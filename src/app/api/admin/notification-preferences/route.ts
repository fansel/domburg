import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const preferences = await prisma.adminNotificationPreferences.findUnique({
      where: { userId: user.id },
    });

    if (!preferences) {
      // Standard-Präferenzen zurückgeben
      return NextResponse.json({
        success: true,
        preferences: {
          newBooking: true,
          bookingApproved: false,
          bookingRejected: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      preferences: {
        newBooking: preferences.newBooking,
        bookingApproved: preferences.bookingApproved,
        bookingRejected: preferences.bookingRejected,
      },
    });
  } catch (error: any) {
    console.error("Error loading notification preferences:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Laden der Einstellungen" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { newBooking, bookingApproved, bookingRejected } = body;

    // Upsert (aktualisieren oder erstellen)
    await prisma.adminNotificationPreferences.upsert({
      where: { userId: user.id },
      update: {
        newBooking: Boolean(newBooking),
        bookingApproved: Boolean(bookingApproved),
        bookingRejected: Boolean(bookingRejected),
      },
      create: {
        userId: user.id,
        newBooking: Boolean(newBooking),
        bookingApproved: Boolean(bookingApproved),
        bookingRejected: Boolean(bookingRejected),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Benachrichtigungseinstellungen wurden gespeichert",
    });
  } catch (error: any) {
    console.error("Error saving notification preferences:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Speichern der Einstellungen" },
      { status: 500 }
    );
  }
}

