import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import { getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    // Hole ALLE Einträge aus dem Calendar (inkl. Info-Events mit colorId=10)
    const allEvents = await getCalendarEvents(
      new Date(new Date().setMonth(new Date().getMonth() - 1)),
      new Date(new Date().setFullYear(new Date().getFullYear() + 2))
    );

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

    // Filtere nur manuelle Einträge (keine App-Buchungen)
    // Eine App-Buchung ist identifizierbar durch:
    // 1. Hat eine googleEventId die in der Datenbank verlinkt ist, ODER
    // 2. Beginnt mit "Buchung:" (genaues Format wie bei der Erstellung), ODER
    // 3. Enthält das 🏠 Emoji, ODER
    // 4. Enthält Preis-Format (z.B. "100€/200€")
    const manualBookings = allEvents.filter((date) => {
      // Prüfe ob Event-ID in der Datenbank verlinkt ist
      if (date.id && appBookingEventIds.has(date.id)) {
        return false; // Es ist eine App-Buchung
      }
      
      // Prüfe Titel-Format (App-Buchungen beginnen immer mit "Buchung:")
      const isAppBooking = date.summary?.startsWith("Buchung:") || 
                           date.summary?.includes("🏠") ||
                           date.summary?.match(/\d+€\/\d+€/); // Preis-Einträge
      
      return !isAppBooking;
    });

    // Hole alle Verlinkungen für diese Events
    const eventIds = manualBookings.map(b => b.id);
    const linkedEvents = await prisma.linkedCalendarEvent.findMany({
      where: {
        OR: [
          { eventId1: { in: eventIds } },
          { eventId2: { in: eventIds } },
        ],
      },
    });

    // Erstelle eine Map: eventId -> Array von verlinkten Event-IDs
    const linkedEventMap = new Map<string, string[]>();
    linkedEvents.forEach(link => {
      // Füge beide Richtungen hinzu
      if (!linkedEventMap.has(link.eventId1)) {
        linkedEventMap.set(link.eventId1, []);
      }
      if (!linkedEventMap.has(link.eventId2)) {
        linkedEventMap.set(link.eventId2, []);
      }
      linkedEventMap.get(link.eventId1)!.push(link.eventId2);
      linkedEventMap.get(link.eventId2)!.push(link.eventId1);
    });

    // Automatische Verlinkung: Events mit gleicher Farbe + mehr als 1 Tag Überschneidung
    // Prüfe alle Event-Paare
    const newLinks: Array<{ eventId1: string; eventId2: string }> = [];
    const processedPairs = new Set<string>();
    
    for (let i = 0; i < manualBookings.length; i++) {
      const event1 = manualBookings[i];
      if (event1.colorId === '10' || !event1.colorId) continue; // Info-Events überspringen
      
      const event1Start = new Date(event1.start);
      const event1End = new Date(event1.end);
      
      for (let j = i + 1; j < manualBookings.length; j++) {
        const event2 = manualBookings[j];
        if (event2.colorId === '10' || !event2.colorId) continue; // Info-Events überspringen
        if (event1.colorId !== event2.colorId) continue; // Verschiedene Farben überspringen
        
        // Prüfe ob Events bereits verlinkt sind
        const pairKey = [event1.id, event2.id].sort().join('-');
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);
        
        const alreadyLinked = linkedEventMap.get(event1.id)?.includes(event2.id) || 
                             linkedEventMap.get(event2.id)?.includes(event1.id);
        if (alreadyLinked) continue;
        
        // Prüfe Überlappung: mehr als 1 Tag
        const event2Start = new Date(event2.start);
        const event2End = new Date(event2.end);
        
        // Normalisiere auf Tagesanfang für Vergleich
        const normalizeDate = (date: Date) => {
          const d = new Date(date);
          d.setHours(0, 0, 0, 0);
          return d;
        };
        
        const s1 = normalizeDate(event1Start);
        const e1 = normalizeDate(event1End);
        const s2 = normalizeDate(event2Start);
        const e2 = normalizeDate(event2End);
        
        // Prüfe ob Events sich überlappen
        if (s1 <= e2 && s2 <= e1) {
          // Berechne die tatsächliche Überlappung in Tagen
          const overlapStart = s1 > s2 ? s1 : s2;
          const overlapEnd = e1 < e2 ? e1 : e2;
          const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
          
          // Mehr als 1 Tag Überschneidung = automatisch verlinken
          if (overlapDays > 1) {
            const [id1, id2] = [event1.id, event2.id].sort();
            newLinks.push({ eventId1: id1, eventId2: id2 });
          }
        }
      }
    }
    
    // Speichere neue automatische Verlinkungen in der DB
    if (newLinks.length > 0) {
      await Promise.all(
        newLinks.map(link =>
          prisma.linkedCalendarEvent.upsert({
            where: {
              eventId1_eventId2: {
                eventId1: link.eventId1,
                eventId2: link.eventId2,
              },
            },
            create: {
              eventId1: link.eventId1,
              eventId2: link.eventId2,
              createdBy: null, // Automatisch erkannt
            },
            update: {}, // Update nichts, nur erstellen wenn nicht vorhanden
          })
        )
      );
      
      // Lade Verlinkungen neu nach dem Speichern
      const updatedLinkedEvents = await prisma.linkedCalendarEvent.findMany({
        where: {
          OR: [
            { eventId1: { in: eventIds } },
            { eventId2: { in: eventIds } },
          ],
        },
      });
      
      // Aktualisiere linkedEventMap
      linkedEventMap.clear();
      updatedLinkedEvents.forEach(link => {
        if (!linkedEventMap.has(link.eventId1)) {
          linkedEventMap.set(link.eventId1, []);
        }
        if (!linkedEventMap.has(link.eventId2)) {
          linkedEventMap.set(link.eventId2, []);
        }
        linkedEventMap.get(link.eventId1)!.push(link.eventId2);
        linkedEventMap.get(link.eventId2)!.push(link.eventId1);
      });
    }

    return NextResponse.json({
      success: true,
      bookings: manualBookings.map((booking) => ({
        id: booking.id,
        summary: booking.summary,
        start: booking.start.toISOString(),
        end: booking.end.toISOString(),
        colorId: booking.colorId,
        isInfo: booking.colorId === '10', // colorId=10 = Grün = Info
        linkedEventIds: linkedEventMap.get(booking.id) || [], // Array von verlinkten Event-IDs
      })),
    });
  } catch (error: any) {
    console.error("Error loading calendar bookings:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Laden der Kalender-Buchungen" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { summary, start, end, isInfo } = await request.json();

    if (!summary || !start || !end) {
      return NextResponse.json(
        { success: false, error: "Titel und Zeitraum sind erforderlich" },
        { status: 400 }
      );
    }

    // Erstelle Event in Google Calendar
    const eventId = await createCalendarEvent({
      summary,
      startDate: new Date(start),
      endDate: new Date(end),
      description: isInfo ? "Info-Eintrag (nicht blockierend)" : "Manuelle Blockierung",
    });

    // Setze colorId automatisch basierend auf Event-ID (wie bei normalen Buchungen)
    if (eventId) {
      const { getBookingColorId } = await import("@/lib/utils");
      
      let autoColorId: string;
      if (isInfo) {
        autoColorId = '10'; // Info = Farbe 10
      } else {
        // Prüfe ob im gleichen Zeitraum bereits Events existieren
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        // Hole alle Events im erweiterten Zeitraum (etwas vor/nach dem Zeitraum für Überlappungsprüfung)
        const checkStartDate = new Date(startDate);
        checkStartDate.setDate(checkStartDate.getDate() - 1);
        const checkEndDate = new Date(endDate);
        checkEndDate.setDate(checkEndDate.getDate() + 1);
        
        const existingEvents = await getCalendarEvents(checkStartDate, checkEndDate);
        
        // Filtere nur manuelle Blockierungen (keine App-Buchungen, keine Info-Events)
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
        
        const manualBlockings = existingEvents.filter((event) => {
          // Überspringe das gerade erstellte Event
          if (event.id === eventId) return false;
          
          // Prüfe ob Event-ID in der Datenbank verlinkt ist
          if (event.id && appBookingEventIds.has(event.id)) {
            return false;
          }
          
          // Prüfe Titel-Format (App-Buchungen beginnen immer mit "Buchung:")
          const isAppBooking = event.summary?.startsWith("Buchung:") || 
                               event.summary?.includes("🏠") ||
                               event.summary?.match(/\d+€\/\d+€/);
          
          if (isAppBooking) return false;
          if (event.colorId === '10') return false; // Info-Events überspringen
          
          return true;
        });
        
        // Prüfe welche Events mit dem neuen Event überlappen
        const normalizeDate = (date: Date) => {
          const d = new Date(date);
          d.setHours(0, 0, 0, 0);
          return d;
        };
        
        const newEventStart = normalizeDate(startDate);
        const newEventEnd = normalizeDate(endDate);
        
        const overlappingEvents = manualBlockings.filter((existingEvent) => {
          const existingStart = normalizeDate(existingEvent.start);
          const existingEnd = normalizeDate(existingEvent.end);
          
          // Prüfe ob Events sich überlappen
          return newEventStart <= existingEnd && existingStart <= newEventEnd;
        });
        
        // Sammle alle verwendeten Farben der überlappenden Events
        const usedColors = new Set<string>();
        overlappingEvents.forEach((event) => {
          if (event.colorId && event.colorId !== '10') {
            usedColors.add(event.colorId);
          }
        });
        
        // Verfügbare Farben
        const availableColors = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '11'];
        
        // Wähle eine Farbe, die nicht verwendet wird
        let selectedColor = getBookingColorId(eventId); // Standard-Farbe basierend auf Event-ID
        
        // Wenn die Standard-Farbe bereits verwendet wird, wähle eine andere
        if (usedColors.has(selectedColor) && usedColors.size < availableColors.length) {
          // Finde erste verfügbare Farbe
          for (const color of availableColors) {
            if (!usedColors.has(color)) {
              selectedColor = color;
              break;
            }
          }
        }
        
        autoColorId = selectedColor;
      }
      
      await updateCalendarEvent(eventId, {
        colorId: autoColorId,
      });
    }

    // Prüfe auf Konflikte nach dem Erstellen (nur wenn nicht Info-Event)
    if (eventId && !isInfo) {
      const { checkAndNotifyConflictsForCalendarEvent } = await import("@/lib/booking-conflicts");
      
      // Prüfe alle Konflikte und benachrichtige wenn nötig
      checkAndNotifyConflictsForCalendarEvent(eventId).catch(error => {
        console.error("[Calendar] Error checking conflicts after manual event creation:", error);
        // Fehler nicht weiterwerfen, damit Event-Erstellung erfolgreich bleibt
      });
    }

    return NextResponse.json({
      success: true,
      message: "Kalendereintrag wurde erstellt",
      eventId,
    });
  } catch (error: any) {
    console.error("Error creating calendar booking:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Erstellen des Kalendereintrags" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { id, summary, start, end, isInfo } = await request.json();

    if (!id || !summary || !start || !end) {
      return NextResponse.json(
        { success: false, error: "Alle Felder sind erforderlich" },
        { status: 400 }
      );
    }

    // Update Event in Google Calendar
    // Behalte die bestehende Farbe, es sei denn es ist ein Info-Event (dann Farbe 10)
    const { getBookingColorId } = await import("@/lib/utils");
    const autoColorId = isInfo ? '10' : getBookingColorId(id); // Info = Farbe 10, sonst automatisch basierend auf Event-ID
    
    await updateCalendarEvent(id, {
      summary,
      startDate: new Date(start),
      endDate: new Date(end),
      description: isInfo ? "Info-Eintrag (nicht blockierend)" : "Manuelle Blockierung",
      colorId: autoColorId,
    });

    // Prüfe auf Konflikte nach dem Update (nur wenn nicht Info-Event und Datum geändert wurde)
    if (!isInfo) {
      const { checkAndNotifyConflictsForCalendarEvent } = await import("@/lib/booking-conflicts");
      
      checkAndNotifyConflictsForCalendarEvent(id).catch(error => {
        console.error("[Calendar] Error checking conflicts after manual event update:", error);
        // Fehler nicht weiterwerfen, damit Event-Update erfolgreich bleibt
      });
    }

    return NextResponse.json({
      success: true,
      message: "Kalendereintrag wurde aktualisiert",
    });
  } catch (error: any) {
    console.error("Error updating calendar booking:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Aktualisieren des Kalendereintrags" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Event-ID ist erforderlich" },
        { status: 400 }
      );
    }

    // Prüfe ob es eine interne Buchung ist (über googleEventId verlinkt)
    const booking = await prisma.booking.findUnique({
      where: { googleEventId: id },
    });

    if (booking) {
      // Es ist eine interne Buchung - storniere sie statt nur das Calendar Event zu löschen
      // Google Calendar Event löschen
      await deleteCalendarEvent(id);

      // Buchung stornieren
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "Vom Admin aus dem Kalender gelöscht",
        },
      });

      // Activity Log
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "BOOKING_CANCELLED",
          entity: "Booking",
          entityId: booking.id,
          details: { reason: "Vom Admin aus dem Kalender gelöscht", calendarEventId: id },
        },
      });

      // Lösche alle Konflikteinträge die dieses Event enthalten
      await prisma.ignoredConflict.deleteMany({
        where: {
          OR: [
            { conflictKey: { contains: id } }, // Event-ID ist Teil des conflictKey
          ],
          conflictType: { in: ["OVERLAPPING_CALENDAR_EVENTS", "CALENDAR_CONFLICT"] },
        },
      });

      await prisma.notifiedConflict.deleteMany({
        where: {
          OR: [
            { conflictKey: { contains: id } }, // Event-ID ist Teil des conflictKey
          ],
          conflictType: { in: ["OVERLAPPING_CALENDAR_EVENTS", "CALENDAR_CONFLICT"] },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Buchung wurde storniert",
        bookingCancelled: true,
      });
    } else {
      // Es ist ein externes Event - nur aus Google Calendar löschen
    await deleteCalendarEvent(id);

      // Lösche alle Konflikteinträge die dieses Event enthalten
      await prisma.ignoredConflict.deleteMany({
        where: {
          OR: [
            { conflictKey: { contains: id } }, // Event-ID ist Teil des conflictKey
          ],
          conflictType: { in: ["OVERLAPPING_CALENDAR_EVENTS", "CALENDAR_CONFLICT"] },
        },
      });

      await prisma.notifiedConflict.deleteMany({
        where: {
          OR: [
            { conflictKey: { contains: id } }, // Event-ID ist Teil des conflictKey
          ],
          conflictType: { in: ["OVERLAPPING_CALENDAR_EVENTS", "CALENDAR_CONFLICT"] },
        },
      });

    return NextResponse.json({
      success: true,
      message: "Kalendereintrag wurde gelöscht",
        bookingCancelled: false,
    });
    }
  } catch (error: any) {
    console.error("Error deleting calendar booking:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Löschen des Kalendereintrags" },
      { status: 500 }
    );
  }
}

