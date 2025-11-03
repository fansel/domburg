import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import { updateCalendarEvent } from "@/lib/google-calendar";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { eventIds, colorId } = await request.json();

    // Unterstütze beide Formate: einzelnes eventId oder Array von eventIds
    const eventIdArray = eventIds || (eventId ? [eventId] : []);
    
    if (!colorId || eventIdArray.length === 0) {
      return NextResponse.json(
        { success: false, error: "eventIds (Array) und colorId sind erforderlich" },
        { status: 400 }
      );
    }

    // Prüfe ob es eine interne Buchung ist (über googleEventId verlinkt)
    // Nur manuelle Events dürfen gruppiert werden
    const bookings = await prisma.booking.findMany({
      where: {
        googleEventId: { in: eventIdArray },
      },
    });

    if (bookings.length > 0) {
      // Es ist eine interne Buchung - keine Gruppierung erlaubt
      return NextResponse.json(
        { success: false, error: "Automatisch erstellte Buchungen können nicht gruppiert werden" },
        { status: 400 }
      );
    }

    // Update alle Events mit der gleichen Farbe
    await Promise.all(
      eventIdArray.map(eventId =>
        updateCalendarEvent(eventId, { colorId })
      )
    );

    // Speichere Verlinkungen in der Datenbank (alle Events miteinander verlinken)
    // Erstelle Verlinkungen zwischen allen Event-Paaren
    const linkPromises: Promise<any>[] = [];
    for (let i = 0; i < eventIdArray.length; i++) {
      for (let j = i + 1; j < eventIdArray.length; j++) {
        const eventId1 = eventIdArray[i];
        const eventId2 = eventIdArray[j];
        // Sortiere IDs für konsistente Speicherung
        const [id1, id2] = [eventId1, eventId2].sort();
        
        linkPromises.push(
          prisma.linkedCalendarEvent.upsert({
            where: {
              eventId1_eventId2: {
                eventId1: id1,
                eventId2: id2,
              },
            },
            create: {
              eventId1: id1,
              eventId2: id2,
              createdBy: user.id,
            },
            update: {}, // Update nichts, nur erstellen wenn nicht vorhanden
          })
        );
      }
    }
    await Promise.all(linkPromises);

    // Prüfe auf Konflikte nach dem Gruppieren (Farbe ändern kann Konflikte beeinflussen)
    const { checkAndNotifyConflictsForCalendarEvent } = await import("@/lib/booking-conflicts");
    
    Promise.all(
      eventIdArray.map(eventId =>
        checkAndNotifyConflictsForCalendarEvent(eventId).catch(error => {
          console.error(`[Calendar] Error checking conflicts after grouping event ${eventId}:`, error);
        })
      )
    ).catch(() => {
      // Fehler nicht weiterwerfen
    });

    return NextResponse.json({
      success: true,
      message: `${eventIdArray.length} Events wurden zusammengelegt`,
    });
  } catch (error: any) {
    console.error("Error grouping calendar event:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Zusammenlegen der Events" },
      { status: 500 }
    );
  }
}

