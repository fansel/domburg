import { PrismaClient } from '@prisma/client';
import { emailTemplates } from '../src/template/email-templates-seed';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starte Seeding...');

  // Standard-Superadmin mit Username/Passwort
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@domburg.local' },
    update: {
      username: 'admin',
      password: hashedPassword,
      name: 'Administrator',
      role: 'SUPERADMIN' as any,
    },
    create: {
      email: 'admin@domburg.local',
      name: 'Administrator',
      username: 'admin',
      password: hashedPassword,
      role: 'SUPERADMIN' as any,
    },
  });
  console.log('✅ Superadmin erstellt:', admin.username, '/', admin.email);
  console.log('   Login: admin / admin123');

  // Test-Gast erstellen
  const guest = await prisma.user.upsert({
    where: { email: 'gast@example.com' },
    update: {},
    create: {
      email: 'gast@example.com',
      name: 'Test Gast',
      role: 'GUEST',
    },
  });
  console.log('✅ Test-Gast erstellt:', guest.email);

  // Gastcode erstellen
  const guestToken = await prisma.guestAccessToken.upsert({
    where: { token: 'domburg2024' },
    update: {},
    create: {
      token: 'domburg2024',
      description: 'Standard Gastcode für Freunde',
      isActive: true,
    },
  });
  console.log('✅ Gastcode erstellt:', guestToken.token);

  // Basis-Preiseinstellungen (Dual-Preis: Family / Standard)
  await prisma.pricingSetting.upsert({
    where: { key: 'base_price_per_night' },
    update: {},
    create: {
      key: 'base_price_per_night',
      value: '180.00',      // Standard-Preis (Basis)
      value2: '120.00',     // Family-Preis (Basis)
      description: 'Basispreis pro Nacht - Standard/Family (EUR)',
    },
  });

  await prisma.pricingSetting.upsert({
    where: { key: 'cleaning_fee' },
    update: {},
    create: {
      key: 'cleaning_fee',
      value: '75.00',
      description: 'Endreinigungsgebühr (EUR)',
    },
  });

  await prisma.pricingSetting.upsert({
    where: { key: 'min_stay_nights' },
    update: {},
    create: {
      key: 'min_stay_nights',
      value: '3',
      description: 'Mindestanzahl Übernachtungen',
    },
  });

  await prisma.pricingSetting.upsert({
    where: { key: 'beach_hut_price_per_week' },
    update: {},
    create: {
      key: 'beach_hut_price_per_week',
      value: '100.00',
      description: 'Strandbuden-Preis pro Woche (EUR)',
    },
  });

  await prisma.pricingSetting.upsert({
    where: { key: 'beach_hut_price_per_day' },
    update: {},
    create: {
      key: 'beach_hut_price_per_day',
      value: '15.00',
      description: 'Strandbuden-Preis pro Tag (EUR)',
    },
  });

  console.log('✅ Preiseinstellungen erstellt');

  // Preisphasen für 2025/2026
  const currentYear = new Date().getFullYear();

  // Lösche alte Preisphasen
  await prisma.pricingPhase.deleteMany({});

  // 1. Hochsaison Juni-September
  await prisma.pricingPhase.create({
    data: {
      name: 'Hochsaison Sommer',
      description: 'Juni bis September - erhöhte Preise',
      startDate: new Date(`${currentYear}-06-01`),
      endDate: new Date(`${currentYear}-09-30`),
      pricePerNight: 220.00,           // Standard
      familyPricePerNight: 140.00,      // Family
      priority: 10,
      isActive: true,
    },
  });

  console.log('✅ Preisphasen erstellt (Hochsaison Sommer)');

  // System-Einstellungen
  await prisma.setting.upsert({
    where: { key: 'house_name' },
    update: {},
    create: {
      key: 'house_name',
      value: 'Domburg Ferienhaus',
      description: 'Name des Ferienhauses',
      isPublic: true,
    },
  });

  await prisma.setting.upsert({
    where: { key: 'max_guests' },
    update: {},
    create: {
      key: 'max_guests',
      value: '6',
      description: 'Maximale Anzahl Gäste',
      isPublic: true,
    },
  });

  await prisma.setting.upsert({
    where: { key: 'check_in_time' },
    update: {},
    create: {
      key: 'check_in_time',
      value: '15:00',
      description: 'Check-in Uhrzeit',
      isPublic: true,
    },
  });

  await prisma.setting.upsert({
    where: { key: 'check_out_time' },
    update: {},
    create: {
      key: 'check_out_time',
      value: '10:00',
      description: 'Check-out Uhrzeit',
      isPublic: true,
    },
  });

  console.log('✅ System-Einstellungen erstellt');

  // Email Templates erstellen oder aktualisieren (upsert)
  console.log('📧 Prüfe Email-Templates...');
  for (const template of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { key: template.key },
      update: {
        // Aktualisiere nur, wenn Template existiert aber inaktiv ist oder veraltet
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
  console.log('✅ Email-Templates Prüfung abgeschlossen');

  console.log('🎉 Seeding abgeschlossen!');
}

main()
  .catch((e) => {
    console.error('❌ Fehler beim Seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

