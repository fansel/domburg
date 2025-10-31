"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Send, Clock, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sendMessageToGuest } from "@/app/actions/booking-management";
import { formatDateTime, formatDate } from "@/lib/utils";
import { BookingDetailView } from "@/components/admin/booking-detail-view";
import type { Booking, Message, User as UserType } from "@prisma/client";
import { useRouter } from "next/navigation";

interface BookingWithMessages extends Booking {
  messages: (Message & {
    user: Pick<UserType, "id" | "name" | "email" | "role"> | null;
  })[];
}

interface ChatViewProps {
  booking: BookingWithMessages;
  currentUser: {
    id: string;
    email: string;
    name?: string | null;
    role: string;
  };
}

export function ChatView({ booking: initialBooking, currentUser }: ChatViewProps) {
  const [booking, setBooking] = useState(initialBooking);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [booking.messages]);

  // Refresh booking data periodically to get new messages
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [router]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setIsSendingMessage(true);
    try {
      const result = await sendMessageToGuest(booking.id, newMessage.trim());
      
      if (result.success && result.message) {
        setNewMessage("");
        // Update booking with new message
        setBooking({
          ...booking,
          messages: [...booking.messages, result.message as any],
          updatedAt: new Date(),
        });
        toast({
          title: "Nachricht gesendet",
          description: "Die Nachricht wurde erfolgreich versendet.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: result.error || "Fehler beim Senden der Nachricht",
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten",
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const startDate = new Date(booking.startDate);
  const endDate = new Date(booking.endDate);

  return (
    <>
      <div className="max-w-4xl mx-auto">
        {/* Header - Clickable to open booking details */}
        <Card 
          className="mb-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsDetailDialogOpen(true)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-lg font-semibold truncate">
                    {booking.guestName || booking.guestEmail.split("@")[0]}
                  </h2>
                  <span className="text-xs text-muted-foreground font-mono">
                    {booking.bookingCode}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(startDate)} - {formatDate(endDate)}
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            {/* Messages */}
            <div className="space-y-4 mb-6 max-h-[calc(100vh-300px)] overflow-y-auto px-1">
              {booking.messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Noch keine Nachrichten</p>
                  <p className="text-sm mt-2">Schreibe die erste Nachricht an den Gast</p>
                </div>
              ) : (
                <>
                  {booking.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.isFromGuest ? "justify-start" : "justify-end"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[70%] rounded-lg p-3 ${
                          message.isFromGuest
                            ? "bg-muted"
                            : "bg-primary text-primary-foreground"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-semibold">
                            {message.isFromGuest
                              ? message.senderName || message.senderEmail
                              : "Admin"}
                          </span>
                          <Clock className="h-3 w-3" />
                          <span className="text-xs opacity-70">
                            {formatDateTime(message.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="chatMessage">Nachricht schreiben</Label>
              <Textarea
                id="chatMessage"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Nachricht an den Gast schreiben..."
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    handleSendMessage();
                  }
                }}
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  Gast erhält Email und kann direkt antworten (Ctrl+Enter zum Senden)
                </p>
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || isSendingMessage}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSendingMessage ? "Sende..." : "Senden"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Booking Details Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col p-0">
          <div className="p-6 pb-4 flex-shrink-0 border-b">
            <DialogHeader>
              <DialogTitle>Buchungsdetails</DialogTitle>
              <DialogDescription>
                Alle Informationen zur Buchung
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            <BookingDetailView booking={booking} currentUser={currentUser} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

