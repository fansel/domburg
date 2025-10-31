// Email Template Rendering Engine

import prisma from "./prisma";

export async function renderEmailTemplate(
  templateKey: string,
  variables: Record<string, any>
): Promise<{ subject: string; html: string; text: string } | null> {
  try {
    // Load template from database
    const template = await prisma.emailTemplate.findUnique({
      where: { key: templateKey, isActive: true },
    });

    if (!template) {
      console.error(`Email template not found: ${templateKey}`);
      return null;
    }

    // Replace variables in subject
    let subject = template.subject;
    let html = template.bodyHtml;
    let text = template.bodyText;

    // Replace {{variable}} with actual values
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      const stringValue = value?.toString() || "";
      
      subject = subject.replace(regex, stringValue);
      html = html.replace(regex, stringValue);
      text = text.replace(regex, stringValue);
    }

    // Handle conditional blocks {{#if variable}}...{{/if}}
    html = processConditionals(html, variables);
    text = processConditionals(text, variables);

    return { subject, html, text };
  } catch (error) {
    console.error("Error rendering email template:", error);
    return null;
  }
}

function processConditionals(content: string, variables: Record<string, any>): string {
  // Simple conditional logic: {{#if variable}}...{{/if}}
  const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  
  return content.replace(conditionalRegex, (match, variableName, innerContent) => {
    const value = variables[variableName];
    // Show content if variable exists and is truthy
    return value ? innerContent : "";
  });
}

// Helper: Format date for emails
export function formatEmailDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Helper: Format price
export function formatEmailPrice(price: number | string | undefined | null): string {
  if (price === undefined || price === null) {
    return "0,00";
  }
  const p = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(p)) {
    return "0,00";
  }
  return p.toFixed(2).replace(".", ",");
}

