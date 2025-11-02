import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Debug Route: Zeigt Details einer spezifischen Buchung
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingCode = searchParams.get('code') || '123456';

    const booking = await prisma.booking.findUnique({
      where: { bookingCode },
      select: {
        id: true,
        bookingCode: true,
        startDate: true,
        endDate: true,
        status: true,
        guestName: true,
        guestEmail: true,
        numberOfAdults: true,
        numberOfChildren: true,
        createdAt: true,
        updatedAt: true,
        cancelledAt: true,
        cancellationReason: true,
        googleEventId: true,
      },
    });

    if (!booking) {
      return NextResponse.json({
        error: 'Buchung nicht gefunden',
        bookingCode,
      });
    }

    // Normalisiere Daten für Vergleich
    const normalizeDate = (date: Date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const startNormalized = normalizeDate(booking.startDate);
    const endNormalized = normalizeDate(booking.endDate);

    return NextResponse.json({
      bookingCode: booking.bookingCode,
      raw: {
        startDate: booking.startDate.toISOString(),
        endDate: booking.endDate.toISOString(),
        startDateUTC: booking.startDate.toUTCString(),
        endDateUTC: booking.endDate.toUTCString(),
      },
      normalized: {
        startDate: startNormalized.toISOString().split('T')[0],
        endDate: endNormalized.toISOString().split('T')[0],
      },
      display: {
        startDate: booking.startDate.toLocaleDateString('de-DE', { 
          timeZone: 'Europe/Amsterdam',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        endDate: booking.endDate.toLocaleDateString('de-DE', {
          timeZone: 'Europe/Amsterdam',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
      },
      status: booking.status,
      guestName: booking.guestName,
      numberOfAdults: booking.numberOfAdults ?? (booking as any).numberOfGuests ?? 1,
      numberOfChildren: booking.numberOfChildren ?? 0,
      googleEventId: booking.googleEventId,
      cancelledAt: booking.cancelledAt?.toISOString() || null,
      cancellationReason: booking.cancellationReason,
      timestamps: {
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Buchung', details: String(error) },
      { status: 500 }
    );
  }
}

