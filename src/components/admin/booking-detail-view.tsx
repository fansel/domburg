"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, User, Mail, Users, MessageSquare, Edit, Trash2, 
  Save, X, Send, Clock 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cancelBooking } from "@/app/actions/booking";
import {
  updateBooking,
  sendMessageToGuest,
} from "@/app/actions/booking-management";
import type { Booking, Message, User as UserType } from "@prisma/client";

interface BookingWithMessages extends Booking {
  messages: (Message & {
    user: Pick<UserType, "id" | "name" | "email" | "role"> | null;
  })[];
}

interface BookingDetailViewProps {
  booking: BookingWithMessages;
  currentUser: Pick<UserType, "id" | "name" | "email" | "role">;
}

export function BookingDetailView({
  booking: initialBooking,
  currentUser,
}: BookingDetailViewProps) {
  const [booking, setBooking] = useState(initialBooking);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  const [editData, setEditData] = useState({
    startDate: new Date(booking.startDate).toISOString().split("T")[0],
    endDate: new Date(booking.endDate).toISOString().split("T")[0],
    numberOfGuests: booking.numberOfGuests,
    guestName: booking.guestName || "",
    guestEmail: booking.guestEmail,
    adminNotes: booking.adminNotes || "",
  });

  // Aktualisiere editData wenn booking sich ändert oder Bearbeiten-Modus aktiviert wird
  useEffect(() => {
    if (isEditing) {
      setEditData({
        startDate: new Date(booking.startDate).toISOString().split("T")[0],
        endDate: new Date(booking.endDate).toISOString().split("T")[0],
        numberOfGuests: booking.numberOfGuests,
        guestName: booking.guestName || "",
        guestEmail: booking.guestEmail,
        adminNotes: booking.adminNotes || "",
      });
    }
  }, [booking, isEditing]);

  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateBooking(booking.id, {
      startDate: editData.startDate,
      endDate: editData.endDate,
      numberOfGuests: editData.numberOfGuests,
      guestName: editData.guestName,
      guestEmail: editData.guestEmail,
      adminNotes: editData.adminNotes,
    });

    if (result.success && result.booking) {
      setBooking({...booking, ...result.booking, messages: booking.messages});
      setIsEditing(false);
      toast({
        title: "Gespeichert",
        description: "Buchung wurde erfolgreich aktualisiert",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Fehler beim Speichern",
        variant: "destructive",
      });
    }
    setIsSaving(false);
  };

  const handleCancel = async (reason: string) => {
    const result = await cancelBooking(booking.id, reason);
    if (result.success) {
      window.location.reload();
      toast({
        title: "Storniert",
        description: "Buchung wurde storniert",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setIsSendingMessage(true);
    const result = await sendMessageToGuest(booking.id, newMessage);
    
    if (result.success && result.message) {
      setBooking({
        ...booking,
        messages: [...booking.messages, result.message as any],
      });
      setNewMessage("");
      toast({
        title: "Gesendet",
        description: "Nachricht wurde an den Gast gesendet",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error,
        variant: "destructive",
      });
    }
    setIsSendingMessage(false);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(date));
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      PENDING: { variant: "secondary", label: "Ausstehend" },
      APPROVED: { variant: "default", label: "Bestätigt" },
      REJECTED: { variant: "destructive", label: "Abgelehnt" },
      CANCELLED: { variant: "outline", label: "Storniert" },
    };
    const config = variants[status] || variants.PENDING;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-xl sm:text-2xl truncate">Buchung {booking.bookingCode}</CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                {getStatusBadge(booking.status)}
                <span className="hidden sm:inline">•</span>
                <span className="text-xs sm:text-sm">Erstellt am {formatDate(booking.createdAt)}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isEditing && booking.status !== "CANCELLED" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Bearbeiten</span>
                    <span className="sm:hidden">Edit</span>
                  </Button>
                  <CancelDialog onCancel={handleCancel} />
                </>
              )}
              {isEditing && (
                <>
                  <Button 
                    size="sm" 
                    className="w-full sm:w-auto" 
                    onClick={handleSave} 
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Speichern..." : "Speichern"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setIsEditing(false);
                      setEditData({
                        startDate: new Date(booking.startDate).toISOString().split("T")[0],
                        endDate: new Date(booking.endDate).toISOString().split("T")[0],
                        numberOfGuests: booking.numberOfGuests,
                        guestName: booking.guestName || "",
                        guestEmail: booking.guestEmail,
                        adminNotes: booking.adminNotes || "",
                      });
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Abbrechen
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Gast-Informationen */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Gast-Informationen
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="guestName">Name</Label>
                {isEditing ? (
                  <Input
                    id="guestName"
                    value={editData.guestName}
                    onChange={(e) =>
                      setEditData({ ...editData, guestName: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-sm">{booking.guestName || "Nicht angegeben"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="guestEmail">E-Mail</Label>
                {isEditing ? (
                  <Input
                    id="guestEmail"
                    type="email"
                    value={editData.guestEmail}
                    onChange={(e) =>
                      setEditData({ ...editData, guestEmail: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-sm">{booking.guestEmail}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Buchungsdetails */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Buchungsdetails
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">Anreise</Label>
                {isEditing ? (
                  <Input
                    id="startDate"
                    type="date"
                    value={editData.startDate}
                    onChange={(e) =>
                      setEditData({ ...editData, startDate: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-sm font-medium">{formatDate(booking.startDate)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Abreise</Label>
                {isEditing ? (
                  <Input
                    id="endDate"
                    type="date"
                    value={editData.endDate}
                    onChange={(e) =>
                      setEditData({ ...editData, endDate: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-sm font-medium">{formatDate(booking.endDate)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="numberOfGuests">Anzahl Gäste</Label>
                {isEditing ? (
                  <Input
                    id="numberOfGuests"
                    type="number"
                    min="1"
                    value={editData.numberOfGuests}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        numberOfGuests: parseInt(e.target.value),
                      })
                    }
                  />
                ) : (
                  <p className="text-sm font-medium">{booking.numberOfGuests}</p>
                )}
              </div>
            </div>
            
            {booking.totalPrice && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Gesamtpreis:</span>
                  <span className="text-2xl font-bold">
                    {formatCurrency(parseFloat(booking.totalPrice.toString()))}
                  </span>
                </div>
              </div>
            )}

            {booking.message && (
              <div className="mt-4 space-y-2">
                <Label>Nachricht vom Gast</Label>
                <p className="text-sm p-3 bg-muted rounded-lg">{booking.message}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Admin-Notizen */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Admin-Notizen</h3>
            {isEditing ? (
              <Textarea
                value={editData.adminNotes}
                onChange={(e) =>
                  setEditData({ ...editData, adminNotes: e.target.value })
                }
                placeholder="Interne Notizen..."
                rows={4}
              />
            ) : (
              <p className="text-sm p-3 bg-muted rounded-lg">
                {booking.adminNotes || "Keine Notizen"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chat/Nachrichten */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Kommunikation
          </CardTitle>
          <CardDescription>
            Nachrichten mit dem Gast
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Nachrichtenverlauf */}
          <div className="space-y-3 max-h-64 sm:max-h-96 overflow-y-auto px-1">
            {booking.messages.length === 0 ? (
              <p className="text-xs sm:text-sm text-muted-foreground text-center py-8">
                Noch keine Nachrichten
              </p>
            ) : (
              booking.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.isFromGuest ? "justify-start" : "justify-end"
                  }`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] rounded-lg p-2 sm:p-3 ${
                      message.isFromGuest
                        ? "bg-muted"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
                      <span className="text-[10px] sm:text-xs font-semibold">
                        {message.isFromGuest
                          ? message.senderName || message.senderEmail
                          : "Admin"}
                      </span>
                      <Clock className="h-2 w-2 sm:h-3 sm:w-3" />
                      <span className="text-[10px] sm:text-xs opacity-70">
                        {formatDateTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <Separator />

          {/* Neue Nachricht */}
          <div className="space-y-2">
            <Label htmlFor="newMessage" className="text-xs sm:text-sm">Neue Nachricht an Gast</Label>
            <Textarea
              id="newMessage"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Nachricht an den Gast schreiben... (Gast kann per Email-Antwort zurückschreiben)"
              rows={3}
              className="text-xs sm:text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) {
                  handleSendMessage();
                }
              }}
            />
            <div className="flex justify-between items-center flex-wrap gap-2">
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                📧 Gast erhält Email und kann direkt antworten
              </p>
              <Button
                size="sm"
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || isSendingMessage}
              >
                <Send className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{isSendingMessage ? "Sende..." : "Senden (Ctrl+Enter)"}</span>
                <span className="sm:hidden">{isSendingMessage ? "..." : "Senden"}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Cancel Dialog Component
function CancelDialog({ onCancel }: { onCancel: (reason: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (reason.trim()) {
      onCancel(reason);
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="w-full sm:w-auto">
          <Trash2 className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Stornieren</span>
          <span className="sm:hidden">Cancel</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buchung stornieren</DialogTitle>
          <DialogDescription>
            Sind Sie sicher, dass Sie diese Buchung stornieren möchten?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Grund für die Stornierung</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Bitte geben Sie einen Grund an..."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason.trim()}
          >
            Stornieren bestätigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

