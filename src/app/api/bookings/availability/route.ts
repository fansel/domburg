import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCalendarEvents } from '@/lib/google-calendar';

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

    // 1. Alle genehmigte und ausstehende Buchungen im Zeitraum abrufen (ANONYM)
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
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
        startDate: true,
        endDate: true,
        status: true,
        // KEINE guestName oder guestEmail für Anonymität
      },
    });

    // Blockierte Tage von Buchungen berechnen
    const blockedDates: string[] = [];
    bookings.forEach((booking) => {
      const current = new Date(booking.startDate);
      const end = new Date(booking.endDate);

      while (current <= end) {
        blockedDates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    });

    // 2. Blockierte Termine aus Google Calendar laden
    try {
      const calendarEvents = await getCalendarEvents(startDate, endDate);
      
      // Filtere nur blockierende Events (keine Info-Events, keine eigenen Buchungen)
      const blockingEvents = calendarEvents.filter(event => {
        const isOwnBooking = event.summary.includes('Buchung:');
        const isInfoColor = event.colorId === '10';
        return !isOwnBooking && !isInfoColor;
      });

      // Füge blockierte Tage aus Calendar Events hinzu
      blockingEvents.forEach((event) => {
        const current = new Date(event.start);
        const end = new Date(event.end);

        while (current < end) { // < statt <= für ganztägige Events
          blockedDates.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }
      });
    } catch (error) {
      console.warn('Could not load calendar events for availability:', error);
      // Fahre fort ohne Calendar Events
    }

    return NextResponse.json({
      blockedDates: [...new Set(blockedDates)], // Duplikate entfernen
      bookings: bookings.map((b) => ({
        // Anonymisierte Daten für Gäste
        id: 'blocked', // Keine echte ID
        startDate: b.startDate.toISOString().split('T')[0],
        endDate: b.endDate.toISOString().split('T')[0],
        status: 'blocked', // Generischer Status
      })),
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Verfügbarkeit' },
      { status: 500 }
    );
  }
}

