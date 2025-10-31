import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyMagicLinkToken, createToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token ist erforderlich' },
        { status: 400 }
      );
    }

    // Magic Link Token verifizieren
    const userId = await verifyMagicLinkToken(token);

    if (!userId) {
      return NextResponse.json(
        { error: 'Token ist ungültig oder abgelaufen' },
        { status: 401 }
      );
    }

    // Benutzer laden
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Benutzer nicht gefunden oder deaktiviert' },
        { status: 404 }
      );
    }

    // Last login aktualisieren
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        details: { method: 'magic_link' },
      },
    });

    // JWT Token erstellen
    const authToken = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Response mit Cookie erstellen
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    // Cookie direkt im Response-Header setzen
    response.cookies.set('auth_token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 Tage
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error in verify route:', error);
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten' },
      { status: 500 }
    );
  }
}

