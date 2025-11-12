import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "EXPOSE_GENERAL_TEXT" },
    });

    return NextResponse.json({
      success: true,
      text: setting?.value || "",
    });
  } catch (error: any) {
    console.error("Error fetching expose text:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Laden des Texts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json(
        { success: false, error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    // Prüfe ob User canManageExpose hat (oder SUPERADMIN)
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { canManageExpose: true, role: true },
    });

    if (dbUser?.role !== "SUPERADMIN" && !dbUser?.canManageExpose) {
      return NextResponse.json(
        { success: false, error: "Keine Berechtigung zum Verwalten von Expose" },
        { status: 403 }
      );
    }

    const { text } = await request.json();

    // Speichere oder aktualisiere das Setting
    await prisma.setting.upsert({
      where: { key: "EXPOSE_GENERAL_TEXT" },
      update: { value: text || "" },
      create: {
        key: "EXPOSE_GENERAL_TEXT",
        value: text || "",
        description: "Allgemeiner Text für die Expose-Seite",
        isPublic: true,
      },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "EXPOSE_TEXT_UPDATED",
        entity: "Setting",
        entityId: "EXPOSE_GENERAL_TEXT",
        details: { text: text?.substring(0, 100) || "" },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating expose text:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Speichern des Texts" },
      { status: 500 }
    );
  }
}

