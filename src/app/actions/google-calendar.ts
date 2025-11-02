"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser, hasAdminRights, isSuperAdmin } from "@/lib/auth";
import { getCalendarClient, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarEvents, getCalendarId } from "@/lib/google-calendar";
import { BookingStatus } from "@prisma/client";
import { getBookingColorId } from "@/lib/utils";

export async function updateGoogleCalendarSettings({
  calendarId,
  serviceAccountJson,
}: {
  calendarId: string;
  serviceAccountJson?: string;
}) {
  try {
    const user = await getCurrentUser();
    const isSuper = await isSuperAdmin();
    if (!user || !isSuper) {
      return { success: false, error: "Keine Berechtigung - Nur Superadmins können Google Calendar-Einstellungen ändern" };
    }

    if (!calendarId.trim()) {
      return { success: false, error: "Calendar-ID ist erforderlich" };
    }

    // Update or create calendar ID setting
    await prisma.setting.upsert({
      where: { key: "GOOGLE_CALENDAR_ID" },
      update: { value: calendarId },
      create: { key: "GOOGLE_CALENDAR_ID", value: calendarId },
    });

    // If service account JSON is provided, save it
    if (serviceAccountJson?.trim()) {
      try {
        const credentials = JSON.parse(serviceAccountJson);
        
        // Validate basic structure
        if (!credentials.type || !credentials.project_id || !credentials.private_key || !credentials.client_email) {
          return { success: false, error: "Ungültige Service Account Credentials" };
        }

        await prisma.setting.upsert({
          where: { key: "GOOGLE_SERVICE_ACCOUNT" },
          update: { value: JSON.stringify(credentials) },
          create: { key: "GOOGLE_SERVICE_ACCOUNT", value: JSON.stringify(credentials) },
        });

        // Also save the service account email for display
        await prisma.setting.upsert({
          where: { key: "GOOGLE_SERVICE_ACCOUNT_EMAIL" },
          update: { value: credentials.client_email },
          create: { key: "GOOGLE_SERVICE_ACCOUNT_EMAIL", value: credentials.client_email },
        });

      } catch (error) {
        return { success: false, error: "Ungültiges JSON-Format" };
      }
    }

    // Activity log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "SETTINGS_UPDATED",
        entity: "Settings",
        entityId: "GOOGLE_CALENDAR",
        details: { calendarId, updatedServiceAccount: !!serviceAccountJson },
      },
    });

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error) {
    console.error("Error updating Google Calendar settings:", error);
    return { success: false, error: "Fehler beim Speichern der Einstellungen" };
  }
}

export async function testGoogleCalendarConnection() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    const calendar = await getCalendarClient();
    if (!calendar) {
      return { success: false, error: "Google Calendar nicht konfiguriert" };
    }

    // Get calendar settings to verify
    const calendarIdSetting = await prisma.setting.findUnique({
      where: { key: "GOOGLE_CALENDAR_ID" },
    });

    if (!calendarIdSetting?.value) {
      return { success: false, error: "Calendar-ID nicht konfiguriert" };
    }

    // Try to get calendar details
    try {
      const response = await calendar.calendars.get({
        calendarId: calendarIdSetting.value,
      });

      return { 
        success: true, 
        calendarName: response.data.summary || "Unknown Calendar" 
      };
    } catch (error: any) {
      if (error.code === 404) {
        return { success: false, error: "Kalender nicht gefunden - bitte Calendar-ID prüfen" };
      } else if (error.code === 403) {
        return { success: false, error: "Keine Berechtigung - bitte Kalender für Service Account freigeben" };
      } else {
        return { success: false, error: `Verbindungsfehler: ${error.message}` };
      }
    }
  } catch (error: any) {
    console.error("Error testing Google Calendar connection:", error);
    return { success: false, error: error.message || "Verbindung fehlgeschlagen" };
  }
}

export async function syncAllBookingsToCalendar() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    let createdCount = 0;
    let deletedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    const calendar = await getCalendarClient();
    if (!calendar) {
      return { success: false, error: "Google Calendar nicht konfiguriert" };
    }

    // Hole alle APPROVED Buchungen
    const approvedBookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.APPROVED,
      },
    });

    // 1. Erstelle/Aktualisiere Events für APPROVED Buchungen
    console.log(`=== SYNC: Processing ${approvedBookings.length} APPROVED bookings ===`);
    
    for (const booking of approvedBookings) {
      try {
        // Konvertiere zu lokaler Zeit für Logging
        const getLocalDateString = (date: Date): string => {
          const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Amsterdam',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          return formatter.format(date);
        };
        
        const localStart = getLocalDateString(booking.startDate);
        const localEnd = getLocalDateString(booking.endDate);
        
        console.log(`Processing booking ${booking.bookingCode} (${booking.guestName}):`);
        console.log(`  DB (UTC): ${booking.startDate.toISOString().split('T')[0]} → ${booking.endDate.toISOString().split('T')[0]}`);
        console.log(`  Local (AMS): ${localStart} → ${localEnd}`);
        
        let needsNewEvent = false;
        
        // Prüfe ob Event mit googleEventId im Kalender existiert
        if (booking.googleEventId) {
          console.log(`  - Has googleEventId: ${booking.googleEventId}`);
          try {
            const calendarIdSetting = await prisma.setting.findUnique({
              where: { key: "GOOGLE_CALENDAR_ID" },
            });
            
            if (calendarIdSetting?.value) {
              await calendar.events.get({
                calendarId: calendarIdSetting.value,
                eventId: booking.googleEventId,
              });
              // Event existiert - aktualisiere es mit korrekten Daten (falls alte UTC-Konvertierung)
              console.log(`  - Event exists in calendar, updating...`);
              const colorId = getBookingColorId(booking.id);
              const success = await updateCalendarEvent(booking.googleEventId, {
                summary: `Buchung: ${booking.guestName || booking.guestEmail}`,
                description: booking.message || "",
                startDate: booking.startDate,
                endDate: booking.endDate,
                colorId,
              });
              if (success) {
                console.log(`  - Updated successfully`);
                updatedCount++;
              }
            } else {
              needsNewEvent = true;
            }
          } catch (error: any) {
            // Event existiert nicht mehr im Kalender (404)
            if (error.code === 404) {
              console.log(`  - Event not found in calendar (404), will create new`);
              needsNewEvent = true;
            } else {
              throw error;
            }
          }
        } else {
          console.log(`  - No googleEventId, will create new`);
          needsNewEvent = true;
        }

        // Erstelle neues Event falls nötig
        if (needsNewEvent) {
          console.log(`  - Creating new calendar event...`);
          const colorId = getBookingColorId(booking.id);
          const eventId = await createCalendarEvent({
            summary: `Buchung: ${booking.guestName || booking.guestEmail}`,
            description: booking.message || "",
            startDate: booking.startDate,
            endDate: booking.endDate,
            guestEmail: booking.guestEmail,
            guestName: booking.guestName || undefined,
            colorId,
          });

          if (eventId) {
            console.log(`  - Created successfully with ID: ${eventId}`);
            await prisma.booking.update({
              where: { id: booking.id },
              data: { googleEventId: eventId },
            });
            createdCount++;
          } else {
            console.log(`  - Failed to create event (no ID returned)`);
          }
        }
      } catch (error: any) {
        console.error(`Error syncing event for booking ${booking.bookingCode}:`, error);
        errors.push(`Synchronisieren ${booking.bookingCode}: ${error.message}`);
      }
    }

    // 2. Lösche Events für CANCELLED/REJECTED Buchungen mit googleEventId
    const cancelledWithEvent = await prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.CANCELLED, BookingStatus.REJECTED] },
        googleEventId: { not: null },
      },
    });

    for (const booking of cancelledWithEvent) {
      try {
        if (booking.googleEventId) {
          await deleteCalendarEvent(booking.googleEventId);
          await prisma.booking.update({
            where: { id: booking.id },
            data: { googleEventId: null },
          });
          deletedCount++;
        }
      } catch (error: any) {
        // Ignoriere 410 (Already deleted) - Event wurde bereits manuell gelöscht
        if (error.code === 410) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { googleEventId: null },
          });
          deletedCount++;
        } else {
          console.error(`Error deleting event for booking ${booking.bookingCode}:`, error);
          errors.push(`Löschen ${booking.bookingCode}: ${error.message}`);
        }
      }
    }

    // Activity log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "CALENDAR_SYNC",
        entity: "Booking",
        entityId: "BULK_SYNC",
        details: { createdCount, updatedCount, deletedCount, errors: errors.length > 0 ? errors : undefined },
      },
    });

    if (errors.length > 0 && createdCount === 0 && updatedCount === 0 && deletedCount === 0) {
      return { success: false, error: `Alle Synchronisationen fehlgeschlagen: ${errors[0]}` };
    }

    revalidatePath("/admin/bookings");
    revalidatePath("/admin/calendar");
    
    return { 
      success: true, 
      createdCount,
      updatedCount, 
      deletedCount,
      partialErrors: errors.length > 0 ? errors : undefined 
    };
  } catch (error: any) {
    console.error("Error syncing bookings to calendar:", error);
    return { success: false, error: error.message || "Synchronisation fehlgeschlagen" };
  }
}

export async function markEventAsInfo(eventId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Event-Farbe auf Grün (10) setzen
    const success = await updateCalendarEvent(eventId, {
      colorId: '10', // Basilikum/Grün = Info-Event
    });

    if (success) {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "EVENT_MARKED_AS_INFO",
          entity: "CalendarEvent",
          entityId: eventId,
          details: { colorId: '10' },
        },
      });

      revalidatePath("/admin/calendar");
      return { success: true };
    }

    return { success: false, error: "Event konnte nicht aktualisiert werden" };
  } catch (error: any) {
    console.error("Error marking event as info:", error);
    return { success: false, error: error.message || "Fehler beim Markieren" };
  }
}

export async function unmarkEventAsInfo(eventId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Event-Farbe zurücksetzen (null = Standard)
    const success = await updateCalendarEvent(eventId, {
      colorId: undefined,
    });

    if (success) {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "EVENT_UNMARKED_AS_INFO",
          entity: "CalendarEvent",
          entityId: eventId,
          details: { colorId: null },
        },
      });

      revalidatePath("/admin/calendar");
      return { success: true };
    }

    return { success: false, error: "Event konnte nicht aktualisiert werden" };
  } catch (error: any) {
    console.error("Error unmarking event as info:", error);
    return { success: false, error: error.message || "Fehler beim Entmarkieren" };
  }
}

export async function cleanupBookingEvents() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    const calendar = await getCalendarClient();
    if (!calendar) {
      return { success: false, error: "Google Calendar nicht konfiguriert" };
    }

    const calendarId = await getCalendarId();
    if (!calendarId) {
      return { success: false, error: "Calendar-ID nicht konfiguriert" };
    }

    // Hole alle Events
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3); // 3 Monate zurück
    
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 2); // 2 Jahre voraus

    const response = await calendar.events.list({
      calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      maxResults: 2500,
    });

    const events = response.data.items || [];
    
    let deletedCount = 0;
    const errors: string[] = [];

    // Lösche nur Events, die mit "Buchung:" beginnen
    for (const event of events) {
      if (event.summary?.startsWith('Buchung:')) {
        try {
          await calendar.events.delete({
            calendarId,
            eventId: event.id!,
          });
          console.log(`Deleted event: ${event.summary} (${event.id})`);
          deletedCount++;
        } catch (error: any) {
          if (error.code !== 410) { // Ignoriere "already deleted"
            console.error(`Error deleting event ${event.id}:`, error);
            errors.push(`${event.summary}: ${error.message}`);
          } else {
            deletedCount++; // Zähle auch bereits gelöschte
          }
        }
      }
    }

    // Lösche alle googleEventId Referenzen aus der Datenbank
    await prisma.booking.updateMany({
      where: {
        googleEventId: { not: null },
      },
      data: {
        googleEventId: null,
      },
    });

    // Activity log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "CALENDAR_CLEANUP",
        entity: "CalendarEvent",
        entityId: "BULK_DELETE",
        details: { deletedCount, totalEvents: events.length, errors: errors.length > 0 ? errors : undefined },
      },
    });

    revalidatePath("/admin/calendar");
    revalidatePath("/admin/bookings");
    
    return {
      success: true,
      deletedCount,
      totalEvents: events.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    console.error("Error cleaning up calendar:", error);
    return { success: false, error: error.message || "Fehler beim Bereinigen" };
  }
}

