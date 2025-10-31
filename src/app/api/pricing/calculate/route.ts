import { NextRequest, NextResponse } from "next/server";
import { calculateBookingPrice } from "@/lib/pricing";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { startDate, endDate, guestCode } = await request.json();

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start- und Enddatum erforderlich" },
        { status: 400 }
      );
    }

    // Prüfe ob Guest Code Family-Preis hat
    let useFamilyPrice = false;
    if (guestCode) {
      const token = await prisma.guestAccessToken.findUnique({
        where: { token: guestCode, isActive: true },
      });
      useFamilyPrice = token?.useFamilyPrice || false;
    }

    const pricing = await calculateBookingPrice(
      new Date(startDate),
      new Date(endDate),
      useFamilyPrice
    );

    return NextResponse.json({
      success: true,
      pricing,
    });
  } catch (error: any) {
    console.error("Error calculating price:", error);
    return NextResponse.json(
      { error: "Fehler bei der Preisberechnung" },
      { status: 500 }
    );
  }
}

