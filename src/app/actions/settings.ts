"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser, generateMagicLinkToken, hasAdminRights } from "@/lib/auth";
import { sendMagicLinkEmail, sendNewUserEmail } from "@/lib/email";
import { generateGuestCode } from "@/lib/guest-code";
import * as bcrypt from "bcryptjs";

// Gäste-Token Verwaltung

export async function createGuestToken({
  description,
  maxUsage,
  expiresInDays,
  useFamilyPrice = false,
  accessType = "GUEST",
}: {
  description: string;
  maxUsage?: number;
  expiresInDays?: number;
  useFamilyPrice?: boolean;
  accessType?: "GUEST" | "CLEANING";
}) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
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
        accessType,
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
    if (!user || !hasAdminRights(user.role)) {
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
    if (!user || !hasAdminRights(user.role)) {
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
  username,
  password,
  generatePassword = false,
}: {
  email: string;
  name: string;
  username?: string;
  password?: string;
  generatePassword?: boolean;
}) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasAdminRights(currentUser.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Prüfen ob E-Mail bereits existiert
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { success: false, error: "E-Mail-Adresse bereits vergeben" };
    }

    // Wenn kein Username angegeben, verwende den E-Mail-Namen-Teil als Username
    let finalUsername = username?.trim() || email.split('@')[0];
    
    // Prüfen ob Username bereits existiert
    const existingUsername = await prisma.user.findUnique({
      where: { username: finalUsername },
    });

    if (existingUsername) {
      return { success: false, error: "Benutzername bereits vergeben" };
    }

    // Passwort generieren oder verwenden
    let finalPassword: string;
    let generatedPassword: string | undefined;
    
    if (generatePassword) {
      // Generiere ein sicheres Passwort (12 Zeichen)
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      generatedPassword = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      finalPassword = generatedPassword;
    } else if (password) {
      finalPassword = password;
    } else {
      return { success: false, error: "Passwort ist erforderlich" };
    }

    // Passwort hashen
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const loginUrl = `${appUrl}/auth/login`;

    const user = await prisma.user.create({
      data: {
        email,
        name,
        username: finalUsername,
        password: hashedPassword,
        role: "ADMIN",
        isActive: true,
        canSeeBookings: true,  // Standard: darf Buchungen sehen
        canApproveBookings: false,  // Standard: darf nicht genehmigen
        mustChangePassword: generatePassword, // Muss Passwort ändern wenn generiert wurde
      },
    });

    // Sende Willkommens-E-Mail
    try {
      await sendNewUserEmail({
        to: user.email,
        name: user.name || user.email,
        username: user.username || user.email.split('@')[0],
        password: finalPassword,
        loginUrl: appUrl,
        mustChangePassword: generatePassword,
      });
    } catch (emailError) {
      console.error("Error sending welcome email:", emailError);
      // E-Mail-Fehler sollen User-Erstellung nicht verhindern
    }

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "ADMIN_CREATED",
        entity: "User",
        entityId: user.id,
        details: JSON.parse(JSON.stringify({ email, name, username: finalUsername })),
      },
    });

    revalidatePath("/admin/settings");
    return { success: true, user, generatedPassword };
  } catch (error) {
    console.error("Error creating admin user:", error);
    return { success: false, error: "Fehler beim Erstellen des Benutzers" };
  }
}

export async function sendMagicLinkToAdmin(userId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasAdminRights(currentUser.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, error: "Benutzer nicht gefunden" };
    }

    if (!hasAdminRights(user.role)) {
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

export async function resendWelcomeEmail(userId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasAdminRights(currentUser.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, error: "Benutzer nicht gefunden" };
    }

    if (!hasAdminRights(user.role)) {
      return { success: false, error: "Benutzer ist kein Administrator" };
    }

    // Generiere ein neues Passwort
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    const newPassword = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    
    // Hashe das neue Passwort
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Aktualisiere das Passwort in der Datenbank
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: true, // Muss Passwort beim nächsten Login ändern
      },
    });

    // Sende Willkommens-E-Mail mit neuem Passwort
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    
    await sendNewUserEmail({
      to: user.email,
      name: user.name || user.email,
      username: user.username || user.email.split('@')[0],
      password: newPassword,
      loginUrl: appUrl,
      mustChangePassword: true,
    });

    return { success: true, generatedPassword: newPassword };
  } catch (error) {
    console.error("Error resending welcome email:", error);
    return { success: false, error: "Fehler beim Senden der Willkommens-E-Mail" };
  }
}

export async function deleteAdminUser(id: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !(currentUser.role === "ADMIN" || currentUser.role === "SUPERADMIN")) {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Nicht sich selbst löschen
    if (currentUser.id === id) {
      return { success: false, error: "Sie können sich nicht selbst löschen" };
    }

    // Prüfe ob der zu löschende User ein SUPERADMIN ist
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!userToDelete) {
      return { success: false, error: "Benutzer nicht gefunden" };
    }

    // Admins können keine SUPERADMINs löschen
    if (userToDelete.role === "SUPERADMIN" && currentUser.role !== "SUPERADMIN") {
      return { success: false, error: "Nur SUPERADMINs können andere SUPERADMINs löschen" };
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

// Update user role
export async function updateUserRole(userId: string, role: "ADMIN" | "SUPERADMIN") {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "SUPERADMIN") {
      return { success: false, error: "Keine Berechtigung - Nur Superadmins können Rollen ändern" };
    }

    // Nicht eigene Rolle ändern
    if (currentUser.id === userId) {
      return { success: false, error: "Sie können Ihre eigene Rolle nicht ändern" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, error: "Benutzer nicht gefunden" };
    }

    // Nur ADMIN und SUPERADMIN Rollen können zugeordnet werden (keine GUEST)
    if (user.role === "GUEST") {
      return { success: false, error: "Gast-Benutzer können keine Admin-Rolle erhalten" };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "USER_ROLE_UPDATED",
        entity: "User",
        entityId: userId,
        details: { oldRole: user.role, newRole: role, userEmail: user.email },
      },
    });

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating user role:", error);
    return { success: false, error: error.message || "Fehler beim Aktualisieren der Rolle" };
  }
}

// Update user permissions
export async function updateUserPermissions(
  userId: string, 
  canSeeBookings: boolean, 
  canApproveBookings: boolean,
  canManagePricing?: boolean
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !(currentUser.role === "ADMIN" || currentUser.role === "SUPERADMIN")) {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Nicht eigene Berechtigungen ändern (außer Superadmin)
    if (currentUser.id === userId && currentUser.role !== "SUPERADMIN") {
      return { success: false, error: "Sie können Ihre eigenen Berechtigungen nicht ändern" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, error: "Benutzer nicht gefunden" };
    }

    // Nur ADMIN und SUPERADMIN können Berechtigungen haben
    if (user.role === "GUEST") {
      return { success: false, error: "Gast-Benutzer können keine Admin-Berechtigungen erhalten" };
    }

    const updateData: any = { 
      canSeeBookings,
      canApproveBookings,
    };

    // canManagePricing nur aktualisieren, wenn explizit übergeben
    if (canManagePricing !== undefined) {
      updateData.canManagePricing = canManagePricing;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Lade aktuellen User, um aktuellen Wert von canManagePricing zu bekommen
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { canManagePricing: true },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: currentUser.id,
        action: "USER_PERMISSIONS_UPDATED",
        entity: "User",
        entityId: userId,
        details: { 
          canSeeBookings, 
          canApproveBookings, 
          canManagePricing: canManagePricing !== undefined ? canManagePricing : (updatedUser?.canManagePricing ?? false),
          userEmail: user.email 
        },
      },
    });

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating user permissions:", error);
    return { success: false, error: error.message || "Fehler beim Aktualisieren der Berechtigungen" };
  }
}

