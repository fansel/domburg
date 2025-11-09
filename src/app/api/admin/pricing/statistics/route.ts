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
      const rawManualEntries = allEvents
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

      // Hole Verlinkungen für manuelle Einträge
      const manualEventIds = rawManualEntries.map(e => e.id).filter((id): id is string => id !== null);
      const linkedEvents = manualEventIds.length > 0 ? await prisma.linkedCalendarEvent.findMany({
        where: {
          OR: [
            { eventId1: { in: manualEventIds } },
            { eventId2: { in: manualEventIds } },
          ],
        },
      }) : [];

      // Erstelle Map für transitiv verlinkte Events (Gruppen)
      const linkedEventMap = new Map<string, Set<string>>();
      
      // Initialisiere Map
      rawManualEntries.forEach(entry => {
        if (entry.id) {
          linkedEventMap.set(entry.id, new Set([entry.id]));
        }
      });

      // Verbinde transitiv verlinkte Events
      linkedEvents.forEach(link => {
        const id1 = link.eventId1;
        const id2 = link.eventId2;
        
        // Finde die Gruppe für id1 und id2
        let group1 = linkedEventMap.get(id1);
        let group2 = linkedEventMap.get(id2);
        
        if (!group1) {
          group1 = new Set([id1]);
          linkedEventMap.set(id1, group1);
        }
        if (!group2) {
          group2 = new Set([id2]);
          linkedEventMap.set(id2, group2);
        }
        
        // Wenn sie in verschiedenen Gruppen sind, vereinige sie
        if (group1 !== group2) {
          // Vereinige die Gruppen
          group2.forEach(id => {
            group1!.add(id);
            linkedEventMap.set(id, group1!);
          });
        }
      });

      // Verarbeite jede Gruppe von verlinkten Events
      const processedGroups = new Set<Set<string>>();
      const processedEventIds = new Set<string>();
      
      rawManualEntries.forEach(entry => {
        if (!entry.id || processedEventIds.has(entry.id)) return;
        
        const group = linkedEventMap.get(entry.id);
        if (!group || group.size === 1) {
          // Keine Verlinkung oder nur ein Event: Einzeln behalten
          manualEntries.push(entry);
          processedEventIds.add(entry.id);
          return;
        }
        
        // Prüfe ob diese Gruppe bereits verarbeitet wurde
        if (processedGroups.has(group)) return;
        processedGroups.add(group);
        
        // Hole alle Events dieser Gruppe
        const groupEvents = rawManualEntries.filter(e => e.id && group.has(e.id));
        if (groupEvents.length < 2) {
          // Nur ein Event in der Gruppe: Einzeln behalten
          manualEntries.push(entry);
          processedEventIds.add(entry.id);
          return;
        }
        
        // Sortiere Events nach Startdatum
        groupEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
        
        // Prüfe ob sich Events überschneiden
        const hasOverlap = groupEvents.some((event1, i) => {
          return groupEvents.slice(i + 1).some(event2 => {
            const e1Start = new Date(event1.start);
            const e1End = new Date(event1.end);
            const e2Start = new Date(event2.start);
            const e2End = new Date(event2.end);
            
            // Normalisiere auf Tagesanfang
            const normalizeDate = (date: Date) => {
              const d = new Date(date);
              d.setUTCHours(0, 0, 0, 0);
              return d;
            };
            
            const s1 = normalizeDate(e1Start);
            const e1 = normalizeDate(e1End);
            const s2 = normalizeDate(e2Start);
            const e2 = normalizeDate(e2End);
            
            // Prüfe Überschneidung (mehr als nur anstoßen)
            return s1 < e2 && s2 < e1;
          });
        });
        
        if (!hasOverlap) {
          // Keine Überschneidung: Alle einzeln behalten
          groupEvents.forEach(e => {
            manualEntries.push(e);
            processedEventIds.add(e.id!);
          });
        } else {
          // Überschneidung: Aufteilen
          // Strategie: Erste Buchung bekommt nur den nicht-überschneidenden Teil,
          // zweite Buchung bekommt den überschneidenden Teil + Rest
          
          // Normalisiere auf Tagesanfang für Vergleich
          const normalizeDate = (date: Date) => {
            const d = new Date(date);
            d.setUTCHours(0, 0, 0, 0);
            return d;
          };
          
          // Verarbeite jedes Event genau einmal
          const processedInGroup = new Set<string>();
          
          for (let i = 0; i < groupEvents.length; i++) {
            const event1 = groupEvents[i];
            if (processedInGroup.has(event1.id!)) continue;
            
            const s1 = normalizeDate(new Date(event1.start));
            const e1 = normalizeDate(new Date(event1.end));
            
            // Finde die erste Überschneidung mit einem späteren, noch nicht verarbeiteten Event
            let firstOverlapStart: Date | null = null;
            let firstOverlapIndex = -1;
            
            for (let j = i + 1; j < groupEvents.length; j++) {
              const event2 = groupEvents[j];
              if (processedInGroup.has(event2.id!)) continue;
              
              const s2 = normalizeDate(new Date(event2.start));
              const e2 = normalizeDate(new Date(event2.end));
              
              // Prüfe Überschneidung (mehr als nur anstoßen)
              if (s1 < e2 && s2 < e1) {
                // Überschneidung gefunden
                const overlapStart = s2 > s1 ? s2 : s1; // Start der Überschneidung
                if (!firstOverlapStart || overlapStart < firstOverlapStart) {
                  firstOverlapStart = overlapStart;
                  firstOverlapIndex = j;
                }
              }
            }
            
            if (firstOverlapStart && firstOverlapStart > s1) {
              // Erste Buchung: Nur bis zum Start der Überschneidung
              manualEntries.push({
                id: `${event1.id}-part1`,
                summary: event1.summary,
                start: event1.start,
                end: firstOverlapStart,
              });
              
              // Zweite Buchung: Ab dem Start der Überschneidung bis zu ihrem Ende
              const event2 = groupEvents[firstOverlapIndex];
              manualEntries.push({
                id: `${event2.id}-part2`,
                summary: event2.summary,
                start: firstOverlapStart,
                end: event2.end,
              });
              
              processedInGroup.add(event1.id!);
              processedInGroup.add(event2.id!);
              processedEventIds.add(event1.id!);
              processedEventIds.add(event2.id!);
            } else {
              // Keine Überschneidung: Ganze Buchung
              manualEntries.push(event1);
              processedInGroup.add(event1.id!);
              processedEventIds.add(event1.id!);
            }
          }
        }
      });
    } catch (error) {
      console.error("Error loading calendar events:", error);
    }

    // Hilfsfunktion: Teile Buchungen auf, die über den Jahreswechsel gehen
    // Gibt nur den Teil zurück, der im angegebenen Jahr liegt
    const splitBookingByYear = (
      id: string,
      startDate: Date,
      endDate: Date,
      year: number,
      additionalData: any
    ) => {
      const bookingStart = new Date(startDate);
      const bookingEnd = new Date(endDate);
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31, 23, 59, 59);

      // Wenn die Buchung komplett im Jahr liegt, keine Aufteilung nötig
      if (bookingStart >= yearStart && bookingEnd <= yearEnd) {
        return [{
          id: id,
          startDate: bookingStart,
          endDate: bookingEnd,
          ...additionalData,
        }];
      }

      // Wenn die Buchung das gesamte Jahr umfasst
      if (bookingStart < yearStart && bookingEnd > yearEnd) {
        return [{
          id: `${id}-${year}`,
          startDate: yearStart,
          endDate: yearEnd,
          ...additionalData,
        }];
      }

      // Buchung beginnt im Jahr und endet im nächsten Jahr
      if (bookingStart >= yearStart && bookingStart <= yearEnd && bookingEnd > yearEnd) {
        return [{
          id: `${id}-${year}`,
          startDate: bookingStart,
          endDate: yearEnd,
          ...additionalData,
        }];
      }

      // Buchung beginnt im Vorjahr und endet im aktuellen Jahr
      if (bookingStart < yearStart && bookingEnd >= yearStart && bookingEnd <= yearEnd) {
        return [{
          id: `${id}-${year}`,
          startDate: yearStart,
          endDate: bookingEnd,
          ...additionalData,
        }];
      }

      // Buchung liegt nicht im Jahr
      return [];
    };

    // Kombiniere Buchungen und manuelle Einträge (mit Aufteilung über Jahreswechsel)
    const allItems: Array<{
      id: string;
      type: "booking" | "manual";
      startDate: Date;
      endDate: Date;
      guestName?: string;
      guestEmail?: string;
      bookingCode?: string;
      summary?: string;
      defaultUseFamilyPrice: boolean;
    }> = [];

    // Hole alle Guest Codes mit Family-Preis für effiziente Prüfung
    const guestCodesWithFamilyPrice = new Set<string>();
    if (bookings.some(b => b.guestCode)) {
      const uniqueGuestCodes = [...new Set(bookings.map(b => b.guestCode).filter((code): code is string => !!code))];
      if (uniqueGuestCodes.length > 0) {
        const tokens = await prisma.guestAccessToken.findMany({
          where: {
            token: { in: uniqueGuestCodes },
            useFamilyPrice: true,
          },
          select: { token: true },
        });
        tokens.forEach(token => guestCodesWithFamilyPrice.add(token.token));
      }
    }

    // Buchungen aufteilen
    bookings.forEach((booking) => {
      // Prüfe ob diese Buchung einen Family-Code verwendet
      const usesFamilyPrice = booking.guestCode ? guestCodesWithFamilyPrice.has(booking.guestCode) : false;
      
      const parts = splitBookingByYear(
        booking.id,
        booking.startDate,
        booking.endDate,
        year,
        {
          type: "booking" as const,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          bookingCode: booking.bookingCode,
          defaultUseFamilyPrice: usesFamilyPrice, // Verwende Family-Preis wenn Code es aktiviert
        }
      );
      allItems.push(...parts);
    });

    // Manuelle Einträge aufteilen
    manualEntries.forEach((entry) => {
      const parts = splitBookingByYear(
        entry.id,
        entry.start,
        entry.end,
        year,
        {
          type: "manual" as const,
          summary: entry.summary,
          defaultUseFamilyPrice: true, // Manuelle Einträge standardmäßig Family
        }
      );
      allItems.push(...parts);
    });

    // Filtere Events mit identischem Start- und Enddatum (0 Nächte)
    const filteredItems = allItems.filter((item) => {
      const startDate = new Date(item.startDate);
      const endDate = new Date(item.endDate);
      
      // Normalisiere auf Tagesanfang für Vergleich
      const normalizeDate = (date: Date) => {
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      };
      
      const normalizedStart = normalizeDate(startDate);
      const normalizedEnd = normalizeDate(endDate);
      
      // Nur behalten, wenn Start- und Enddatum unterschiedlich sind (mindestens 1 Nacht)
      return normalizedStart.getTime() !== normalizedEnd.getTime();
    });

    // Prüfe ob für dieses Jahr Preisphasen existieren
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);
    
    const pricingPhasesForYear = await prisma.pricingPhase.findMany({
      where: {
        isActive: true,
        startDate: { lte: yearEnd },
        endDate: { gte: yearStart },
      },
      take: 1, // Nur prüfen ob welche existieren
    });
    
    const hasPricingPhases = pricingPhasesForYear.length > 0;

    return NextResponse.json({
      success: true,
      bookings: filteredItems,
      hasPricingPhases,
    });
  } catch (error: any) {
    console.error("Error loading statistics:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Statistiken" },
      { status: 500 }
    );
  }
}

