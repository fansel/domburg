"use server";

import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ExposeImagePlacement } from "@prisma/client";

// Alle Expose-Einträge abrufen (für Admin)
export async function getExposes() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    const exposes = await prisma.expose.findMany({
      orderBy: { order: "asc" },
      include: {
        section: true,
      },
    });

    return { success: true, data: exposes };
  } catch (error: any) {
    console.error("Error fetching exposes:", error);
    return { success: false, error: "Fehler beim Laden der Expose-Einträge" };
  }
}

// Öffentliche Expose-Einträge abrufen (nur aktive)
export async function getPublicExposes() {
  try {
    const exposes = await prisma.expose.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      include: {
        section: true,
      },
    });

    return { success: true, data: exposes };
  } catch (error: any) {
    console.error("Error fetching public exposes:", error);
    return { success: false, error: "Fehler beim Laden der Expose-Einträge" };
  }
}

// Expose-Eintrag erstellen
export async function createExpose(data: {
  title?: string;
  description?: string;
  imageUrl: string;
  imageText?: string;
  sectionId?: string | null;
  placement?: ExposeImagePlacement;
  order?: number;
}) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Prüfe ob User canManageExpose hat (oder SUPERADMIN)
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { canManageExpose: true, role: true },
    });

    if (dbUser?.role !== "SUPERADMIN" && !dbUser?.canManageExpose) {
      return { success: false, error: "Keine Berechtigung zum Verwalten von Expose" };
    }

    // Bestimme nächste Order-Nummer falls nicht angegeben
    let order = data.order;
    if (order === undefined) {
      const maxOrder = await prisma.expose.findFirst({
        orderBy: { order: "desc" },
        select: { order: true },
      });
      order = (maxOrder?.order ?? -1) + 1;
    }

    const requestedPlacement =
      data.placement ?? (data.sectionId ? "BELOW" : "GALLERY");
    const sectionId =
      requestedPlacement === "GALLERY" ? null : data.sectionId || null;
    const placement: ExposeImagePlacement = requestedPlacement;

    const expose = await prisma.expose.create({
      data: {
        title: data.title || null,
        description: data.description || null,
        imageUrl: data.imageUrl,
        imageText: data.imageText || null,
        sectionId,
        placement,
        order: order,
        isActive: true,
      },
      include: { section: true },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "EXPOSE_CREATED",
        entity: "Expose",
        entityId: expose.id,
        details: { title: expose.title },
      },
    });

    revalidatePath("/admin/expose");
    revalidatePath("/expose");
    return { success: true, data: expose };
  } catch (error: any) {
    console.error("Error creating expose:", error);
    return { success: false, error: "Fehler beim Erstellen des Expose-Eintrags" };
  }
}

// Expose-Eintrag aktualisieren
export async function updateExpose(
  id: string,
  data: {
    title?: string;
    description?: string;
    imageUrl?: string;
    imageText?: string;
    sectionId?: string | null;
    placement?: ExposeImagePlacement;
    order?: number;
    isActive?: boolean;
  }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Prüfe ob User canManageExpose hat (oder SUPERADMIN)
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { canManageExpose: true, role: true },
    });

    if (dbUser?.role !== "SUPERADMIN" && !dbUser?.canManageExpose) {
      return { success: false, error: "Keine Berechtigung zum Verwalten von Expose" };
    }

    const requestedPlacement =
      data.placement ?? (data.sectionId ? "BELOW" : undefined);
    const sectionId =
      requestedPlacement === "GALLERY"
        ? null
        : data.sectionId !== undefined
        ? data.sectionId || null
        : undefined;
    const placement =
      requestedPlacement !== undefined ? (requestedPlacement as ExposeImagePlacement) : undefined;

    const expose = await prisma.expose.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title || null }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.imageUrl && { imageUrl: data.imageUrl }),
        ...(data.imageText !== undefined && { imageText: data.imageText || null }),
        ...(sectionId !== undefined && { sectionId }),
        ...(placement !== undefined && { placement }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { section: true },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "EXPOSE_UPDATED",
        entity: "Expose",
        entityId: expose.id,
        details: { title: expose.title },
      },
    });

    revalidatePath("/admin/expose");
    revalidatePath("/expose");
    return { success: true, data: expose };
  } catch (error: any) {
    console.error("Error updating expose:", error);
    return { success: false, error: "Fehler beim Aktualisieren des Expose-Eintrags" };
  }
}

// Expose-Eintrag löschen
export async function deleteExpose(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Prüfe ob User canManageExpose hat (oder SUPERADMIN)
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { canManageExpose: true, role: true },
    });

    if (dbUser?.role !== "SUPERADMIN" && !dbUser?.canManageExpose) {
      return { success: false, error: "Keine Berechtigung zum Verwalten von Expose" };
    }

    await prisma.expose.delete({
      where: { id },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "EXPOSE_DELETED",
        entity: "Expose",
        entityId: id,
      },
    });

    revalidatePath("/admin/expose");
    revalidatePath("/expose");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting expose:", error);
    return { success: false, error: "Fehler beim Löschen des Expose-Eintrags" };
  }
}

// Reihenfolge von Expose-Einträgen aktualisieren
export async function updateExposeOrder(ids: string[]) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Prüfe ob User canManageExpose hat (oder SUPERADMIN)
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { canManageExpose: true, role: true },
    });

    if (dbUser?.role !== "SUPERADMIN" && !dbUser?.canManageExpose) {
      return { success: false, error: "Keine Berechtigung zum Verwalten von Expose" };
    }

    // Aktualisiere die Reihenfolge
    await Promise.all(
      ids.map((id, index) =>
        prisma.expose.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    revalidatePath("/admin/expose");
    revalidatePath("/expose");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating expose order:", error);
    return { success: false, error: "Fehler beim Aktualisieren der Reihenfolge" };
  }
}

