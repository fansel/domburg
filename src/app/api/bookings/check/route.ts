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

    // Buchung finden
    const booking = await prisma.booking.findFirst({
      where: {
        bookingCode: bookingCode.trim(),
        guestEmail: email.trim().toLowerCase(),
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
        createdAt: true,
        adminNotes: true,
        rejectionReason: true,
        cancellationReason: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Buchung nicht gefunden' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error('Error checking booking:', error);
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten' },
      { status: 500 }
    );
  }
}

