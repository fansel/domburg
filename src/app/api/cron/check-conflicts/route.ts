import { NextRequest, NextResponse } from "next/server";
import { findAllConflicts, checkAndNotifyConflictsForCalendarEvent, generateConflictKey } from "@/lib/booking-conflicts";
import { getCalendarEvents } from "@/lib/google-calendar";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  // Prüfe ob Request von Cron kommt (sicherer mit Secret)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Cron] Starting conflict check for manual calendar events...");
    
    // Hole alle manuellen Events aus dem letzten 24 Stunden (neue/aktualisierte)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1); // Letzten 24 Stunden
    
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 2);
    
    const events = await getCalendarEvents(startDate, endDate);
    
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

    // Hole alle aktuellen Konflikte
    const allConflicts = await findAllConflicts();
    
    // Prüfe Konflikte pro Konflikt (nicht pro Event), damit jeder Konflikt nur einmal benachrichtigt wird
    let checked = 0;
    let notificationsSent = 0;
    
    // Sammle alle Konflikte, die manuelle Events betreffen
    const relevantConflicts = allConflicts.filter(conflict => {
      if (conflict.type === "CALENDAR_CONFLICT") {
        // Prüfe ob das Calendar Event ein manuelles Event ist
        return conflict.calendarEvent?.id && 
               manualEvents.some(me => me.id === conflict.calendarEvent?.id);
      } else if (conflict.type === "OVERLAPPING_CALENDAR_EVENTS") {
        // Prüfe ob mindestens eines der Calendar Events ein manuelles Event ist
        return conflict.calendarEvents?.some(e => 
          manualEvents.some(me => me.id === e.id)
        );
      } else if (conflict.type === "OVERLAPPING_REQUESTS") {
        // Für OVERLAPPING_REQUESTS prüfen wir separat weiter unten
        return false;
      }
      return false;
    });

    // Prüfe jeden Konflikt nur einmal (nicht pro Event)
    for (const conflict of relevantConflicts) {
      if (conflict.severity !== "HIGH") {
        checked++;
        continue;
      }
      
      const conflictKey = generateConflictKey(conflict);
      const { isConflictNotified, markConflictAsNotified } = await import("@/lib/booking-conflicts");
      const alreadyNotified = await isConflictNotified(conflictKey, conflict.type);
      
      if (!alreadyNotified) {
        // Hole Admins und sende Benachrichtigung
        const { getAdminsToNotify } = await import("@/lib/notifications");
        const adminEmails = await getAdminsToNotify("bookingConflict");
        
        if (adminEmails.length > 0) {
          const { getPublicUrl } = await import("@/lib/email");
          const appUrl = await getPublicUrl();
          const { formatConflict } = await import("@/lib/booking-conflicts");
          const { sendBookingConflictNotificationToAdmin } = await import("@/lib/email");
          
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

    // Prüfe auch überlappende Calendar Events (Events untereinander)
    // Diese werden bereits oben abgedeckt, aber hier nochmal explizit für Vollständigkeit
    const overlappingConflicts = allConflicts.filter(c => c.type === "OVERLAPPING_CALENDAR_EVENTS");
    
    for (const conflict of overlappingConflicts) {
      if (conflict.severity !== "HIGH") continue;
      
      const conflictKey = generateConflictKey(conflict);
      const { isConflictNotified, markConflictAsNotified } = await import("@/lib/booking-conflicts");
      const alreadyNotified = await isConflictNotified(conflictKey, conflict.type);
      
      if (!alreadyNotified) {
        // Prüfe ob eines der Events in unseren manuellen Events ist
        const hasManualEvent = conflict.calendarEvents?.some(e => 
          manualEvents.some(me => me.id === e.id)
        );
        
        if (hasManualEvent) {
          // Hole Admins und sende Benachrichtigung
          const { getAdminsToNotify } = await import("@/lib/notifications");
          const adminEmails = await getAdminsToNotify("bookingConflict");
          
          if (adminEmails.length > 0) {
            const { getPublicUrl } = await import("@/lib/email");
            const appUrl = await getPublicUrl();
            const { formatConflict } = await import("@/lib/booking-conflicts");
            const { sendBookingConflictNotificationToAdmin } = await import("@/lib/email");
            
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

    console.log(`[Cron] Checked ${checked} events, sent ${notificationsSent} notifications`);

    return NextResponse.json({
      success: true,
      checked,
      notificationsSent,
      manualEventsCount: manualEvents.length,
      message: `Konflikte für ${checked} manuelle Events geprüft, ${notificationsSent} Benachrichtigungen gesendet`,
    });
  } catch (error: any) {
    console.error("[Cron] Error checking conflicts:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Fehler beim Prüfen der Konflikte" },
      { status: 500 }
    );
  }
}

