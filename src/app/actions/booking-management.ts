"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import { calculateBookingPrice, validateBookingDates } from "@/lib/pricing";
import { updateCalendarEvent } from "@/lib/google-calendar";
import { getBookingColorId } from "@/lib/utils";

// Buchung bearbeiten
export async function updateBooking(
  bookingId: string,
  data: {
    startDate?: string;
    endDate?: string;
    numberOfAdults?: number;
    numberOfChildren?: number;
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
    adminNotes?: string;
  }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Prüfe ob User Buchungen bearbeiten/genehmigen darf
    if (!user.canApproveBookings && user.role !== "SUPERADMIN") {
      return { success: false, error: "Sie haben keine Berechtigung, Buchungen zu bearbeiten" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return { success: false, error: "Buchung nicht gefunden" };
    }

    // PENDING und APPROVED Buchungen können bearbeitet werden
    if (!["PENDING", "APPROVED"].includes(booking.status)) {
      return { success: false, error: "Nur ausstehende oder genehmigte Buchungen können bearbeitet werden" };
    }

    // Prepare update data
    const updateData: any = {};

    // WICHTIG: Parse Datumsstrings konsistent mit Europe/Amsterdam Timezone
    // (gleiche Logik wie in createBooking)
    const parseDateFromISO = (dateStr: string): Date => {
      const date = new Date(dateStr);
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Amsterdam',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const dateStrFormatted = formatter.format(date);
      const [year, month, day] = dateStrFormatted.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    };

    if (data.startDate) updateData.startDate = parseDateFromISO(data.startDate);
    if (data.endDate) updateData.endDate = parseDateFromISO(data.endDate);
    if (data.numberOfAdults !== undefined) updateData.numberOfAdults = data.numberOfAdults;
    if (data.numberOfChildren !== undefined) updateData.numberOfChildren = data.numberOfChildren;
    if (data.guestName !== undefined) updateData.guestName = data.guestName;
    if (data.guestEmail) updateData.guestEmail = data.guestEmail;
    if (data.guestPhone !== undefined) updateData.guestPhone = data.guestPhone;
    if (data.adminNotes !== undefined) updateData.adminNotes = data.adminNotes;

    // Recalculate price if dates or guests changed
    if (data.startDate || data.endDate || data.numberOfAdults !== undefined || data.numberOfChildren !== undefined) {
      const startDate = data.startDate
        ? parseDateFromISO(data.startDate)
        : booking.startDate;
      const endDate = data.endDate ? parseDateFromISO(data.endDate) : booking.endDate;
      const numberOfAdults = data.numberOfAdults !== undefined ? data.numberOfAdults : booking.numberOfAdults;
      const numberOfChildren = data.numberOfChildren !== undefined ? data.numberOfChildren : booking.numberOfChildren;
      const totalGuests = numberOfAdults + numberOfChildren;

      // Validate dates (inkl. Google Calendar-Blockierungen)
      const validation = await validateBookingDates(startDate, endDate, bookingId);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Prüfe ob Family-Preis verwendet wird (aus bestehender Buchung über guestCode)
      let useFamilyPrice = false;
      if (booking.guestCode) {
        const token = await prisma.guestAccessToken.findUnique({
          where: { token: booking.guestCode, isActive: true },
        });
        useFamilyPrice = token?.useFamilyPrice || false;
      }

      const { totalPrice, ...pricingDetails } = await calculateBookingPrice(
        startDate,
        endDate,
        useFamilyPrice
      );

      updateData.totalPrice = totalPrice;
      updateData.pricingDetails = pricingDetails as any; // PriceCalculation wird als JSON gespeichert

      // Update Google Calendar Event if exists and booking is APPROVED
      // PENDING Buchungen haben noch kein Calendar Event
      if (booking.googleEventId && (booking.status === "APPROVED" || updateData.status === "APPROVED")) {
        try {
          const colorId = getBookingColorId(booking.id);
          await updateCalendarEvent(booking.googleEventId, {
            summary: `Buchung: ${data.guestName || booking.guestName || data.guestEmail || booking.guestEmail}`,
            description: `Geändert von Admin\n\nAnzahl Erwachsene: ${numberOfAdults}\nAnzahl Kinder: ${numberOfChildren}${
              data.adminNotes ? `\n\nNotizen: ${data.adminNotes}` : ""
            }`,
            startDate: startDate,
            endDate: endDate,
            colorId,
          });
        } catch (error) {
          console.error("Error updating calendar event:", error);
        }
      }
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "BOOKING_UPDATED",
        entity: "Booking",
        entityId: bookingId,
        details: JSON.parse(JSON.stringify(data)),
      },
    });

    // Prüfe auf Konflikte nach Update und benachrichtige Admins (nur wenn Daten geändert wurden)
    if (data.startDate || data.endDate) {
      const { checkAndNotifyConflictsForBooking } = await import("@/lib/booking-conflicts");
      await checkAndNotifyConflictsForBooking(bookingId).catch(error => {
        console.error("[Booking] Error checking conflicts after update:", error);
        // Fehler nicht weiterwerfen, damit Update erfolgreich bleibt
      });
    }

    revalidatePath(`/admin/bookings/${bookingId}`);
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/calendar");

    return { success: true, booking: updatedBooking };
  } catch (error) {
    console.error("Error updating booking:", error);
    return { success: false, error: "Fehler beim Aktualisieren der Buchung" };
  }
}

