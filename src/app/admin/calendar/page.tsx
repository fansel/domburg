import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Navbar } from "@/components/navbar";
import { BookingCalendarView } from "@/components/admin/booking-calendar-view";
import { Calendar as CalendarIcon } from "lucide-react";
import { getCalendarEvents } from "@/lib/google-calendar";
import { BackButton } from "@/components/admin/back-button";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable caching

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }

  // Lade alle Buchungen
  const bookings = await prisma.booking.findMany({
    where: {
      status: {
        in: ["PENDING", "APPROVED"],
      },
    },
    orderBy: {
      startDate: "asc",
    },
  });

  // Lade blockierte Termine aus Google Calendar (3 Monate zurück bis 6 Monate voraus)
  const today = new Date();
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const sixMonthsLater = new Date(today);
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
  
  let calendarEvents: Array<{ id: string; summary: string; start: Date; end: Date; colorId?: string }> = [];
  try {
    const allEvents = await getCalendarEvents(threeMonthsAgo, sixMonthsLater);
    console.log(`📅 Loaded ${allEvents.length} events from Google Calendar`);
    
    // Filtere nach Farbe und eigenen Buchungen
    calendarEvents = allEvents.filter(event => {
      // 1. Eigene Buchungen der App (blockieren nicht)
      const isOwnBooking = event.summary.includes('Buchung:');
      
      // 2. Google Calendar Farben-Filter
      // Farb-IDs in Google Calendar:
      // 1=Lavendel, 2=Salbei, 3=Traube, 4=Flamingo, 5=Banane, 
      // 6=Mandarine, 7=Pfau, 8=Graphit, 9=Blaubeere, 10=Basilikum, 11=Tomate
      // Farbe 10 (Basilikum/Grün) = Info-Events (blockieren nicht)
      const infoColorIds = ['10']; // Grün für Info-Events
      const isInfoColor = event.colorId && infoColorIds.includes(event.colorId);
      
      const isBlocking = !isOwnBooking && !isInfoColor;
      
      console.log(`Event: "${event.summary}" (color: ${event.colorId || 'default'}) - own: ${isOwnBooking}, infoColor: ${isInfoColor}, blocking: ${isBlocking}`);
      
      return isBlocking;
    });
    
    console.log(`🔒 Showing ${calendarEvents.length} blocking events`);
  } catch (error) {
    console.warn('Could not load calendar events:', error);
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-8">
        <BackButton href="/admin/bookings" />

        <PageHeader
          title="calendar.bookingCalendar"
          description="calendar.overviewDescription"
          icon={<CalendarIcon className="h-8 w-8" />}
        />

        <BookingCalendarView 
          bookings={bookings} 
          calendarEvents={calendarEvents}
          initialMonth={searchParams?.month ? parseInt(searchParams.month) - 1 : undefined}
          initialYear={searchParams?.year ? parseInt(searchParams.year) : undefined}
        />
      </div>
    </div>
  );
}

