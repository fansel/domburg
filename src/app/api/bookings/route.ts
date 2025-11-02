import { NextResponse } from "next/server";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prüfe ob User Buchungen sehen darf
    if (!user.canSeeBookings) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Serialize dates and Decimal
    const serializedBookings = bookings.map((booking) => ({
      ...booking,
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
      approvedAt: booking.approvedAt?.toISOString() || null,
      rejectedAt: booking.rejectedAt?.toISOString() || null,
      cancelledAt: booking.cancelledAt?.toISOString() || null,
      totalPrice: booking.totalPrice?.toString() || null,
    }));

    return NextResponse.json({ bookings: serializedBookings });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

