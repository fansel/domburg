import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import { updateCalendarEvent, getCalendarEvents } from "@/lib/google-calendar";
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

    const { eventId } = await request.json();

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "eventId ist erforderlich" },
        { status: 400 }
      );
    }

    // Prüfe ob Event eine interne Buchung ist (über googleEventId verlinkt)
    // Nur manuelle Events dürfen getrennt werden
    const booking = await prisma.booking.findUnique({
      where: {
        googleEventId: eventId,
      },
      select: {
        googleEventId: true,
      },
    });

    if (booking) {
      return NextResponse.json(
        { success: false, error: "Automatisch erstellte Buchungen können nicht getrennt werden" },
        { status: 400 }
      );
    }

    // Hole alle Verlinkungen zu diesem Event
    const linkedEventsToEvent = await prisma.linkedCalendarEvent.findMany({
      where: {
        OR: [
          { eventId1: eventId },
          { eventId2: eventId },
        ],
      },
    });

    if (linkedEventsToEvent.length === 0) {
      return NextResponse.json(
        { success: false, error: "Dieses Event ist nicht verlinkt" },
        { status: 400 }
      );
    }

    // Finde alle Events, die mit diesem Event transitiv verlinkt sind (vor dem Entfernen)
    // Dazu müssen wir ALLE Verlinkungen für alle transitiv verbundenen Events holen
    const getAllConnectedEventIds = async (startEventId: string): Promise<Set<string>> => {
      const connected = new Set<string>([startEventId]);
      const queue = [startEventId];
      const visited = new Set<string>([startEventId]);
      const allFoundEventIds = new Set<string>([startEventId]);
      
      // Iterative Suche: Hole alle Verlinkungen für alle gefundenen Events
      while (queue.length > 0) {
        const currentBatch = Array.from(queue);
        queue.length = 0; // Leere Queue
        
        // Hole alle Verlinkungen für die aktuelle Batch
        const currentLinks = await prisma.linkedCalendarEvent.findMany({
          where: {
            OR: currentBatch.map(id => [
              { eventId1: id },
              { eventId2: id },
            ]).flat(),
          },
        });
        
        // Verarbeite alle gefundenen Verlinkungen
        currentLinks.forEach(link => {
          const otherId = currentBatch.includes(link.eventId1) ? link.eventId2 : link.eventId1;
          if (!visited.has(otherId)) {
            visited.add(otherId);
            connected.add(otherId);
            allFoundEventIds.add(otherId);
            queue.push(otherId);
          }
        });
      }
      
      return connected;
    };

    // BEVOR wir das Event entfernen: Finde alle transitiv verlinkten Events
    const allConnectedEventIds = await getAllConnectedEventIds(eventId);
    const remainingEventIds = Array.from(allConnectedEventIds).filter(id => id !== eventId);

    // Lösche ALLE Verlinkungen zu diesem Event
    await prisma.linkedCalendarEvent.deleteMany({
      where: {
        OR: [
          { eventId1: eventId },
          { eventId2: eventId },
        ],
      },
    });

    // Setze Benachrichtigungen für Konflikte zurück, die diese Events betreffen
    // (damit der Konflikt erneut benachrichtigt werden kann, wenn er weiterhin besteht)
    await resetConflictNotificationsForEvents([eventId, ...allConnectedEventIds]);

    // JETZT: Finde alle isolierten Events (Events die keine Verlinkungen mehr haben)
    // und trenne sie von der Gruppe
    if (remainingEventIds.length > 0) {
      // Hole ALLE verbleibenden Verlinkungen zwischen den remainingEventIds
      const remainingLinks = await prisma.linkedCalendarEvent.findMany({
        where: {
          AND: [
            { eventId1: { in: remainingEventIds } },
            { eventId2: { in: remainingEventIds } },
          ],
        },
      });

      // Erstelle Set aller Events die noch verlinkt sind
      const linkedEventIds = new Set<string>();
      remainingLinks.forEach((link: { eventId1: string; eventId2: string }) => {
        linkedEventIds.add(link.eventId1);
        linkedEventIds.add(link.eventId2);
      });

      // Finde isolierte Events (Events die keine Verlinkungen mehr haben)
      const isolatedEventIds = remainingEventIds.filter(id => !linkedEventIds.has(id));

      // Wenn es isolierte Events gibt, weisen wir ihnen eine eigene Farbe zu
      if (isolatedEventIds.length > 0) {
        // Lösche alle Verlinkungen zu isolierten Events (sollten eigentlich keine mehr sein, aber sicherheitshalber)
        await prisma.linkedCalendarEvent.deleteMany({
          where: {
            OR: [
              { eventId1: { in: isolatedEventIds } },
              { eventId2: { in: isolatedEventIds } },
            ],
          },
        });

        // Weise isolierten Events eine einzigartige Farbe zu
        await Promise.all(
          isolatedEventIds.map(async (isolatedEventId: string) => {
            const uniqueColorId = getBookingColorId(isolatedEventId);
            await updateCalendarEvent(isolatedEventId, {
              colorId: uniqueColorId,
            });
          })
        );
      }

      // JETZT: Prüfe ob die verbleibenden verlinkten Events noch transitiv verbunden sind
      // WICHTIG: Wenn ursprünglich mehr als 2 Events transitiv verlinkt waren (A-B-C),
      // und ein Event entfernt wird, dann sollten ALLE verbleibenden Events getrennt werden
      // Das ist wichtig, weil bei der Gruppierung ALLE Paare verlinkt werden (A-B, B-C, A-C),
      // aber nach Entfernen von B sollten A und C getrennt werden
      const stillLinkedEventIds = remainingEventIds.filter(id => linkedEventIds.has(id));
      
      // Prüfe: Wenn es mehr als 2 Events in allConnectedEventIds gab, dann war eventId ein "Knoten"
      // Nach Entfernen des Knotens sollten die verbleibenden Events getrennt werden
      const hadMoreThanTwoEvents = allConnectedEventIds.size > 2;
      
      if (stillLinkedEventIds.length > 0 && remainingLinks.length > 0) {
        // Erstelle Graph der noch verlinkten Events
        const graph = new Map<string, string[]>();
        stillLinkedEventIds.forEach(id => {
          graph.set(id, []);
        });

        remainingLinks.forEach((link: { eventId1: string; eventId2: string }) => {
          if (stillLinkedEventIds.includes(link.eventId1) && stillLinkedEventIds.includes(link.eventId2)) {
            graph.get(link.eventId1)!.push(link.eventId2);
            graph.get(link.eventId2)!.push(link.eventId1);
          }
        });

        // Finde alle zusammenhängenden Komponenten
        const components: string[][] = [];
        const unvisited = new Set(stillLinkedEventIds);

        while (unvisited.size > 0) {
          const startId = Array.from(unvisited)[0];
          const component: string[] = [];
          const queue = [startId];
          const visited = new Set<string>();

          while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);
            component.push(current);
            unvisited.delete(current);

            const neighbors = graph.get(current) || [];
            neighbors.forEach(neighbor => {
              if (!visited.has(neighbor) && stillLinkedEventIds.includes(neighbor)) {
                queue.push(neighbor);
              }
            });
          }

          if (component.length > 0) {
            components.push(component);
          }
        }

        // WICHTIG: Wenn ursprünglich mehr als 2 Events transitiv verlinkt waren (A-B-C),
        // und ein Event entfernt wird, dann sollten ALLE verbleibenden Events getrennt werden
        if (hadMoreThanTwoEvents && remainingEventIds.length > 1) {
          // Ursprünglich waren 3+ Events transitiv verlinkt (A-B-C oder mehr)
          // Nach Entfernen eines Events sollten ALLE verbleibenden Events getrennt werden
          // Lösche ALLE Verlinkungen zwischen den remainingEventIds
          await prisma.linkedCalendarEvent.deleteMany({
            where: {
              AND: [
                { eventId1: { in: remainingEventIds } },
                { eventId2: { in: remainingEventIds } },
              ],
            },
          });
          
          // Weise JEDEM verbleibenden Event eine einzigartige Farbe zu
          await Promise.all(
            remainingEventIds.map(async (remainingEventId: string) => {
              const uniqueColorId = getBookingColorId(remainingEventId);
              await updateCalendarEvent(remainingEventId, {
                colorId: uniqueColorId,
              });
            })
          );
        } else if (components.length > 1) {
          // Mehrere Komponenten gefunden - trenne alle außer der ersten
          // Alle Komponenten außer der ersten trennen
          const eventsToUnlinkFromComponents: string[] = [];
          for (let i = 1; i < components.length; i++) {
            eventsToUnlinkFromComponents.push(...components[i]);
          }

          // Lösche alle Verlinkungen zwischen den zu trennenden Events
          if (eventsToUnlinkFromComponents.length > 0) {
            await prisma.linkedCalendarEvent.deleteMany({
              where: {
                OR: [
                  { 
                    AND: [
                      { eventId1: { in: eventsToUnlinkFromComponents } },
                      { eventId2: { in: eventsToUnlinkFromComponents } },
                    ]
                  },
                  {
                    AND: [
                      { eventId1: { in: eventsToUnlinkFromComponents } },
                      { eventId2: { in: stillLinkedEventIds.filter(id => !eventsToUnlinkFromComponents.includes(id)) } },
                    ]
                  },
                  {
                    AND: [
                      { eventId1: { in: stillLinkedEventIds.filter(id => !eventsToUnlinkFromComponents.includes(id)) } },
                      { eventId2: { in: eventsToUnlinkFromComponents } },
                    ]
                  },
                ],
              },
            });

            // Weise getrennten Events eine einzigartige Farbe zu
            await Promise.all(
              eventsToUnlinkFromComponents.map(async (eventIdToUnlink: string) => {
                const uniqueColorId = getBookingColorId(eventIdToUnlink);
                await updateCalendarEvent(eventIdToUnlink, {
                  colorId: uniqueColorId,
                });
              })
            );
          }
        }
      }
    }

    // Weise diesem Event eine einzigartige Farbe zu (basierend auf Event-ID)
    const uniqueColorId = getBookingColorId(eventId);
    await updateCalendarEvent(eventId, {
      colorId: uniqueColorId,
    });

    // Prüfe auf Konflikte nach dem Trennen (Farbe ändern kann Konflikte beeinflussen)
    const { checkAndNotifyConflictsForCalendarEvents } = await import("@/lib/booking-conflicts");
    
    const allAffectedEventIds = remainingEventIds.length > 0 
      ? [eventId, ...remainingEventIds]
      : [eventId];
    
    // Prüfe alle Events auf einmal, um Duplikate zu vermeiden
    checkAndNotifyConflictsForCalendarEvents(allAffectedEventIds).catch((error: any) => {
      console.error(`[Calendar] Error checking conflicts after ungrouping single event:`, error);
    });

    return NextResponse.json({
      success: true,
      message: "Event wurde von der Verlinkung getrennt",
    });
  } catch (error: any) {
    console.error("Error ungrouping single calendar event:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Trennen des Events" },
      { status: 500 }
    );
  }
}

