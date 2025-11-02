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

    // 1. Nur genehmigte Buchungen im Zeitraum abrufen (ANONYM)
    // WICHTIG: PENDING Anfragen blockieren den Kalender NICHT - nur APPROVED Buchungen
    const bookings = await prisma.booking.findMany({
      where: {
        status: 'APPROVED',
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
    // WICHTIG: Check-out Tag (endDate) ist NICHT blockiert, außer er ist auch Check-in Tag
    // Tage zwischen Check-in und Check-out sind blockiert
    // Damit kann ein Tag zwischen Check-out und Check-in verfügbar sein
    
    // Hilfsfunktion: Konvertiert UTC Date zu lokalem Datum (Europe/Amsterdam)
    // Die Datenbank speichert UTC, aber wir müssen sie in lokaler Zeitzone interpretieren
    const getLocalDateString = (date: Date): string => {
      // Konvertiere UTC zu lokaler Zeit (Europe/Amsterdam)
      // Formatiere das Datum direkt in der lokalen Zeitzone
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Amsterdam',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(date);
    };
    
    const blockedDatesSet = new Set<string>();
    const checkInDates = new Set<string>(); // Sammle alle Check-in Tage
    const checkOutDates = new Set<string>(); // Sammle alle Check-out Tage
    
    // Zuerst: Sammle alle Check-in und Check-out Tage (in lokaler Zeitzone)
    bookings.forEach((booking) => {
      const startKey = getLocalDateString(booking.startDate);
      const endKey = getLocalDateString(booking.endDate);
      checkInDates.add(startKey);
      checkOutDates.add(endKey);
    });
    
    // WICHTIG: Ein Tag ist nur blockiert wenn:
    // 1. Er zwischen Check-in und Check-out liegt (also während einer Buchung)
    // 2. ODER er ist sowohl Check-in als auch Check-out Tag
    // Check-in Tage alleine sind NICHT blockiert (können als Check-out verwendet werden)
    // Check-out Tage alleine sind NICHT blockiert (können als Check-in verwendet werden)
    
    bookings.forEach((booking) => {
      const startKey = getLocalDateString(booking.startDate);
      const endKey = getLocalDateString(booking.endDate);
      
      // Parse die Datumstrings direkt (Format: YYYY-MM-DD)
      const [startYear, startMonth, startDay] = startKey.split('-').map(Number);
      const [endYear, endMonth, endDay] = endKey.split('-').map(Number);
      
      // Iteriere durch alle Tage zwischen Check-in und Check-out (exklusive Check-in und Check-out)
      // Diese Tage sind blockiert (während einer Buchung)
      let currentYear = startYear;
      let currentMonth = startMonth;
      let currentDay = startDay;
      
      // Überspringe den Check-in Tag (ist nicht blockiert, außer er ist auch Check-out)
      currentDay++;
      if (currentDay > new Date(currentYear, currentMonth, 0).getDate()) {
        currentDay = 1;
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      }
      
      // Blockiere Tage zwischen Check-in und Check-out
      while (!(currentYear === endYear && currentMonth === endMonth && currentDay === endDay)) {
        const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
        blockedDatesSet.add(dateKey);
        
        // Nächster Tag
        currentDay++;
        if (currentDay > new Date(currentYear, currentMonth, 0).getDate()) {
          currentDay = 1;
          currentMonth++;
          if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
          }
        }
      }
      
      // Check-in Tag ist nur blockiert, wenn er auch ein Check-out Tag ist
      if (checkOutDates.has(startKey)) {
        blockedDatesSet.add(startKey);
      }
      
      // Check-out Tag ist nur blockiert, wenn er auch ein Check-in Tag ist
      // WICHTIG: Verwende endKey direkt (bereits in lokaler Zeitzone konvertiert)
      if (checkInDates.has(endKey)) {
        blockedDatesSet.add(endKey);
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
      // Gleiche Logik wie bei Buchungen: Nur Tage zwischen Check-in und Check-out sind blockiert
      const calendarCheckInDates = new Set<string>();
      const calendarCheckOutDates = new Set<string>();
      
      // Sammle alle Check-in und Check-out Tage der Calendar Events
      blockingEvents.forEach((event) => {
        const eventStartLocal = getLocalDateString(event.start);
        const eventEndLocal = getLocalDateString(event.end);
        calendarCheckInDates.add(eventStartLocal);
        calendarCheckOutDates.add(eventEndLocal);
      });
      
      // Blockiere nur Tage zwischen Check-in und Check-out (nicht Check-in/Check-out selbst)
      blockingEvents.forEach((event) => {
        const eventStartLocal = getLocalDateString(event.start);
        const eventEndLocal = getLocalDateString(event.end);
        
        // Parse die Datumstrings direkt
        const [startYear, startMonth, startDay] = eventStartLocal.split('-').map(Number);
        const [endYear, endMonth, endDay] = eventEndLocal.split('-').map(Number);
        
        // Sicherheitscheck: Wenn Start nach End, überspringe
        if (startYear > endYear || (startYear === endYear && startMonth > endMonth) || 
            (startYear === endYear && startMonth === endMonth && startDay >= endDay)) {
          return;
        }
        
        // Iteriere durch alle Tage zwischen Check-in und Check-out (exklusive Check-in und Check-out)
        let currentYear = startYear;
        let currentMonth = startMonth;
        let currentDay = startDay;
        
        // Überspringe den Check-in Tag
        currentDay++;
        if (currentDay > new Date(currentYear, currentMonth, 0).getDate()) {
          currentDay = 1;
          currentMonth++;
          if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
          }
        }
        
        // Sicherheitscheck: Maximal 1000 Tage pro Event (verhindert Endlosschleifen)
        let daysProcessed = 0;
        const maxDays = 1000;
        
        // Blockiere Tage zwischen Check-in und Check-out
        while (!(currentYear === endYear && currentMonth === endMonth && currentDay === endDay) && daysProcessed < maxDays) {
          const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
          blockedDatesSet.add(dateKey);
          daysProcessed++;
          
          // Nächster Tag
          currentDay++;
          if (currentDay > new Date(currentYear, currentMonth, 0).getDate()) {
            currentDay = 1;
            currentMonth++;
            if (currentMonth > 12) {
              currentMonth = 1;
              currentYear++;
            }
          }
        }
        
        // Check-in Tag eines Calendar Events ist nur blockiert, wenn er auch Check-out Tag eines anderen Calendar Events ist
        if (calendarCheckOutDates.has(eventStartLocal)) {
          blockedDatesSet.add(eventStartLocal);
        }
        
        // Check-out Tag eines Calendar Events ist blockiert, wenn:
        // 1. Er auch Check-in Tag eines anderen Calendar Events ist, ODER
        // 2. Er auch Check-in Tag einer BUCHUNG ist (kombinierte Blockierung)
        // Bei externen Calendar Events ist der letzte Tag immer Check-out Tag und sollte verfügbar sein,
        // ABER wenn an diesem Tag auch eine Buchung startet, ist er blockiert
        if (calendarCheckInDates.has(eventEndLocal) || checkInDates.has(eventEndLocal)) {
          blockedDatesSet.add(eventEndLocal);
        }
      });
    } catch (error) {
      console.warn('Could not load calendar events for availability:', error);
      // Fahre fort ohne Calendar Events
    }

    // Konvertiere Set zu Array und filtere nur Tage im angefragten Zeitraum
    const startLocal = getLocalDateString(startDate);
    const endLocal = getLocalDateString(endDate);
    const blockedDates = Array.from(blockedDatesSet).filter(dateKey => {
      return dateKey >= startLocal && dateKey <= endLocal;
    });

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

