import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung - Nur Superadmins können SMTP-Verbindungen testen" },
        { status: 403 }
      );
    }

    const { host, port, user: smtpUser, password } = await request.json();

    if (!host || !port || !smtpUser) {
      return NextResponse.json(
        { success: false, error: "Bitte fülle Host, Port und Benutzername aus" },
        { status: 400 }
      );
    }

    // Wenn kein Passwort übergeben wurde, versuche das gespeicherte Passwort zu verwenden
    let smtpPassword = password;
    if (!smtpPassword) {
      const savedPassword = await prisma.setting.findUnique({
        where: { key: "SMTP_PASSWORD" },
      });
      smtpPassword = savedPassword?.value || "";
    }

    if (!smtpPassword) {
      return NextResponse.json(
        { success: false, error: "Passwort fehlt. Bitte Passwort eingeben oder zuerst speichern." },
        { status: 400 }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465, // true für Port 465, false für andere Ports
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    // Verify connection (testet nur die Verbindung, ohne E-Mail zu versenden)
    await transporter.verify();

    return NextResponse.json({
      success: true,
      message: "SMTP-Verbindung erfolgreich",
    });
  } catch (error: any) {
    console.error("SMTP connection test error:", error);
    
    let errorMessage = "Verbindung fehlgeschlagen";
    if (error.code === "EAUTH") {
      errorMessage = "Authentifizierung fehlgeschlagen. Prüfe Benutzername und Passwort.";
    } else if (error.code === "ECONNECTION" || error.code === "ETIMEDOUT") {
      errorMessage = "Verbindung zum Server fehlgeschlagen. Prüfe Host und Port.";
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

