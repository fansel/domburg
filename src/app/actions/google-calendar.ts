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

export async function syncAllBookingsToCalendar(skipAuth = false) {
  try {
    let user = null;
    if (!skipAuth) {
      user = await getCurrentUser();
      if (!user || !hasAdminRights(user.role)) {
        return { success: false, error: "Keine Berechtigung" };
      }
    }

    let createdCount = 0;
    let deletedCount = 0;
    let updatedCount = 0;
    let syncedFromCalendarCount = 0;
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
    console.log(`\n=== SYNC: STARTE SYNCHRONISATION ===`);
    console.log(`[SYNC] Gefunden: ${approvedBookings.length} APPROVED Buchungen`);
    console.log(`[SYNC] ==========================================\n`);
    
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
        
        console.log(`\n[SYNC] Processing booking ${booking.bookingCode} (${booking.guestName || booking.guestEmail}):`);
        console.log(`  [SYNC] DB (UTC): ${booking.startDate.toISOString().split('T')[0]} → ${booking.endDate.toISOString().split('T')[0]}`);
        console.log(`  [SYNC] Local (AMS): ${localStart} → ${localEnd}`);
        
        let needsNewEvent = false;
        
        // Prüfe ob Event mit googleEventId im Kalender existiert
        if (booking.googleEventId) {
          console.log(`  [SYNC] Event-ID vorhanden: ${booking.googleEventId}`);
          console.log(`  [SYNC] Prüfe ob Event im Google Kalender existiert...`);
          try {
            const calendarIdSetting = await prisma.setting.findUnique({
              where: { key: "GOOGLE_CALENDAR_ID" },
            });
            
            if (calendarIdSetting?.value) {
              const eventResponse = await calendar.events.get({
                calendarId: calendarIdSetting.value,
                eventId: booking.googleEventId,
              });
              
              const event = eventResponse.data;
              
              // Prüfe ob Event-Daten vorhanden sind
              if (!event) {
                console.log(`  [SYNC] ⚠️  Event-Daten sind null/undefined`);
                console.log(`  [SYNC] → Lösche alte googleEventId aus Datenbank`);
                await prisma.booking.update({
                  where: { id: booking.id },
                  data: { googleEventId: null },
                });
                console.log(`  [SYNC] → Erstelle neues Event...`);
                needsNewEvent = true;
                // Kein continue - Event-Erstellung wird später ausgeführt
              } else if (event.status === 'cancelled') {
                // Prüfe ob Event wirklich sichtbar ist (nicht cancelled)
                console.log(`  [SYNC] ⚠️  Event ist als "cancelled" markiert - nicht sichtbar!`);
                console.log(`  [SYNC] → Lösche alte googleEventId aus Datenbank`);
                await prisma.booking.update({
                  where: { id: booking.id },
                  data: { googleEventId: null },
                });
                console.log(`  [SYNC] → Erstelle neues Event...`);
                needsNewEvent = true;
                // Kein continue - Event-Erstellung wird später ausgeführt
              } else {
                // Event existiert und ist sichtbar
                console.log(`  [SYNC] ✅ Event gefunden im Google Kalender (Status: ${event.status})`);
                console.log(`  [SYNC] Event-Details:`, {
                  id: event.id,
                  summary: event.summary,
                  start: event.start?.date,
                  end: event.end?.date,
                  status: event.status,
                });
              
                // Prüfe ob sich das Datum im Google Kalender geändert hat
                if (event.start?.date && event.end?.date) {
                  // WICHTIG: Konsistente Datumsinterpretation mit createCalendarEvent
                  // Google Calendar gibt Datumsstrings im Format "YYYY-MM-DD" zurück
                  // Diese wurden beim Erstellen mit getLocalDateString (timeZone: 'Europe/Amsterdam') formatiert
                  // ABER: getLocalDateString formatiert ein UTC-Datum in Amsterdam-Zeit
                  // Wenn endDate = 2025-11-12 00:00:00 UTC ist, dann ist es in Amsterdam 2025-11-12 01:00:00 oder 02:00:00
                  // getLocalDateString gibt "2025-11-12" zurück
                  // Dann addieren wir 1 Tag: "2025-11-13"
                  // Google Calendar speichert end.date = "2025-11-13" (exklusiv)
                  // Beim Synchronisieren müssen wir "2025-11-13" als UTC-Datum interpretieren
                  // und dann 1 Tag abziehen, um das inklusive End-Datum zu erhalten
                  const parseDateFromISO = (dateStr: string): Date => {
                    // Parse direkt als UTC-Datum (YYYY-MM-DD Format)
                    // Da getLocalDateString ein UTC-Datum in Amsterdam-Zeit formatiert,
                    // aber Google Calendar die Datumsstrings ohne Zeitzone zurückgibt,
                    // interpretieren wir sie direkt als UTC (wie in der Datenbank gespeichert)
                    const [year, month, day] = dateStr.split('-').map(Number);
                    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
                  };
                  
                  // Google Calendar verwendet bei ganztägigen Events ein EXKLUSIVES End-Datum
                  // z.B. Event von 7. bis 9. November wird als end="2025-11-10" zurückgegeben
                  // Wir müssen einen Tag abziehen, um das korrekte inklusive End-Datum zu erhalten
                  const calendarStart = parseDateFromISO(event.start.date);
                  const calendarEnd = parseDateFromISO(event.end.date);
                  calendarEnd.setUTCDate(calendarEnd.getUTCDate() - 1); // Exklusives End-Datum zu inklusivem konvertieren (UTC)
                  
                  // Normalisiere Datenbank-Daten für Vergleich (verwende gleiche Methode)
                  // booking.startDate und booking.endDate sind bereits UTC-Daten
                  // Normalisiere sie auf UTC-Mitternacht für konsistenten Vergleich
                  const dbStart = new Date(booking.startDate);
                  dbStart.setUTCHours(0, 0, 0, 0);
                  const dbEnd = new Date(booking.endDate);
                  dbEnd.setUTCHours(0, 0, 0, 0);
                  
                  // Normalisiere Kalender-Daten für Vergleich (beide sind jetzt UTC)
                  calendarStart.setUTCHours(0, 0, 0, 0);
                  calendarEnd.setUTCHours(0, 0, 0, 0);
                  
                  // Prüfe ob sich das Datum geändert hat
                  const datesChanged = 
                    calendarStart.getTime() !== dbStart.getTime() || 
                    calendarEnd.getTime() !== dbEnd.getTime();
                  
                  if (datesChanged) {
                    console.log(`  [SYNC] 🔄 Datum wurde im Google Kalender geändert!`);
                    console.log(`    [SYNC] DB: ${dbStart.toISOString().split('T')[0]} → ${dbEnd.toISOString().split('T')[0]}`);
                    console.log(`    [SYNC] GC: ${calendarStart.toISOString().split('T')[0]} → ${calendarEnd.toISOString().split('T')[0]}`);
                    console.log(`  [SYNC] → Synchronisiere Datenbank mit Google Kalender...`);
                    
                    // Prüfe nochmal, ob Buchung noch APPROVED ist
                    const currentBooking = await prisma.booking.findUnique({
                      where: { id: booking.id },
                      select: { status: true },
                    });
                    
                    if (currentBooking?.status === BookingStatus.APPROVED) {
                      // Aktualisiere Datenbank mit neuen Daten aus Google Kalender
                      // parseDateFromISO wurde bereits oben definiert
                      const newStartDate = parseDateFromISO(event.start.date);
                      const newEndDate = parseDateFromISO(event.end.date);
                      
                      // Debug-Logging für Datumskonvertierung
                      console.log(`  [SYNC] 🔍 Datumskonvertierung:`);
                      console.log(`    [SYNC] Google Calendar start.date: ${event.start.date}`);
                      console.log(`    [SYNC] Google Calendar end.date: ${event.end.date} (exklusiv)`);
                      console.log(`    [SYNC] Nach parseDateFromISO - Start: ${newStartDate.toISOString()}`);
                      console.log(`    [SYNC] Nach parseDateFromISO - End (vor -1): ${newEndDate.toISOString()}`);
                      
                      // WICHTIG: Google Calendar verwendet exklusives End-Datum
                      // Wenn end.date = "2025-12-02" ist, bedeutet das, dass das Event am 1. Dezember endet
                      // Wir müssen einen Tag abziehen, um das inklusive End-Datum zu erhalten
                      const utcDay = newEndDate.getUTCDate();
                      const utcMonth = newEndDate.getUTCMonth();
                      const utcYear = newEndDate.getUTCFullYear();
                      
                      console.log(`    [SYNC] Vor Reduzierung - UTC: ${utcYear}-${utcMonth + 1}-${utcDay}`);
                      
                      newEndDate.setUTCDate(utcDay - 1); // Exklusives End-Datum zu inklusivem (UTC)
                      
                      console.log(`    [SYNC] Nach -1 Tag - End (inklusiv): ${newEndDate.toISOString()}`);
                      console.log(`    [SYNC] Nach -1 Tag - UTC: ${newEndDate.getUTCFullYear()}-${newEndDate.getUTCMonth() + 1}-${newEndDate.getUTCDate()}`);
                      console.log(`  [SYNC] → Berechne Preis neu für neue Daten...`);
                      // Berechne Preis neu für neue Daten
                      const { calculateBookingPrice } = await import("@/lib/pricing");
                      const existingPricingDetails = booking.pricingDetails as any;
                      const useFamilyPrice = existingPricingDetails?.useFamilyPrice || false;
                      const { totalPrice, ...pricingDetails } = await calculateBookingPrice(
                        newStartDate,
                        newEndDate,
                        useFamilyPrice
                      );
                      
                      // Format-Funktion für Datum
                      const formatDateForNotes = (date: Date): string => {
                        return new Intl.DateTimeFormat("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          timeZone: "Europe/Amsterdam",
                        }).format(date);
                      };
                      
                      // Erstelle Admin-Notiz-Eintrag für Datumsänderung
                      const now = new Date();
                      const timestamp = new Intl.DateTimeFormat("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/Amsterdam",
                      }).format(now);
                      
                      const dateChangeNote = `\n\n[${timestamp}] Datum im Google Kalender geändert:\n` +
                        `  Alt: ${formatDateForNotes(booking.startDate)} → ${formatDateForNotes(booking.endDate)}\n` +
                        `  Neu: ${formatDateForNotes(newStartDate)} → ${formatDateForNotes(newEndDate)}`;
                      
                      const updatedAdminNotes = (booking.adminNotes || "") + dateChangeNote;
                      
                      console.log(`  [SYNC] → Speichere in Datenbank:`);
                      console.log(`    [SYNC] Start: ${newStartDate.toISOString()}`);
                      console.log(`    [SYNC] End: ${newEndDate.toISOString()}`);
                      console.log(`  [SYNC] → Aktualisiere Datenbank (Datum + Preis + Admin-Notizen)...`);
                      await prisma.booking.update({
                        where: { id: booking.id },
                        data: {
                          startDate: newStartDate,
                          endDate: newEndDate,
                          totalPrice,
                          pricingDetails: pricingDetails as any,
                          adminNotes: updatedAdminNotes,
                        },
                      });
                      
                      console.log(`  [SYNC] ✅ Datenbank erfolgreich aktualisiert (Datum + Preis neu berechnet, Admin-Notizen aktualisiert)`);
                      
                      // WICHTIG: Aktualisiere auch das Event in Google Calendar mit den neuen Daten
                      // damit es beim nächsten Synchronisieren konsistent ist
                      console.log(`  [SYNC] → Aktualisiere Event in Google Calendar mit neuen Daten...`);
                      const { updateCalendarEvent } = await import("@/lib/google-calendar");
                      const { getBookingColorId } = await import("@/lib/utils");
                      const expectedSummary = `Buchung: ${booking.guestName || booking.guestEmail}`;
                      const expectedDescription = booking.message || "";
                      const expectedColorId = getBookingColorId(booking.id);
                      
                      const updateSuccess = await updateCalendarEvent(booking.googleEventId, {
                        summary: expectedSummary,
                        description: expectedDescription,
                        startDate: newStartDate,
                        endDate: newEndDate,
                        colorId: expectedColorId,
                      });
                      
                      if (updateSuccess) {
                        console.log(`  [SYNC] ✅ Event in Google Calendar erfolgreich aktualisiert`);
                      } else {
                        console.log(`  [SYNC] ⚠️  Fehler beim Aktualisieren des Events in Google Calendar`);
                      }
                      
                      syncedFromCalendarCount++;
                      // Überspringe weitere Verarbeitung für diese Buchung, da sie bereits synchronisiert wurde
                      continue;
                    } else {
                      console.log(`  [SYNC] ⚠️  Buchung ist nicht mehr APPROVED (${currentBooking?.status}), überspringe Synchronisation`);
                    }
                  } else {
                    // Datum unverändert - prüfe ob andere Details geändert wurden
                    console.log(`  [SYNC] ✅ Datum stimmt überein`);
                    
                    const expectedSummary = `Buchung: ${booking.guestName || booking.guestEmail}`;
                    const expectedDescription = booking.message || "";
                    const expectedColorId = getBookingColorId(booking.id);
                    
                    // Prüfe ob sich Summary, Description oder ColorId geändert haben
                    const summaryChanged = event.summary !== expectedSummary;
                    const descriptionChanged = (event.description || "") !== expectedDescription;
                    const colorIdChanged = event.colorId !== expectedColorId;
                    
                    if (summaryChanged || descriptionChanged || colorIdChanged) {
                      console.log(`  [SYNC] → Event-Details haben sich geändert (Summary: ${summaryChanged}, Description: ${descriptionChanged}, ColorId: ${colorIdChanged})`);
                      console.log(`  [SYNC] → Aktualisiere Event-Details...`);
                      const success = await updateCalendarEvent(booking.googleEventId, {
                        summary: expectedSummary,
                        description: expectedDescription,
                        startDate: booking.startDate,
                        endDate: booking.endDate,
                        colorId: expectedColorId,
                      });
                      if (success) {
                        console.log(`  [SYNC] ✅ Event erfolgreich aktualisiert`);
                        updatedCount++;
                      } else {
                        console.log(`  [SYNC] ❌ Fehler beim Aktualisieren des Events`);
                        console.log(`  [SYNC] → Lösche alte googleEventId aus Datenbank und erstelle neues Event...`);
                        await prisma.booking.update({
                          where: { id: booking.id },
                          data: { googleEventId: null },
                        });
                        needsNewEvent = true;
                      }
                    } else {
                      console.log(`  [SYNC] ✅ Event ist bereits synchronisiert - keine Änderungen nötig`);
                    }
                  }
                } else {
                  // Event existiert, aber kein Datum vorhanden - aktualisiere mit DB-Daten
                  console.log(`  [SYNC] ⚠️  Event existiert, aber kein Datum vorhanden`);
                  console.log(`  [SYNC] → Aktualisiere Event mit Datenbank-Daten...`);
                  const colorId = getBookingColorId(booking.id);
                  const success = await updateCalendarEvent(booking.googleEventId, {
                    summary: `Buchung: ${booking.guestName || booking.guestEmail}`,
                    description: booking.message || "",
                    startDate: booking.startDate,
                    endDate: booking.endDate,
                    colorId,
                  });
                  if (success) {
                    console.log(`  [SYNC] ✅ Event erfolgreich aktualisiert`);
                    updatedCount++;
                  } else {
                    console.log(`  [SYNC] ❌ Fehler beim Aktualisieren des Events`);
                    console.log(`  [SYNC] → Lösche alte googleEventId aus Datenbank und erstelle neues Event...`);
                    await prisma.booking.update({
                      where: { id: booking.id },
                      data: { googleEventId: null },
                    });
                    needsNewEvent = true;
                  }
                }
              }
            } else {
              console.log(`  [SYNC] ⚠️  Keine Calendar-ID konfiguriert`);
              console.log(`  [SYNC] → Erstelle neues Event...`);
              needsNewEvent = true;
            }
          } catch (error: any) {
            // Event existiert nicht mehr im Kalender (404)
            if (error.code === 404) {
              console.log(`  [SYNC] ❌ Event nicht im Google Kalender gefunden (404)`);
              console.log(`  [SYNC] → Lösche alte googleEventId aus Datenbank...`);
              await prisma.booking.update({
                where: { id: booking.id },
                data: { googleEventId: null },
              });
              console.log(`  [SYNC] → Erstelle neues Event...`);
              needsNewEvent = true;
            } else {
              console.log(`  [SYNC] ❌ Unerwarteter Fehler: ${error.message}`);
              throw error;
            }
          }
        } else {
          console.log(`  [SYNC] ⚠️  Keine googleEventId vorhanden`);
          console.log(`  [SYNC] → Erstelle neues Event...`);
          needsNewEvent = true;
        }

        // Erstelle neues Event falls nötig, aber nur wenn Buchung noch APPROVED ist
        if (needsNewEvent) {
          console.log(`  [SYNC] Prüfe ob Buchung noch APPROVED ist...`);
          // Prüfe nochmal, ob Buchung noch APPROVED ist (könnte zwischenzeitlich storniert worden sein)
          const currentBooking = await prisma.booking.findUnique({
            where: { id: booking.id },
            select: { status: true },
          });

          if (currentBooking?.status !== BookingStatus.APPROVED) {
            console.log(`  [SYNC] ⚠️  Buchung ist nicht mehr APPROVED (${currentBooking?.status}), überspringe Event-Erstellung`);
            continue;
          }

          console.log(`  [SYNC] ✅ Buchung ist noch APPROVED`);
          console.log(`  [SYNC] → Erstelle neues Event im Google Kalender...`);
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
            console.log(`  [SYNC] ✅ Event erfolgreich erstellt mit ID: ${eventId}`);
            console.log(`  [SYNC] → Prüfe ob Buchung noch APPROVED ist (vor Update)...`);
            // Prüfe nochmal vor dem Update, ob Buchung noch APPROVED ist
            const bookingBeforeUpdate = await prisma.booking.findUnique({
              where: { id: booking.id },
              select: { status: true },
            });

            if (bookingBeforeUpdate?.status === BookingStatus.APPROVED) {
              console.log(`  [SYNC] → Speichere googleEventId in Datenbank...`);
              await prisma.booking.update({
                where: { id: booking.id },
                data: { googleEventId: eventId },
              });
              console.log(`  [SYNC] ✅ googleEventId erfolgreich gespeichert`);
              createdCount++;
            } else {
              console.log(`  [SYNC] ⚠️  Buchung wurde vor Update storniert (${bookingBeforeUpdate?.status})`);
              console.log(`  [SYNC] → Lösche gerade erstelltes Event...`);
              // Lösche das gerade erstellte Event, da Buchung storniert wurde
              try {
                await deleteCalendarEvent(eventId);
                console.log(`  [SYNC] ✅ Event erfolgreich gelöscht`);
              } catch (deleteError) {
                console.error(`  [SYNC] ❌ Fehler beim Löschen des Events ${eventId}:`, deleteError);
              }
            }
          } else {
            console.log(`  [SYNC] ❌ Fehler beim Erstellen des Events (keine ID zurückgegeben)`);
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
          const deleted = await deleteCalendarEvent(booking.googleEventId);
          // deleteCalendarEvent gibt true zurück, auch wenn Event bereits gelöscht war (410)
          if (deleted) {
            await prisma.booking.update({
              where: { id: booking.id },
              data: { googleEventId: null },
            });
            deletedCount++;
          }
        }
      } catch (error: any) {
        // Falls deleteCalendarEvent einen anderen Fehler wirft
        console.error(`Error deleting event for booking ${booking.bookingCode}:`, error);
        errors.push(`Löschen ${booking.bookingCode}: ${error.message}`);
      }
    }

    // Activity log (nur wenn User vorhanden)
    if (user) {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "CALENDAR_SYNC",
          entity: "Booking",
          entityId: "BULK_SYNC",
          details: { createdCount, updatedCount, deletedCount, syncedFromCalendarCount, errors: errors.length > 0 ? errors : undefined },
        },
      });
    }

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
      syncedFromCalendarCount,
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

