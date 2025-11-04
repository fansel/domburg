import { Booking } from "@prisma/client";
import prisma from "./prisma";
import { getBlockedDatesFromCalendar } from "./google-calendar";
import { datesOverlap } from "./utils";

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
        const hasPending = overlappingBookings.some(b => b.status === 'PENDING');
        
        // Severity-Logik:
        // - 3+ überlappende Anfragen = immer HIGH (egal ob PENDING)
        // - 2 überlappende Anfragen mit mindestens einer PENDING = MEDIUM (keine E-Mail)
        // - 2 überlappende Anfragen beide APPROVED = HIGH (E-Mail)
        const severity = overlappingBookings.length >= 3 
          ? "HIGH" 
          : (hasPending ? "MEDIUM" : "HIGH");
        
        conflicts.push({
          type: "OVERLAPPING_REQUESTS",
          bookings: overlappingBookings as Booking[],
          severity,
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
        // 3+ überlappende PENDING Anfragen = HIGH Severity (wichtig genug für Benachrichtigung)
        // 2 überlappende PENDING Anfragen = MEDIUM (potenzieller Konflikt)
        const severity = overlappingPendings.length >= 3 ? "HIGH" : "MEDIUM";
        
        conflicts.push({
          type: "OVERLAPPING_REQUESTS",
          bookings: overlappingPendings as Booking[],
          severity,
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
          // Prüfe ob alle Events die gleiche colorId haben
          const firstEvent = allEvents.find(e => e.id === overlappingEvents[0].id);
          const firstColorId = firstEvent?.colorId;
          const allSameColor = firstColorId !== undefined && 
            overlappingEvents.every(oe => {
              const event = allEvents.find(e => e.id === oe.id);
              return event?.colorId === firstColorId;
            });
          
          // Wenn alle Events die gleiche Farbe haben = KEIN Konflikt (zusammengehörig)
          // Verschiedene Farben = echter Konflikt (HIGH)
          if (allSameColor) {
            // Gleiche Farbe = kein Konflikt, einfach überspringen
            processed.add(conflictKey);
            continue;
          }
          
          const conflict: BookingConflict = {
            type: "OVERLAPPING_CALENDAR_EVENTS" as const,
            bookings: [], // Keine Buchungen beteiligt
            calendarEvents: overlappingEvents.map(e => ({
              id: e.id,
              summary: e.summary,
              start: e.start,
              end: e.end,
            })),
            severity: "HIGH",
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
 * Filtert automatisch ignorierte Konflikte heraus
 */
export async function findAllConflicts(): Promise<BookingConflict[]> {
  const [overlapping, calendar, calendarOverlaps] = await Promise.all([
    findOverlappingRequests(),
    findCalendarConflicts(),
    findOverlappingCalendarEvents(),
  ]);

  const allConflicts = [...overlapping, ...calendar, ...calendarOverlaps];
  
  // Filtere ignorierte Konflikte
  return await filterIgnoredConflicts(allConflicts);
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

/**
 * Generiert einen eindeutigen Key für einen Konflikt
 */
export function generateConflictKey(conflict: BookingConflict): string {
  if (conflict.type === "OVERLAPPING_CALENDAR_EVENTS") {
    return conflict.calendarEvents
      ?.map(e => e.id)
      .sort()
      .join("-") || "";
  } else if (conflict.type === "CALENDAR_CONFLICT") {
    const bookingId = conflict.bookings[0]?.id || "";
    const eventId = conflict.calendarEvent?.id || "";
    return `${bookingId}-${eventId}`;
  } else {
    // OVERLAPPING_REQUESTS
    return conflict.bookings
      .map(b => b.id)
      .sort()
      .join("-");
  }
}

/**
 * Prüft ob ein Konflikt ignoriert wurde
 */
export async function isConflictIgnored(
  conflictKey: string,
  conflictType: string
): Promise<boolean> {
  // Dynamischer Import um sicherzustellen dass prisma verfügbar ist
  const prismaClient = prisma || (await import('./prisma')).default;
  
  try {
    const ignored = await prismaClient.ignoredConflict.findUnique({
      where: {
        conflictKey_conflictType: {
          conflictKey,
          conflictType,
        },
      },
    });
    return !!ignored;
  } catch (error: any) {
    // Wenn das Model noch nicht existiert (Migration nicht ausgeführt)
    if (error?.code === 'P2001' || error?.message?.includes('does not exist')) {
      console.warn('[Conflict] IgnoredConflict model not found - migration may be needed');
      return false;
    }
    throw error;
  }
}

/**
 * Markiert einen Konflikt als ignoriert
 */
export async function ignoreConflict(
  conflictKey: string,
  conflictType: string,
  reason?: string,
  userId?: string
): Promise<void> {
  // Dynamischer Import um sicherzustellen dass prisma verfügbar ist
  const prismaClient = prisma || (await import('./prisma')).default;
  
  await prismaClient.ignoredConflict.create({
    data: {
      conflictKey,
      conflictType,
      reason,
      ignoredById: userId || null,
    },
  });
}

/**
 * Entfernt die Ignorierung eines Konflikts
 */
export async function unignoreConflict(
  conflictKey: string,
  conflictType: string
): Promise<void> {
  // Dynamischer Import um sicherzustellen dass prisma verfügbar ist
  const prismaClient = prisma || (await import('./prisma')).default;
  
  await prismaClient.ignoredConflict.deleteMany({
    where: {
      conflictKey,
      conflictType,
    },
  });
}

/**
 * Filtert ignorierte Konflikte aus
 */
export async function filterIgnoredConflicts(
  conflicts: BookingConflict[]
): Promise<BookingConflict[]> {
  const filtered: BookingConflict[] = [];
  
  for (const conflict of conflicts) {
    const conflictKey = generateConflictKey(conflict);
    const isIgnored = await isConflictIgnored(conflictKey, conflict.type);
    
    if (!isIgnored) {
      filtered.push(conflict);
    }
  }
  
  return filtered;
}

/**
 * Prüft ob ein Konflikt bereits benachrichtigt wurde
 */
export async function isConflictNotified(
  conflictKey: string,
  conflictType: string
): Promise<boolean> {
  // Dynamischer Import um sicherzustellen dass prisma verfügbar ist
  const prismaClient = prisma || (await import('./prisma')).default;
  
  try {
    const notified = await prismaClient.notifiedConflict.findUnique({
      where: {
        conflictKey_conflictType: {
          conflictKey,
          conflictType,
        },
      },
    });
    return !!notified;
  } catch (error: any) {
    // Wenn das Model noch nicht existiert (Migration nicht ausgeführt)
    if (error?.code === 'P2001' || error?.message?.includes('does not exist')) {
      console.warn('[Conflict] NotifiedConflict model not found - migration may be needed');
      return false;
    }
    throw error;
  }
}

/**
 * Markiert einen Konflikt als benachrichtigt
 */
export async function markConflictAsNotified(
  conflictKey: string,
  conflictType: string
): Promise<void> {
  // Dynamischer Import um sicherzustellen dass prisma verfügbar ist
  const prismaClient = prisma || (await import('./prisma')).default;
  
  await prismaClient.notifiedConflict.upsert({
    where: {
      conflictKey_conflictType: {
        conflictKey,
        conflictType,
      },
    },
    create: {
      conflictKey,
      conflictType,
    },
    update: {
      // Update notifiedAt wenn bereits vorhanden
      notifiedAt: new Date(),
    },
  });
}

/**
 * Prüft Konflikte für ein manuelles Kalender-Event und sendet Benachrichtigungen an Admins
 */
export async function checkAndNotifyConflictsForCalendarEvent(eventId: string): Promise<void> {
  try {
    // Hole alle Konflikte
    const conflicts = await findAllConflicts();
    
    // Finde Konflikte die dieses Event betreffen
    const relevantConflicts = conflicts.filter(conflict => {
      if (conflict.type === "CALENDAR_CONFLICT") {
        return conflict.calendarEvent?.id === eventId;
      } else if (conflict.type === "OVERLAPPING_CALENDAR_EVENTS") {
        return conflict.calendarEvents?.some(e => e.id === eventId);
      }
      return false;
    });

    if (relevantConflicts.length === 0) {
      return;
    }

    // Hole Admins, die Konflikt-Benachrichtigungen erhalten möchten
    const { getAdminsToNotify } = await import("./notifications");
    const adminEmails = await getAdminsToNotify("bookingConflict");

    if (adminEmails.length === 0) {
      console.log(`[Conflict] No admins to notify for calendar event conflicts`);
      return;
    }

    // Hole Public URL
    const { getPublicUrl } = await import("./email");
    const appUrl = await getPublicUrl();

    // Sende Benachrichtigung für jeden relevanten Konflikt (nur HIGH severity)
    for (const conflict of relevantConflicts) {
      if (conflict.severity !== "HIGH") {
        console.log(`[Conflict] Skipping notification for ${conflict.type} - severity is ${conflict.severity} (not HIGH)`);
        continue;
      }

      // Prüfe ob dieser Konflikt bereits benachrichtigt wurde
      const conflictKey = generateConflictKey(conflict);
      const alreadyNotified = await isConflictNotified(conflictKey, conflict.type);
      
      if (alreadyNotified) {
        console.log(`[Conflict] Skipping notification for ${conflict.type} - already notified`);
        continue;
      }

      const conflictDescription = formatConflict(conflict);
      
      // Bereite Buchungsdaten vor (kann leer sein wenn nur Calendar Events)
      const bookingsData = conflict.bookings.map(booking => ({
        bookingCode: booking.bookingCode,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        startDate: booking.startDate,
        endDate: booking.endDate,
        status: booking.status,
      }));

      // Bereite Calendar Events Daten vor
      const calendarEventsData = [];
      if (conflict.calendarEvent) {
        calendarEventsData.push({
          id: conflict.calendarEvent.id,
          summary: conflict.calendarEvent.summary || 'Unbenannter Eintrag',
          start: conflict.calendarEvent.start,
          end: conflict.calendarEvent.end,
        });
      }
      if (conflict.calendarEvents) {
        for (const event of conflict.calendarEvents) {
          // Vermeide Duplikate (wenn calendarEvent bereits hinzugefügt wurde)
          if (!calendarEventsData.find(e => e.id === event.id)) {
            calendarEventsData.push({
              id: event.id,
              summary: event.summary || 'Unbenannter Eintrag',
              start: event.start,
              end: event.end,
            });
          }
        }
      }

      // Sende E-Mail an alle betroffenen Admins
      const { sendBookingConflictNotificationToAdmin } = await import("./email");
      
      let atLeastOneSuccess = false;
      for (const adminEmail of adminEmails) {
        try {
          const result = await sendBookingConflictNotificationToAdmin({
            adminEmail,
            conflictType: conflict.type,
            conflictDescription,
            bookings: bookingsData,
            calendarEvents: calendarEventsData.length > 0 ? calendarEventsData : undefined,
            adminUrl: `${appUrl}/admin/bookings`,
          });
          
          if (result.success) {
            atLeastOneSuccess = true;
          }
          
          console.log(`[Conflict] Notification sent to ${adminEmail} for calendar event ${eventId}:`, result.success ? "success" : "failed", result.error || "");
        } catch (error: any) {
          console.error(`[Conflict] Error sending notification to ${adminEmail}:`, error);
        }
      }

      // Markiere Konflikt als benachrichtigt (nur wenn mindestens eine E-Mail erfolgreich gesendet wurde)
      if (atLeastOneSuccess) {
        await markConflictAsNotified(conflictKey, conflict.type);
      }
    }
  } catch (error) {
    console.error("[Conflict] Error checking and notifying conflicts for calendar event:", error);
  }
}

/**
 * Prüft Konflikte für eine bestimmte Buchung und sendet Benachrichtigungen an Admins
 */
export async function checkAndNotifyConflictsForBooking(bookingId: string): Promise<void> {
  try {
    // findAllConflicts() filtert bereits ignorierte Konflikte heraus
    const conflicts = await findAllConflicts();
    const relevantConflicts = conflicts.filter(conflict =>
      conflict.bookings.some(b => b.id === bookingId)
    );

    // Wenn keine Konflikte für diese Buchung, nichts tun
    if (relevantConflicts.length === 0) {
      return;
    }

    // Hole Admins, die Konflikt-Benachrichtigungen erhalten möchten
    const { getAdminsToNotify } = await import("./notifications");
    const adminEmails = await getAdminsToNotify("bookingConflict");

    if (adminEmails.length === 0) {
      console.log(`[Conflict] No admins to notify for conflicts`);
      return;
    }

    // Hole Public URL
    const { getPublicUrl } = await import("./email");
    const appUrl = await getPublicUrl();

    // Sende Benachrichtigung für jeden relevanten Konflikt (nur HIGH severity)
    // Ignorierte Konflikte sind bereits von findAllConflicts() gefiltert
    for (const conflict of relevantConflicts) {
      // Nur bei HIGH severity Konflikten benachrichtigen
      // MEDIUM Konflikte (z.B. gleiche Farbe) sind nur potenzielle Konflikte
      if (conflict.severity !== "HIGH") {
        console.log(`[Conflict] Skipping notification for ${conflict.type} - severity is ${conflict.severity} (not HIGH)`);
        continue;
      }
      
      // Prüfe ob dieser Konflikt bereits benachrichtigt wurde
      const conflictKey = generateConflictKey(conflict);
      const alreadyNotified = await isConflictNotified(conflictKey, conflict.type);
      
      if (alreadyNotified) {
        console.log(`[Conflict] Skipping notification for ${conflict.type} - already notified`);
        continue;
      }

      const conflictDescription = formatConflict(conflict);
      
      // Bereite Buchungsdaten vor
      const bookingsData = conflict.bookings.map(booking => ({
        bookingCode: booking.bookingCode,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        startDate: booking.startDate,
        endDate: booking.endDate,
        status: booking.status,
      }));

      // Bereite Calendar Events Daten vor
      const calendarEventsData = [];
      if (conflict.calendarEvent) {
        calendarEventsData.push({
          id: conflict.calendarEvent.id,
          summary: conflict.calendarEvent.summary || 'Unbenannter Eintrag',
          start: conflict.calendarEvent.start,
          end: conflict.calendarEvent.end,
        });
      }
      if (conflict.calendarEvents) {
        for (const event of conflict.calendarEvents) {
          // Vermeide Duplikate (wenn calendarEvent bereits hinzugefügt wurde)
          if (!calendarEventsData.find(e => e.id === event.id)) {
            calendarEventsData.push({
              id: event.id,
              summary: event.summary || 'Unbenannter Eintrag',
              start: event.start,
              end: event.end,
            });
          }
        }
      }

      // Sende E-Mail an alle betroffenen Admins
      const { sendBookingConflictNotificationToAdmin } = await import("./email");
      
      let atLeastOneSuccess = false;
      for (const adminEmail of adminEmails) {
        try {
          const result = await sendBookingConflictNotificationToAdmin({
            adminEmail,
            conflictType: conflict.type,
            conflictDescription,
            bookings: bookingsData,
            calendarEvents: calendarEventsData.length > 0 ? calendarEventsData : undefined,
            adminUrl: `${appUrl}/admin/bookings`,
          });
          
          if (result.success) {
            atLeastOneSuccess = true;
          }
          
          console.log(`[Conflict] Notification sent to ${adminEmail}:`, result.success ? "success" : "failed", result.error || "");
        } catch (error: any) {
          console.error(`[Conflict] Error sending notification to ${adminEmail}:`, error);
        }
      }

      // Markiere Konflikt als benachrichtigt (nur wenn mindestens eine E-Mail erfolgreich gesendet wurde)
      if (atLeastOneSuccess) {
        await markConflictAsNotified(conflictKey, conflict.type);
        console.log(`[Conflict] Marked conflict ${conflictKey} as notified`);
      }
    }
  } catch (error) {
    console.error("[Conflict] Error checking and notifying conflicts:", error);
  }
}

