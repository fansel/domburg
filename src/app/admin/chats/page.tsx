import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import prisma from "@/lib/prisma";
import { ChatsList } from "@/components/admin/chats-list";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function AdminChatsPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }

  // Lade alle Bookings mit Messages, sortiert nach letzter Nachricht
  const bookingsWithMessages = await prisma.booking.findMany({
    where: {
      messages: {
        some: {},
      },
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1, // Nur die letzte Nachricht
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  // Berechne für jede Buchung die Anzahl ungelesener Nachrichten
  const chats = await Promise.all(
    bookingsWithMessages.map(async (booking) => {
      // Zähle ungelesene Nachrichten (von Gästen, die noch nicht gelesen wurden)
      const unreadCount = await prisma.message.count({
        where: {
          bookingId: booking.id,
          isFromGuest: true,
          readAt: null,
        },
      });

      const lastMessage = booking.messages[0];
      
      return {
        id: booking.id,
        bookingCode: booking.bookingCode,
        guestName: booking.guestName || booking.guestEmail.split("@")[0],
        guestEmail: booking.guestEmail,
        startDate: booking.startDate,
        endDate: booking.endDate,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              createdAt: lastMessage.createdAt,
              isFromGuest: lastMessage.isFromGuest,
            }
          : null,
        unreadCount,
        totalMessages: booking._count.messages,
        updatedAt: booking.updatedAt,
      };
    })
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-8">
        <PageHeader
          title="admin.chats"
          description="admin.chatsDescription"
          icon={<MessageSquare className="h-8 w-8" />}
        />

        <ChatsList chats={chats} />
      </div>
    </div>
  );
}

