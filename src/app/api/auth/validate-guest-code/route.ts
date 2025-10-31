import { NextRequest, NextResponse } from 'next/server';
import { verifyGuestAccessToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { valid: false, error: 'Gastcode ist erforderlich' },
        { status: 400 }
      );
    }

    // Gastcode verifizieren
    const isValid = await verifyGuestAccessToken(code);

    return NextResponse.json({
      valid: isValid,
    });
  } catch (error) {
    console.error('Error validating guest code:', error);
    return NextResponse.json(
      { valid: false, error: 'Ein Fehler ist aufgetreten' },
      { status: 500 }
    );
  }
}

