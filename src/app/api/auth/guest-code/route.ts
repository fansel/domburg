import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyGuestAccessToken, createToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Gastcode ist erforderlich' },
        { status: 400 }
      );
    }

    // Gastcode verifizieren
    const result = await verifyGuestAccessToken(code);

    if (!result.valid) {
      return NextResponse.json(
        { error: 'Gastcode ist ungültig oder abgelaufen' },
        { status: 401 }
      );
    }

    // Für Cleaning-Codes auch einen User erstellen (aber mit speziellem Namen)
    // Standard-Gastbenutzer erstellen oder finden
    const guestEmail = result.accessType === 'CLEANING' 
      ? `housekeeper-${code}@hollandhaus.local`
      : `guest-${code}@hollandhaus.local`;
    
    let user = await prisma.user.findUnique({
      where: { email: guestEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: guestEmail,
          name: result.accessType === 'CLEANING' ? 'Housekeeper' : 'Gast',
          role: 'GUEST',
        },
      });
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
        details: { method: 'guest_code', code },
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
      accessType: result.accessType || 'GUEST',
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
    console.error('Error in guest-code route:', error);
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten' },
      { status: 500 }
    );
  }
}

