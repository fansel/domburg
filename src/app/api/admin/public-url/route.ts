import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung - Nur Superadmins können die öffentliche URL ändern" },
        { status: 403 }
      );
    }

    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL ist erforderlich" },
        { status: 400 }
      );
    }

    // URL validieren
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Ungültige URL" },
        { status: 400 }
      );
    }

    // Setting aktualisieren oder erstellen
    await prisma.setting.upsert({
      where: { key: "PUBLIC_URL" },
      update: { value: url.trim() },
      create: {
        key: "PUBLIC_URL",
        value: url.trim(),
        description: "Öffentliche URL der Anwendung (für E-Mail-Links)",
      },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "PUBLIC_URL_UPDATED",
        entity: "Setting",
        details: { url: url.trim() },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating public URL:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern der URL" },
      { status: 500 }
    );
  }
}

