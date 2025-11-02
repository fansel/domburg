import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // GET ist öffentlich zugänglich (Gäste müssen wissen, bis wann sie buchen können)
    const setting = await prisma.setting.findUnique({
      where: { key: "BOOKING_ADVANCE_OCTOBER_TO_NEXT_YEAR" },
    });

    return NextResponse.json({
      success: true,
      enabled: setting?.value === "true",
    });
  } catch (error: any) {
    console.error("Error loading booking advance setting:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Laden der Einstellung" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung - Nur Superadmins können Systemeinstellungen ändern" },
        { status: 403 }
      );
    }

    const { enabled } = await request.json();

    await prisma.setting.upsert({
      where: { key: "BOOKING_ADVANCE_OCTOBER_TO_NEXT_YEAR" },
      update: { value: enabled ? "true" : "false" },
      create: {
        key: "BOOKING_ADVANCE_OCTOBER_TO_NEXT_YEAR",
        value: enabled ? "true" : "false",
        description: "Ab Oktober für das ganze nächste Jahr buchbar",
      },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "SETTINGS_UPDATED",
        entity: "Settings",
        entityId: "BOOKING_ADVANCE_OCTOBER_TO_NEXT_YEAR",
        details: { enabled },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Einstellung wurde gespeichert",
    });
  } catch (error: any) {
    console.error("Error saving booking advance setting:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Speichern der Einstellung" },
      { status: 500 }
    );
  }
}

