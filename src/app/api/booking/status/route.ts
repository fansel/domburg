import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { email, bookingCode } = await request.json();

    if (!email || !bookingCode) {
      return NextResponse.json(
        { error: 'E-Mail und Buchungsnummer sind erforderlich' },
        { status: 400 }
      );
    }

    // Buchung suchen
    const booking = await prisma.booking.findFirst({
      where: {
        bookingCode: bookingCode.trim(),
        guestEmail: email.toLowerCase().trim(),
      },
      select: {
        id: true,
        bookingCode: true,
        guestEmail: true,
        guestName: true,
        guestPhone: true,
        startDate: true,
        endDate: true,
        numberOfAdults: true,
        numberOfChildren: true,
        status: true,
        message: true,
        totalPrice: true,
        adminNotes: true,
        rejectionReason: true,
        cancellationReason: true,
        createdAt: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Buchung nicht gefunden. Bitte überprüfen Sie Ihre Angaben.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      booking 
    });
  } catch (error) {
    console.error('Error fetching booking status:', error);
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten' },
      { status: 500 }
    );
  }
}

