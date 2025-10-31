import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findAllConflicts } from "@/lib/booking-conflicts";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const conflicts = await findAllConflicts();

    // Konvertiere Date-Objekte zu ISO-Strings für JSON-Serialisierung
    const serializedConflicts = conflicts.map(conflict => ({
      ...conflict,
      calendarEvent: conflict.calendarEvent ? {
        ...conflict.calendarEvent,
        start: conflict.calendarEvent.start.toISOString(),
        end: conflict.calendarEvent.end.toISOString(),
      } : undefined,
      calendarEvents: conflict.calendarEvents?.map(event => ({
        ...event,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
      })),
    }));

    return NextResponse.json({
      success: true,
      conflicts: serializedConflicts,
      count: serializedConflicts.length,
    });
  } catch (error: any) {
    console.error("Error finding conflicts:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Laden der Konflikte", conflicts: [] },
      { status: 500 }
    );
  }
}

