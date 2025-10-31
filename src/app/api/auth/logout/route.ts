import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie, getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (user) {
      // Activity Log
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'LOGOUT',
          entity: 'User',
          entityId: user.id,
        },
      });
    }

    // Cookie löschen
    await clearAuthCookie();

    return NextResponse.json({
      success: true,
      message: 'Erfolgreich abgemeldet',
    });
  } catch (error) {
    console.error('Error in logout route:', error);
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten' },
      { status: 500 }
    );
  }
}

