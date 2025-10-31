import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateMagicLinkToken, isAdminEmail } from '@/lib/auth';
import { sendMagicLinkEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'E-Mail ist erforderlich' },
        { status: 400 }
      );
    }

    // Benutzer finden oder erstellen
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Neuen Benutzer erstellen
      const role = isAdminEmail(email) ? 'ADMIN' : 'GUEST';
      user = await prisma.user.create({
        data: {
          email,
          role,
        },
      });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Ihr Konto wurde deaktiviert' },
        { status: 403 }
      );
    }

    // Magic Link Token generieren
    const token = await generateMagicLinkToken(user.id);

    // E-Mail senden
    await sendMagicLinkEmail({
      to: email,
      token,
      name: user.name || undefined,
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'MAGIC_LINK_REQUESTED',
        entity: 'User',
        entityId: user.id,
        details: { email },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Magic Link wurde versendet',
    });
  } catch (error) {
    console.error('Error in magic-link route:', error);
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten' },
      { status: 500 }
    );
  }
}

