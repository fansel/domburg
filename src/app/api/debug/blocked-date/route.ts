import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCalendarEvents } from '@/lib/google-calendar';

/**
 * Debug Route: Analysiert warum ein bestimmtes Datum blockiert ist
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    
    // Parse Datum als lokales Datum (ohne Timezone-Umwandlung)
    let targetDate: Date;
    if (dateParam) {
      const [year, month, day] = dateParam.split('-').map(Number);
      targetDate = new Date(year, month - 1, day);
    } else {
      targetDate = new Date('2024-11-10');
      targetDate.setHours(0, 0, 0, 0);
    }
    const targetDateStr = dateParam || targetDate.toISOString().split('T')[0];

    // Zeitraum für Abfrage: 1 Monat vor und nach dem Ziel-Datum
    const searchStart = new Date(targetDate);
    searchStart.setMonth(searchStart.getMonth() - 1);
    const searchEnd = new Date(targetDate);
    searchEnd.setMonth(searchEnd.getMonth() + 1);

    // Alle Buchungen im Zeitraum laden
    const allBookings = await prisma.booking.findMany({
      where: {
        OR: [
          {
            AND: [
              { startDate: { lte: searchEnd } },
              { endDate: { gte: searchStart } },
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
        googleEventId: true,
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    // Aktive Buchungen (PENDING/APPROVED) - für Verfügbarkeitsprüfung
    const activeBookings = allBookings.filter(b => ['PENDING', 'APPROVED'].includes(b.status));
    
    // Finde spezifische Buchung falls vorhanden
    const specificBooking = allBookings.find(b => b.bookingCode === '123456');

    // Google Calendar Events laden
    let calendarEvents: any[] = [];
    try {
      const events = await getCalendarEvents(searchStart, searchEnd);
      calendarEvents = events.map(event => ({
        id: event.id,
        summary: event.summary,
        start: event.start,
        end: event.end,
        colorId: event.colorId,
        isOwnBooking: event.summary.includes('Buchung:') || event.summary.includes('🏠'),
        isInfoColor: event.colorId === '10',
        isBlocking: !event.summary.includes('Buchung:') && 
                   !event.summary.includes('🏠') && 
                   event.colorId !== '10',
      }));
    } catch (error) {
      console.error('Error loading calendar events:', error);
    }

    // Analysiere was den Ziel-Tag blockiert
    // WICHTIG: Verwende lokale Zeitzone (Europe/Amsterdam) für Konsistenz
    const getLocalDateString = (date: Date): string => {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Amsterdam',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(date);
    };

    const normalizeDate = (date: Date) => {
      const localDateStr = getLocalDateString(date);
      const [year, month, day] = localDateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    const targetDateNormalized = normalizeDate(targetDate);
    const targetDateKey = getLocalDateString(targetDate);

    // Sammle Check-in und Check-out Tage (in lokaler Zeitzone)
    const checkInDates = new Set<string>();
    const checkOutDates = new Set<string>();
    activeBookings.forEach(booking => {
      const checkInKey = getLocalDateString(booking.startDate);
      const checkOutKey = getLocalDateString(booking.endDate);
      checkInDates.add(checkInKey);
      checkOutDates.add(checkOutKey);
    });

    // Finde Buchungen die den Tag blockieren
    // WICHTIG: Ein Tag ist nur blockiert wenn:
    // 1. Er zwischen Check-in und Check-out liegt
    // 2. ODER er ist sowohl Check-in als auch Check-out Tag
    // Check-in Tage alleine sind NICHT blockiert
    // Check-out Tage alleine sind NICHT blockiert
    const blockingBookings: any[] = [];
    activeBookings.forEach(booking => {
      const start = normalizeDate(booking.startDate);
      const end = normalizeDate(booking.endDate);
      const startKey = getLocalDateString(booking.startDate);
      const endKey = getLocalDateString(booking.endDate);

      // Tag ist blockiert wenn:
      // 1. Er liegt zwischen Check-in und Check-out (während einer Buchung)
      // 2. ODER er ist Check-in Tag UND auch Check-out Tag
      // 3. ODER er ist Check-out Tag UND auch Check-in Tag
      const isBlockedByThisBooking = 
        (targetDateNormalized > start && targetDateNormalized < end) ||  // Zwischen Check-in und Check-out
        (targetDateKey === startKey && checkOutDates.has(startKey)) ||  // Check-in Tag der auch Check-out ist
        (targetDateKey === endKey && checkInDates.has(endKey));  // Check-out Tag der auch Check-in ist

      if (isBlockedByThisBooking) {
        blockingBookings.push({
          bookingCode: booking.bookingCode,
          startDate: startKey,
          endDate: endKey,
          startDateRaw: booking.startDate.toISOString(),
          endDateRaw: booking.endDate.toISOString(),
          status: booking.status,
          guestName: booking.guestName,
          reason: (targetDateNormalized > start && targetDateNormalized < end) ? 'Tag zwischen Check-in und Check-out' :
                 (targetDateKey === startKey && checkOutDates.has(startKey)) ? 'Check-in Tag (aber auch Check-out Tag)' :
                 'Check-out Tag (aber auch Check-in Tag)',
        });
      }
    });

    // Finde Calendar Events die den Tag blockieren
    const blockingCalendarEvents: any[] = [];
    calendarEvents
      .filter(event => event.isBlocking)
      .forEach(event => {
        const eventStart = normalizeDate(event.start);
        const eventEnd = normalizeDate(event.end);
        // Bei ganztägigen Calendar Events: end ist exklusiv (z.B. end=2025-11-10 bedeutet bis 09.11 inklusive)
        // Für Blockierung: Tag ist blockiert wenn er >= start und < end (wie im Calendar üblich)
        const isBlockedByThisEvent = 
          targetDateNormalized >= eventStart && targetDateNormalized < eventEnd;

        if (isBlockedByThisEvent) {
          blockingCalendarEvents.push({
            summary: event.summary,
            start: event.start.toISOString().split('T')[0],
            end: event.end.toISOString().split('T')[0],
            colorId: event.colorId,
            debug: {
              eventStart: eventStart.toISOString().split('T')[0],
              eventEnd: eventEnd.toISOString().split('T')[0],
              targetDate: targetDateNormalized.toISOString().split('T')[0],
              comparison: `${targetDateNormalized >= eventStart} && ${targetDateNormalized < eventEnd}`,
            },
          });
        }
      });

    // Alle Buchungen die den Tag berühren (auch wenn nicht blockierend)
    const touchingBookings = allBookings
      .filter(booking => {
        const start = normalizeDate(booking.startDate);
        const end = normalizeDate(booking.endDate);
        return targetDateNormalized >= start && targetDateNormalized <= end;
      })
      .map(booking => ({
        bookingCode: booking.bookingCode,
        startDate: booking.startDate.toISOString().split('T')[0],
        endDate: booking.endDate.toISOString().split('T')[0],
        status: booking.status,
        guestName: booking.guestName,
      }));

    return NextResponse.json({
      targetDate: targetDateStr,
      isBlocked: blockingBookings.length > 0 || blockingCalendarEvents.length > 0,
      blockingBookings,
      blockingCalendarEvents,
      allActiveBookings: activeBookings.map(b => ({
        bookingCode: b.bookingCode,
        startDate: b.startDate.toISOString().split('T')[0],
        endDate: b.endDate.toISOString().split('T')[0],
        status: b.status,
        guestName: b.guestName,
      })),
      allBookings: allBookings.map(b => ({
        bookingCode: b.bookingCode,
        startDate: b.startDate.toISOString().split('T')[0],
        endDate: b.endDate.toISOString().split('T')[0],
        status: b.status,
        guestName: b.guestName,
      })),
      allCalendarEvents: calendarEvents,
      touchingBookings,
      checkInDates: Array.from(checkInDates).sort(),
      specificBookingDOMWHABNQ: specificBooking ? {
        bookingCode: specificBooking.bookingCode,
        startDate: getLocalDateString(specificBooking.startDate),
        endDate: getLocalDateString(specificBooking.endDate),
        startDateRaw: specificBooking.startDate.toISOString(),
        endDateRaw: specificBooking.endDate.toISOString(),
        status: specificBooking.status,
        guestName: specificBooking.guestName,
      } : null,
      summary: {
        totalBookings: allBookings.length,
        activeBookings: activeBookings.length,
        totalCalendarEvents: calendarEvents.length,
        blockingBookingsCount: blockingBookings.length,
        blockingCalendarEventsCount: blockingCalendarEvents.length,
        statusBreakdown: {
          APPROVED: allBookings.filter(b => b.status === 'APPROVED').length,
          PENDING: allBookings.filter(b => b.status === 'PENDING').length,
          CANCELLED: allBookings.filter(b => b.status === 'CANCELLED').length,
          REJECTED: allBookings.filter(b => b.status === 'REJECTED').length,
        },
      },
    });
  } catch (error) {
    console.error('Error analyzing blocked date:', error);
    return NextResponse.json(
      { 
        error: 'Fehler beim Analysieren des blockierten Datums', 
        details: String(error) 
      },
      { status: 500 }
    );
  }
}

