import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // GET ist öffentlich zugänglich (Gäste müssen wissen, bis wann sie buchen können)
    const setting = await prisma.setting.findUnique({
      where: { key: "BOOKING_LIMIT_DATE" },
    });

    return NextResponse.json({
      success: true,
      date: setting?.value || null,
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

    const { date } = await request.json();

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

    await prisma.setting.upsert({
      where: { key: "BOOKING_LIMIT_DATE" },
      update: { value: date || "" },
      create: {
        key: "BOOKING_LIMIT_DATE",
        value: date || "",
        description: "Buchungen erlauben bis zu diesem Datum",
      },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "SETTINGS_UPDATED",
        entity: "Settings",
        entityId: "BOOKING_LIMIT_DATE",
        details: { date: date || null },
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

