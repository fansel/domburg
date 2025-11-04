import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import { updateCalendarEvent } from "@/lib/google-calendar";
import { getBookingColorId } from "@/lib/utils";
import prisma from "@/lib/prisma";
import { resetConflictNotificationsForEvents } from "@/lib/booking-conflicts";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { eventIds } = await request.json();

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length < 2) {
      return NextResponse.json(
        { success: false, error: "Mindestens 2 eventIds sind erforderlich" },
        { status: 400 }
      );
    }

    // Prüfe ob Events interne Buchungen sind (über googleEventId verlinkt)
    // Nur manuelle Events dürfen getrennt werden
    const prisma = (await import("@/lib/prisma")).default;
    const bookings = await prisma.booking.findMany({
      where: {
        googleEventId: { in: eventIds },
      },
      select: {
        googleEventId: true,
      },
    });
    const appBookingEventIds = new Set(
      bookings
        .map((b) => b.googleEventId)
        .filter((id): id is string => id !== null)
    );

    // Prüfe ob eines der Events eine interne Buchung ist
    const hasAppBooking = eventIds.some(id => appBookingEventIds.has(id));
    if (hasAppBooking) {
      return NextResponse.json(
        { success: false, error: "Automatisch erstellte Buchungen können nicht getrennt werden" },
        { status: 400 }
      );
    }

    // Weise jedem Event eine einzigartige Farbe zu (basierend auf Event-ID)
    const updatePromises = eventIds.map(eventId => {
      const uniqueColorId = getBookingColorId(eventId);
      return updateCalendarEvent(eventId, {
        colorId: uniqueColorId,
      });
    });

    await Promise.all(updatePromises);

    // Entferne alle Verlinkungen zwischen diesen Events aus der Datenbank
    // Lösche alle Verlinkungen die eines dieser Events enthalten
    await prisma.linkedCalendarEvent.deleteMany({
      where: {
        OR: [
          { eventId1: { in: eventIds } },
          { eventId2: { in: eventIds } },
        ],
      },
    });

    // Setze Benachrichtigungen für Konflikte zurück, die diese Events betreffen
    // (damit der Konflikt erneut benachrichtigt werden kann, wenn er weiterhin besteht)
    await resetConflictNotificationsForEvents(eventIds);

    // Prüfe auf Konflikte nach dem Trennen (Farbe ändern kann Konflikte beeinflussen)
    const { checkAndNotifyConflictsForCalendarEvent } = await import("@/lib/booking-conflicts");
    
    // Prüfe alle Events auf Konflikte
    Promise.all(
      eventIds.map(eventId => 
        checkAndNotifyConflictsForCalendarEvent(eventId).catch(error => {
          console.error(`[Calendar] Error checking conflicts after ungrouping event ${eventId}:`, error);
        })
      )
    ).catch(() => {
      // Fehler nicht weiterwerfen
    });

    return NextResponse.json({
      success: true,
      message: `${eventIds.length} Events wurden getrennt (jedes hat jetzt eine eigene Farbe)`,
    });
  } catch (error: any) {
    console.error("Error ungrouping calendar events:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Trennen der Events" },
      { status: 500 }
    );
  }
}

