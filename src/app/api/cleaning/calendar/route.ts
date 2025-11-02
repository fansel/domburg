import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCalendarEvents } from '@/lib/google-calendar';

/**
 * API Route für Putzhilfe-Kalender
 * Gibt nur Ankunft/Abreise und Anwesenheit zurück (OHNE Namen)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');

    // Standard: aktueller Monat
    const today = new Date();
    const month = monthParam ? parseInt(monthParam) : today.getMonth();
    const year = yearParam ? parseInt(yearParam) : today.getFullYear();

    // Zeitraum für Google Calendar: Erweitert, um auch bei Navigation in die Vergangenheit Events zu laden
    // 12 Monate vor dem angefragten Monat bis 24 Monate danach
    const requestedMonthStart = new Date(year, month, 1);
    const calendarStartDate = new Date(year, month - 12, 1);
    const calendarEndDate = new Date(year, month + 24, 0);

    // Alle genehmigten Buchungen laden (auch aus der Vergangenheit)
    // Lade alle APPROVED Buchungen, nicht nur die im Zeitraum
    // Aber filtere für die Anzeige nur die, die mit dem angefragten Monat überschneiden
    const requestedMonthEnd = new Date(year, month + 1, 0);
    
    let allBookings = await prisma.booking.findMany({
      where: {
        status: 'APPROVED',
        OR: [
          {
            AND: [
              { startDate: { lte: requestedMonthEnd } },
              { endDate: { gte: requestedMonthStart } },
            ],
          },
        ],
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        // KEINE Namen oder E-Mails!
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    // Filtere Teilbuchungen heraus (Buchungen die vollständig innerhalb einer größeren Buchung liegen)
    // Sortiere nach Dauer (längste zuerst), damit größere Buchungen zuerst geprüft werden
    // Bei gleicher Dauer: längere Startdatum = später (sollte zuerst geprüft werden)
    const sortedBookings = [...allBookings].sort((a, b) => {
      const durationA = new Date(a.endDate).getTime() - new Date(a.startDate).getTime();
      const durationB = new Date(b.endDate).getTime() - new Date(b.startDate).getTime();
      if (durationB !== durationA) {
        return durationB - durationA; // Längste zuerst
      }
      // Bei gleicher Dauer: nach Startdatum sortieren (spätere zuerst)
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });

    const bookings: typeof allBookings = [];
    const excludedIds = new Set<string>();

    for (let i = 0; i < sortedBookings.length; i++) {
      const booking = sortedBookings[i];
      
      // Wenn diese Buchung bereits als Teilbuchung markiert wurde, überspringe sie
      if (excludedIds.has(booking.id)) {
        continue;
      }

      // Prüfe ob diese Buchung vollständig innerhalb einer anderen liegt
      let isContained = false;
      for (let j = 0; j < sortedBookings.length; j++) {
        if (i === j || excludedIds.has(sortedBookings[j].id)) continue;
        
        const otherBooking = sortedBookings[j];
        
        // Normalisiere Daten für Vergleich
        const bookingStart = new Date(booking.startDate);
        bookingStart.setHours(0, 0, 0, 0);
        const bookingEnd = new Date(booking.endDate);
        bookingEnd.setHours(0, 0, 0, 0);
        
        const otherStart = new Date(otherBooking.startDate);
        otherStart.setHours(0, 0, 0, 0);
        const otherEnd = new Date(otherBooking.endDate);
        otherEnd.setHours(0, 0, 0, 0);
        
        // Prüfe ob booking vollständig innerhalb otherBooking liegt
        // Wichtig: Nur wenn booking STRICHT innerhalb liegt (nicht gleich)
        // oder wenn booking gleich ist, aber otherBooking länger ist
        const isSameDates = bookingStart.getTime() === otherStart.getTime() && 
                           bookingEnd.getTime() === otherEnd.getTime();
        const isStrictlyContained = bookingStart >= otherStart && bookingEnd <= otherEnd;
        
        // Wenn beide Buchungen genau gleich sind, behalte die erste (die in der Liste früher kommt)
        if (isSameDates && j < i) {
          // Die andere Buchung kommt früher in der Liste, diese wird als Teilbuchung markiert
          isContained = true;
          excludedIds.add(booking.id);
          break;
        } else if (!isSameDates && isStrictlyContained) {
          // Diese Buchung ist strikt innerhalb der anderen
          isContained = true;
          excludedIds.add(booking.id);
          break;
        }
      }

      // Wenn nicht enthalten, füge zur Liste hinzu
      if (!isContained) {
        bookings.push(booking);
      }
    }

    // Google Calendar Events laden (optional) - erweiterter Zeitraum
    let calendarEvents: Array<{ start: Date; end: Date; summary?: string; isExternal?: boolean }> = [];
    try {
      const events = await getCalendarEvents(calendarStartDate, calendarEndDate);
      // Filtere nur blockierende Events (keine Info-Events, keine App-Buchungen)
      // WICHTIG: Alle Events mit "Buchung:" im Summary werden herausgefiltert, da diese Gästedaten enthalten
      calendarEvents = events
        .filter(event => {
          const isOwnBooking = event.summary.includes('Buchung:') || event.summary.includes('🏠');
          const isInfoColor = event.colorId === '10';
          const shouldInclude = !isOwnBooking && !isInfoColor;
          
          
          return shouldInclude;
        })
        .map(event => ({
          start: event.start,
          end: event.end,
          // Anonymisiere summary: Entferne potenzielle Gästedaten
          // Falls summary noch potenzielle Gästedaten enthält (z.B. von manuell erstellten Events),
          // ersetze es mit generischem Text
          summary: event.summary.includes('@') || 
                   /[A-Z][a-z]+ [A-Z][a-z]+/.test(event.summary) ? // Potenzielle Namen (z.B. "Max Mustermann")
                   'Blockierter Termin' : 
                   event.summary,
          isExternal: true, // Markiere als externe Events
        }));
    } catch (error) {
      console.warn('Could not load calendar events for cleaning calendar:', error);
    }

    // Bereite Daten für Kalenderansicht vor
    // Genau wie der Buchungskalender: Alle Tage zwischen Start und Ende markieren
    // Jeder Tag kennt seine Period-IDs für visuelle Gruppierung
    const calendarData: Record<string, { type: 'arrival' | 'departure' | 'both' | 'occupied'; isCheckIn?: boolean; isCheckOut?: boolean; periodIds?: Array<{ id: string; colorIndex: number }>; bookings?: number }> = {};

    // Sammlung für Zeitraum-Übersicht mit eindeutigen IDs und Farben
    // Vordefinierte Farbpalette für Buchungen
    const colorPalette = [
      { bg: 'bg-blue-500', border: 'border-blue-700', label: 'Blau' },
      { bg: 'bg-purple-500', border: 'border-purple-700', label: 'Lila' },
      { bg: 'bg-orange-500', border: 'border-orange-700', label: 'Orange' },
      { bg: 'bg-teal-500', border: 'border-teal-700', label: 'Türkis' },
      { bg: 'bg-pink-500', border: 'border-pink-700', label: 'Rosa' },
      { bg: 'bg-indigo-500', border: 'border-indigo-700', label: 'Indigo' },
      { bg: 'bg-yellow-500', border: 'border-yellow-700', label: 'Gelb' },
      { bg: 'bg-cyan-500', border: 'border-cyan-700', label: 'Cyan' },
    ];
    
    const periods: Array<{ id: string; start: string; end: string; type: 'booking' | 'external'; colorIndex: number }> = [];

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

    // Sammle alle Check-in und Check-out Tage für Buchungen (für kombinierte Prüfung)
    // WICHTIG: endDate in der DB ist der letzte buchbare Tag, aber im Cleaning Calendar
    // ist der Check-out Tag endDate + 1 (Person ist noch am endDate da, checkt erst am nächsten Tag aus)
    const bookingCheckInDates = new Set<string>();
    const bookingCheckOutDates = new Set<string>();
    
    bookings.forEach((booking) => {
      const startKey = getLocalDateString(booking.startDate);
      const endKey = getLocalDateString(booking.endDate);
      // WICHTIG: endDate ist BEREITS der Check-out Tag, NICHT +1!
      bookingCheckInDates.add(startKey);
      bookingCheckOutDates.add(endKey);
    });

    // Hauptbuchungen: Mit Farbe und in periods
    bookings.forEach((booking, index) => {
      // Verwende getLocalDateString um UTC korrekt in lokale Zeitzone zu konvertieren
      const startKey = getLocalDateString(booking.startDate);
      const endKey = getLocalDateString(booking.endDate);
      
      // WICHTIG: endDate ist BEREITS der Check-out Tag!
      // Keine +1 Tag Berechnung nötig

      // Eindeutige ID für diese Buchung
      const periodId = `booking-${index}`;
      const colorIndex = index % colorPalette.length;

      // Für Übersicht speichern (Check-in bis Check-out)
      periods.push({
        id: periodId,
        start: startKey,
        end: endKey, // endDate IST der Check-out Tag
        type: 'booking',
        colorIndex
      });

      // Check-in Tag immer anzeigen (als "arrival" oder "both")
      if (!calendarData[startKey]) {
        calendarData[startKey] = { 
          type: 'arrival', 
          isCheckIn: true, 
          isCheckOut: false, 
          periodIds: [],
          bookings: 0 
        };
      }
      calendarData[startKey].isCheckIn = true;
      if (!calendarData[startKey].periodIds) {
        calendarData[startKey].periodIds = [];
      }
      if (!calendarData[startKey].periodIds.find(p => p.id === periodId)) {
        calendarData[startKey].periodIds.push({ id: periodId, colorIndex });
      }
      // Wenn Check-in Tag auch Check-out Tag ist, dann "both"
      if (bookingCheckOutDates.has(startKey)) {
        calendarData[startKey].type = 'both';
        calendarData[startKey].isCheckOut = true;
      } else {
        calendarData[startKey].type = 'arrival';
      }
      calendarData[startKey].bookings = (calendarData[startKey].bookings || 0) + 1;

      // Tage zwischen Check-in und Check-out als "occupied" markieren
      // WICHTIG: endDate ist der Check-out Tag, Person ist nur bis endDate-1 da
      // Normalisiere booking dates auf lokale Zeit
      const [startYear, startMonth, startDay] = startKey.split('-').map(Number);
      const [endYear, endMonth, endDay] = endKey.split('-').map(Number);
      const normalizedStart = new Date(startYear, startMonth - 1, startDay);
      const normalizedEnd = new Date(endYear, endMonth - 1, endDay);
      
      let currentDate = new Date(normalizedStart);
      currentDate.setDate(currentDate.getDate() + 1); // Überspringe Check-in Tag
      
      // Person ist nur bis endDate-1 da, endDate ist Check-out (Person ist nicht mehr da)
      while (currentDate < normalizedEnd) {
        const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        
        if (!calendarData[dateKey]) {
          calendarData[dateKey] = { 
            type: 'occupied', 
            isCheckIn: false, 
            isCheckOut: false, 
            periodIds: [],
            bookings: 0 
          };
        }
        if (!calendarData[dateKey].periodIds) {
          calendarData[dateKey].periodIds = [];
        }
        if (!calendarData[dateKey].periodIds.find(p => p.id === periodId)) {
          calendarData[dateKey].periodIds.push({ id: periodId, colorIndex });
        }
        calendarData[dateKey].type = 'occupied';
        calendarData[dateKey].bookings = (calendarData[dateKey].bookings || 0) + 1;
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Check-out Tag IMMER anzeigen (als "departure" oder "both")
      // endKey IST bereits der Check-out Tag
      // Für Cleaning Calendar müssen alle Check-out Tage sichtbar sein
      if (!calendarData[endKey]) {
        calendarData[endKey] = { 
          type: 'departure', 
          isCheckIn: false, 
          isCheckOut: true, 
          periodIds: [],
          bookings: 0 
        };
      }
      calendarData[endKey].isCheckOut = true;
      if (!calendarData[endKey].periodIds) {
        calendarData[endKey].periodIds = [];
      }
      if (!calendarData[endKey].periodIds.find(p => p.id === periodId)) {
        calendarData[endKey].periodIds.push({ id: periodId, colorIndex });
      }
      // Wenn Check-out Tag auch Check-in Tag ist, dann "both"
      if (bookingCheckInDates.has(endKey)) {
        calendarData[endKey].type = 'both';
        calendarData[endKey].isCheckIn = true;
      } else {
        calendarData[endKey].type = 'departure';
      }
      calendarData[endKey].bookings = (calendarData[endKey].bookings || 0) + 1;
    });

    // Teilbuchungen: Nur als "occupied" markieren, OHNE Farbe/periodIds (keine eigene Periode)
    // Diese sind schon als "belegt" zu zählen, aber nicht farblich hervorzuheben
    allBookings.forEach((booking) => {
      if (excludedIds.has(booking.id)) {
        // Diese ist eine Teilbuchung - markiere Tage als belegt, aber ohne periodIds
        const start = new Date(booking.startDate);
        const end = new Date(booking.endDate);
        const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        
        // Alle Tage der Teilbuchung als "occupied" markieren (ohne periodIds)
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
          
          // Wenn der Tag noch nicht existiert, erstelle ihn als "occupied"
          if (!calendarData[dateKey]) {
            calendarData[dateKey] = { 
              type: 'occupied', 
              isCheckIn: false, 
              isCheckOut: false, 
              periodIds: [],
              bookings: 0 
            };
          }
          
          // Wenn der Tag bereits periodIds hat (von einer Hauptbuchung), füge KEINE hinzu
          // Nur wenn der Tag noch keine periodIds hat, markiere ihn als occupied
          if (!calendarData[dateKey].periodIds || calendarData[dateKey].periodIds.length === 0) {
            calendarData[dateKey].type = 'occupied';
          }
          // Zähle die Buchung trotzdem (für Statistiken)
          calendarData[dateKey].bookings = (calendarData[dateKey].bookings || 0) + 1;
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    });

    // Sammle alle Check-in und Check-out Tage für Calendar Events
    // WICHTIG: Bei Calendar Events ist event.end exklusiv, daher ist der letzte Tag end - 1
    // Check-out Tag ist dann (end - 1) + 1 = end (aber als Datum formatiert)
    const eventCheckInDates = new Set<string>();
    const eventCheckOutDates = new Set<string>();
    
    calendarEvents.forEach((event) => {
      if (!event.isExternal) return;
      const start = new Date(event.start);
      const end = new Date(event.end);
      const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      // Bei Calendar Events: end ist exklusiv, also end IST der Check-out Tag!
      const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const startKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      const endKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
      eventCheckInDates.add(startKey);
      eventCheckOutDates.add(endKey);
    });

    // Füge auch Calendar Events hinzu (genau wie Buchungen)
    calendarEvents.forEach((event, index) => {
      if (!event.isExternal) return;
      
      const start = new Date(event.start);
      const end = new Date(event.end);
      
      // Normalisiere auf Mitternacht für konsistente Vergleiche
      const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      // Bei Calendar Events: end ist exklusiv, also end IST bereits der Check-out Tag!
      const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      
      const startKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      const endKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

      // Eindeutige ID für dieses Event
      const periodId = `external-${index}`;
      // Für externe Events verwenden wir die Buchungen-Indizes weiter
      const colorIndex = (bookings.length + index) % colorPalette.length;

      // Für Übersicht speichern (Check-in bis Check-out)
      periods.push({
        id: periodId,
        start: startKey,
        end: endKey, // end ist bereits Check-out Tag (exklusiv)
        type: 'external',
        colorIndex
      });

      // Check-in Tag IMMER anzeigen (für Cleaning Calendar müssen alle Check-in Tage sichtbar sein)
      if (!calendarData[startKey]) {
        calendarData[startKey] = { 
          type: 'arrival', 
          isCheckIn: true, 
          isCheckOut: false, 
          periodIds: [],
          bookings: 0 
        };
      }
      calendarData[startKey].isCheckIn = true;
      if (!calendarData[startKey].periodIds) {
        calendarData[startKey].periodIds = [];
      }
      if (!calendarData[startKey].periodIds.find(p => p.id === periodId)) {
        calendarData[startKey].periodIds.push({ id: periodId, colorIndex });
      }
      // Wenn Check-in Tag auch Check-out Tag ist, dann "both"
      if (eventCheckOutDates.has(startKey) || calendarData[startKey].isCheckOut) {
        calendarData[startKey].type = 'both';
        calendarData[startKey].isCheckOut = true;
      } else {
        calendarData[startKey].type = 'arrival';
      }
      calendarData[startKey].bookings = (calendarData[startKey].bookings || 0) + 1;

      // Tage zwischen Check-in und Check-out als "occupied" markieren
      // WICHTIG: endDate ist Check-out Tag (exklusiv), Event ist nur bis endDate-1 aktiv
      let currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + 1); // Überspringe Check-in Tag
      
      // Event ist nur bis endDate-1 aktiv (endDate ist Check-out, exklusiv)
      while (currentDate < endDate) {
        const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        
        if (!calendarData[dateKey]) {
          calendarData[dateKey] = { 
            type: 'occupied', 
            isCheckIn: false, 
            isCheckOut: false, 
            periodIds: [],
            bookings: 0 
          };
        }
        if (!calendarData[dateKey].periodIds) {
          calendarData[dateKey].periodIds = [];
        }
        if (!calendarData[dateKey].periodIds.find(p => p.id === periodId)) {
          calendarData[dateKey].periodIds.push({ id: periodId, colorIndex });
        }
        calendarData[dateKey].type = 'occupied';
        calendarData[dateKey].bookings = (calendarData[dateKey].bookings || 0) + 1;
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Check-out Tag IMMER anzeigen (als "departure" oder "both")
      // endKey IST bereits der Check-out Tag (exklusiv)
      // Für Cleaning Calendar müssen alle Check-out Tage sichtbar sein
      if (!calendarData[endKey]) {
        calendarData[endKey] = { 
          type: 'departure', 
          isCheckIn: false, 
          isCheckOut: true, 
          periodIds: [],
          bookings: 0 
        };
      }
      calendarData[endKey].isCheckOut = true;
      if (!calendarData[endKey].periodIds) {
        calendarData[endKey].periodIds = [];
      }
      if (!calendarData[endKey].periodIds.find(p => p.id === periodId)) {
        calendarData[endKey].periodIds.push({ id: periodId, colorIndex });
      }
      // Wenn Check-out Tag auch Check-in Tag ist, dann "both"
      if (eventCheckInDates.has(endKey) || bookingCheckInDates.has(endKey)) {
        calendarData[endKey].type = 'both';
        calendarData[endKey].isCheckIn = true;
      } else {
        calendarData[endKey].type = 'departure';
      }
      calendarData[endKey].bookings = (calendarData[endKey].bookings || 0) + 1;
    });

    // Sortiere Perioden nach Startdatum
    periods.sort((a, b) => a.start.localeCompare(b.start));

    // Filtere Perioden: Nur die, die mit dem angefragten Monat überschneiden
    const filteredPeriods = periods.filter((period) => {
      // Parse period dates as local dates (YYYY-MM-DD format)
      const [startY, startM, startD] = period.start.split('-').map(Number);
      const periodStart = new Date(startY, startM - 1, startD);
      periodStart.setHours(0, 0, 0, 0);
      
      const [endY, endM, endD] = period.end.split('-').map(Number);
      const periodEnd = new Date(endY, endM - 1, endD);
      periodEnd.setHours(23, 59, 59, 999);
      
      const monthStart = new Date(year, month, 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(year, month + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      
      // Überschneidung prüfen: Periode überschneidet Monat wenn periodEnd >= monthStart && periodStart <= monthEnd
      return periodStart <= monthEnd && periodEnd >= monthStart;
    });

    // Filtere auch calendarData: Nur Tage des angefragten Monats
    // UND sortiere periodIds für "both" Tage: Check-in Perioden zuerst (links oben/grün), dann Check-out Perioden (rechts unten/rot)
    const filteredCalendarData: typeof calendarData = {};
    const monthStart = new Date(year, month, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, month + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    
    Object.keys(calendarData).forEach((dateKey) => {
      // Parse dateKey direkt als lokales Datum (YYYY-MM-DD Format)
      const [y, m, d] = dateKey.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      date.setHours(0, 0, 0, 0);
      
      if (date >= monthStart && date <= monthEnd) {
        const dayData = calendarData[dateKey];
        
        // Sortiere periodIds für "both" Tage: Check-out Perioden zuerst (links oben = grün = Ankunft), dann Check-in Perioden (rechts unten = rot = Abreise)
        if (dayData.type === 'both' && dayData.periodIds && dayData.periodIds.length >= 1) {
          // Finde heraus welche Perioden Check-in sind (startet an diesem Tag) und welche Check-out (endet an diesem Tag)
          const checkInPeriods: typeof dayData.periodIds = [];
          const checkOutPeriods: typeof dayData.periodIds = [];
          
          dayData.periodIds.forEach(period => {
            // Verwende das ursprüngliche periods Array (nicht filteredPeriods), 
            // da periodIds auf alle Perioden verweisen können, auch außerhalb des aktuellen Monats
            const periodInfo = periods.find(p => p.id === period.id);
            if (periodInfo) {
              if (periodInfo.start === dateKey) {
                // Diese Periode startet hier (Check-in = Ankunft)
                checkInPeriods.push(period);
              } else if (periodInfo.end === dateKey) {
                // Diese Periode endet hier (Check-out = Abreise)
                checkOutPeriods.push(period);
              } else {
                // Fallback: Wenn nicht klar, nimm die erste als Check-out
                if (checkOutPeriods.length === 0) {
                  checkOutPeriods.push(period);
                } else {
                  checkInPeriods.push(period);
                }
              }
            }
          });
          
          // Sortiere: Check-out ZUERST (links oben = grün = Ankunft), dann Check-in (rechts unten = rot = Abreise)
          // WICHTIG: Links oben zeigt die Abreise (Check-out), rechts unten die Ankunft (Check-in)
          // Wenn nur eine Periode, dann ist es sowohl Check-in als auch Check-out derselben Buchung
          dayData.periodIds = checkOutPeriods.length > 0 || checkInPeriods.length > 0 
            ? [...checkOutPeriods, ...checkInPeriods]
            : dayData.periodIds; // Fallback: behalte originale Reihenfolge
        }
        
        filteredCalendarData[dateKey] = dayData;
      }
    });

    return NextResponse.json({
      calendarData: filteredCalendarData,
      periods: filteredPeriods,
      colorPalette,
      month,
      year,
    });
  } catch (error) {
    console.error('Error fetching cleaning calendar:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden des Kalenders' },
      { status: 500 }
    );
  }
}
