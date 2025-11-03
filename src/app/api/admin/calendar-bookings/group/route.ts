import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import { updateCalendarEvent } from "@/lib/google-calendar";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { eventId, colorId } = await request.json();

    if (!eventId || !colorId) {
      return NextResponse.json(
        { success: false, error: "eventId und colorId sind erforderlich" },
        { status: 400 }
      );
    }

    // Prüfe ob es eine interne Buchung ist (über googleEventId verlinkt)
    // Nur manuelle Events dürfen gruppiert werden
    const prisma = (await import("@/lib/prisma")).default;
    const booking = await prisma.booking.findUnique({
      where: { googleEventId: eventId },
    });

    if (booking) {
      // Es ist eine interne Buchung - keine Gruppierung erlaubt
      return NextResponse.json(
        { success: false, error: "Automatisch erstellte Buchungen können nicht gruppiert werden" },
        { status: 400 }
      );
    }

    // Update Event mit neuer Farbe
    await updateCalendarEvent(eventId, {
      colorId,
    });

    // Prüfe auf Konflikte nach dem Gruppieren (Farbe ändern kann Konflikte beeinflussen)
    const { checkAndNotifyConflictsForCalendarEvent } = await import("@/lib/booking-conflicts");
    
    checkAndNotifyConflictsForCalendarEvent(eventId).catch(error => {
      console.error("[Calendar] Error checking conflicts after grouping:", error);
      // Fehler nicht weiterwerfen, damit Gruppierung erfolgreich bleibt
    });

    return NextResponse.json({
      success: true,
      message: "Event-Farbe wurde aktualisiert",
    });
  } catch (error: any) {
    console.error("Error grouping calendar event:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Aktualisieren der Event-Farbe" },
      { status: 500 }
    );
  }
}

