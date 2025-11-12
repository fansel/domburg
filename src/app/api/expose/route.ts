import { NextRequest, NextResponse } from "next/server";
import { getPublicExposes } from "@/app/actions/expose";
import { getPublicExposeSections } from "@/app/actions/expose-sections";
import prisma from "@/lib/prisma";

// Öffentliche API für Expose-Einträge (für Gäste)
export async function GET(request: NextRequest) {
  try {
    const [exposeResult, sectionResult, contactSettings] = await Promise.all([
      getPublicExposes(),
      getPublicExposeSections(),
      prisma.setting.findMany({
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
      }),
    ]);
    
    if (!exposeResult.success) {
      return NextResponse.json(
        { error: exposeResult.error },
        { status: 500 }
      );
    }

    if (!sectionResult.success) {
      return NextResponse.json(
        { error: sectionResult.error },
        { status: 500 }
      );
    }

    // Parse Kontaktdaten
    const contacts = {
      contact1Name: contactSettings.find((s) => s.key === "EXPOSE_CONTACT1_NAME")?.value || "",
      contact1Phone: contactSettings.find((s) => s.key === "EXPOSE_CONTACT1_PHONE")?.value || "",
      contact1Mobile: contactSettings.find((s) => s.key === "EXPOSE_CONTACT1_MOBILE")?.value || "",
      contact1Email: contactSettings.find((s) => s.key === "EXPOSE_CONTACT1_EMAIL")?.value || "",
      contact2Name: contactSettings.find((s) => s.key === "EXPOSE_CONTACT2_NAME")?.value || "",
      contact2Phone: contactSettings.find((s) => s.key === "EXPOSE_CONTACT2_PHONE")?.value || "",
      contact2Mobile: contactSettings.find((s) => s.key === "EXPOSE_CONTACT2_MOBILE")?.value || "",
      contact2Email: contactSettings.find((s) => s.key === "EXPOSE_CONTACT2_EMAIL")?.value || "",
      houseAddress: contactSettings.find((s) => s.key === "EXPOSE_HOUSE_ADDRESS")?.value || "",
      housePhone: contactSettings.find((s) => s.key === "EXPOSE_HOUSE_PHONE")?.value || "",
    };

    return NextResponse.json({
      exposes: exposeResult.data,
      sections: sectionResult.data,
      contacts,
    });
  } catch (error: any) {
    console.error("Error in expose API:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Expose-Einträge" },
      { status: 500 }
    );
  }
}

