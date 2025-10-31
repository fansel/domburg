"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateBookingPrice, validateBookingDates } from "@/lib/pricing";
import { updateCalendarEvent } from "@/lib/google-calendar";
import { sendMessageNotificationToGuest } from "@/lib/email";

// Buchung bearbeiten
export async function updateBooking(
  bookingId: string,
  data: {
    startDate?: string;
    endDate?: string;
    numberOfGuests?: number;
    guestName?: string;
    guestEmail?: string;
    adminNotes?: string;
  }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return { success: false, error: "Buchung nicht gefunden" };
    }

    // Prepare update data
    const updateData: any = {};

    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    if (data.numberOfGuests) updateData.numberOfGuests = data.numberOfGuests;
    if (data.guestName !== undefined) updateData.guestName = data.guestName;
    if (data.guestEmail) updateData.guestEmail = data.guestEmail;
    if (data.adminNotes !== undefined) updateData.adminNotes = data.adminNotes;

    // Recalculate price if dates or guests changed
    if (data.startDate || data.endDate || data.numberOfGuests) {
      const startDate = data.startDate
        ? new Date(data.startDate)
        : booking.startDate;
      const endDate = data.endDate ? new Date(data.endDate) : booking.endDate;
      const numberOfGuests = data.numberOfGuests || booking.numberOfGuests;

      // Validate dates (inkl. Google Calendar-Blockierungen)
      const validation = await validateBookingDates(startDate, endDate, bookingId);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const { totalPrice, ...pricingDetails } = await calculateBookingPrice(
        startDate,
        endDate
      );

      updateData.totalPrice = totalPrice;
      updateData.pricingDetails = pricingDetails;

      // Update Google Calendar Event if exists
      if (booking.googleEventId && booking.status === "APPROVED") {
        try {
          await updateCalendarEvent(booking.googleEventId, {
            summary: `Buchung: ${data.guestName || booking.guestName || data.guestEmail || booking.guestEmail}`,
            description: `Geändert von Admin\n\nAnzahl Gäste: ${numberOfGuests}${
              data.adminNotes ? `\n\nNotizen: ${data.adminNotes}` : ""
            }`,
            startDate: startDate,
            endDate: endDate,
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

    revalidatePath(`/admin/bookings/${bookingId}`);
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/calendar");

    return { success: true, booking: updatedBooking };
  } catch (error) {
    console.error("Error updating booking:", error);
    return { success: false, error: "Fehler beim Aktualisieren der Buchung" };
  }
}

// Nachricht an Gast senden
export async function sendMessageToGuest(bookingId: string, content: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return { success: false, error: "Buchung nicht gefunden" };
    }

    const message = await prisma.message.create({
      data: {
        bookingId,
        userId: user.id,
        senderEmail: user.email,
        senderName: user.name,
        content,
        isFromGuest: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Send email notification to guest
    await sendMessageNotificationToGuest({
      guestEmail: booking.guestEmail,
      bookingCode: booking.bookingCode,
      guestName: booking.guestName || undefined,
      messageContent: content,
      senderName: user.name || "Administrator",
    });

    revalidatePath(`/admin/bookings/${bookingId}`);

    return { success: true, message };
  } catch (error) {
    console.error("Error sending message:", error);
    return { success: false, error: "Fehler beim Senden der Nachricht" };
  }
}

// Nachricht von Gast empfangen (API Route)
export async function sendMessageFromGuest(
  bookingCode: string,
  guestEmail: string,
  content: string,
  guestName?: string
) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { bookingCode },
    });

    if (!booking) {
      return { success: false, error: "Buchung nicht gefunden" };
    }

    if (booking.guestEmail !== guestEmail) {
      return { success: false, error: "Keine Berechtigung" };
    }

    const message = await prisma.message.create({
      data: {
        bookingId: booking.id,
        senderEmail: guestEmail,
        senderName: guestName,
        content,
        isFromGuest: true,
      },
    });

    // TODO: Send notification to admin

    return { success: true, message };
  } catch (error) {
    console.error("Error sending message from guest:", error);
    return { success: false, error: "Fehler beim Senden der Nachricht" };
  }
}

