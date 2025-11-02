import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCalendarEvents } from '@/lib/google-calendar';

/**
 * Debug Route: Zeigt detaillierte Informationen über Verfügbarkeit
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    if (!startParam || !endParam) {
      return NextResponse.json(
        { error: 'Start- und Enddatum sind erforderlich' },
        { status: 400 }
      );
    }

    const startDate = new Date(startParam);
    const endDate = new Date(endParam);

    // Alle Buchungen im Zeitraum
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ['PENDING', 'APPROVED', 'CANCELLED', 'REJECTED'] },
        OR: [
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: startDate } },
            ],
          },
        ],
      },
      select: {
        id: true,
        bookingCode: true,
        startDate: true,
        endDate: true,
        status: true,
        guestName: true,
        guestEmail: true,
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    // Blockierte Tage berechnen (wie in availability route)
    const blockedDatesSet = new Set<string>();
    const checkInDates = new Set<string>();
    
    bookings
      .filter(b => ['PENDING', 'APPROVED'].includes(b.status))
      .forEach((booking) => {
        const start = new Date(booking.startDate);
        start.setHours(0, 0, 0, 0);
        const startKey = start.toISOString().split('T')[0];
        checkInDates.add(startKey);
      });
    
    bookings
      .filter(b => ['PENDING', 'APPROVED'].includes(b.status))
      .forEach((booking) => {
        const start = new Date(booking.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(booking.endDate);
        end.setHours(0, 0, 0, 0);
        
        const current = new Date(start);
        const endKey = end.toISOString().split('T')[0];
        
        while (current < end) {
          const dateKey = current.toISOString().split('T')[0];
          blockedDatesSet.add(dateKey);
          current.setDate(current.getDate() + 1);
        }
        
        if (checkInDates.has(endKey)) {
          blockedDatesSet.add(endKey);
        }
      });

    // Google Calendar Events
    let calendarEvents: any[] = [];
    try {
      const events = await getCalendarEvents(startDate, endDate);
      calendarEvents = events
        .filter(event => {
          const isOwnBooking = event.summary.includes('Buchung:');
          const isInfoColor = event.colorId === '10';
          return !isOwnBooking && !isInfoColor;
        })
        .map(event => ({
          summary: event.summary,
          start: event.start.toISOString().split('T')[0],
          end: event.end.toISOString().split('T')[0],
          colorId: event.colorId,
        }));
    } catch (error) {
      console.warn('Could not load calendar events:', error);
    }

    // Prüfe spezifischen Zeitraum 9-11.11
    const testStart = new Date('2024-11-09');
    testStart.setHours(0, 0, 0, 0);
    const testEnd = new Date('2024-11-11');
    testEnd.setHours(0, 0, 0, 0);
    
    const conflicts = bookings
      .filter(b => ['PENDING', 'APPROVED'].includes(b.status))
      .filter(b => {
        const bStart = new Date(b.startDate);
        bStart.setHours(0, 0, 0, 0);
        const bEnd = new Date(b.endDate);
        bEnd.setHours(0, 0, 0, 0);
        
        return (
          (testStart < bEnd && testEnd > bStart)
        );
      })
      .map(b => ({
        bookingCode: b.bookingCode,
        startDate: b.startDate.toISOString().split('T')[0],
        endDate: b.endDate.toISOString().split('T')[0],
        status: b.status,
        guestName: b.guestName,
      }));

    return NextResponse.json({
      timeRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      allBookings: bookings.map(b => ({
        bookingCode: b.bookingCode,
        startDate: b.startDate.toISOString().split('T')[0],
        endDate: b.endDate.toISOString().split('T')[0],
        status: b.status,
        guestName: b.guestName,
      })),
      activeBookings: bookings
        .filter(b => ['PENDING', 'APPROVED'].includes(b.status))
        .map(b => ({
          bookingCode: b.bookingCode,
          startDate: b.startDate.toISOString().split('T')[0],
          endDate: b.endDate.toISOString().split('T')[0],
          status: b.status,
        })),
      checkInDates: Array.from(checkInDates).sort(),
      blockedDates: Array.from(blockedDatesSet).sort(),
      calendarEvents,
      testPeriod: {
        requested: '2024-11-09 bis 2024-11-11',
        conflicts,
        isBlocked: conflicts.length > 0,
      },
    });
  } catch (error) {
    console.error('Error in debug availability:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Debug-Informationen', details: String(error) },
      { status: 500 }
    );
  }
}

