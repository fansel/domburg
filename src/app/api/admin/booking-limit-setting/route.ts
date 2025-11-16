import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // GET ist öffentlich zugänglich (Gäste müssen wissen, bis wann sie buchen können)
    const [dateSetting, enabledSetting] = await Promise.all([
      prisma.setting.findUnique({
      where: { key: "BOOKING_LIMIT_DATE" },
      }),
      prisma.setting.findUnique({
        where: { key: "BOOKING_LIMIT_DATE_ENABLED" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      date: dateSetting?.value || null,
      enabled: enabledSetting?.value === "true",
    });
  } catch (error: any) {
    console.error("Error loading booking limit setting:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Laden der Einstellung" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    // Prüfe Berechtigung: SuperAdmin ODER Admin mit canManageBookingLimit
    const isSuperAdmin = user.role === "SUPERADMIN";
    const canManage = isSuperAdmin || (user.role === "ADMIN" && (user as any).canManageBookingLimit === true);
    
    if (!canManage) {
      return NextResponse.json(
        { error: "Keine Berechtigung - Nur Superadmins oder Admins mit entsprechender Berechtigung können diese Einstellung ändern" },
        { status: 403 }
      );
    }

    const { date, enabled } = await request.json();

    // Validiere Datum falls gesetzt
    if (date && date !== "") {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return NextResponse.json(
          { success: false, error: "Ungültiges Datum" },
          { status: 400 }
        );
      }
    }

    await Promise.all([
      prisma.setting.upsert({
      where: { key: "BOOKING_LIMIT_DATE" },
      update: { value: date || "" },
      create: {
        key: "BOOKING_LIMIT_DATE",
        value: date || "",
        description: "Buchungen erlauben bis zu diesem Datum",
      },
      }),
      prisma.setting.upsert({
        where: { key: "BOOKING_LIMIT_DATE_ENABLED" },
        update: { value: enabled === true ? "true" : "false" },
        create: {
          key: "BOOKING_LIMIT_DATE_ENABLED",
          value: enabled === true ? "true" : "false",
          description: "Aktiviert das explizite Buchungslimit",
        },
      }),
    ]);

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "SETTINGS_UPDATED",
        entity: "Settings",
        entityId: "BOOKING_LIMIT_DATE",
        details: { date: date || null, enabled: enabled === true },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Einstellung wurde gespeichert",
    });
  } catch (error: any) {
    console.error("Error saving booking limit setting:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Speichern der Einstellung" },
      { status: 500 }
    );
  }
}

