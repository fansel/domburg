import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Nicht angemeldet" },
        { status: 401 }
      );
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Aktuelles Passwort und neues Passwort erforderlich" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Neues Passwort muss mindestens 8 Zeichen lang sein" },
        { status: 400 }
      );
    }

    // Vollständigen User mit Passwort laden
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true, mustChangePassword: true },
    });

    if (!fullUser || !fullUser.password) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden oder kein Passwort gesetzt" },
        { status: 404 }
      );
    }

    // Aktuelles Passwort prüfen
    const isValidPassword = await bcrypt.compare(currentPassword, fullUser.password);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Aktuelles Passwort ist falsch" },
        { status: 401 }
      );
    }

    // Neues Passwort hashen
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Passwort aktualisieren und mustChangePassword zurücksetzen
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        mustChangePassword: false,
      },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_CHANGED",
        entity: "User",
        entityId: user.id,
        details: {},
      },
    });

    return NextResponse.json({
      success: true,
      message: "Passwort wurde erfolgreich geändert",
    });
  } catch (error: any) {
    console.error("Password change error:", error);
    return NextResponse.json(
      { error: "Fehler beim Ändern des Passworts" },
      { status: 500 }
    );
  }
}

