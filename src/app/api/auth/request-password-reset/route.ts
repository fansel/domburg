import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { SignJWT } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const getSecretKey = () => new TextEncoder().encode(JWT_SECRET);

// Password Reset Token generieren
async function generatePasswordResetToken(userId: string): Promise<string> {
  const expirySeconds = 3600; // 1 Stunde
  
  const token = await new SignJWT({ userId, type: 'password_reset' } as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expirySeconds)
    .sign(getSecretKey());

  return token;
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "E-Mail-Adresse erforderlich" },
        { status: 400 }
      );
    }

    // Benutzer suchen (nach Email oder Username)
    // Akzeptiere sowohl ADMIN als auch SUPERADMIN
    // Suche case-insensitive wie in der Login-Route
    const emailTrimmed = email.trim();
    const emailLower = emailTrimmed.toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailTrimmed }, // Original (case-sensitive)
          { email: emailLower },   // Lowercase
          { username: emailTrimmed },
          { username: emailLower },
        ],
        role: {
          in: ['ADMIN', 'SUPERADMIN']
        },
        isActive: true,
      },
    });

    console.log(`Password reset search for: "${emailTrimmed}" (lowercase: "${emailLower}"), found user:`, user ? { id: user.id, email: user.email, username: user.username, role: user.role } : 'none');

    // Aus Sicherheitsgründen immer Erfolg melden, auch wenn User nicht gefunden
    // Dies verhindert, dass Angreifer herausfinden können, welche Emails existieren
    if (!user) {
      // Logge trotzdem für interne Zwecke
      console.log(`Password reset requested for non-existent email/username: ${email}`);
      
      // Warte kurz, um Timing-Angriffe zu erschweren
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return NextResponse.json({
        success: true,
        message: "Falls ein Benutzer mit dieser E-Mail-Adresse existiert, wurde eine E-Mail zum Zurücksetzen des Passworts gesendet.",
      });
    }

    // Token generieren
    const token = await generatePasswordResetToken(user.id);

    // E-Mail senden
    const emailResult = await sendPasswordResetEmail({
      to: user.email,
      token,
      name: user.name || undefined,
    });

    if (!emailResult.success) {
      console.error("Failed to send password reset email:", emailResult.error);
      console.error("Error details:", {
        email: user.email,
        error: emailResult.error,
        sentVia: (emailResult as any).sentVia,
      });
      // Auch hier Erfolg melden aus Sicherheitsgründen
      return NextResponse.json({
        success: true,
        message: "Falls ein Benutzer mit dieser E-Mail-Adresse existiert, wurde eine E-Mail zum Zurücksetzen des Passworts gesendet.",
      });
    }

    console.log(`Password reset email sent successfully to ${user.email} via ${(emailResult as any).sentVia || 'unknown'}`);

    // Activity Log (ohne currentUser, da es eine öffentliche Anfrage ist)
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        entity: "User",
        entityId: user.id,
        details: { email: user.email, requestedVia: 'public_reset' },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Falls ein Benutzer mit dieser E-Mail-Adresse existiert, wurde eine E-Mail zum Zurücksetzen des Passworts gesendet.",
    });
  } catch (error: any) {
    console.error("Password reset request error:", error);
    // Auch bei Fehlern generische Antwort für Sicherheit
    return NextResponse.json({
      success: true,
      message: "Falls ein Benutzer mit dieser E-Mail-Adresse existiert, wurde eine E-Mail zum Zurücksetzen des Passworts gesendet.",
    });
  }
}

