import prisma from '@/lib/prisma';
import { getDaysBetween } from '@/lib/utils';
import { getCalendarEvents } from '@/lib/google-calendar';

interface PriceCalculation {
  nights: number;
  basePrice: number;
  cleaningFee: number;
  totalPrice: number;
  pricePerNight: number;
  breakdown: Array<{
    date: string;
    price: number;
    phase?: string;
  }>;
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

  // Preisphasen holen
  const pricingPhases = await prisma.pricingPhase.findMany({
    where: {
      isActive: true,
      OR: [
        {
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } },
          ],
        },
      ],
    },
    orderBy: { priority: 'desc' },
  });

  // Tagespreise berechnen
  const breakdown: Array<{ date: string; price: number; phase?: string }> = [];
  let totalNightlyPrice = 0;

  const currentDate = new Date(startDate);
  while (currentDate < endDate) {
    let priceForDay = defaultPricePerNight;
    let appliedPhase: string | undefined;

    // Höchste Priorität der passenden Preisphasen finden
    for (const phase of pricingPhases) {
      if (currentDate >= phase.startDate && currentDate <= phase.endDate) {
        // Family-Preis oder Standard-Preis verwenden
        if (useFamilyPrice && phase.familyPricePerNight) {
          priceForDay = parseFloat(phase.familyPricePerNight.toString());
        } else {
          priceForDay = parseFloat(phase.pricePerNight.toString());
        }
        appliedPhase = phase.name;
        break; // Höchste Priorität gefunden
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

  const totalPrice = totalNightlyPrice + cleaningFee;

  return {
    nights,
    basePrice: totalNightlyPrice,
    cleaningFee,
    totalPrice,
    pricePerNight: totalNightlyPrice / nights,
    breakdown,
  };
}

export async function getMinStayNights(): Promise<number> {
  const setting = await prisma.pricingSetting.findUnique({
    where: { key: 'min_stay_nights' },
  });
  return parseInt(setting?.value || '3');
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
  const overlappingBookings = await prisma.booking.findMany({
    where: {
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
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
  });

  if (overlappingBookings.length > 0) {
    return {
      valid: false,
      error: 'Dieser Zeitraum ist bereits gebucht oder angefragt',
    };
  }

  // Blockierte Termine aus Google Calendar prüfen
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

    if (blockingEvents.length > 0) {
      const eventTitles = blockingEvents.map(e => e.summary).join(', ');
      return {
        valid: false,
        error: `Zeitraum ist im Kalender blockiert: ${eventTitles}`,
      };
    }
  } catch (error) {
    // Wenn Calendar-Abfrage fehlschlägt, trotzdem fortfahren
    console.warn('Could not check Google Calendar for blocked dates:', error);
  }

  return { valid: true };
}

