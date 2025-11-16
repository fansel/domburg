/**
 * Cron Jobs für automatische Aufgaben
 */

import cron, { ScheduledTask } from 'node-cron';

let conflictCheckJob: ScheduledTask | null = null;
let calendarSyncJob: ScheduledTask | null = null;
let isRunning = false; // Verhindert mehrfache gleichzeitige Ausführungen
let isSyncRunning = false; // Verhindert mehrfache gleichzeitige Synchronisationen

/**
 * Prüft Konflikte für manuelle Kalender-Events
 * Wird intern aufgerufen (kein HTTP Request nötig)
 */
async function checkConflictsForManualEvents() {
  // Verhindere mehrfache gleichzeitige Ausführungen
  if (isRunning) {
    console.log('[Cron] Conflict check already running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  try {
    console.log('[Cron] Starting conflict check for manual calendar events...');
    
    const { findAllConflicts, generateConflictKey, isConflictNotified, markConflictAsNotified } = await import('./booking-conflicts');
    const { getCalendarEvents } = await import('./google-calendar');
    const prisma = (await import('./prisma')).default;
    const { getAdminsToNotify } = await import('./notifications');
    const { getPublicUrl, sendBookingConflictNotificationToAdmin } = await import('./email');
    const { formatConflict } = await import('./booking-conflicts');
    
    // Hole alle manuellen Events (letzten 7 Tage + 1 Jahr in die Zukunft)
    // Reduzierter Zeitraum um Memory-Probleme zu vermeiden
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Letzten 7 Tage
    
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1); // Nur 1 Jahr (statt 2)
    
    const events = await getCalendarEvents(startDate, endDate);
    console.log(`[Cron] Loaded ${events.length} calendar events from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Filtere manuelle Events (nicht von App erstellt)
    const bookingsWithEventId = await prisma.booking.findMany({
      where: { googleEventId: { not: null } },
      select: { googleEventId: true },
    });
    const appEventIds = new Set(
      bookingsWithEventId.map(b => b.googleEventId).filter((id): id is string => id !== null)
    );
    
    const manualEvents = events.filter(event => {
      // Prüfe ob Event-ID in der Datenbank verlinkt ist (App-Buchung)
      if (event.id && appEventIds.has(event.id)) {
        return false;
      }
      
      // Prüfe Titel-Format (App-Buchungen beginnen immer mit "Buchung:")
      const isAppBooking = event.summary?.startsWith("Buchung:") || 
                           event.summary?.includes("🏠");
      
      // Filtere Info-Events heraus
      const isInfo = event.colorId === '10';
      
      return !isAppBooking && !isInfo;
    });

    console.log(`[Cron] Found ${manualEvents.length} manual calendar events to check`);

    // Hole alle aktuellen Konflikte (nur relevante für den Zeitraum)
    // findAllConflicts() lädt ALLE Buchungen - das könnte bei vielen Buchungen Memory-Probleme verursachen
    const allConflicts = await findAllConflicts();
    console.log(`[Cron] Found ${allConflicts.length} total conflicts to check`);
    
    // Prüfe Konflikte für jedes manuelle Event
    let checked = 0;
    let notificationsSent = 0;
    
    for (const event of manualEvents) {
      if (!event.id) continue;
      
      // Finde Konflikte die dieses Event betreffen
      const relevantConflicts = allConflicts.filter(conflict => {
        if (conflict.type === "CALENDAR_CONFLICT") {
          return conflict.calendarEvent?.id === event.id;
        } else if (conflict.type === "OVERLAPPING_CALENDAR_EVENTS") {
          return conflict.calendarEvents?.some(e => e.id === event.id);
        }
        return false;
      });

      if (relevantConflicts.length > 0) {
        // Prüfe ob Konflikt bereits benachrichtigt wurde
        const conflict = relevantConflicts[0]; // Nimm ersten relevanten Konflikt
        const conflictKey = generateConflictKey(conflict);
        const alreadyNotified = await isConflictNotified(conflictKey, conflict.type);
        
        if (!alreadyNotified && conflict.severity === "HIGH") {
          // Benachrichtigung senden
          const adminEmails = await getAdminsToNotify("bookingConflict");
          
          if (adminEmails.length > 0) {
            const appUrl = await getPublicUrl();
            const conflictDescription = formatConflict(conflict);
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
              } catch (error: any) {
                console.error(`[Cron] Error sending notification:`, error);
              }
            }

            if (atLeastOneSuccess) {
              await markConflictAsNotified(conflictKey, conflict.type);
              notificationsSent++;
            }
          }
        }
        
        checked++;
      }
    }

    // Prüfe auch überlappende Calendar Events (Events untereinander)
    const overlappingConflicts = allConflicts.filter(c => c.type === "OVERLAPPING_CALENDAR_EVENTS");
    
    for (const conflict of overlappingConflicts) {
      if (conflict.severity !== "HIGH") continue;
      
      const conflictKey = generateConflictKey(conflict);
      const alreadyNotified = await isConflictNotified(conflictKey, conflict.type);
      
      if (!alreadyNotified) {
        // Prüfe ob eines der Events in unseren manuellen Events ist
        const hasManualEvent = conflict.calendarEvents?.some(e => 
          manualEvents.some(me => me.id === e.id)
        );
        
        if (hasManualEvent) {
          // Hole Admins und sende Benachrichtigung
          const adminEmails = await getAdminsToNotify("bookingConflict");
          
          if (adminEmails.length > 0) {
            const appUrl = await getPublicUrl();
            const conflictDescription = formatConflict(conflict);
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
              } catch (error: any) {
                console.error(`[Cron] Error sending notification:`, error);
              }
            }

            if (atLeastOneSuccess) {
              await markConflictAsNotified(conflictKey, conflict.type);
              notificationsSent++;
            }
          }
        }
      }
    }

    // Prüfe auch OVERLAPPING_REQUESTS Konflikte (überlappende Buchungsanfragen)
    const overlappingRequestConflicts = allConflicts.filter(c => c.type === "OVERLAPPING_REQUESTS");
    console.log(`[Cron] Found ${overlappingRequestConflicts.length} OVERLAPPING_REQUESTS conflicts`);
    
    for (const conflict of overlappingRequestConflicts) {
      if (conflict.severity !== "HIGH") {
        console.log(`[Cron] Skipping OVERLAPPING_REQUESTS conflict - severity is ${conflict.severity} (not HIGH)`);
        continue;
      }
      
      // Zusätzliche Prüfung: Wenn 2 überlappende Anfragen und mindestens eine PENDING → keine E-Mail
      // (nur wenn beide APPROVED oder 3+ Anfragen → E-Mail senden)
      if (conflict.bookings.length === 2) {
        const hasPending = conflict.bookings.some(b => b.status === 'PENDING');
        if (hasPending) {
          console.log(`[Cron] Skipping OVERLAPPING_REQUESTS conflict - 2 bookings with at least one PENDING (no email)`);
          continue;
        }
      }
      
      const conflictKey = generateConflictKey(conflict);
      const alreadyNotified = await isConflictNotified(conflictKey, conflict.type);
      
      if (alreadyNotified) {
        console.log(`[Cron] Skipping OVERLAPPING_REQUESTS conflict - already notified (key: ${conflictKey})`);
        continue;
      }

      // Hole Admins und sende Benachrichtigung
      const adminEmails = await getAdminsToNotify("bookingConflict");
      
      if (adminEmails.length === 0) {
        console.log(`[Cron] No admins to notify for OVERLAPPING_REQUESTS conflict`);
        continue;
      }
      
      const appUrl = await getPublicUrl();
      const conflictDescription = formatConflict(conflict);
      const bookingsData = conflict.bookings.map(booking => ({
        bookingCode: booking.bookingCode,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        startDate: booking.startDate,
        endDate: booking.endDate,
        status: booking.status,
      }));

      console.log(`[Cron] Sending notification for OVERLAPPING_REQUESTS conflict with ${conflict.bookings.length} bookings to ${adminEmails.length} admins`);
      
      let atLeastOneSuccess = false;
      for (const adminEmail of adminEmails) {
        try {
          const result = await sendBookingConflictNotificationToAdmin({
            adminEmail,
            conflictType: conflict.type,
            conflictDescription,
            bookings: bookingsData,
            adminUrl: `${appUrl}/admin/bookings`,
          });
          
          if (result.success) {
            atLeastOneSuccess = true;
            console.log(`[Cron] Notification sent successfully to ${adminEmail}`);
          } else {
            console.log(`[Cron] Notification failed for ${adminEmail}:`, result.error);
          }
        } catch (error: any) {
          console.error(`[Cron] Error sending notification to ${adminEmail}:`, error);
        }
      }

      if (atLeastOneSuccess) {
        await markConflictAsNotified(conflictKey, conflict.type);
        notificationsSent++;
        console.log(`[Cron] Marked OVERLAPPING_REQUESTS conflict as notified (key: ${conflictKey})`);
      } else {
        console.log(`[Cron] Failed to send notification for OVERLAPPING_REQUESTS conflict - no successful sends`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Cron] Checked ${checked} events, sent ${notificationsSent} notifications (took ${duration}ms)`);
    
    // Memory cleanup: Clear large arrays
    // (JavaScript GC wird das automatisch machen, aber explizit für Debugging)
    if (duration > 30000) {
      console.warn(`[Cron] Warning: Conflict check took ${duration}ms (>30s), consider optimizing`);
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Cron] Error checking conflicts (took ${duration}ms):`, error);
  } finally {
    // Stelle sicher dass Flag immer zurückgesetzt wird
    isRunning = false;
    
    // Force garbage collection hint (nur wenn --expose-gc flag gesetzt ist)
    if (global.gc && typeof global.gc === 'function') {
      try {
        global.gc();
      } catch (e) {
        // Ignore
      }
    }
  }
}

/**
 * Startet den Cron-Job für Konflikt-Prüfung (alle 15 Minuten)
 */
export function startConflictCheckCron() {
  // Stoppe existierenden Job falls vorhanden
  if (conflictCheckJob) {
    conflictCheckJob.stop();
  }

  // Starte neuen Job: alle 15 Minuten (*/15 * * * *)
  conflictCheckJob = cron.schedule('*/15 * * * *', async () => {
    try {
      // Verwende setImmediate um nicht den Event Loop zu blockieren
      await Promise.resolve().then(() => checkConflictsForManualEvents());
    } catch (error: any) {
      console.error('[Cron] Unhandled error in conflict check job:', error);
    }
  }, {
    timezone: "Europe/Berlin", // Passend für Domburg
  });

  console.log('[Cron] Conflict check job scheduled: every 15 minutes');
  
  // Führe sofort eine Prüfung beim Start durch (optional)
  // checkConflictsForManualEvents();
}

/**
 * Stoppt den Cron-Job
 */
export function stopConflictCheckCron() {
  if (conflictCheckJob) {
    conflictCheckJob.stop();
    conflictCheckJob = null;
    console.log('[Cron] Conflict check job stopped');
  }
}

/**
 * Synchronisiert alle Buchungen mit Google Calendar
 * Wird intern aufgerufen (ohne User-Context)
 */
async function syncBookingsToCalendar() {
  // Verhindere mehrfache gleichzeitige Ausführungen
  if (isSyncRunning) {
    console.log('[Cron] Calendar sync already running, skipping...');
    return;
  }

  isSyncRunning = true;
  const startTime = Date.now();
  try {
    console.log('[Cron] Starting calendar sync...');
    
    const { syncAllBookingsToCalendar } = await import('../app/actions/google-calendar');
    // skipAuth=true für Cron-Job (kein User-Context)
    const result = await syncAllBookingsToCalendar(true);
    
    const duration = Date.now() - startTime;
    
    if (result.success) {
      const created = result.createdCount || 0;
      const updated = result.updatedCount || 0;
      const deleted = result.deletedCount || 0;
      const syncedFromCalendar = result.syncedFromCalendarCount || 0;
      
      console.log(`[Cron] Calendar sync completed (took ${duration}ms): ${created} created, ${updated} updated, ${deleted} deleted, ${syncedFromCalendar} synced from calendar`);
    } else {
      console.error(`[Cron] Calendar sync failed (took ${duration}ms):`, result.error);
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Cron] Error syncing calendar (took ${duration}ms):`, error);
  } finally {
    isSyncRunning = false;
  }
}

/**
 * Startet den Cron-Job für Google Calendar Synchronisation (alle 30 Minuten)
 */
export function startCalendarSyncCron() {
  // Stoppe existierenden Job falls vorhanden
  if (calendarSyncJob) {
    calendarSyncJob.stop();
  }

  // Starte neuen Job: alle 30 Minuten (*/30 * * * *)
  calendarSyncJob = cron.schedule('*/30 * * * *', async () => {
    try {
      // Verwende setImmediate um nicht den Event Loop zu blockieren
      await Promise.resolve().then(() => syncBookingsToCalendar());
    } catch (error: any) {
      console.error('[Cron] Unhandled error in calendar sync job:', error);
    }
  }, {
    timezone: "Europe/Berlin", // Passend für Domburg
  });

  console.log('[Cron] Calendar sync job scheduled: every 30 minutes');
}

/**
 * Stoppt den Calendar Sync Cron-Job
 */
export function stopCalendarSyncCron() {
  if (calendarSyncJob) {
    calendarSyncJob.stop();
    calendarSyncJob = null;
    console.log('[Cron] Calendar sync job stopped');
  }
}

