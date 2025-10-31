import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    // Hole ALLE Einträge aus dem Calendar (inkl. Info-Events mit colorId=10)
    const allEvents = await getCalendarEvents(
      new Date(new Date().setMonth(new Date().getMonth() - 1)),
      new Date(new Date().setFullYear(new Date().getFullYear() + 2))
    );

    // Filtere nur manuelle Einträge (keine App-Buchungen)
    const manualBookings = allEvents.filter((date) => {
      const isAppBooking = date.summary?.includes("🏠") || 
                           date.summary?.includes("Buchung") ||
                           date.summary?.match(/\d+€\/\d+€/); // Preis-Einträge
      return !isAppBooking;
    });

    return NextResponse.json({
      success: true,
      bookings: manualBookings.map((booking) => ({
        id: booking.id,
        summary: booking.summary,
        start: booking.start.toISOString(),
        end: booking.end.toISOString(),
        colorId: booking.colorId,
        isInfo: booking.colorId === '10', // colorId=10 = Grün = Info
      })),
    });
  } catch (error: any) {
    console.error("Error loading calendar bookings:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Laden der Kalender-Buchungen" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { summary, start, end, isInfo } = await request.json();

    if (!summary || !start || !end) {
      return NextResponse.json(
        { success: false, error: "Titel und Zeitraum sind erforderlich" },
        { status: 400 }
      );
    }

    // Erstelle Event in Google Calendar
    const eventId = await createCalendarEvent({
      summary,
      startDate: new Date(start),
      endDate: new Date(end),
      description: isInfo ? "Info-Eintrag (nicht blockierend)" : "Manuelle Blockierung",
    });

    // Setze colorId je nach Info-Status
    if (eventId) {
      await updateCalendarEvent(eventId, {
        colorId: isInfo ? '10' : '', // '10' = Grün (Info), '' = Standard (Blockierung)
      });
    }

    return NextResponse.json({
      success: true,
      message: "Kalendereintrag wurde erstellt",
      eventId,
    });
  } catch (error: any) {
    console.error("Error creating calendar booking:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Erstellen des Kalendereintrags" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { id, summary, start, end, isInfo } = await request.json();

    if (!id || !summary || !start || !end) {
      return NextResponse.json(
        { success: false, error: "Alle Felder sind erforderlich" },
        { status: 400 }
      );
    }

    // Update Event in Google Calendar
    await updateCalendarEvent(id, {
      summary,
      startDate: new Date(start),
      endDate: new Date(end),
      description: isInfo ? "Info-Eintrag (nicht blockierend)" : "Manuelle Blockierung",
      colorId: isInfo ? '10' : '', // colorId=10 = Grün = Info, '' = Standard (entfernt die Farbe)
    });

    return NextResponse.json({
      success: true,
      message: "Kalendereintrag wurde aktualisiert",
    });
  } catch (error: any) {
    console.error("Error updating calendar booking:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Aktualisieren des Kalendereintrags" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Event-ID ist erforderlich" },
        { status: 400 }
      );
    }

    // Lösche Event aus Google Calendar
    await deleteCalendarEvent(id);

    return NextResponse.json({
      success: true,
      message: "Kalendereintrag wurde gelöscht",
    });
  } catch (error: any) {
    console.error("Error deleting calendar booking:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Löschen des Kalendereintrags" },
      { status: 500 }
    );
  }
}

