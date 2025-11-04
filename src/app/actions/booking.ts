"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import { calculateBookingPrice, validateBookingDates } from "@/lib/pricing";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";
import { 
  sendBookingNotificationToAdmin, 
  sendBookingConfirmationToGuest,
  sendBookingApprovalToGuest,
  sendBookingRejectionToGuest,
  sendBookingCancellationToGuest,
  sendMessageNotificationToGuest,
  sendBookingApprovedNotificationToAdmin,
  sendBookingRejectedNotificationToAdmin,
  sendBookingCancelledNotificationToAdmin,
  sendNewMessageFromGuestNotificationToAdmin,
} from "@/lib/email";
import { generateBookingCode } from "@/lib/booking-code";
import { getBookingColorId } from "@/lib/utils";

export async function createBooking(formData: {
  startDate: string;
  endDate: string;
  numberOfAdults: number;
  numberOfChildren?: number;
  guestEmail: string;
  guestName?: string;
  guestPhone?: string;
  message?: string;
  guestCode?: string;
  useFamilyPrice?: boolean;
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

    // Name validieren (optional für Admin-Buchungen)
    // Telefonnummer ist optional für Admin-Buchungen

    // Daten validieren
    const validation = await validateBookingDates(startDate, endDate);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Prüfe ob Family-Preis verwendet wird (explizit gesetzt oder über Guest Code)
    let useFamilyPrice = formData.useFamilyPrice || false;
    if (!useFamilyPrice && formData.guestCode) {
      // Prüfe ob Guest Code Family-Preis hat
      const token = await prisma.guestAccessToken.findUnique({
        where: { token: formData.guestCode, isActive: true },
      });
      useFamilyPrice = token?.useFamilyPrice || false;
    }
    
    // Preis berechnen (Strandbude wird automatisch aktiviert wenn in aktiver Session)
    const pricing = await calculateBookingPrice(startDate, endDate, useFamilyPrice);
    
    // Prüfe ob Strandbude automatisch aktiviert wurde
    // Beachte: Bei Family-Preis ist Strandbude aktiviert (useBeachHut = true), aber kostenlos (beachHutPrice = 0)
    // Daher prüfen wir anhand der Session-Verfügbarkeit, nicht am Preis
    const allSessions = await prisma.beachHutSession.findMany();
    let useBeachHut = false;
    
    if (allSessions.length > 0) {
      const activeSessions = await prisma.beachHutSession.findMany({
        where: {
          isActive: true,
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } },
          ],
        },
      });
      useBeachHut = activeSessions.length > 0;
    } else {
      // Wenn keine Sessions definiert sind, ist Strandbude ganzjährig verfügbar
      useBeachHut = true;
    }

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
        guestName: formData.guestName || null,
        guestPhone: formData.guestPhone || null,
        guestCode: formData.guestCode || null, // Speichere den verwendeten Zugangscode
        userId: user?.id, // Optional: nur wenn eingeloggt
        startDate,
        endDate,
        numberOfAdults: formData.numberOfAdults,
      numberOfChildren: formData.numberOfChildren || 0,
        useBeachHut: useBeachHut,
        message: formData.message,
        totalPrice: pricing.totalPrice,
        pricingDetails: pricing as any, // PriceCalculation wird als JSON gespeichert
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
      guestEmail: formData.guestEmail,
      bookingCode: booking.bookingCode,
      guestName: formData.guestName,
      startDate,
      endDate,
      numberOfAdults: formData.numberOfAdults,
      numberOfChildren: formData.numberOfChildren || 0,
      totalPrice: parseFloat(pricing.totalPrice.toString()),
      guestCode: formData.guestCode || undefined,
    });

    // Admin-Benachrichtigung senden (nur an Admins, die Benachrichtigungen aktiviert haben)
    const { getAdminsToNotify } = await import("@/lib/notifications");
    const adminEmails = await getAdminsToNotify("newBooking");
    console.log(`[Booking] Sending new booking notifications to ${adminEmails.length} admins:`, adminEmails);
    for (const adminEmail of adminEmails) {
      try {
        const result = await sendBookingNotificationToAdmin({
          adminEmail,
          guestEmail: formData.guestEmail,
          guestName: formData.guestName,
          bookingCode: booking.bookingCode,
          startDate,
          endDate,
          numberOfAdults: formData.numberOfAdults,
          numberOfChildren: formData.numberOfChildren || 0,
          totalPrice: parseFloat(pricing.totalPrice.toString()),
          message: formData.message,
          guestCode: formData.guestCode || undefined,
        });
        console.log(`[Booking] Notification sent to ${adminEmail}:`, result.success ? "success" : "failed", result.error || "");
      } catch (error: any) {
        console.error(`[Booking] Error sending notification to ${adminEmail}:`, error);
      }
    }

    // Prüfe auf Konflikte und benachrichtige Admins
    const { checkAndNotifyConflictsForBooking } = await import("@/lib/booking-conflicts");
    await checkAndNotifyConflictsForBooking(booking.id).catch(error => {
      console.error("[Booking] Error checking conflicts:", error);
      // Fehler nicht weiterwerfen, damit Buchung erfolgreich bleibt
    });

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

    // Nur eigene Buchungen stornieren (außer Admin mit Berechtigung)
    // Hinweis: userId ist jetzt optional, da Buchungen ohne Account erstellt werden können
    if (booking.userId && booking.userId !== user.id) {
      // Prüfe ob User Admin mit Berechtigung ist
      if (!hasAdminRights(user.role)) {
        return { success: false, error: "Keine Berechtigung" };
      }
      // Prüfe ob Admin Buchungen stornieren darf (gleiche Berechtigung wie genehmigen)
      if (!user.canApproveBookings && user.role !== "SUPERADMIN") {
        return { success: false, error: "Sie haben keine Berechtigung, Buchungen zu stornieren" };
      }
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

    // E-Mail an Gast senden
    await sendBookingCancellationToGuest({
      guestEmail: booking.guestEmail,
      bookingCode: booking.bookingCode,
      guestName: booking.guestName || undefined,
      startDate: booking.startDate,
      endDate: booking.endDate,
      cancellationReason: reason,
      guestCode: booking.guestCode || undefined,
    });

    // Benachrichtigung an andere Admins senden (außer dem, der storniert hat)
    const { getAdminsToNotify } = await import("@/lib/notifications");
    // Für Stornierung verwenden wir bookingApproved als Notification-Typ (oder wir erweitern später)
    // Für jetzt: Benachrichtige alle Admins, die bookingApproved aktiviert haben
    const adminEmails = await getAdminsToNotify("bookingApproved");
    console.log(`[Booking] Sending cancellation notifications to ${adminEmails.length} admins (excluding ${user.email}):`, adminEmails);
    for (const adminEmail of adminEmails) {
      // Überspringe den Admin, der die Stornierung durchgeführt hat
      if (adminEmail !== user.email) {
        try {
          const result = await sendBookingCancelledNotificationToAdmin({
            adminEmail,
            bookingCode: booking.bookingCode,
            guestName: booking.guestName || undefined,
            guestEmail: booking.guestEmail,
            startDate: booking.startDate,
            endDate: booking.endDate,
            cancelledByName: user.name || user.email,
            cancellationReason: reason,
          });
          console.log(`[Booking] Cancellation notification sent to ${adminEmail}:`, result.success ? "success" : "failed", result.error || "");
        } catch (error: any) {
          console.error(`[Booking] Error sending cancellation notification to ${adminEmail}:`, error);
        }
      }
    }

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

export async function restoreBooking(bookingId: string, restoreToStatus: "PENDING" | "APPROVED" = "APPROVED") {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Prüfe ob User Buchungen bearbeiten/genehmigen darf
    if (!user.canApproveBookings && user.role !== "SUPERADMIN") {
      return { success: false, error: "Sie haben keine Berechtigung, Buchungen wiederherzustellen" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return { success: false, error: "Buchung nicht gefunden" };
    }

    // Nur CANCELLED Buchungen können wiederhergestellt werden
    if (booking.status !== "CANCELLED") {
      return { success: false, error: "Buchung ist nicht storniert" };
    }

    const updateData: any = {
      status: restoreToStatus,
      cancelledAt: null,
      cancellationReason: null,
    };

    // Wenn zu APPROVED wiederhergestellt wird, Google Calendar Event erstellen
    if (restoreToStatus === "APPROVED" && !booking.googleEventId) {
      const colorId = getBookingColorId(booking.id);
      const googleEventId = await createCalendarEvent({
        summary: `Buchung: ${booking.guestName || booking.guestEmail}`,
        description: booking.message || "",
        startDate: booking.startDate,
        endDate: booking.endDate,
        guestEmail: booking.guestEmail,
        guestName: booking.guestName || undefined,
        colorId,
      });
      
      if (googleEventId) {
        updateData.googleEventId = googleEventId;
        updateData.approvedAt = new Date();
        updateData.approvedById = user.id;
      }
    } else if (restoreToStatus === "APPROVED" && booking.googleEventId) {
      // Wenn bereits googleEventId existiert, nur Status zurücksetzen
      updateData.approvedAt = booking.approvedAt || new Date();
      updateData.approvedById = booking.approvedById || user.id;
    }

    // Buchung wiederherstellen
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
    });

    // E-Mail an Gast senden je nach Status
    if (restoreToStatus === "APPROVED") {
      // Wenn zu APPROVED wiederhergestellt, sende Genehmigungs-E-Mail
      const { calculateBookingPrice } = await import("@/lib/pricing");
      const pricing = await calculateBookingPrice(
        booking.startDate,
        booking.endDate,
        false
      );
      
      // Admin-Notizen werden NICHT an Gäste gesendet - nur für interne Admin-Notizen
      await sendBookingApprovalToGuest({
        guestEmail: booking.guestEmail,
        bookingCode: booking.bookingCode,
        guestName: booking.guestName || undefined,
        startDate: booking.startDate,
        endDate: booking.endDate,
        numberOfAdults: (booking as any).numberOfAdults ?? (booking as any).numberOfGuests ?? 1,
        numberOfChildren: (booking as any).numberOfChildren ?? 0,
        totalPrice: parseFloat((booking.totalPrice || 0).toString()),
        guestCode: booking.guestCode || undefined,
      });

      // Benachrichtigung an andere Admins senden (außer dem, der wiederhergestellt hat)
      const { getAdminsToNotify } = await import("@/lib/notifications");
      const adminEmails = await getAdminsToNotify("bookingApproved");
      console.log(`[Booking] Sending restoration notifications to ${adminEmails.length} admins (excluding ${user.email}):`, adminEmails);
      for (const adminEmail of adminEmails) {
        if (adminEmail !== user.email) {
          try {
            const result = await sendBookingApprovedNotificationToAdmin({
              adminEmail,
              bookingCode: booking.bookingCode,
              guestName: booking.guestName || undefined,
              guestEmail: booking.guestEmail,
              startDate: booking.startDate,
              endDate: booking.endDate,
              approvedByName: user.name || user.email,
              adminNotes: booking.adminNotes || undefined, // Admin-Notizen an andere Admins senden
            });
            console.log(`[Booking] Restoration notification sent to ${adminEmail}:`, result.success ? "success" : "failed", result.error || "");
          } catch (error: any) {
            console.error(`[Booking] Error sending restoration notification to ${adminEmail}:`, error);
          }
        }
      }
    } else if (restoreToStatus === "PENDING") {
      // Wenn zu PENDING wiederhergestellt, sende Bestätigungs-E-Mail (wie bei neuer Buchung)
      const { calculateBookingPrice } = await import("@/lib/pricing");
      const pricing = await calculateBookingPrice(
        booking.startDate,
        booking.endDate,
        false
      );
      
      await sendBookingConfirmationToGuest({
        guestEmail: booking.guestEmail,
        bookingCode: booking.bookingCode,
        guestName: booking.guestName || undefined,
        startDate: booking.startDate,
        endDate: booking.endDate,
        numberOfAdults: (booking as any).numberOfAdults ?? (booking as any).numberOfGuests ?? 1,
        numberOfChildren: (booking as any).numberOfChildren ?? 0,
        totalPrice: parseFloat((booking.totalPrice || 0).toString()),
        guestCode: booking.guestCode || undefined,
      });

      // Benachrichtigung an Admins senden
      const { getAdminsToNotify } = await import("@/lib/notifications");
      const adminEmails = await getAdminsToNotify("newBooking");
      console.log(`[Booking] Sending restoration to pending notifications to ${adminEmails.length} admins:`, adminEmails);
      for (const adminEmail of adminEmails) {
        try {
          const result = await sendBookingNotificationToAdmin({
            adminEmail,
            guestEmail: booking.guestEmail,
            guestName: booking.guestName || undefined,
            bookingCode: booking.bookingCode,
            startDate: booking.startDate,
            endDate: booking.endDate,
            numberOfAdults: (booking as any).numberOfAdults ?? (booking as any).numberOfGuests ?? 1,
            numberOfChildren: (booking as any).numberOfChildren ?? 0,
            totalPrice: parseFloat((booking.totalPrice || 0).toString()),
            message: booking.message || undefined,
            guestCode: booking.guestCode || undefined,
          });
          console.log(`[Booking] Restoration to pending notification sent to ${adminEmail}:`, result.success ? "success" : "failed", result.error || "");
        } catch (error: any) {
          console.error(`[Booking] Error sending restoration to pending notification to ${adminEmail}:`, error);
        }
      }
    }

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "BOOKING_RESTORED",
        entity: "Booking",
        entityId: bookingId,
        details: { restoreToStatus },
      },
    });

    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${bookingId}`);

    return { success: true };
  } catch (error) {
    console.error("Error restoring booking:", error);
    return { success: false, error: "Fehler beim Wiederherstellen der Buchung" };
  }
}

export async function approveBooking(bookingId: string, adminNotes?: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Prüfe ob User Buchungen genehmigen darf
    if (!user.canApproveBookings && user.role !== "SUPERADMIN") {
      return { success: false, error: "Sie haben keine Berechtigung, Buchungen zu genehmigen" };
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
    const colorId = getBookingColorId(booking.id);
    const googleEventId = await createCalendarEvent({
      summary: `Buchung: ${booking.guestName || booking.guestEmail}`,
      description: booking.message || "",
      startDate: booking.startDate,
      endDate: booking.endDate,
      guestEmail: booking.guestEmail,
      guestName: booking.guestName || undefined,
      colorId,
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
      guestEmail: booking.guestEmail,
      bookingCode: booking.bookingCode,
      guestName: booking.guestName || undefined,
      startDate: booking.startDate,
      endDate: booking.endDate,
      numberOfAdults: booking.numberOfAdults,
      numberOfChildren: booking.numberOfChildren,
      totalPrice: parseFloat((booking.totalPrice || 0).toString()),
      guestCode: booking.guestCode || undefined,
    });

    // Benachrichtigung an andere Admins senden (außer dem, der genehmigt hat)
    const { getAdminsToNotify } = await import("@/lib/notifications");
    const adminEmails = await getAdminsToNotify("bookingApproved");
    console.log(`[Booking] Sending approval notifications to ${adminEmails.length} admins (excluding ${user.email}):`, adminEmails);
    for (const adminEmail of adminEmails) {
      // Überspringe den Admin, der die Genehmigung durchgeführt hat
      if (adminEmail !== user.email) {
        try {
          const result = await sendBookingApprovedNotificationToAdmin({
            adminEmail,
            bookingCode: booking.bookingCode,
            guestName: booking.guestName || undefined,
            guestEmail: booking.guestEmail,
            startDate: booking.startDate,
            endDate: booking.endDate,
            approvedByName: user.name || user.email,
            adminNotes: adminNotes, // Admin-Notizen an andere Admins senden
          });
          console.log(`[Booking] Approval notification sent to ${adminEmail}:`, result.success ? "success" : "failed", result.error || "");
        } catch (error: any) {
          console.error(`[Booking] Error sending approval notification to ${adminEmail}:`, error);
        }
      }
    }

    // Prüfe auf Konflikte nach Genehmigung und benachrichtige Admins
    const { checkAndNotifyConflictsForBooking } = await import("@/lib/booking-conflicts");
    await checkAndNotifyConflictsForBooking(bookingId).catch(error => {
      console.error("[Booking] Error checking conflicts after approval:", error);
      // Fehler nicht weiterwerfen, damit Genehmigung erfolgreich bleibt
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
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Prüfe ob User Buchungen ablehnen darf (gleiche Berechtigung wie genehmigen)
    if (!user.canApproveBookings && user.role !== "SUPERADMIN") {
      return { success: false, error: "Sie haben keine Berechtigung, Buchungen abzulehnen" };
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
      guestEmail: booking.guestEmail,
      bookingCode: booking.bookingCode,
      guestName: booking.guestName || undefined,
      startDate: booking.startDate,
      endDate: booking.endDate,
      rejectionReason: reason,
      guestCode: booking.guestCode || undefined,
    });

    // Benachrichtigung an andere Admins senden (außer dem, der abgelehnt hat)
    const { getAdminsToNotify } = await import("@/lib/notifications");
    const adminEmails = await getAdminsToNotify("bookingRejected");
    console.log(`[Booking] Sending rejection notifications to ${adminEmails.length} admins (excluding ${user.email}):`, adminEmails);
    for (const adminEmail of adminEmails) {
      // Überspringe den Admin, der die Ablehnung durchgeführt hat
      if (adminEmail !== user.email) {
        try {
          const result = await sendBookingRejectedNotificationToAdmin({
            adminEmail,
            bookingCode: booking.bookingCode,
            guestName: booking.guestName || undefined,
            guestEmail: booking.guestEmail,
            startDate: booking.startDate,
            endDate: booking.endDate,
            rejectedByName: user.name || user.email,
            rejectionReason: reason,
            adminNotes: adminNotes, // Admin-Notizen an andere Admins senden
          });
          console.log(`[Booking] Rejection notification sent to ${adminEmail}:`, result.success ? "success" : "failed", result.error || "");
        } catch (error: any) {
          console.error(`[Booking] Error sending rejection notification to ${adminEmail}:`, error);
        }
      }
    }

    revalidatePath("/admin/bookings");

    return { success: true };
  } catch (error) {
    console.error("Error rejecting booking:", error);
    return { success: false, error: "Fehler beim Ablehnen der Buchung" };
  }
}

