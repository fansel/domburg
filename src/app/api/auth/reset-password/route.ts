import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const getSecretKey = () => new TextEncoder().encode(JWT_SECRET);

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token und Passwort erforderlich" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Passwort muss mindestens 8 Zeichen lang sein" },
        { status: 400 }
      );
    }

    // Token verifizieren
    let payload: any;
    try {
      const { payload: decoded } = await jwtVerify(token, getSecretKey());
      payload = decoded;
    } catch (error) {
      return NextResponse.json(
        { error: "Token ist ungültig oder abgelaufen" },
        { status: 401 }
      );
    }

    // Prüfe ob es ein Password-Reset-Token ist
    if (payload.type !== 'password_reset') {
      return NextResponse.json(
        { error: "Ungültiger Token-Typ" },
        { status: 401 }
      );
    }

    const userId = payload.userId;

    if (!userId) {
      return NextResponse.json(
        { error: "Token ist ungültig" },
        { status: 401 }
      );
    }

    // Benutzer laden
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden oder deaktiviert" },
        { status: 404 }
      );
    }

    // Passwort hashen
    const hashedPassword = await bcrypt.hash(password, 10);

    // Passwort aktualisieren
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET",
        entity: "User",
        entityId: user.id,
        details: {},
      },
    });

    return NextResponse.json({
      success: true,
      message: "Passwort wurde erfolgreich zurückgesetzt",
    });
  } catch (error: any) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "Fehler beim Zurücksetzen des Passworts" },
      { status: 500 }
    );
  }
}

