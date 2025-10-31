import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { host, port, user: smtpUser, password, fromEmail, fromName, enabled, passwordChanged } = await request.json();

    // SMTP-Einstellungen in Settings-Tabelle speichern
    const updates = [
      prisma.setting.upsert({
        where: { key: "SMTP_HOST" },
        update: { value: host || "" },
        create: { key: "SMTP_HOST", value: host || "", description: "SMTP Server Host" },
      }),
      prisma.setting.upsert({
        where: { key: "SMTP_PORT" },
        update: { value: port || "587" },
        create: { key: "SMTP_PORT", value: port || "587", description: "SMTP Server Port" },
      }),
      prisma.setting.upsert({
        where: { key: "SMTP_USER" },
        update: { value: smtpUser || "" },
        create: { key: "SMTP_USER", value: smtpUser || "", description: "SMTP Benutzername" },
      }),
      prisma.setting.upsert({
        where: { key: "SMTP_FROM_EMAIL" },
        update: { value: fromEmail || "" },
        create: { key: "SMTP_FROM_EMAIL", value: fromEmail || "", description: "Absender E-Mail" },
      }),
      prisma.setting.upsert({
        where: { key: "SMTP_FROM_NAME" },
        update: { value: fromName || "Familie Waubke" },
        create: { key: "SMTP_FROM_NAME", value: fromName || "Familie Waubke", description: "Absender Name" },
      }),
      prisma.setting.upsert({
        where: { key: "SMTP_ENABLED" },
        update: { value: enabled ? "true" : "false" },
        create: { key: "SMTP_ENABLED", value: enabled ? "true" : "false", description: "SMTP aktiviert" },
      }),
    ];

    // Nur Passwort updaten wenn es geändert wurde
    if (passwordChanged) {
      updates.push(
        prisma.setting.upsert({
          where: { key: "SMTP_PASSWORD" },
          update: { value: password || "" },
          create: { key: "SMTP_PASSWORD", value: password || "", description: "SMTP Passwort" },
        })
      );
    }

    await Promise.all(updates);

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "SMTP_SETTINGS_UPDATED",
        entity: "Setting",
        details: { smtp_host: host, smtp_user: smtpUser },
      },
    });

    return NextResponse.json({
      success: true,
      message: "SMTP-Einstellungen wurden gespeichert",
    });
  } catch (error: any) {
    console.error("Error saving SMTP settings:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Speichern der Einstellungen" },
      { status: 500 }
    );
  }
}

