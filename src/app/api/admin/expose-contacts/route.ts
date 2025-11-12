import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            "EXPOSE_CONTACT1_NAME",
            "EXPOSE_CONTACT1_PHONE",
            "EXPOSE_CONTACT1_MOBILE",
            "EXPOSE_CONTACT1_EMAIL",
            "EXPOSE_CONTACT2_NAME",
            "EXPOSE_CONTACT2_PHONE",
            "EXPOSE_CONTACT2_MOBILE",
            "EXPOSE_CONTACT2_EMAIL",
            "EXPOSE_HOUSE_ADDRESS",
            "EXPOSE_HOUSE_PHONE",
          ],
        },
      },
    });

    const contacts = {
      contact1Name: settings.find((s) => s.key === "EXPOSE_CONTACT1_NAME")?.value || "",
      contact1Phone: settings.find((s) => s.key === "EXPOSE_CONTACT1_PHONE")?.value || "",
      contact1Mobile: settings.find((s) => s.key === "EXPOSE_CONTACT1_MOBILE")?.value || "",
      contact1Email: settings.find((s) => s.key === "EXPOSE_CONTACT1_EMAIL")?.value || "",
      contact2Name: settings.find((s) => s.key === "EXPOSE_CONTACT2_NAME")?.value || "",
      contact2Phone: settings.find((s) => s.key === "EXPOSE_CONTACT2_PHONE")?.value || "",
      contact2Mobile: settings.find((s) => s.key === "EXPOSE_CONTACT2_MOBILE")?.value || "",
      contact2Email: settings.find((s) => s.key === "EXPOSE_CONTACT2_EMAIL")?.value || "",
      houseAddress: settings.find((s) => s.key === "EXPOSE_HOUSE_ADDRESS")?.value || "",
      housePhone: settings.find((s) => s.key === "EXPOSE_HOUSE_PHONE")?.value || "",
    };

    return NextResponse.json({
      success: true,
      contacts,
    });
  } catch (error: any) {
    console.error("Error fetching expose contacts:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Laden der Kontaktdaten" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return NextResponse.json(
        { success: false, error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    // Prüfe ob User canManageExpose hat (oder SUPERADMIN)
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { canManageExpose: true, role: true },
    });

    if (dbUser?.role !== "SUPERADMIN" && !dbUser?.canManageExpose) {
      return NextResponse.json(
        { success: false, error: "Keine Berechtigung zum Verwalten von Expose" },
        { status: 403 }
      );
    }

    const contacts = await request.json();

    // Speichere alle Kontaktdaten
    await Promise.all([
      prisma.setting.upsert({
        where: { key: "EXPOSE_CONTACT1_NAME" },
        update: { value: contacts.contact1Name || "" },
        create: {
          key: "EXPOSE_CONTACT1_NAME",
          value: contacts.contact1Name || "",
          description: "Kontakt 1 Name",
          isPublic: true,
        },
      }),
      prisma.setting.upsert({
        where: { key: "EXPOSE_CONTACT1_PHONE" },
        update: { value: contacts.contact1Phone || "" },
        create: {
          key: "EXPOSE_CONTACT1_PHONE",
          value: contacts.contact1Phone || "",
          description: "Kontakt 1 Telefon",
          isPublic: true,
        },
      }),
      prisma.setting.upsert({
        where: { key: "EXPOSE_CONTACT1_MOBILE" },
        update: { value: contacts.contact1Mobile || "" },
        create: {
          key: "EXPOSE_CONTACT1_MOBILE",
          value: contacts.contact1Mobile || "",
          description: "Kontakt 1 Mobil",
          isPublic: true,
        },
      }),
      prisma.setting.upsert({
        where: { key: "EXPOSE_CONTACT1_EMAIL" },
        update: { value: contacts.contact1Email || "" },
        create: {
          key: "EXPOSE_CONTACT1_EMAIL",
          value: contacts.contact1Email || "",
          description: "Kontakt 1 E-Mail",
          isPublic: true,
        },
      }),
      prisma.setting.upsert({
        where: { key: "EXPOSE_CONTACT2_NAME" },
        update: { value: contacts.contact2Name || "" },
        create: {
          key: "EXPOSE_CONTACT2_NAME",
          value: contacts.contact2Name || "",
          description: "Kontakt 2 Name",
          isPublic: true,
        },
      }),
      prisma.setting.upsert({
        where: { key: "EXPOSE_CONTACT2_PHONE" },
        update: { value: contacts.contact2Phone || "" },
        create: {
          key: "EXPOSE_CONTACT2_PHONE",
          value: contacts.contact2Phone || "",
          description: "Kontakt 2 Telefon",
          isPublic: true,
        },
      }),
      prisma.setting.upsert({
        where: { key: "EXPOSE_CONTACT2_MOBILE" },
        update: { value: contacts.contact2Mobile || "" },
        create: {
          key: "EXPOSE_CONTACT2_MOBILE",
          value: contacts.contact2Mobile || "",
          description: "Kontakt 2 Mobil",
          isPublic: true,
        },
      }),
      prisma.setting.upsert({
        where: { key: "EXPOSE_CONTACT2_EMAIL" },
        update: { value: contacts.contact2Email || "" },
        create: {
          key: "EXPOSE_CONTACT2_EMAIL",
          value: contacts.contact2Email || "",
          description: "Kontakt 2 E-Mail",
          isPublic: true,
        },
      }),
      prisma.setting.upsert({
        where: { key: "EXPOSE_HOUSE_ADDRESS" },
        update: { value: contacts.houseAddress || "" },
        create: {
          key: "EXPOSE_HOUSE_ADDRESS",
          value: contacts.houseAddress || "",
          description: "Haus-Adresse",
          isPublic: true,
        },
      }),
      prisma.setting.upsert({
        where: { key: "EXPOSE_HOUSE_PHONE" },
        update: { value: contacts.housePhone || "" },
        create: {
          key: "EXPOSE_HOUSE_PHONE",
          value: contacts.housePhone || "",
          description: "Haus Telefon",
          isPublic: true,
        },
      }),
    ]);

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "EXPOSE_CONTACTS_UPDATED",
        entity: "Setting",
        entityId: "EXPOSE_CONTACTS",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating expose contacts:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Speichern der Kontaktdaten" },
      { status: 500 }
    );
  }
}

