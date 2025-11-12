'use server';

import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getExposeSections() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    const sections = await prisma.exposeSection.findMany({
      orderBy: { order: "asc" },
    });

    return { success: true, data: sections };
  } catch (error: any) {
    console.error("Error fetching expose sections:", error);
    return { success: false, error: "Fehler beim Laden der Abschnitte" };
  }
}

export async function getPublicExposeSections() {
  try {
    const sections = await prisma.exposeSection.findMany({
      orderBy: { order: "asc" },
    });

    return { success: true, data: sections };
  } catch (error: any) {
    console.error("Error fetching public expose sections:", error);
    return { success: false, error: "Fehler beim Laden der Abschnitte" };
  }
}

export async function createExposeSection(data: {
  title?: string | null;
  content: string;
  order?: number;
}) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { canManageExpose: true, role: true },
    });

    if (dbUser?.role !== "SUPERADMIN" && !dbUser?.canManageExpose) {
      return { success: false, error: "Keine Berechtigung zum Verwalten von Expose" };
    }

    let order = data.order;
    if (order === undefined) {
      const maxOrder = await prisma.exposeSection.findFirst({
        orderBy: { order: "desc" },
        select: { order: true },
      });
      order = (maxOrder?.order ?? -1) + 1;
    }

    const section = await prisma.exposeSection.create({
      data: {
        title: data.title ? data.title.trim() || null : null,
        content: data.content,
        order,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "EXPOSE_SECTION_CREATED",
        entity: "ExposeSection",
        entityId: section.id,
        details: { title: section.title },
      },
    });

    revalidatePath("/admin/expose");
    revalidatePath("/expose");

    return { success: true, data: section };
  } catch (error: any) {
    console.error("Error creating expose section:", error);
    return { success: false, error: "Fehler beim Erstellen des Abschnitts" };
  }
}

export async function updateExposeSection(
  id: string,
  data: {
    title?: string | null;
    content?: string;
  }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { canManageExpose: true, role: true },
    });

    if (dbUser?.role !== "SUPERADMIN" && !dbUser?.canManageExpose) {
      return { success: false, error: "Keine Berechtigung zum Verwalten von Expose" };
    }

    const section = await prisma.exposeSection.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title?.trim() || null }),
        ...(data.content !== undefined && { content: data.content }),
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "EXPOSE_SECTION_UPDATED",
        entity: "ExposeSection",
        entityId: section.id,
        details: { title: section.title },
      },
    });

    revalidatePath("/admin/expose");
    revalidatePath("/expose");

    return { success: true, data: section };
  } catch (error: any) {
    console.error("Error updating expose section:", error);
    return { success: false, error: "Fehler beim Aktualisieren des Abschnitts" };
  }
}

export async function deleteExposeSection(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { canManageExpose: true, role: true },
    });

    if (dbUser?.role !== "SUPERADMIN" && !dbUser?.canManageExpose) {
      return { success: false, error: "Keine Berechtigung zum Verwalten von Expose" };
    }

    const exposeCount = await prisma.expose.count({
      where: { sectionId: id },
    });

    if (exposeCount > 0) {
      return {
        success: false,
        error: "Abschnitt kann nicht gelöscht werden, solange zugeordnete Bilder existieren.",
      };
    }

    await prisma.exposeSection.delete({
      where: { id },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "EXPOSE_SECTION_DELETED",
        entity: "ExposeSection",
        entityId: id,
      },
    });

    revalidatePath("/admin/expose");
    revalidatePath("/expose");

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting expose section:", error);
    return { success: false, error: "Fehler beim Löschen des Abschnitts" };
  }
}

export async function updateExposeSectionOrder(ids: string[]) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { canManageExpose: true, role: true },
    });

    if (dbUser?.role !== "SUPERADMIN" && !dbUser?.canManageExpose) {
      return { success: false, error: "Keine Berechtigung zum Verwalten von Expose" };
    }

    await Promise.all(
      ids.map((id, index) =>
        prisma.exposeSection.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    revalidatePath("/admin/expose");
    revalidatePath("/expose");

    return { success: true };
  } catch (error: any) {
    console.error("Error updating expose section order:", error);
    return { success: false, error: "Fehler beim Aktualisieren der Abschnittsreihenfolge" };
  }
}


