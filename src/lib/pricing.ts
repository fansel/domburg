import prisma from '@/lib/prisma';
import { getDaysBetween } from '@/lib/utils';
import { getCalendarEvents } from '@/lib/google-calendar';

export interface PriceCalculation {
  nights: number;
  basePrice: number;
  cleaningFee: number;
  beachHutPrice?: number;
  totalPrice: number;
  pricePerNight: number;
  breakdown: Array<{
    date: string;
    price: number;
    phase?: string;
  }>;
  warnings?: string[]; // Warnungen zu Saison-Regeln (blockieren nicht die Buchung)
}

export async function calculateBookingPrice(
  startDate: Date,
  endDate: Date,
  useFamilyPrice: boolean = false
): Promise<PriceCalculation> {
  const nights = getDaysBetween(startDate, endDate);

  // Basis-Preis aus Einstellungen holen
  const basePriceSetting = await prisma.pricingSetting.findUnique({
    where: { key: 'base_price_per_night' },
  });
  
  // Family-Preis oder Standard-Preis
  const defaultPricePerNight = useFamilyPrice && basePriceSetting?.value2
    ? parseFloat(basePriceSetting.value2)
    : parseFloat(basePriceSetting?.value || '140');

  // Reinigungsgebühr
  const cleaningFeeSetting = await prisma.pricingSetting.findUnique({
    where: { key: 'cleaning_fee' },
  });
  const cleaningFee = parseFloat(cleaningFeeSetting?.value || '75');

  // Preisphasen holen - hole ALLE aktiven Phasen, da wir später filtern
  // Dies ermöglicht auch jahresübergreifende Phasen zu finden
  const pricingPhases = await prisma.pricingPhase.findMany({
    where: {
      isActive: true,
    },
    orderBy: { priority: 'desc' },
  });

  // Tagespreise berechnen
  const breakdown: Array<{ date: string; price: number; phase?: string }> = [];
  let totalNightlyPrice = 0;

  // Normalisiere Datums-Objekte für Tag-zu-Tag-Vergleiche (setze Zeit auf 00:00:00 UTC)
  // Verwende UTC um Zeitzonen-Probleme zu vermeiden
  const normalizeDate = (date: Date): Date => {
    const normalized = new Date(date);
    // Verwende UTC für konsistente Berechnung
    normalized.setUTCHours(0, 0, 0, 0);
    return normalized;
  };

  const normalizedStartDate = normalizeDate(startDate);
  const normalizedEndDate = normalizeDate(endDate);

  // Normalisiere auch die Preisphasen-Daten
  const normalizedPhases = pricingPhases.map(phase => ({
    ...phase,
    startDate: normalizeDate(phase.startDate),
    endDate: normalizeDate(phase.endDate),
  }));

  let currentDate = new Date(normalizedStartDate);
  while (currentDate < normalizedEndDate) {
    let priceForDay = defaultPricePerNight;
    let appliedPhase: string | undefined;

    // Höchste Priorität der passenden Preisphasen finden
    // Phasen sind bereits nach priority: 'desc' sortiert
    for (const phase of normalizedPhases) {
      // Prüfe ob currentDate innerhalb der Phase liegt
      // endDate ist inklusiv (der Tag gehört noch zur Phase)
      if (currentDate >= phase.startDate && currentDate <= phase.endDate) {
        // Family-Preis oder Standard-Preis verwenden
        if (useFamilyPrice && phase.familyPricePerNight) {
          priceForDay = parseFloat(phase.familyPricePerNight.toString());
        } else {
          priceForDay = parseFloat(phase.pricePerNight.toString());
        }
        appliedPhase = phase.name;
        break; // Höchste Priorität gefunden (da bereits sortiert)
      }
    }

    breakdown.push({
      date: currentDate.toISOString().split('T')[0],
      price: priceForDay,
      phase: appliedPhase,
    });

    totalNightlyPrice += priceForDay;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Strandbuden-Preis automatisch berechnen, wenn innerhalb einer aktiven Session
  // Bei Family-Preis ist Strandbude kostenlos inklusive (useBeachHut = true, aber beachHutPrice = 0)
  let beachHutPrice = 0;
  let useBeachHut = false;
  
  // Prüfe ob Strandbude in aktiver Session verfügbar ist
  const allSessions = await (prisma as any).beachHutSession.findMany();
  
  if (allSessions.length > 0) {
    // Wenn Sessions definiert sind, prüfe ob Buchungszeitraum innerhalb einer aktiven Session liegt
    const activeSessions = await (prisma as any).beachHutSession.findMany({
      where: {
        isActive: true,
        AND: [
          { startDate: { lte: normalizedEndDate } },
          { endDate: { gte: normalizedStartDate } },
        ],
      },
    });
    useBeachHut = activeSessions.length > 0;
  } else {
    // Wenn keine Sessions definiert sind, ist Strandbude ganzjährig verfügbar
    useBeachHut = true;
  }

  // Berechne Strandbuden-Preis nur wenn aktiviert UND NICHT Family-Preis
  // Bei Family-Preis ist Strandbude kostenlos (useBeachHut = true, aber beachHutPrice = 0)
  if (useBeachHut && !useFamilyPrice) {
    const beachHutPricePerWeekSetting = await prisma.pricingSetting.findUnique({
      where: { key: 'beach_hut_price_per_week' },
    });
    const beachHutPricePerDaySetting = await prisma.pricingSetting.findUnique({
      where: { key: 'beach_hut_price_per_day' },
    });
    
    const pricePerWeek = parseFloat(beachHutPricePerWeekSetting?.value || '100');
    const pricePerDay = parseFloat(beachHutPricePerDaySetting?.value || '15');
    
    // Berechne Anzahl Wochen und verbleibende Tage
    const weeks = Math.floor(nights / 7);
    const remainingDays = nights % 7;
    
    beachHutPrice = (weeks * pricePerWeek) + (remainingDays * pricePerDay);
  }

  const totalPrice = totalNightlyPrice + cleaningFee + beachHutPrice;

  // Prüfe Saison-Regeln und sammle Warnungen
  const warnings: string[] = [];
  
  // Finde die relevante Preisphase für den Starttag
  // Prüfe alle Phasen und nimm die mit der höchsten Priorität, die den Starttag enthält
  let startDatePhase: (typeof pricingPhases[0] & { minNights?: number | null; saturdayToSaturday?: boolean }) | undefined;
  
  // Suche alle Phasen die den Starttag enthalten, sortiert nach Priorität
  // WICHTIG: Ignoriere das Jahr und prüfe nur Monat/Tag (für jahresübergreifende Phasen)
  const matchingPhases = pricingPhases
    .filter(phase => {
      const phaseStart = normalizeDate(phase.startDate);
      const phaseEnd = normalizeDate(phase.endDate);
      
      // Methode 1: Normale Datumsprüfung (für exakte Jahresphasen)
      if (normalizedStartDate >= phaseStart && normalizedStartDate <= phaseEnd) {
        return true;
      }
      
      // Methode 2: Jahresübergreifende Prüfung - ignoriere Jahr, prüfe nur Monat/Tag
      const startMonth = normalizedStartDate.getMonth();
      const startDay = normalizedStartDate.getDate();
      const phaseStartMonth = phaseStart.getMonth();
      const phaseStartDay = phaseStart.getDate();
      const phaseEndMonth = phaseEnd.getMonth();
      const phaseEndDay = phaseEnd.getDate();
      
      // Prüfe ob Starttag zwischen Phase-Start und Phase-Ende liegt (jahresunabhängig)
      // Für z.B. Juni-September: Wenn Starttag zwischen 06-01 und 09-30 liegt
      if (phaseStartMonth <= phaseEndMonth) {
        // Normale Range (z.B. Juni bis September)
        if (startMonth > phaseStartMonth || (startMonth === phaseStartMonth && startDay >= phaseStartDay)) {
          if (startMonth < phaseEndMonth || (startMonth === phaseEndMonth && startDay <= phaseEndDay)) {
            return true;
          }
        }
      } else {
        // Jahresübergreifend (z.B. Dezember bis Februar)
        if (startMonth > phaseStartMonth || (startMonth === phaseStartMonth && startDay >= phaseStartDay)) {
          return true;
        }
        if (startMonth < phaseEndMonth || (startMonth === phaseEndMonth && startDay <= phaseEndDay)) {
          return true;
        }
      }
      
      return false;
    })
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
  if (matchingPhases.length > 0) {
    const phase = matchingPhases[0] as any;
    startDatePhase = phase;
    
    // Prüfe Mindestanzahl Nächte
    const minNights = phase.minNights;
    if (minNights != null && nights < minNights) {
      const warningMsg = `Für diese Saison ist eine Mindestbuchung von ${minNights} Nächten erforderlich. Du buchst ${nights} ${nights === 1 ? 'Nacht' : 'Nächte'}.`;
      warnings.push(warningMsg);
      // Speichere minNights für bessere Extraktion im Frontend
      (warnings as any).minNights = minNights;
    }

    // Prüfe Samstag-zu-Samstag Regel
    const saturdayToSaturday = phase.saturdayToSaturday;
    if (saturdayToSaturday === true) {
      // Konvertiere Daten in Europe/Amsterdam Zeitzone für Wochentag-Berechnung
      // Das Datum kommt als UTC, muss aber in der lokalen Zeitzone interpretiert werden
      const getDayOfWeekInTimezone = (date: Date, timezone: string = 'Europe/Amsterdam'): number => {
        // Verwende Intl.DateTimeFormat um das Datum in der lokalen Zeitzone zu formatieren
        // und dann den Wochentag zu extrahieren
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          weekday: 'long',
        });
        const weekday = formatter.format(date);
        
        const weekdayMap: Record<string, number> = {
          'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 
          'Thursday': 4, 'Friday': 5, 'Saturday': 6
        };
        
        return weekdayMap[weekday] ?? 0;
      };
      
      // Verwende die ORIGINALEN Daten (vor Normalisierung) für Wochentag-Berechnung
      // Die Normalisierung setzt auf UTC-Mitternacht, was das Datum verschieben kann
      const startDay = getDayOfWeekInTimezone(startDate); // 0 = Sonntag, 6 = Samstag
      
      // WICHTIG: endDate ist exklusiv (letzter gebuchter Tag ist endDate - 1 Tag)
      // Für eine Buchung von Samstag zu Samstag: Start = Samstag, End = nächster Samstag
      // Der letzte gebuchte Tag ist also der Tag VOR endDate
      // Erstelle ein neues Datum für den letzten gebuchten Tag (1 Tag vor endDate)
      const lastBookedDate = new Date(endDate);
      lastBookedDate.setDate(lastBookedDate.getDate() - 1);
      const lastBookedDay = getDayOfWeekInTimezone(lastBookedDate); // 0 = Sonntag, 6 = Samstag
      
      const endDay = getDayOfWeekInTimezone(endDate); // 0 = Sonntag, 6 = Samstag
      
      // Debug: Log für besseres Verständnis
      console.log('Saturday check (Europe/Amsterdam):', {
        startDate: normalizedStartDate.toISOString(),
        startDay,
        startDayName: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][startDay],
        endDate: normalizedEndDate.toISOString(),
        endDay,
        endDayName: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][endDay],
        lastBookedDate: lastBookedDate.toISOString(),
        lastBookedDay,
        lastBookedDayName: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][lastBookedDay],
        isStartSaturday: startDay === 6,
        isLastDaySaturday: lastBookedDay === 6,
        nights,
        willShowWarning: !(startDay === 6 && (endDay === 0 || lastBookedDay === 6 || (nights > 0 && nights % 7 === 0)))
      });
      
      // Eine Samstag-zu-Samstag-Buchung ist gültig wenn:
      // 1. Starttag ist Samstag (6) UND Endtag ist Samstag (6) UND Anzahl Nächte ist Vielfaches von 7
      // ODER
      // 2. Starttag ist Samstag (6) UND Endtag ist Sonntag (0) - dann ist letzter Tag = Samstag
      // ODER
      // 3. Starttag ist Samstag (6) UND letzter gebuchter Tag ist Samstag (6)
      // 
      // Wenn jemand "Samstag bis Samstag" im Kalender auswählt:
      // - startDate = Samstag, endDate = nächster Samstag
      // - lastBookedDay = Freitag (endDate - 1)
      // - Aber: Anzahl Nächte = 7, also ist es eine volle Woche = gültig
      const isValidSaturdayToSaturday = startDay === 6 && (
        // Fall 1: Start = Samstag UND End = Samstag UND 7 Nächte (oder Vielfaches)
        (endDay === 6 && nights > 0 && nights % 7 === 0) ||
        // Fall 2: Start = Samstag UND End = Sonntag (dann ist letzter Tag = Samstag)
        endDay === 0 ||
        // Fall 3: Start = Samstag UND letzter gebuchter Tag = Samstag
        lastBookedDay === 6
      );
      
      if (!isValidSaturdayToSaturday) {
        warnings.push('Für diese Saison sind nur Buchungen von Samstag zu Samstag möglich.');
      }
    }
  }

  return {
    nights,
    basePrice: totalNightlyPrice,
    cleaningFee,
    // Strandbude-Preis anzeigen wenn automatisch aktiviert
    // Bei Family-Preis ist useBeachHut = true, aber beachHutPrice = 0 (kostenlos)
    beachHutPrice: useBeachHut && beachHutPrice > 0 ? beachHutPrice : undefined,
    totalPrice,
    pricePerNight: totalNightlyPrice / nights,
    breakdown,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export async function getMinStayNights(): Promise<number> {
  const setting = await prisma.pricingSetting.findUnique({
    where: { key: 'min_stay_nights' },
  });
  return parseInt(setting?.value || '3');
}


/**
 * Berechnet das maximale Buchungsdatum basierend auf der Einstellung
 * Regel: Ab Oktober (Monat >= 10) für das ganze nächste Jahr, sonst bis Ende des aktuellen Jahres
 */
export async function getMaxBookingDate(): Promise<Date> {
  const setting = await prisma.setting.findUnique({
    where: { key: "BOOKING_ADVANCE_OCTOBER_TO_NEXT_YEAR" },
  });
  
  const enabled = setting?.value === "true";
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();
  
  if (enabled && currentMonth >= 10) {
    // Ab Oktober: Maximale Buchung bis Ende des nächsten Jahres
    return new Date(currentYear + 1, 11, 31); // 31. Dezember des nächsten Jahres
  } else {
    // Vor Oktober: Maximale Buchung bis Ende des aktuellen Jahres
    return new Date(currentYear, 11, 31); // 31. Dezember des aktuellen Jahres
  }
}

export async function validateBookingDates(
  startDate: Date,
  endDate: Date,
  excludeBookingId?: string // Um bei Updates die eigene Buchung auszuschließen
): Promise<{ valid: boolean; error?: string }> {
  // Startdatum muss in der Zukunft liegen
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (startDate < now) {
    return { valid: false, error: 'Startdatum muss in der Zukunft liegen' };
  }

  // Enddatum muss nach Startdatum liegen
  if (endDate <= startDate) {
    return { valid: false, error: 'Enddatum muss nach Startdatum liegen' };
  }

  // Prüfe maximales Buchungsdatum (Vorausplanung)
  const maxBookingDate = await getMaxBookingDate();
  maxBookingDate.setHours(23, 59, 59, 999);
  if (endDate > maxBookingDate) {
    const setting = await prisma.setting.findUnique({
      where: { key: "BOOKING_ADVANCE_OCTOBER_TO_NEXT_YEAR" },
    });
    const enabled = setting?.value === "true";
    const currentMonth = new Date().getMonth() + 1;
    
    if (enabled && currentMonth >= 10) {
      return { valid: false, error: `Buchungen sind nur bis zum 31. Dezember ${maxBookingDate.getFullYear()} möglich` };
    } else {
      return { valid: false, error: `Buchungen sind nur bis zum 31. Dezember ${maxBookingDate.getFullYear()} möglich` };
    }
  }

  // Mindestaufenthalt prüfen
  const minNights = await getMinStayNights();
  const nights = getDaysBetween(startDate, endDate);
  if (nights < minNights) {
    return {
      valid: false,
      error: `Mindestaufenthalt: ${minNights} Nächte`,
    };
  }

  // Überschneidungen mit bestehenden Buchungen in der Datenbank prüfen
  // WICHTIG: 
  // - Nur APPROVED Buchungen blockieren neue Anfragen
  // - PENDING Anfragen blockieren NICHT - mehrere PENDING Anfragen für denselben Zeitraum sind erlaubt
  // - Sie werden später als potenzielle Konflikte im Admin-Panel angezeigt
  const existingBookings = await prisma.booking.findMany({
    where: {
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      status: 'APPROVED', // Nur APPROVED Buchungen blockieren
      OR: [
        {
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } },
          ],
        },
      ],
    },
  });

  // Normalisiere Daten für Vergleich
  // WICHTIG: Verwende lokale Zeitzone (Europe/Amsterdam) für Konsistenz mit Anzeige
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
    // Parse als lokales Datum (ohne Timezone)
    const [year, month, day] = localDateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const newStart = normalizeDate(startDate);
  const newEnd = normalizeDate(endDate);

  // Logik: Ein Tag ist blockiert wenn er Check-in Tag ist
  // Check-out Tag ist NICHT blockiert (kann als Check-in verwendet werden)
  // Wenn ein Tag sowohl Check-in als auch Check-out ist → blockiert (weil Check-in)
  
  // Sammle alle Check-in Tage der bestehenden Buchungen (in lokaler Zeitzone)
  const existingCheckInDates = new Set<string>();
  existingBookings.forEach((booking) => {
    const checkInKey = getLocalDateString(booking.startDate);
    existingCheckInDates.add(checkInKey);
  });

  // Prüfe ob neue Buchung Tage blockiert, die zwischen Check-in und Check-out liegen
  // WICHTIG: 
  // - Check-in Tage sind NICHT blockiert (können als Check-out verwendet werden)
  // - Check-out Tage sind NICHT blockiert (können als Check-in verwendet werden)
  // - Nur Tage STRENG zwischen Check-in und Check-out sind blockiert
  // Iteriere durch alle Tage der neuen Buchung (von newStart bis newEnd exklusive newEnd)
  let hasBlockedDays = false;
  
  let checkDate = new Date(newStart);
  while (checkDate < newEnd) {
    // Prüfe ob Tag zwischen Check-in und Check-out einer bestehenden Buchung liegt
    // Check-in Tage selbst sind NICHT blockiert (können als Check-out verwendet werden)
    // Check-out Tage selbst sind NICHT blockiert (können als Check-in verwendet werden)
    for (const booking of existingBookings) {
      const existingStart = normalizeDate(booking.startDate);
      const existingEnd = normalizeDate(booking.endDate);
      
      // Tag ist blockiert wenn er STRENG zwischen Check-in und Check-out liegt
      // (checkDate > existingStart && checkDate < existingEnd)
      // Check-in Tag (checkDate === existingStart) ist NICHT blockiert
      // Check-out Tag (checkDate === existingEnd) ist NICHT blockiert
      // Tag NACH Check-out (checkDate > existingEnd) ist NICHT blockiert
      if (checkDate > existingStart && checkDate < existingEnd) {
        hasBlockedDays = true;
        break;
      }
    }
    
    if (hasBlockedDays) break;
    checkDate.setDate(checkDate.getDate() + 1);
  }
  
  // Prüfe auch den Check-out Tag der neuen Buchung (newEnd)
  // Er ist blockiert, wenn er STRENG zwischen Check-in und Check-out einer bestehenden Buchung liegt
  // Check-out Tag selbst ist NICHT blockiert (kann als Check-in verwendet werden)
  for (const booking of existingBookings) {
    const existingStart = normalizeDate(booking.startDate);
    const existingEnd = normalizeDate(booking.endDate);
    
    // Check-out Tag ist blockiert, wenn er STRENG zwischen Check-in und Check-out liegt (aber nicht Check-in/Check-out Tag selbst)
    if (newEnd > existingStart && newEnd < existingEnd) {
      hasBlockedDays = true;
      break;
    }
  }

  if (hasBlockedDays) {
    return {
      valid: false,
      error: 'Dieser Zeitraum ist bereits gebucht oder angefragt',
    };
  }

  // Blockierte Termine aus Google Calendar prüfen
  // WICHTIG: Gleiche Logik wie bei Buchungen - Check-out Tag ist verfügbar
  try {
    const calendarEvents = await getCalendarEvents(startDate, endDate);
    
    // Filtere Events: Nur echte Blockierungen (basierend auf Farbe)
    const blockingEvents = calendarEvents.filter(event => {
      // 1. Ignoriere Events die von unserer App erstellt wurden
      if (event.summary.includes('Buchung:')) {
        return false;
      }
      
      // 2. Ignoriere Events mit Info-Farbe (Grün=10) - z.B. Preise, Ferien
      const infoColorIds = ['10'];
      if (event.colorId && infoColorIds.includes(event.colorId)) {
        return false;
      }
      
      // Alle anderen Events sind Blockierungen
      return true;
    });

    // Prüfe ob Tage der neuen Buchung mit blockierenden Events überlappen
    // Gleiche Logik wie bei Buchungen: Nur Tage zwischen Check-in und Check-out sind blockiert
    if (blockingEvents.length > 0) {
      let hasBlockedDays = false;
      
      // Iteriere durch alle Tage der neuen Buchung (von newStart bis newEnd exklusive newEnd)
      let checkDate = new Date(newStart);
      while (checkDate < newEnd) {
        // Prüfe ob dieser Tag durch ein Calendar Event blockiert ist
        for (const event of blockingEvents) {
          const eventStart = normalizeDate(event.start);
          const eventEnd = normalizeDate(event.end);
          
          // Tag ist blockiert wenn er STRENG zwischen Check-in und Check-out liegt
          // Check-in Tage sind NICHT blockiert
          // Check-out Tage sind NICHT blockiert (können als Check-in verwendet werden)
          // (checkDate > eventStart && checkDate < eventEnd)
          if (checkDate > eventStart && checkDate < eventEnd) {
            hasBlockedDays = true;
            break;
          }
        }
        
        if (hasBlockedDays) break;
        checkDate.setDate(checkDate.getDate() + 1);
      }
      
      // Prüfe auch den Check-out Tag der neuen Buchung (newEnd)
      if (!hasBlockedDays) {
        for (const event of blockingEvents) {
          const eventStart = normalizeDate(event.start);
          const eventEnd = normalizeDate(event.end);
          
          // Check-out Tag ist blockiert, wenn er STRENG zwischen Check-in und Check-out liegt
          // Check-out Tag selbst ist NICHT blockiert (kann als Check-in verwendet werden)
          if (newEnd > eventStart && newEnd < eventEnd) {
            hasBlockedDays = true;
            break;
          }
        }
      }

      if (hasBlockedDays) {
        const eventTitles = blockingEvents.map(e => e.summary).join(', ');
        return {
          valid: false,
          error: `Zeitraum ist im Kalender blockiert: ${eventTitles}`,
        };
      }
    }
  } catch (error) {
    // Wenn Calendar-Abfrage fehlschlägt, trotzdem fortfahren
    console.warn('Could not check Google Calendar for blocked dates:', error);
  }

  return { valid: true };
}

