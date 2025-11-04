import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import { updateCalendarEvent, getCalendarEvents } from "@/lib/google-calendar";
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

    // Stelle sicher, dass eventIds ein Array ist
    const eventIdArray = Array.isArray(eventIds) ? eventIds : [];

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

    // VALIDIERUNG: Prüfe ob Events verknüpft werden können
    // Events können nur verknüpft werden wenn:
    // 1. Sie sich um ≤1 Tag überlappen/anstoßen, ODER
    // 2. Sie an ein bereits verlinktes Event anschließen (≤1 Tag Abstand zu einem Event im Pool)
    
    // Hole alle Events aus Google Calendar
    const allCalendarEvents = await getCalendarEvents(
      new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
      new Date(new Date().setFullYear(new Date().getFullYear() + 2))
    );
    
    const eventsToLink = allCalendarEvents.filter(e => eventIdArray.includes(e.id));
    
    if (eventsToLink.length !== eventIdArray.length) {
      return NextResponse.json(
        { success: false, error: "Einige Events konnten nicht gefunden werden" },
        { status: 400 }
      );
    }

    // Hole alle bestehenden Verlinkungen für diese Events
    const existingLinks = await prisma.linkedCalendarEvent.findMany({
      where: {
        OR: [
          { eventId1: { in: eventIdArray } },
          { eventId2: { in: eventIdArray } },
        ],
      },
    });

    // Erstelle Map: eventId -> Array von verlinkten Event-IDs (transitive Closure)
    const linkedEventMap = new Map<string, string[]>();
    existingLinks.forEach((link: { eventId1: string; eventId2: string }) => {
      if (!linkedEventMap.has(link.eventId1)) {
        linkedEventMap.set(link.eventId1, []);
      }
      if (!linkedEventMap.has(link.eventId2)) {
        linkedEventMap.set(link.eventId2, []);
      }
      linkedEventMap.get(link.eventId1)!.push(link.eventId2);
      linkedEventMap.get(link.eventId2)!.push(link.eventId1);
    });

    // Finde transitive Closure: Alle Events die über bestehende Links verbunden sind
    const getConnectedEventIds = (eventId: string): Set<string> => {
      const connected = new Set<string>([eventId]);
      const queue = [eventId];
      const visited = new Set<string>();
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        
        const linkedIds = linkedEventMap.get(current) || [];
        linkedIds.forEach(linkedId => {
          if (!connected.has(linkedId)) {
            connected.add(linkedId);
            queue.push(linkedId);
          }
        });
      }
      
      return connected;
    };

    // Prüfe ob alle Event-Paare verknüpft werden können
    const normalizeDate = (date: Date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const eventsOverlapOrTouch = (event1: typeof eventsToLink[0], event2: typeof eventsToLink[0]): boolean => {
      const start1 = normalizeDate(new Date(event1.start));
      const end1 = normalizeDate(new Date(event1.end));
      const start2 = normalizeDate(new Date(event2.start));
      const end2 = normalizeDate(new Date(event2.end));
      
      // Prüfe ob Events sich überlappen oder anstoßen (≤1 Tag)
      // Overlap: start1 < end2 && start2 < end1 bedeutet Überlappung
      // Touch: end1 === start2 oder end2 === start1 (same-day check-in/check-out)
      
      // Prüfe ob sie sich überlappen oder anstoßen
      if (start1 <= end2 && start2 <= end1) {
        // Berechne Überlappung
        const overlapStart = start1 > start2 ? start1 : start2;
        const overlapEnd = end1 < end2 ? end1 : end2;
        const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
        
        // ≤1 Tag Overlap/Touch = erlaubt
        return overlapDays >= 0;
      } else {
        // Keine Überlappung, prüfe ob sie sich anstoßen (≤1 Tag Abstand)
        // Berechne den minimalen Abstand zwischen den Events
        const gap1 = Math.floor(Math.abs(start1.getTime() - end2.getTime()) / (1000 * 60 * 60 * 24)); // Event1 startet nach Event2
        const gap2 = Math.floor(Math.abs(start2.getTime() - end1.getTime()) / (1000 * 60 * 60 * 24)); // Event2 startet nach Event1
        const minGap = Math.min(gap1, gap2);
        
        return minGap <= 1; // ≤1 Tag Abstand = anstoßen
      }
    };

    // Prüfe ob alle Events in einer zusammenhängenden Komponente sind
    // Erstelle einen Graph: Jedes Event-Paar das direkt verbunden werden kann (≤1 Tag)
    const graph = new Map<string, string[]>();
    
    // Initialisiere Graph
    eventsToLink.forEach(event => {
      graph.set(event.id, []);
    });
    
    // Füge Kanten hinzu für Events die direkt verbunden werden können
    for (let i = 0; i < eventsToLink.length; i++) {
      for (let j = i + 1; j < eventsToLink.length; j++) {
        const event1 = eventsToLink[i];
        const event2 = eventsToLink[j];
        
        if (eventsOverlapOrTouch(event1, event2)) {
          graph.get(event1.id)!.push(event2.id);
          graph.get(event2.id)!.push(event1.id);
        }
      }
    }
    
    // Prüfe auch Verbindungen zu bestehenden Pools
    eventsToLink.forEach(event => {
      const connectedToEvent = getConnectedEventIds(event.id);
      
      // Prüfe ob dieses Event an ein Event im Pool anschließt
      for (const poolEventId of connectedToEvent) {
        if (poolEventId === event.id) continue; // Skip sich selbst
        const poolEvent = allCalendarEvents.find(e => e.id === poolEventId);
        if (poolEvent && eventsOverlapOrTouch(poolEvent, event)) {
          // Füge Verbindung zum Pool hinzu (indirekt über poolEventId)
          // Das Event kann über den Pool mit anderen Events verbunden werden
          graph.get(event.id)!.push(poolEventId);
          // Füge auch umgekehrte Verbindung hinzu (für transitive Suche)
          if (!graph.has(poolEventId)) {
            graph.set(poolEventId, []);
          }
          graph.get(poolEventId)!.push(event.id);
        }
      }
    });
    
    // Prüfe ob alle Events in einer zusammenhängenden Komponente sind
    // Verwende BFS um alle erreichbaren Events von event1 zu finden
    const visited = new Set<string>();
    const queue = [eventsToLink[0].id];
    visited.add(eventsToLink[0].id);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = graph.get(current) || [];
      
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          // Nur Events aus eventsToLink zur Queue hinzufügen (nicht Pool-Events)
          if (eventsToLink.some(e => e.id === neighbor)) {
            queue.push(neighbor);
          }
        }
      });
    }
    
    // Prüfe ob alle Events erreichbar sind
    const allReachable = eventsToLink.every(event => visited.has(event.id));
    
    if (!allReachable) {
      // Finde die Events die nicht erreichbar sind
      const unreachableEvents = eventsToLink.filter(event => !visited.has(event.id));
      const reachableEvent = eventsToLink.find(event => visited.has(event.id));
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Nicht alle Events können verknüpft werden. Die Events müssen in einer zusammenhängenden Kette verbunden sein (jedes Event muss sich um ≤1 Tag mit mindestens einem anderen Event in der Gruppe überlappen oder anstoßen). Beispiel: "${unreachableEvents[0]?.summary}" kann nicht mit "${reachableEvent?.summary}" verbunden werden.` 
        },
        { status: 400 }
      );
    }

    // Update alle Events mit der gleichen Farbe
    await Promise.all(
      eventIdArray.map((eventId: string) =>
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
      eventIdArray.map((eventId: string) =>
        checkAndNotifyConflictsForCalendarEvent(eventId).catch((error: any) => {
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

