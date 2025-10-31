import { NextRequest, NextResponse } from 'next/server';
import { devMailStore } from '@/lib/dev-mail';
import { getCurrentUser } from '@/lib/auth';

// GET - Alle Emails abrufen (nur für Admins)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Keine Berechtigung' },
        { status: 403 }
      );
    }

    const emails = devMailStore.getAll();
    
    return NextResponse.json({
      emails,
      count: emails.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Fehler beim Laden der E-Mails' },
      { status: 500 }
    );
  }
}

// DELETE - Alle Emails löschen (nur für Admins)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Keine Berechtigung' },
        { status: 403 }
      );
    }

    devMailStore.clear();
    
    return NextResponse.json({
      success: true,
      message: 'Alle E-Mails gelöscht',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Fehler beim Löschen der E-Mails' },
      { status: 500 }
    );
  }
}

