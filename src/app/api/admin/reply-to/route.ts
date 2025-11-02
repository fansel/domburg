import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung - Nur Superadmins können Reply-To-Einstellungen ändern" },
        { status: 403 }
      );
    }

    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "E-Mail-Adresse ist erforderlich" },
        { status: 400 }
      );
    }

    // E-Mail validieren
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: "Ungültige E-Mail-Adresse" },
        { status: 400 }
      );
    }

    // Setting aktualisieren oder erstellen
    await prisma.setting.upsert({
      where: { key: "REPLY_TO_EMAIL" },
      update: { value: email.trim() },
      create: {
        key: "REPLY_TO_EMAIL",
        value: email.trim(),
        description: "Reply-To E-Mail-Adresse für alle E-Mails des Buchungssystems",
      },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "REPLY_TO_EMAIL_UPDATED",
        entity: "Setting",
        details: { email: email.trim() },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating reply-to email:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern der E-Mail-Adresse" },
      { status: 500 }
    );
  }
}

