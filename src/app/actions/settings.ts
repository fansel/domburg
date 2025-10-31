"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser, generateMagicLinkToken } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";
import { generateGuestCode } from "@/lib/guest-code";

// Gäste-Token Verwaltung

export async function createGuestToken({
  description,
  maxUsage,
  expiresInDays,
  useFamilyPrice = false,
}: {
  description: string;
  maxUsage?: number;
  expiresInDays?: number;
  useFamilyPrice?: boolean;
}) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
    }

    const token = generateGuestCode();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const guestToken = await prisma.guestAccessToken.create({
      data: {
        description,
        token,
        maxUsage,
        expiresAt,
        isActive: true,
        usageCount: 0,
        useFamilyPrice,
      },
    });

    revalidatePath("/admin/settings");
    return { success: true, token: guestToken };
  } catch (error) {
    console.error("Error creating guest token:", error);
    return { success: false, error: "Fehler beim Erstellen des Codes" };
  }
}

export async function toggleGuestToken(id: string, isActive: boolean) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
    }

    const token = await prisma.guestAccessToken.update({
      where: { id },
      data: { isActive },
    });

    revalidatePath("/admin/settings");
    return { success: true, token };
  } catch (error) {
    console.error("Error toggling guest token:", error);
    return { success: false, error: "Fehler beim Aktualisieren des Codes" };
  }
}

export async function deleteGuestToken(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
    }

    await prisma.guestAccessToken.delete({
      where: { id },
    });

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error) {
    console.error("Error deleting guest token:", error);
    return { success: false, error: "Fehler beim Löschen des Codes" };
  }
}

// Admin-Benutzer Verwaltung

export async function createAdminUser({
  email,
  name,
}: {
  email: string;
  name: string;
}) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Prüfen ob E-Mail bereits existiert
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { success: false, error: "E-Mail-Adresse bereits vergeben" };
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: "ADMIN",
        isActive: true,
      },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "ADMIN_CREATED",
        entity: "User",
        entityId: user.id,
        details: JSON.parse(JSON.stringify({ email, name })),
      },
    });

    revalidatePath("/admin/settings");
    return { success: true, user };
  } catch (error) {
    console.error("Error creating admin user:", error);
    return { success: false, error: "Fehler beim Erstellen des Benutzers" };
  }
}

export async function sendMagicLinkToAdmin(userId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, error: "Benutzer nicht gefunden" };
    }

    if (user.role !== "ADMIN") {
      return { success: false, error: "Benutzer ist kein Administrator" };
    }

    const token = await generateMagicLinkToken(user.id);

    await sendMagicLinkEmail({
      to: user.email,
      token,
      name: user.name || undefined,
    });

    return { success: true };
  } catch (error) {
    console.error("Error sending magic link:", error);
    return { success: false, error: "Fehler beim Senden des Magic Links" };
  }
}

export async function deleteAdminUser(id: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Nicht sich selbst löschen
    if (currentUser.id === id) {
      return { success: false, error: "Sie können sich nicht selbst löschen" };
    }

    await prisma.user.delete({
      where: { id },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "ADMIN_DELETED",
        entity: "User",
        entityId: id,
        details: {},
      },
    });

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error) {
    console.error("Error deleting admin user:", error);
    return { success: false, error: "Fehler beim Löschen des Benutzers" };
  }
}

