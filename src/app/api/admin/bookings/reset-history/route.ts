import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { deleteCalendarEvent } from "@/lib/google-calendar";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    // Nur SUPERADMIN darf die Buchungsgeschichte zurücksetzen
    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Nur Superadmins können die Buchungsgeschichte zurücksetzen" },
        { status: 403 }
      );
    }

    // Hole alle Buchungen die gelöscht werden sollen
    // Wir löschen ALLE Buchungen aus der Datenbank
    // Manuelle Kalendereinträge sind KEINE Buchungen in der DB, sie existieren nur in Google Calendar
    const bookingsToDelete = await prisma.booking.findMany({
      where: {
        googleEventId: { not: null }, // Nur Buchungen mit Calendar Events
      },
      select: {
        id: true,
        googleEventId: true,
        bookingCode: true,
      },
    });

    let deletedCount = 0;
    let calendarEventsDeleted = 0;
    const errors: string[] = [];

    // Lösche Google Calendar Events (nur für Buchungen die eines haben)
    for (const booking of bookingsToDelete) {
      if (booking.googleEventId) {
        try {
          await deleteCalendarEvent(booking.googleEventId);
          calendarEventsDeleted++;
        } catch (error: any) {
          // Ignoriere 404/410 (bereits gelöscht)
          if (error.code !== 404 && error.code !== 410) {
            console.error(`Error deleting calendar event ${booking.googleEventId}:`, error);
            errors.push(`Calendar Event ${booking.bookingCode}: ${error.message}`);
          } else {
            calendarEventsDeleted++; // Zähle auch bereits gelöschte
          }
        }
      }
    }

    // Lösche ALLE Buchungen aus der Datenbank (unabhängig von Status oder googleEventId)
    // Manuelle Kalendereinträge bleiben erhalten, da sie keine Buchungen in der DB sind
    const deleteResult = await prisma.booking.deleteMany({});

    deletedCount = deleteResult.count;

    // Lösche auch abhängige Daten
    // Messages werden automatisch gelöscht (onDelete: Cascade)
    // Activity Logs können bleiben für Historie

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "BOOKING_HISTORY_RESET",
        entity: "Booking",
        entityId: "BULK_RESET",
        details: {
          deletedCount,
          calendarEventsDeleted,
          errors: errors.length > 0 ? errors : undefined,
        },
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount,
      calendarEventsDeleted,
      message: `${deletedCount} Buchungen gelöscht, ${calendarEventsDeleted} Google Calendar Events gelöscht`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Error resetting booking history:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Fehler beim Zurücksetzen der Buchungsgeschichte" },
      { status: 500 }
    );
  }
}

