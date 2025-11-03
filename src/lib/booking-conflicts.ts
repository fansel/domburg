import { Booking } from "@prisma/client";
import prisma from "./prisma";
import { getBlockedDatesFromCalendar } from "./google-calendar";

export interface BookingConflict {
  type: "OVERLAPPING_REQUESTS" | "CALENDAR_CONFLICT" | "OVERLAPPING_CALENDAR_EVENTS";
  bookings: Booking[];
  calendarEvent?: {
    id: string;
    summary: string;
    start: Date;
    end: Date;
  };
  calendarEvents?: Array<{
    id: string;
    summary: string;
    start: Date;
    end: Date;
  }>;
  severity: "HIGH" | "MEDIUM";
  isPotentialConflict?: boolean; // true wenn nur PENDING Anfragen betroffen sind (potenzieller Konflikt)
}

/**
 * Prüft ob zwei Datumsbereiche sich überlappen
 * WICHTIG: Überlappungen am gleichen End-Tag sind KEINE Überlappungen,
 * da Check-out und Check-in am selben Tag möglich sind (Pro-Nacht-Zahlung)
 * 
 * Verwendet Europe/Amsterdam Zeitzone für konsistente Normalisierung
 */
export function datesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  // Normalisiere auf Tagesanfang für Vergleich (ignoriere Uhrzeit)
  // WICHTIG: Verwende lokale Zeitzone (Europe/Amsterdam) für Konsistenz
  const getLocalDateString = (date: Date): string => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Amsterdam',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  };

  const normalizeDate = (date: Date) => {
    const localDateStr = getLocalDateString(date);
    // Parse als lokales Datum (ohne Timezone)
    const [year, month, day] = localDateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  
  const s1 = normalizeDate(start1);
  const e1 = normalizeDate(end1);
  const s2 = normalizeDate(start2);
  const e2 = normalizeDate(end2);
  
  // Überlappung nur wenn sie sich EXKLUSIV überschneiden (nicht nur am gleichen Tag berühren)
  // start1 < end2 && start2 < end1 würde auch gleiche Tage als Überlappung sehen
  // Für Hotel-Style: Check-out Tag kann gleich Check-in Tag sein
  // Beispiel: 01.01-05.01 und 05.01-10.01 = KEINE Überlappung (5.1 ist Check-out + Check-in)
  return s1 < e2 && s2 < e1;
}

/**
 * Findet alle überlappenden Buchungsanfragen
 * WICHTIG: Mehrere PENDING Anfragen für denselben Zeitraum sind erlaubt.
 * Nur APPROVED Buchungen können Konflikte verursachen.
 */
export async function findOverlappingRequests(): Promise<BookingConflict[]> {
  // Nur APPROVED Buchungen prüfen - mehrere PENDING Anfragen sind ok
  const approvedBookings = await prisma.booking.findMany({
    where: {
      status: "APPROVED",
    },
    orderBy: {
      startDate: "asc",
    },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  // Lade auch PENDING Buchungen für Konfliktprüfung mit APPROVED
  const pendingBookings = await prisma.booking.findMany({
    where: {
      status: "PENDING",
    },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  const conflicts: BookingConflict[] = [];
  const processed = new Set<string>();

  // Prüfe APPROVED Buchungen untereinander
  for (let i = 0; i < approvedBookings.length; i++) {
    const booking1 = approvedBookings[i];
    const overlappingBookings: Booking[] = [booking1];

    // Prüfe gegen andere APPROVED Buchungen
    for (let j = i + 1; j < approvedBookings.length; j++) {
      const booking2 = approvedBookings[j];

      if (
        datesOverlap(
          booking1.startDate,
          booking1.endDate,
          booking2.startDate,
          booking2.endDate
        )
      ) {
        overlappingBookings.push(booking2);
      }
    }
    
    // Prüfe auch gegen PENDING Anfragen, die mit dieser APPROVED Buchung überlappen
    for (const pendingBooking of pendingBookings) {
      if (
        datesOverlap(
          booking1.startDate,
          booking1.endDate,
          pendingBooking.startDate,
          pendingBooking.endDate
        )
      ) {
        // Nur hinzufügen wenn noch nicht vorhanden
        if (!overlappingBookings.find(b => b.id === pendingBooking.id)) {
          overlappingBookings.push(pendingBooking);
        }
      }
    }

    // Wenn Überlappungen gefunden wurden (mehr als nur booking1)
    if (overlappingBookings.length > 1) {
      const conflictKey = overlappingBookings
        .map((b) => b.id)
        .sort()
        .join("-");

      if (!processed.has(conflictKey)) {
        // Prüfe ob alle beteiligten Buchungen PENDING sind (potenzieller Konflikt)
        const allPending = overlappingBookings.every(b => b.status === 'PENDING');
        
        conflicts.push({
          type: "OVERLAPPING_REQUESTS",
          bookings: overlappingBookings as Booking[],
          severity: allPending ? "MEDIUM" : (overlappingBookings.length > 2 ? "HIGH" : "MEDIUM"),
          isPotentialConflict: allPending, // Flag für potenzielle Konflikte (nur PENDING)
        });
        processed.add(conflictKey);
      }
    }
  }

  // Prüfe PENDING Anfragen untereinander - mehrere PENDING Anfragen für denselben Zeitraum sind potenzielle Konflikte
  for (let i = 0; i < pendingBookings.length; i++) {
    const pending1 = pendingBookings[i];
    const overlappingPendings: Booking[] = [pending1];

    // Prüfe gegen andere PENDING Anfragen
    for (let j = i + 1; j < pendingBookings.length; j++) {
      const pending2 = pendingBookings[j];

      if (
        datesOverlap(
          pending1.startDate,
          pending1.endDate,
          pending2.startDate,
          pending2.endDate
        )
      ) {
        overlappingPendings.push(pending2);
      }
    }

    // Wenn mehrere PENDING Anfragen für denselben Zeitraum gefunden wurden
    if (overlappingPendings.length > 1) {
      const conflictKey = overlappingPendings
        .map((b) => b.id)
        .sort()
        .join("-");

      if (!processed.has(conflictKey)) {
        conflicts.push({
          type: "OVERLAPPING_REQUESTS",
          bookings: overlappingPendings as Booking[],
          severity: "MEDIUM", // Potenzielle Konflikte - Admin muss entscheiden
          isPotentialConflict: true, // Flag für potenzielle Konflikte (nur PENDING)
        });
        processed.add(conflictKey);
      }
    }
  }

  return conflicts;
}

/**
 * Findet Buchungsanfragen, die mit manuellen Kalendereinträgen kollidieren
 */
export async function findCalendarConflicts(): Promise<BookingConflict[]> {
  try {
    // Prüfe sowohl PENDING als auch APPROVED Buchungen gegen Kalendereinträge
    const bookings = await prisma.booking.findMany({
      where: {
        status: {
          in: ["PENDING", "APPROVED"],
        },
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    // Hole alle blockierten Daten aus Google Calendar
    const blockedDates = await getBlockedDatesFromCalendar();

    const conflicts: BookingConflict[] = [];
    const processedConflictKeys = new Set<string>();

    for (const booking of bookings) {
      for (const blockedDate of blockedDates) {
        if (
          datesOverlap(
            booking.startDate,
            booking.endDate,
            blockedDate.start,
            blockedDate.end
          )
        ) {
          // Prüfe ob dieser Kalendereintrag von dieser App erstellt wurde
          const isAppBooking = blockedDate.summary?.includes("🏠") || 
                               blockedDate.summary?.includes("Buchung:") ||
                               blockedDate.summary?.includes("Buchung ");

          // Prüfe ob dieser Kalendereintrag zu dieser Buchung gehört (via googleEventId)
          const isSameEvent = booking.googleEventId === blockedDate.id;

          // Nur als Konflikt markieren wenn:
          // 1. Es KEIN App-Booking ist (also manuell eingetragen), ODER
          // 2. Es ein App-Booking ist, aber NICHT zu dieser Buchung gehört
          if (!isAppBooking || (isAppBooking && !isSameEvent)) {
            // Erstelle einen eindeutigen Key für diesen Konflikt (vermeidet Duplikate)
            const conflictKey = `${booking.id}-${blockedDate.id}`;
            
            if (!processedConflictKeys.has(conflictKey)) {
              conflicts.push({
                type: "CALENDAR_CONFLICT",
                bookings: [booking as Booking],
                calendarEvent: {
                  id: blockedDate.id || "unknown",
                  summary: blockedDate.summary || "Unbenannter Eintrag",
                  start: blockedDate.start,
                  end: blockedDate.end,
                },
                severity: "HIGH",
              });
              processedConflictKeys.add(conflictKey);
            }
          }
        }
      }
    }

    return conflicts;
  } catch (error) {
    console.error("Error finding calendar conflicts:", error);
    return [];
  }
}

/**
 * Findet überlappende Kalendereinträge (externe Doppelbuchungen)
 */
export async function findOverlappingCalendarEvents(): Promise<BookingConflict[]> {
  try {
    // Hole ALLE Events (auch Info-Einträge) für die Überlappungsprüfung
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 2);

    const { getCalendarEvents } = await import("./google-calendar");
    const allEvents = await getCalendarEvents(startDate, endDate);
    
    // Filtere nur echte Blockierungen (keine Info-Einträge, keine App-Buchungen)
    const blockingEvents = allEvents.filter(event => {
      // Filtere Info-Events heraus (colorId=10)
      if (event.colorId === '10') return false;
      
      // Filtere App-Buchungen heraus
      const isAppBooking = event.summary?.includes("🏠") || 
                           event.summary?.includes("Buchung");
      return !isAppBooking;
    });

    const conflicts: BookingConflict[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < blockingEvents.length; i++) {
      const event1 = blockingEvents[i];
      const overlappingEvents = [event1];

      for (let j = i + 1; j < blockingEvents.length; j++) {
        const event2 = blockingEvents[j];

        if (
          datesOverlap(
            event1.start,
            event1.end,
            event2.start,
            event2.end
          )
        ) {
          overlappingEvents.push(event2);
        }
      }

      // Wenn Überlappungen gefunden wurden
      if (overlappingEvents.length > 1) {
        const conflictKey = overlappingEvents
          .map((e) => e.id)
          .sort()
          .join("-");

        if (!processed.has(conflictKey)) {
          const conflict = {
            type: "OVERLAPPING_CALENDAR_EVENTS" as const,
            bookings: [], // Keine Buchungen beteiligt
            calendarEvents: overlappingEvents.map(e => ({
              id: e.id,
              summary: e.summary,
              start: e.start,
              end: e.end,
            })),
            severity: (overlappingEvents.length > 2 ? "HIGH" : "MEDIUM") as "HIGH" | "MEDIUM",
          };
          conflicts.push(conflict);
          processed.add(conflictKey);
        }
      }
    }

    return conflicts;
  } catch (error) {
    console.error("Error finding overlapping calendar events:", error);
    return [];
  }
}

/**
 * Findet alle Konflikte (überlappende Anfragen + Kalenderkonflikte + überlappende Kalendereinträge)
 */
export async function findAllConflicts(): Promise<BookingConflict[]> {
  const [overlapping, calendar, calendarOverlaps] = await Promise.all([
    findOverlappingRequests(),
    findCalendarConflicts(),
    findOverlappingCalendarEvents(),
  ]);

  return [...overlapping, ...calendar, ...calendarOverlaps];
}

/**
 * Prüft ob eine bestimmte Buchung in einem Konflikt ist
 */
export async function isBookingInConflict(bookingId: string): Promise<boolean> {
  const conflicts = await findAllConflicts();
  
  return conflicts.some((conflict) =>
    conflict.bookings.some((b) => b.id === bookingId)
  );
}

/**
 * Formatiert einen Konflikt für die UI
 */
export function formatConflict(conflict: BookingConflict): string {
  if (conflict.type === "OVERLAPPING_REQUESTS") {
    return `${conflict.bookings.length} überlappende Anfragen`;
  } else if (conflict.type === "CALENDAR_CONFLICT") {
    return `Konflikt mit Kalendereintrag: ${conflict.calendarEvent?.summary}`;
  } else {
    return `${conflict.calendarEvents?.length || 0} überlappende Kalendereinträge`;
  }
}

