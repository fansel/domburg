import { NextRequest, NextResponse } from "next/server";
import { calculateBookingPrice } from "@/lib/pricing";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { startDate, endDate, guestCode, useFamilyPrice: explicitUseFamilyPrice } = await request.json();

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start- und Enddatum erforderlich" },
        { status: 400 }
      );
    }

    // Prüfe ob Family-Preis explizit gesetzt oder über Guest Code aktiviert ist
    let useFamilyPrice = explicitUseFamilyPrice || false;
    if (!useFamilyPrice && guestCode) {
      const token = await prisma.guestAccessToken.findUnique({
        where: { token: guestCode, isActive: true },
      });
      useFamilyPrice = token?.useFamilyPrice || false;
    }

    // Konvertiere Datumsstrings zu Date-Objekten
    // WICHTIG: Frontend sendet toISOString(), was das Datum zu UTC konvertiert
    // Beispiel: Wenn Benutzer 4. Januar 2026 00:00:00 in Europe/Amsterdam wählt,
    // wird toISOString() zu "2026-01-03T23:00:00.000Z" (UTC-1) oder "2026-01-03T22:00:00.000Z" (UTC-2)
    // 
    // formatDate() interpretiert das Datum in Europe/Amsterdam Zeitzone.
    // Um konsistent zu sein, müssen wir das Datum so interpretieren, dass es nach
    // der UTC-Normalisierung in normalizeDate() das gleiche Datum ergibt wie formatDate() anzeigt.
    //
    // Lösung: Verwende die lokalen Komponenten des geparsten Datums und erstelle ein UTC-Datum
    // Das entspricht der Art, wie Daten in der Datenbank gespeichert werden
    const parseDateFromISO = (dateStr: string): Date => {
      const date = new Date(dateStr);
      // WICHTIG: Extrahiere die lokalen Komponenten (Jahr, Monat, Tag) wie sie in Europe/Amsterdam erscheinen
      // und erstelle dann ein UTC-Datum mit diesen Komponenten
      // Dies stellt sicher, dass das Datum korrekt interpretiert wird, unabhängig von der Server-Zeitzone
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Amsterdam',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const dateStrFormatted = formatter.format(date); // Format: "YYYY-MM-DD"
      const [year, month, day] = dateStrFormatted.split('-').map(Number);
      // Erstelle ein UTC-Datum mit diesen Komponenten
      // Dies entspricht der Art, wie Daten in der Datenbank gespeichert werden
      // und wie formatDate() sie interpretiert
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    };

    const startDateObj = parseDateFromISO(startDate);
    const endDateObj = parseDateFromISO(endDate);

    // Preisberechnung (Strandbude wird automatisch aktiviert wenn in aktiver Session)
    // calculateBookingPrice normalisiert die Daten intern auf UTC für konsistente Berechnung
    const pricing = await calculateBookingPrice(
      startDateObj,
      endDateObj,
      useFamilyPrice
    );

    // Extrahiere minNights aus warnings falls vorhanden (für Frontend)
    let minNights: number | undefined;
    if (pricing.warnings && pricing.warnings.length > 0) {
      // Versuche minNights aus der Warnung zu extrahieren
      for (const warning of pricing.warnings) {
        const match = warning.match(/Mindestbuchung von (\d+) Nächten?/);
        if (match) {
          minNights = parseInt(match[1]);
          break;
        }
      }
    }

    return NextResponse.json({
      success: true,
      pricing: {
        ...pricing,
        // Füge minNights hinzu falls vorhanden (für einfacheren Zugriff im Frontend)
        ...(minNights && { minNights }),
      },
      useFamilyPrice,
    });
  } catch (error: any) {
    console.error("Error calculating price:", error);
    return NextResponse.json(
      { error: "Fehler bei der Preisberechnung" },
      { status: 500 }
    );
  }
}

