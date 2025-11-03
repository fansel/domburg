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
        
        const { isConflictNotified } = await import("@/lib/booking-conflicts");
        const alreadyNotified = await isConflictNotified(conflictKey, conflict.type);
        
        if (!alreadyNotified && conflict.severity === "HIGH") {
          await checkAndNotifyConflictsForCalendarEvent(event.id);
          notificationsSent++;
        }
        
        checked++;
      }
    }

    // Prüfe auch überlappende Calendar Events (Events untereinander)
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

