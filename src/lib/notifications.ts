import prisma from "./prisma";
import { hasAdminRights } from "./auth";

/**
 * Prüft ob ein Admin eine bestimmte Benachrichtigung erhalten möchte
 */
export async function shouldNotifyAdmin(
  adminEmail: string,
  notificationType: "newBooking" | "bookingApproved" | "bookingRejected" | "bookingConflict"
): Promise<boolean> {
  try {
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail },
      include: { notificationPreferences: true },
    });

    if (!admin || !hasAdminRights(admin.role) || !admin.isActive) {
      return false;
    }

    // Standardwerte (wie im Schema definiert)
    const defaults: Record<typeof notificationType, boolean> = {
      newBooking: true,
      bookingApproved: false,
      bookingRejected: false,
      bookingConflict: false, // Standard: deaktiviert - Admin muss aktivieren
    };

    // Wenn keine Präferenzen gesetzt sind, verwende Standardwerte
    if (!admin.notificationPreferences) {
      return defaults[notificationType];
    }

    // Wenn Präferenzen vorhanden, verwende den Wert (falls undefined/null, dann Standardwert)
    const preferenceValue = admin.notificationPreferences[notificationType];
    // Stelle sicher, dass der Wert explizit als Boolean behandelt wird
    return preferenceValue !== undefined && preferenceValue !== null 
      ? Boolean(preferenceValue)
      : defaults[notificationType];
  } catch (error) {
    console.error("Error checking notification preferences:", error);
    // Bei Fehler Standard: Benachrichtigungen aktivieren
    return true;
  }
}

/**
 * Ruft alle Admins ab, die eine bestimmte Benachrichtigung erhalten möchten
 */
export async function getAdminsToNotify(
  notificationType: "newBooking" | "bookingApproved" | "bookingRejected" | "bookingConflict"
): Promise<string[]> {
  try {
    const admins = await prisma.user.findMany({
      where: {
        OR: [
          { role: "ADMIN" },
          { role: "SUPERADMIN" }
        ],
        isActive: true,
      },
      include: {
        notificationPreferences: true,
      },
    });

    const emails: string[] = [];

    // Standardwerte (wie im Schema definiert)
    const defaults: Record<typeof notificationType, boolean> = {
      newBooking: true,
      bookingApproved: false,
      bookingRejected: false,
      bookingConflict: false, // Standard: deaktiviert - Admin muss aktivieren
    };

    for (const admin of admins) {
      let shouldNotify = false;

      if (!admin.notificationPreferences) {
        // Wenn keine Präferenzen vorhanden, verwende Standardwerte
        shouldNotify = defaults[notificationType];
      } else {
        // Wenn Präferenzen vorhanden, verwende den Wert (falls undefined/null, dann Standardwert)
        const preferenceValue = admin.notificationPreferences[notificationType];
        // Stelle sicher, dass der Wert explizit als Boolean behandelt wird
        shouldNotify = preferenceValue !== undefined && preferenceValue !== null 
          ? Boolean(preferenceValue)
          : defaults[notificationType];
      }

      if (shouldNotify) {
        emails.push(admin.email);
        console.log(`[Notifications] Admin ${admin.email} will be notified for ${notificationType} (preference: ${shouldNotify})`);
      } else {
        console.log(`[Notifications] Admin ${admin.email} will NOT be notified for ${notificationType} (preference: ${shouldNotify})`);
      }
    }

    console.log(`[Notifications] Total admins to notify for ${notificationType}: ${emails.length}`, emails);

    return emails;
  } catch (error) {
    console.error("Error getting admins to notify:", error);
    // Bei Fehler: Leere Liste zurückgeben statt alle Admins (verhindert unerwünschte E-Mails)
    return [];
  }
}

