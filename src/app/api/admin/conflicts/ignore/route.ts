import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import { ignoreConflict, unignoreConflict } from "@/lib/booking-conflicts";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { conflictKey, conflictType, reason, action } = await request.json();

    if (!conflictKey || !conflictType || !action) {
      return NextResponse.json(
        { error: "conflictKey, conflictType und action sind erforderlich" },
        { status: 400 }
      );
    }

    if (action === "ignore") {
      await ignoreConflict(conflictKey, conflictType, reason, user.id);
      return NextResponse.json({ success: true });
    } else if (action === "unignore") {
      await unignoreConflict(conflictKey, conflictType);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
  } catch (error: any) {
    console.error("Error ignoring conflict:", error);
    return NextResponse.json(
      { error: error.message || "Fehler beim Verarbeiten der Anfrage" },
      { status: 500 }
    );
  }
}

