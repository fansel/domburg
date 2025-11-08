import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getCalendarEvents } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());

    // Zeitraum für das Jahr
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    // Hole alle Buchungen für das Jahr
    const bookings = await prisma.booking.findMany({
      where: {
        startDate: { lte: endOfYear },
        endDate: { gte: startOfYear },
        status: { in: ["PENDING", "APPROVED"] }, // Nur aktive Buchungen
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        guestName: true,
        guestEmail: true,
        bookingCode: true,
        guestCode: true,
      },
      orderBy: { startDate: "asc" },
    });

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

    // Hole manuelle Einträge aus Google Calendar
    let manualEntries: Array<{ id: string; summary: string; start: Date; end: Date }> = [];
    try {
      const allEvents = await getCalendarEvents(startOfYear, endOfYear);
      
      // Filtere nur manuelle Einträge (keine App-Buchungen, keine Info-Events)
      manualEntries = allEvents
        .filter((event) => {
          // Prüfe ob Event-ID in der Datenbank verlinkt ist
          if (event.id && appBookingEventIds.has(event.id)) {
            return false; // Es ist eine App-Buchung
          }
          
          // Prüfe Titel-Format (App-Buchungen beginnen immer mit "Buchung:")
          const isAppBooking = event.summary?.startsWith("Buchung:") || 
                               event.summary?.includes("🏠") ||
                               event.summary?.match(/\d+€\/\d+€/);
          
          // Info-Events (colorId: '10') werden NICHT berücksichtigt
          const isInfoColor = event.colorId === '10';
          
          return !isAppBooking && !isInfoColor;
        })
        .map((event) => ({
          id: event.id || `manual-${event.summary}-${event.start.getTime()}`,
          summary: event.summary || "Unbekannt",
          start: event.start,
          end: event.end,
        }));
    } catch (error) {
      console.error("Error loading calendar events:", error);
    }

    // Kombiniere Buchungen und manuelle Einträge
    const allItems = [
      ...bookings.map((booking) => ({
        id: booking.id,
        type: "booking" as const,
        startDate: booking.startDate,
        endDate: booking.endDate,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        bookingCode: booking.bookingCode,
        defaultUseFamilyPrice: false, // Buchungen standardmäßig Normal
      })),
      ...manualEntries.map((entry) => ({
        id: entry.id,
        type: "manual" as const,
        startDate: entry.start,
        endDate: entry.end,
        summary: entry.summary,
        defaultUseFamilyPrice: true, // Manuelle Einträge standardmäßig Family
      })),
    ];

    return NextResponse.json({
      success: true,
      bookings: allItems,
    });
  } catch (error: any) {
    console.error("Error loading statistics:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Statistiken" },
      { status: 500 }
    );
  }
}

