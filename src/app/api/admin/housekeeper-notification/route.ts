import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendTemplatedEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    // Parse request body safely
    let body: any = {};
    let housekeeperIds: string[] | undefined = undefined;
    
    try {
      // Check if request has body
      const contentType = request.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          body = await request.json();
          housekeeperIds = body.housekeeperIds as string[] | undefined;
        } catch (jsonError: any) {
          // If JSON parsing fails, use undefined (will send to all housekeepers)
          console.log("Failed to parse JSON body, sending to all housekeepers:", jsonError.message);
        }
      }
    } catch (error: any) {
      // If any error occurs, use undefined (will send to all housekeepers)
      console.log("Error reading request body, sending to all housekeepers:", error.message);
    }

    // Get housekeepers - either selected ones or all active ones
    let housekeepers;
    if (housekeeperIds && housekeeperIds.length > 0) {
      housekeepers = await prisma.housekeeper.findMany({
        where: { 
          id: { in: housekeeperIds },
          isActive: true 
        },
      });
    } else {
      // Fallback: alle aktiven Housekeeper
      housekeepers = await prisma.housekeeper.findMany({
      where: { isActive: true },
    });
    }

    if (housekeepers.length === 0) {
      return NextResponse.json(
        { error: "Keine Housekeeper ausgewählt oder keine aktiven Housekeeper konfiguriert" },
        { status: 400 }
      );
    }

    // Get public URL for calendar link
    const publicUrlSetting = await prisma.setting.findUnique({
      where: { key: "PUBLIC_URL" },
    });
    const publicUrl = publicUrlSetting?.value || process.env.NEXT_PUBLIC_APP_URL || "";
    const calendarUrl = `${publicUrl}/housekeeping`;

    // Get reply-to email
    const replyToSetting = await prisma.setting.findUnique({
      where: { key: "REPLY_TO_EMAIL" },
    });
    const replyTo = replyToSetting?.value || undefined;

    // Send emails to all housekeepers
    const results = await Promise.all(
      housekeepers.map(async (housekeeper) => {
        try {
          const result = await sendTemplatedEmail(
          "housekeeper_schedule_change",
          housekeeper.email,
          {
              housekeeperName: housekeeper.name,
            calendarUrl,
          },
            replyTo,
          undefined,
            "housekeeper_notification"
          );
          return { success: result.success, email: housekeeper.email, error: result.error };
        } catch (error: any) {
          console.error(`Error sending email to ${housekeeper.email}:`, error);
          return { success: false, email: housekeeper.email, error: error.message };
        }
      })
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    // Update last sent timestamp
    await prisma.setting.upsert({
      where: { key: "HOUSEKEEPER_LAST_SENT" },
      update: { value: new Date().toISOString() },
      create: {
        key: "HOUSEKEEPER_LAST_SENT",
        value: new Date().toISOString(),
        description: "Letzter Zeitpunkt, an dem Housekeeper benachrichtigt wurden",
      },
    });

    return NextResponse.json({
      success: true,
      sent: successful,
      failed,
      total: housekeepers.length,
    });
  } catch (error: any) {
    console.error("Error sending housekeeper notifications:", error);
    return NextResponse.json(
      { error: error.message || "Fehler beim Versenden der Benachrichtigungen" },
      { status: 500 }
    );
  }
}
