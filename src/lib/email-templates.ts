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
  // Simple conditional logic: {{#if variable}}...{{#else}}...{{/if}}
  // Unterstützt auch {{#if variable}}...{{/if}} ohne else
  const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  
  return content.replace(conditionalRegex, (fullMatch, variableName, innerContent) => {
    const value = variables[variableName];
    
    // Prüfe ob es einen {{#else}} Block gibt
    const elseRegex = /\{\{#else\}\}/;
    const elseIndex = innerContent.search(elseRegex);
    
    if (elseIndex !== -1) {
      // Es gibt einen else-Block
      const ifContent = innerContent.substring(0, elseIndex);
      const elseContent = innerContent.substring(elseIndex + 9); // 9 = Länge von "{{#else}}"
      // Zeige if-Content wenn value truthy ist, sonst else-Content
      const replacement = value ? ifContent : elseContent;
      // Rekursiv verarbeiten, falls verschachtelte Blöcke vorhanden sind
      return processConditionals(replacement, variables);
    } else {
      // Kein else-Block, zeige nur wenn value truthy ist
      const replacement = value ? innerContent : "";
      // Rekursiv verarbeiten, falls verschachtelte Blöcke vorhanden sind
      return processConditionals(replacement, variables);
    }
  });
}

// Helper: Format date for emails
// WICHTIG: Verwendet explizit Europe/Amsterdam Timezone für konsistente Datumsanzeige
export function formatEmailDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  
  // Verwende Intl.DateTimeFormat mit expliziter Timezone für konsistente Formatierung
  // unabhängig von der Server-Zeitzone
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Amsterdam",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
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

