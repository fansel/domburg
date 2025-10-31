"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getCalendarClient, createCalendarEvent, updateCalendarEvent, getCalendarEvents } from "@/lib/google-calendar";
import { BookingStatus } from "@prisma/client";

export async function updateGoogleCalendarSettings({
  calendarId,
  serviceAccountJson,
}: {
  calendarId: string;
  serviceAccountJson?: string;
}) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
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
    if (!user || user.role !== "ADMIN") {
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
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Get all approved bookings without a Google Event ID
    const bookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.APPROVED,
        googleEventId: null,
      },
    });

    if (bookings.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    let syncedCount = 0;
    const errors: string[] = [];

    for (const booking of bookings) {
      try {
        const eventId = await createCalendarEvent({
          summary: `Buchung: ${booking.guestName || booking.guestEmail}`,
          description: booking.message || "",
          startDate: booking.startDate,
          endDate: booking.endDate,
          guestEmail: booking.guestEmail,
          guestName: booking.guestName || undefined,
        });

        if (eventId) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { googleEventId: eventId },
          });
          syncedCount++;
        }
      } catch (error: any) {
        console.error(`Error syncing booking ${booking.bookingCode}:`, error);
        errors.push(`${booking.bookingCode}: ${error.message}`);
      }
    }

    // Activity log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "CALENDAR_SYNC",
        entity: "Booking",
        entityId: "BULK_SYNC",
        details: { syncedCount, errors: errors.length > 0 ? errors : undefined },
      },
    });

    if (errors.length > 0 && syncedCount === 0) {
      return { success: false, error: `Alle Synchronisationen fehlgeschlagen: ${errors[0]}` };
    }

    revalidatePath("/admin/bookings");
    revalidatePath("/admin/calendar");
    
    return { success: true, syncedCount, partialErrors: errors.length > 0 ? errors : undefined };
  } catch (error: any) {
    console.error("Error syncing bookings to calendar:", error);
    return { success: false, error: error.message || "Synchronisation fehlgeschlagen" };
  }
}

export async function markEventAsInfo(eventId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
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
    if (!user || user.role !== "ADMIN") {
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

