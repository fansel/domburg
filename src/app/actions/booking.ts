"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateBookingPrice, validateBookingDates } from "@/lib/pricing";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";
import { 
  sendBookingNotificationToAdmin, 
  sendBookingConfirmationToGuest,
  sendBookingApprovalToGuest,
  sendBookingRejectionToGuest,
  sendMessageNotificationToGuest
} from "@/lib/email";
import { generateBookingCode } from "@/lib/booking-code";

export async function createBooking(formData: {
  startDate: string;
  endDate: string;
  numberOfGuests: number;
  guestEmail: string;
  guestName?: string;
  message?: string;
}) {
  try {
    // Optional: User holen wenn eingeloggt (für Admin-Buchungen)
    const user = await getCurrentUser();

    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);

    // E-Mail validieren
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.guestEmail)) {
      return { success: false, error: "Ungültige E-Mail-Adresse" };
    }

    // Daten validieren
    const validation = await validateBookingDates(startDate, endDate);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Preis berechnen
    const pricing = await calculateBookingPrice(startDate, endDate);

    // Eindeutigen Buchungscode generieren (mit Duplikat-Check)
    let bookingCode = generateBookingCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.booking.findUnique({
        where: { bookingCode },
      });
      if (!existing) break;
      bookingCode = generateBookingCode();
      attempts++;
    }

    // Buchung erstellen
    const booking = await prisma.booking.create({
      data: {
        bookingCode,
        guestEmail: formData.guestEmail,
        guestName: formData.guestName,
        userId: user?.id, // Optional: nur wenn eingeloggt
        startDate,
        endDate,
        numberOfGuests: formData.numberOfGuests,
        message: formData.message,
        totalPrice: pricing.totalPrice,
        pricingDetails: pricing,
        status: "PENDING",
      },
    });

    // Activity Log (nur wenn User eingeloggt)
    if (user) {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "BOOKING_CREATED",
          entity: "Booking",
          entityId: booking.id,
          details: { startDate: formData.startDate, endDate: formData.endDate },
        },
      });
    }

    // Bestätigungsmail an Gast senden
    await sendBookingConfirmationToGuest({
      to: formData.guestEmail,
      bookingCode: booking.bookingCode,
      guestName: formData.guestName,
      startDate,
      endDate,
      numberOfGuests: formData.numberOfGuests,
      message: formData.message,
    });

    // Admin-Benachrichtigung senden
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim());
    for (const adminEmail of adminEmails) {
      if (adminEmail) {
        await sendBookingNotificationToAdmin({
          to: adminEmail,
          bookingId: booking.id,
          startDate,
          endDate,
          guestName: formData.guestName || formData.guestEmail,
        });
      }
    }

    revalidatePath("/admin/bookings");

    return { 
      success: true, 
      bookingId: booking.id,
      bookingCode: booking.bookingCode 
    };
  } catch (error) {
    console.error("Error creating booking:", error);
    return { success: false, error: "Fehler beim Erstellen der Buchung" };
  }
}

export async function cancelBooking(bookingId: string, reason?: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Nicht authentifiziert" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return { success: false, error: "Buchung nicht gefunden" };
    }

    // Nur eigene Buchungen stornieren (außer Admin)
    // Hinweis: userId ist jetzt optional, da Buchungen ohne Account erstellt werden können
    if (booking.userId && booking.userId !== user.id && user.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Nur PENDING oder APPROVED Buchungen können storniert werden
    if (!["PENDING", "APPROVED"].includes(booking.status)) {
      return { success: false, error: "Buchung kann nicht storniert werden" };
    }

    // Google Calendar Event löschen
    if (booking.googleEventId) {
      await deleteCalendarEvent(booking.googleEventId);
    }

    // Buchung stornieren
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "BOOKING_CANCELLED",
        entity: "Booking",
        entityId: bookingId,
        details: { reason },
      },
    });

    revalidatePath("/admin/bookings");

    return { success: true };
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return { success: false, error: "Fehler beim Stornieren der Buchung" };
  }
}

export async function approveBooking(bookingId: string, adminNotes?: string) {
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

    if (booking.status !== "PENDING") {
      return { success: false, error: "Buchung kann nicht genehmigt werden" };
    }

    // Google Calendar Event erstellen
    const googleEventId = await createCalendarEvent({
      summary: `Buchung: ${booking.guestName || booking.guestEmail}`,
      description: booking.message || "",
      startDate: booking.startDate,
      endDate: booking.endDate,
      guestEmail: booking.guestEmail,
      guestName: booking.guestName || undefined,
    });

    // Buchung genehmigen
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: user.id,
        adminNotes,
        googleEventId,
      },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "BOOKING_APPROVED",
        entity: "Booking",
        entityId: bookingId,
        details: { googleEventId },
      },
    });

    // Email an Gast senden
    await sendBookingApprovalToGuest({
      to: booking.guestEmail,
      bookingCode: booking.bookingCode,
      guestName: booking.guestName || undefined,
      startDate: booking.startDate,
      endDate: booking.endDate,
      numberOfGuests: booking.numberOfGuests,
      totalPrice: booking.totalPrice || 0,
    });

    revalidatePath("/admin/bookings");

    return { success: true };
  } catch (error) {
    console.error("Error approving booking:", error);
    return { success: false, error: "Fehler beim Genehmigen der Buchung" };
  }
}

export async function rejectBooking(
  bookingId: string,
  reason: string,
  adminNotes?: string
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

    if (booking.status !== "PENDING") {
      return { success: false, error: "Buchung kann nicht abgelehnt werden" };
    }

    // Buchung ablehnen
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectedById: user.id,
        rejectionReason: reason,
        adminNotes,
      },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "BOOKING_REJECTED",
        entity: "Booking",
        entityId: bookingId,
        details: { reason },
      },
    });

    // Email an Gast senden
    await sendBookingRejectionToGuest({
      to: booking.guestEmail,
      bookingCode: booking.bookingCode,
      guestName: booking.guestName || undefined,
      startDate: booking.startDate,
      endDate: booking.endDate,
      reason,
    });

    revalidatePath("/admin/bookings");

    return { success: true };
  } catch (error) {
    console.error("Error rejecting booking:", error);
    return { success: false, error: "Fehler beim Ablehnen der Buchung" };
  }
}

