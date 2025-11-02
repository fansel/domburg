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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const emailLogs = await prisma.emailLog.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
    });

    const total = await prisma.emailLog.count();

    return NextResponse.json({
      success: true,
      logs: emailLogs,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("Error fetching email logs:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der E-Mail-Logs" },
      { status: 500 }
    );
  }
}

