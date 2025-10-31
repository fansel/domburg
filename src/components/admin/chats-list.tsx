"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { formatDateTime, formatRelativeTime, formatDate } from "@/lib/utils";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Chat {
  id: string;
  bookingCode: string;
  guestName: string;
  guestEmail: string;
  startDate: Date;
  endDate: Date;
  lastMessage: {
    content: string;
    createdAt: Date;
    isFromGuest: boolean;
  } | null;
  unreadCount: number;
  totalMessages: number;
  updatedAt: Date;
}

interface ChatsListProps {
  chats: Chat[];
}

// Generiere Akronym aus Name (z.B. "Andre Bauer" -> "AB")
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  if (words[0].length >= 2) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words[0][0].toUpperCase();
}

export function ChatsList({ chats }: ChatsListProps) {
  const router = useRouter();

  if (chats.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Keine Chats</h3>
          <p className="text-muted-foreground text-center">
            Es wurden noch keine Nachrichten ausgetauscht
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-1">
      {chats.map((chat) => {
        const initials = getInitials(chat.guestName);
        const lastMessagePreview = chat.lastMessage
          ? chat.lastMessage.content.length > 60
            ? chat.lastMessage.content.substring(0, 60) + "..."
            : chat.lastMessage.content
          : "Keine Nachrichten";

        return (
          <Link
            key={chat.id}
            href={`/admin/chats/${chat.id}`}
            className="block"
          >
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-4 p-4">
                {/* Avatar mit Initialen */}
                <div
                  className={cn(
                    "flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold text-primary-foreground",
                    chat.unreadCount > 0
                      ? "bg-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {initials}
                </div>

                {/* Chat Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm sm:text-base truncate">
                        {chat.guestName}
                      </h3>
                      {chat.unreadCount > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                          {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
                        </span>
                      )}
                    </div>
                    {chat.lastMessage && (
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {formatRelativeTime(chat.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(chat.startDate)} - {formatDate(chat.endDate)}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {chat.bookingCode}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "text-sm truncate",
                        chat.unreadCount > 0
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      {!chat.lastMessage?.isFromGuest && (
                        <span className="text-muted-foreground">Du: </span>
                      )}
                      {lastMessagePreview}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

