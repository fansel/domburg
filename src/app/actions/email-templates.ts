"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";

export async function getEmailTemplates() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    const templates = await prisma.emailTemplate.findMany({
      orderBy: { name: "asc" },
    });

    return { success: true, templates };
  } catch (error: any) {
    console.error("Error fetching email templates:", error);
    return { success: false, error: error.message };
  }
}

export async function getEmailTemplate(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return { success: false, error: "Template nicht gefunden" };
    }

    return { success: true, template };
  } catch (error: any) {
    console.error("Error fetching email template:", error);
    return { success: false, error: error.message };
  }
}

export async function updateEmailTemplate(
  id: string,
  data: {
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
    isActive?: boolean;
  }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    const template = await prisma.emailTemplate.update({
      where: { id },
      data,
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "EMAIL_TEMPLATE_UPDATED",
        entity: "EmailTemplate",
        entityId: id,
        details: { templateKey: template.key },
      },
    });

    revalidatePath("/admin/email-templates");
    return { success: true, template };
  } catch (error: any) {
    console.error("Error updating email template:", error);
    return { success: false, error: error.message };
  }
}

export async function resetEmailTemplate(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminRights(user.role)) {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Load default template from seed data
    const { emailTemplates } = await import("@/template/email-templates-seed");
    const template = await prisma.emailTemplate.findUnique({ where: { id } });
    
    if (!template) {
      return { success: false, error: "Template nicht gefunden" };
    }

    const defaultTemplate = emailTemplates.find(t => t.key === template.key);
    if (!defaultTemplate) {
      return { success: false, error: "Standard-Template nicht gefunden" };
    }

    const updated = await prisma.emailTemplate.update({
      where: { id },
      data: {
        subject: defaultTemplate.subject,
        bodyHtml: defaultTemplate.bodyHtml,
        bodyText: defaultTemplate.bodyText,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "EMAIL_TEMPLATE_RESET",
        entity: "EmailTemplate",
        entityId: id,
        details: { templateKey: template.key },
      },
    });

    revalidatePath("/admin/email-templates");
    return { success: true, template: updated };
  } catch (error: any) {
    console.error("Error resetting email template:", error);
    return { success: false, error: error.message };
  }
}

