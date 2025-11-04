import { redirect } from "next/navigation";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
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

  if (!user || !hasAdminRights(user.role)) {
    redirect("/");
  }

  // Prüfe ob User Buchungen sehen darf
  // getCurrentUser() liefert bereits canSeeBookings, aber TypeScript erkennt es nicht
  // Verwende Type-Assertion um auf die Property zuzugreifen
  type UserWithPermissions = typeof user & { canSeeBookings: boolean };
  const userWithPermissions = user as UserWithPermissions;
  
  if (!userWithPermissions.canSeeBookings) {
    redirect("/");
  }

  // Lade alle Buchungen (inklusive vergangener Buchungen)
  let allBookings = await prisma.booking.findMany({
    where: {
      status: {
        in: ["PENDING", "APPROVED"],
      },
      // Keine Filterung nach Datum - lade ALLE Buchungen
    },
    orderBy: {
      startDate: "asc",
    },
  });

  // Filtere Teilbuchungen heraus (Buchungen die vollständig innerhalb einer größeren Buchung liegen)
  // Sortiere nach Dauer (längste zuerst), damit größere Buchungen zuerst geprüft werden
  const sortedBookings = [...allBookings].sort((a, b) => {
    const durationA = new Date(a.endDate).getTime() - new Date(a.startDate).getTime();
    const durationB = new Date(b.endDate).getTime() - new Date(b.startDate).getTime();
    return durationB - durationA; // Längste zuerst
  });

  const bookings: typeof allBookings = [];
  const excludedIds = new Set<string>();

  for (let i = 0; i < sortedBookings.length; i++) {
    const booking = sortedBookings[i];
    
    // Wenn diese Buchung bereits als Teilbuchung markiert wurde, überspringe sie
    if (excludedIds.has(booking.id)) {
      continue;
    }

    // Prüfe ob diese Buchung vollständig innerhalb einer anderen liegt
    let isContained = false;
    for (let j = 0; j < sortedBookings.length; j++) {
      if (i === j || excludedIds.has(sortedBookings[j].id)) continue;
      
      const otherBooking = sortedBookings[j];
      
      // Normalisiere Daten für Vergleich
      const bookingStart = new Date(booking.startDate);
      bookingStart.setHours(0, 0, 0, 0);
      const bookingEnd = new Date(booking.endDate);
      bookingEnd.setHours(0, 0, 0, 0);
      
      const otherStart = new Date(otherBooking.startDate);
      otherStart.setHours(0, 0, 0, 0);
      const otherEnd = new Date(otherBooking.endDate);
      otherEnd.setHours(0, 0, 0, 0);
      
      // Prüfe ob booking vollständig innerhalb otherBooking liegt
      if (bookingStart >= otherStart && bookingEnd <= otherEnd) {
        isContained = true;
        excludedIds.add(booking.id);
        break;
      }
    }

    // Wenn nicht enthalten, füge zur Liste hinzu
    if (!isContained) {
      bookings.push(booking);
    }
  }

  // Serialisiere Bookings für Client Component (Decimal zu String konvertieren)
  const serializedBookings = bookings.map((booking) => ({
    ...booking,
    startDate: booking.startDate,
    endDate: booking.endDate,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    approvedAt: booking.approvedAt,
    rejectedAt: booking.rejectedAt,
    cancelledAt: booking.cancelledAt,
    totalPrice: booking.totalPrice?.toString() || null,
    pricingDetails: booking.pricingDetails ? JSON.parse(JSON.stringify(booking.pricingDetails)) : null,
  }));

  // Lade blockierte Termine aus Google Calendar 
  // Erweiterten Zeitraum: 12 Monate zurück bis 24 Monate voraus
  const today = new Date();
  const twelveMonthsAgo = new Date(today);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const twentyFourMonthsLater = new Date(today);
  twentyFourMonthsLater.setMonth(twentyFourMonthsLater.getMonth() + 24);
  
  // Hole alle Buchungen mit googleEventId aus der Datenbank
  const bookingsWithEventId = await prisma.booking.findMany({
    where: {
      googleEventId: { not: null },
    },
    select: {
      googleEventId: true,
    },
  });
  const appBookingEventIds = new Set(
    bookingsWithEventId
      .map((b) => b.googleEventId)
      .filter((id): id is string => id !== null)
  );
  
  let calendarEvents: Array<{ id: string; summary: string; start: Date; end: Date; colorId?: string }> = [];
  try {
    const allEvents = await getCalendarEvents(twelveMonthsAgo, twentyFourMonthsLater);
    
    // Filtere nur manuelle Einträge (keine App-Buchungen, keine Info-Events)
    // Eine App-Buchung ist identifizierbar durch:
    // 1. Hat eine googleEventId die in der Datenbank verlinkt ist, ODER
    // 2. Beginnt mit "Buchung:" (genaues Format wie bei der Erstellung), ODER
    // 3. Enthält das 🏠 Emoji, ODER
    // 4. Enthält Preis-Format (z.B. "100€/200€")
    calendarEvents = allEvents.filter(event => {
      // Prüfe ob Event-ID in der Datenbank verlinkt ist
      if (event.id && appBookingEventIds.has(event.id)) {
        return false; // Es ist eine App-Buchung
      }
      
      // Prüfe Titel-Format (App-Buchungen beginnen immer mit "Buchung:")
      const isOwnBooking = event.summary?.startsWith("Buchung:") || 
                           event.summary?.includes("🏠") ||
                           event.summary?.match(/\d+€\/\d+€/); // Preis-Einträge
      
      // Info-Events (colorId: '10') werden NICHT im Kalender angezeigt
      const infoColorIds = ['10'];
      const isInfoColor = event.colorId && infoColorIds.includes(event.colorId);
      
      return !isOwnBooking && !isInfoColor;
    });
  } catch (error) {
    console.error('Could not load calendar events:', error);
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-6xl lg:max-w-[85%] xl:max-w-[1200px]">
        <BackButton href="/admin/bookings" />

        <PageHeader
          title="calendar.bookingCalendar"
          description="calendar.overviewDescription"
          icon={<CalendarIcon className="h-8 w-8" />}
        />

        <BookingCalendarView 
          bookings={serializedBookings} 
          calendarEvents={calendarEvents}
          initialMonth={searchParams?.month ? parseInt(searchParams.month) - 1 : undefined}
          initialYear={searchParams?.year ? parseInt(searchParams.year) : undefined}
        />
      </div>
    </div>
  );
}

