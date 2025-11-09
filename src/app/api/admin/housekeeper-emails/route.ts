import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const [emailsSetting, lastSentSetting] = await Promise.all([
      prisma.setting.findUnique({
        where: { key: "HOUSEKEEPER_EMAILS" },
      }),
      prisma.setting.findUnique({
        where: { key: "HOUSEKEEPER_LAST_SENT" },
      }),
    ]);

    return NextResponse.json({
      emails: emailsSetting?.value || "",
      lastSentAt: lastSentSetting?.value || null,
    });
  } catch (error: any) {
    console.error("Error fetching housekeeper emails:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Einstellungen" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { emails } = await request.json();

    await prisma.setting.upsert({
      where: { key: "HOUSEKEEPER_EMAILS" },
      update: { value: emails || "" },
      create: {
        key: "HOUSEKEEPER_EMAILS",
        value: emails || "",
        description: "Housekeeper E-Mail-Adressen (kommagetrennt)",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error saving housekeeper emails:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern der E-Mail-Adressen" },
      { status: 500 }
    );
  }
}

