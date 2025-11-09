import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Housekeeping E-Mail-Template...');

  const template = {
    key: "housekeeper_schedule_change",
    name: "Cleaning-Schedule Änderung (an Housekeeper)",
    subject: "Wijzigingen in het schoonmaakschema",
    description: "Benachrichtigung an Housekeeper bei Änderungen am Cleaning-Schedule (auf Niederländisch)",
    variables: ["calendarUrl", "housekeeperName"],
    bodyHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .info-box { 
        background: #e7f3ff; 
        border-left: 4px solid #2563eb;
        padding: 15px; 
        border-radius: 5px; 
        margin: 20px 0; 
      }
      .button { 
        display: inline-block; 
        padding: 12px 24px; 
        background: #2563eb; 
        color: #fff; 
        text-decoration: none; 
        border-radius: 5px;
        margin: 20px 0;
      }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Wijzigingen in het schoonmaakschema</h1>
      
      <p>Beste {{housekeeperName}},</p>
      
      <div class="info-box">
        <p><strong>Er zijn wijzigingen aangebracht in het schoonmaakschema.</strong></p>
        <p>Gelieve het schema te controleren om te zien welke aanpassingen er zijn gemaakt.</p>
      </div>
      
      <p>U kunt het actuele schema bekijken via de onderstaande link:</p>
      
      <a href="{{calendarUrl}}" class="button">Schoonmaakschema bekijken</a>
      
      <p>Als u vragen heeft, neem dan gerust contact met ons op.</p>
      
      <div class="footer">
        <p>Met vriendelijke groet<br>Familie Waubke</p>
      </div>
    </div>
  </body>
</html>`,
    bodyText: `WIJZIGINGEN IN HET SCHOONMAAKSCHEMA

Beste {{housekeeperName}},

Er zijn wijzigingen aangebracht in het schoonmaakschema.

Gelieve het schema te controleren om te zien welke aanpassingen er zijn gemaakt.

U kunt het actuele schema bekijken via:
{{calendarUrl}}

Als u vragen heeft, neem dan gerust contact met ons op.

Met vriendelijke groet
Familie Waubke`,
  };

  await prisma.emailTemplate.upsert({
    where: { key: template.key },
    update: {
      // Aktualisiere nur wenn Template existiert
      name: template.name,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText,
      description: template.description,
      variables: template.variables,
      isActive: true,
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

  console.log(`✅ ${template.name} erstellt/aktualisiert`);
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

