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

    // Preisberechnung (Strandbude wird automatisch aktiviert wenn in aktiver Session)
    const pricing = await calculateBookingPrice(
      new Date(startDate),
      new Date(endDate),
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

