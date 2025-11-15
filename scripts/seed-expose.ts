import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedExpose() {
  console.log('📄 Starte Expose-Daten Seeding...');

  // Lade Expose-Seed-Daten
  let exposeSeedData: any = null;
  try {
    const exposeSeedModule = await import('../src/template/expose-seed');
    exposeSeedData = exposeSeedModule.exposeSeedData;
  } catch (e) {
    console.error('❌ Keine Expose-Seed-Daten gefunden!');
    console.error('   Führe zuerst aus: npx tsx scripts/export-expose-data.ts');
    process.exit(1);
  }

  if (!exposeSeedData) {
    console.error('❌ Keine Expose-Seed-Daten gefunden!');
    process.exit(1);
  }

  // Erstelle/Update Abschnitte (upsert basierend auf Titel und Order)
  const sectionMap = new Map<string, string>();
  for (const section of exposeSeedData.sections) {
    // Versuche zuerst nach Titel zu finden, dann nach Order
    let existingSection = null;
    if (section.title) {
      existingSection = await prisma.exposeSection.findFirst({
        where: { title: section.title },
      });
    }
    
    if (!existingSection && section.order !== undefined) {
      existingSection = await prisma.exposeSection.findFirst({
        where: { order: section.order },
      });
    }

    const sectionData = {
      title: section.title,
      content: section.content,
      order: section.order,
    };

    if (existingSection) {
      // Update bestehenden Abschnitt
      const updatedSection = await prisma.exposeSection.update({
        where: { id: existingSection.id },
        data: sectionData,
      });
      if (section.title) {
        sectionMap.set(section.title, updatedSection.id);
      }
      console.log(`  ✅ Abschnitt aktualisiert: ${section.title || 'Ohne Titel'}`);
    } else {
      // Erstelle neuen Abschnitt
      const createdSection = await prisma.exposeSection.create({
        data: sectionData,
      });
      if (section.title) {
        sectionMap.set(section.title, createdSection.id);
      }
      console.log(`  ✅ Abschnitt erstellt: ${section.title || 'Ohne Titel'}`);
    }
  }

  // Erstelle/Update Expose-Einträge (upsert basierend auf Order und Titel)
  for (const expose of exposeSeedData.exposes) {
    const sectionId = expose.sectionTitle ? sectionMap.get(expose.sectionTitle) || null : null;
    
    // Versuche zuerst nach Order und Titel zu finden
    let existingExpose = null;
    if (expose.title && expose.order !== undefined) {
      existingExpose = await prisma.expose.findFirst({
        where: {
          order: expose.order,
          title: expose.title,
        },
      });
    } else if (expose.order !== undefined) {
      existingExpose = await prisma.expose.findFirst({
        where: { order: expose.order },
      });
    }

    const exposeData = {
      title: expose.title,
      description: expose.description,
      imageUrl: expose.imageUrl,
      imageText: expose.imageText,
      sectionId: sectionId,
      placement: expose.placement,
      order: expose.order,
      isActive: expose.isActive,
    };

    if (existingExpose) {
      // Update bestehenden Eintrag
      await prisma.expose.update({
        where: { id: existingExpose.id },
        data: exposeData,
      });
      console.log(`  ✅ Expose-Eintrag aktualisiert: ${expose.title || 'Ohne Titel'}`);
    } else {
      // Erstelle neuen Eintrag
      await prisma.expose.create({
        data: exposeData,
      });
      console.log(`  ✅ Expose-Eintrag erstellt: ${expose.title || 'Ohne Titel'}`);
    }
  }

  // Erstelle/Update Kontaktdaten (upsert)
  const contactSettings = [
    { key: 'EXPOSE_CONTACT1_NAME', value: exposeSeedData.contacts.contact1Name },
    { key: 'EXPOSE_CONTACT1_PHONE', value: exposeSeedData.contacts.contact1Phone },
    { key: 'EXPOSE_CONTACT1_MOBILE', value: exposeSeedData.contacts.contact1Mobile },
    { key: 'EXPOSE_CONTACT1_EMAIL', value: exposeSeedData.contacts.contact1Email },
    { key: 'EXPOSE_CONTACT2_NAME', value: exposeSeedData.contacts.contact2Name },
    { key: 'EXPOSE_CONTACT2_PHONE', value: exposeSeedData.contacts.contact2Phone },
    { key: 'EXPOSE_CONTACT2_MOBILE', value: exposeSeedData.contacts.contact2Mobile },
    { key: 'EXPOSE_CONTACT2_EMAIL', value: exposeSeedData.contacts.contact2Email },
    { key: 'EXPOSE_HOUSE_ADDRESS', value: exposeSeedData.contacts.houseAddress },
    { key: 'EXPOSE_HOUSE_PHONE', value: exposeSeedData.contacts.housePhone },
  ];

  for (const setting of contactSettings) {
    if (setting.value) {
      await prisma.setting.upsert({
        where: { key: setting.key },
        update: { value: setting.value },
        create: {
          key: setting.key,
          value: setting.value,
          description: `Expose Kontaktdaten: ${setting.key}`,
          isPublic: true,
        },
      });
      console.log(`  ✅ Kontaktdaten aktualisiert: ${setting.key}`);
    }
  }

  console.log('✅ Expose-Daten Seeding abgeschlossen!');
}

seedExpose()
  .catch((e) => {
    console.error('❌ Fehler beim Expose-Seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

