import { PrismaClient } from '@prisma/client';
import { emailTemplates } from '../src/template/email-templates-seed';

const prisma = new PrismaClient();

async function main() {
  console.log('📧 Starte Email-Templates Seeding...');

  // Email Templates erstellen oder aktualisieren (upsert)
  for (const template of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { key: template.key },
      update: {
        // Aktualisiere alle Felder
        name: template.name,
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        bodyText: template.bodyText,
        description: template.description,
        variables: template.variables,
        isActive: true, // Stelle sicher dass Template aktiv ist
      },
      create: {
        key: template.key,
        name: template.name,
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        bodyText: template.bodyText,
        description: template.description,
        variables: template.variables,
        isActive: true,
      },
    });
    console.log(`  ✅ ${template.name} erstellt/aktualisiert`);
  }

  console.log('✅ Email-Templates Seeding abgeschlossen');
}

main()
  .catch((e) => {
    console.error('❌ Fehler beim Email-Templates Seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

