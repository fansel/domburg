import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const [housekeepers, lastSentSetting] = await Promise.all([
      prisma.housekeeper.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.setting.findUnique({
        where: { key: "HOUSEKEEPER_LAST_SENT" },
      }),
    ]);

    return NextResponse.json({
      housekeepers,
      lastSentAt: lastSentSetting?.value || null,
    });
  } catch (error: any) {
    console.error("Error fetching housekeepers:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Housekeeper" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { name, email } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name und E-Mail sind erforderlich" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Ungültige E-Mail-Adresse" },
        { status: 400 }
      );
    }

    const housekeeper = await prisma.housekeeper.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, housekeeper });
  } catch (error: any) {
    console.error("Error creating housekeeper:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "E-Mail-Adresse bereits vorhanden" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Fehler beim Erstellen des Housekeepers" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { id, name, email, isActive } = await request.json();

    if (!id || !name || !email) {
      return NextResponse.json(
        { error: "ID, Name und E-Mail sind erforderlich" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Ungültige E-Mail-Adresse" },
        { status: 400 }
      );
    }

    const housekeeper = await prisma.housekeeper.update({
      where: { id },
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({ success: true, housekeeper });
  } catch (error: any) {
    console.error("Error updating housekeeper:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "E-Mail-Adresse bereits vorhanden" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Housekeepers" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID ist erforderlich" },
        { status: 400 }
      );
    }

    await prisma.housekeeper.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting housekeeper:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Housekeepers" },
      { status: 500 }
    );
  }
}



