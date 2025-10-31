"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { verifyMagicLinkToken, createToken } from "@/lib/auth";

export async function verifyMagicLink(token: string) {
  // Token verifizieren
  const userId = await verifyMagicLinkToken(token);

  if (!userId) {
    return { success: false, error: "Token ist ungültig oder abgelaufen" };
  }

  // Benutzer laden
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.isActive) {
    return { success: false, error: "Benutzer nicht gefunden oder deaktiviert" };
  }

  // Last login aktualisieren
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Activity Log
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      details: { method: "magic_link" },
    },
  });

  // JWT Token erstellen
  const authToken = await createToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  // Cookie setzen (nur in Server Action möglich!)
  const cookieStore = await cookies();
  cookieStore.set('auth_token', authToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 Tage
    path: '/',
  });

  // Admin weiterleiten
  redirect("/admin/bookings");
}

