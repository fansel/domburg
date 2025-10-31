"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Pricing Settings

export async function updatePricingSetting(key: string, value: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
    }

    const setting = await prisma.pricingSetting.update({
      where: { key },
      data: { value },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "PRICING_UPDATED",
        entity: "PricingSetting",
        entityId: setting.id,
        details: JSON.parse(JSON.stringify({ key, value })),
      },
    });

    revalidatePath("/admin/pricing");
    return { success: true, setting };
  } catch (error) {
    console.error("Error updating pricing setting:", error);
    return { success: false, error: "Fehler beim Aktualisieren der Einstellung" };
  }
}

// Pricing Phases

export async function createPricingPhase(data: {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  pricePerNight: number;
  familyPricePerNight?: number;
  priority: number;
  isActive: boolean;
}) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Validierung
    if (!data.name || !data.startDate || !data.endDate || !data.pricePerNight) {
      return { success: false, error: "Bitte füllen Sie alle Pflichtfelder aus" };
    }

    if (new Date(data.startDate) >= new Date(data.endDate)) {
      return { success: false, error: "Das Enddatum muss nach dem Startdatum liegen" };
    }

    if (data.pricePerNight <= 0) {
      return { success: false, error: "Der Preis muss größer als 0 sein" };
    }

    const phase = await prisma.pricingPhase.create({
      data: {
        name: data.name,
        description: data.description,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        pricePerNight: data.pricePerNight,
        familyPricePerNight: data.familyPricePerNight || null,
        priority: data.priority,
        isActive: data.isActive,
      },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "PRICING_PHASE_CREATED",
        entity: "PricingPhase",
        entityId: phase.id,
        details: JSON.parse(JSON.stringify({ name: data.name })),
      },
    });

    revalidatePath("/admin/pricing");
    return { success: true, phase };
  } catch (error) {
    console.error("Error creating pricing phase:", error);
    return { success: false, error: "Fehler beim Erstellen der Preisphase" };
  }
}

export async function updatePricingPhase(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    startDate: Date;
    endDate: Date;
    pricePerNight: number;
    familyPricePerNight: number;
    priority: number;
    isActive: boolean;
  }>
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Validierung
    if (data.startDate && data.endDate) {
      if (new Date(data.startDate) >= new Date(data.endDate)) {
        return { success: false, error: "Das Enddatum muss nach dem Startdatum liegen" };
      }
    }

    if (data.pricePerNight !== undefined && data.pricePerNight <= 0) {
      return { success: false, error: "Der Preis muss größer als 0 sein" };
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    if (data.pricePerNight) updateData.pricePerNight = data.pricePerNight;
    if (data.familyPricePerNight !== undefined) updateData.familyPricePerNight = data.familyPricePerNight || null;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const phase = await prisma.pricingPhase.update({
      where: { id },
      data: updateData,
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "PRICING_PHASE_UPDATED",
        entity: "PricingPhase",
        entityId: phase.id,
        details: JSON.parse(JSON.stringify({ name: phase.name })),
      },
    });

    revalidatePath("/admin/pricing");
    return { success: true, phase };
  } catch (error) {
    console.error("Error updating pricing phase:", error);
    return { success: false, error: "Fehler beim Aktualisieren der Preisphase" };
  }
}

export async function deletePricingPhase(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung" };
    }

    await prisma.pricingPhase.delete({
      where: { id },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "PRICING_PHASE_DELETED",
        entity: "PricingPhase",
        entityId: id,
        details: JSON.parse(JSON.stringify({})),
      },
    });

    revalidatePath("/admin/pricing");
    return { success: true };
  } catch (error) {
    console.error("Error deleting pricing phase:", error);
    return { success: false, error: "Fehler beim Löschen der Preisphase" };
  }
}

