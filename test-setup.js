// Quick Setup Test für Domburg Buchungssystem
const { PrismaClient } = require('@prisma/client');

async function testSetup() {
  console.log('🔍 Teste Setup...\n');
  
  try {
    const prisma = new PrismaClient();
    
    // Test 1: Datenbankverbindung
    console.log('✓ Test 1: Datenbankverbindung');
    await prisma.$connect();
    console.log('  → Verbindung erfolgreich!\n');
    
    // Test 2: Gastcode prüfen
    console.log('✓ Test 2: Gastcode');
    const guestToken = await prisma.guestAccessToken.findUnique({
      where: { token: 'domburg2024' },
    });
    
    if (guestToken) {
      console.log('  → Gastcode "domburg2024" gefunden!');
      console.log(`  → Aktiv: ${guestToken.isActive}`);
      console.log(`  → Nutzungen: ${guestToken.usageCount}\n`);
    } else {
      console.log('  ❌ Gastcode NICHT gefunden! Führen Sie "npm run db:seed" aus.\n');
    }
    
    // Test 3: Admin-Benutzer prüfen
    console.log('✓ Test 3: Admin-Benutzer');
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@domburg.local' },
    });
    
    if (admin) {
      console.log('  → Admin-Benutzer gefunden!');
      console.log(`  → Rolle: ${admin.role}\n`);
    } else {
      console.log('  ❌ Admin NICHT gefunden! Führen Sie "npm run db:seed" aus.\n');
    }
    
    // Test 4: Preiseinstellungen prüfen
    console.log('✓ Test 4: Preiseinstellungen');
    const settings = await prisma.pricingSetting.count();
    console.log(`  → ${settings} Preiseinstellungen gefunden\n`);
    
    if (settings === 0) {
      console.log('  ❌ Keine Preiseinstellungen! Führen Sie "npm run db:seed" aus.\n');
    }
    
    console.log('─────────────────────────────────────────');
    console.log('✅ Setup-Test abgeschlossen!');
    console.log('─────────────────────────────────────────');
    
    if (!guestToken || !admin || settings === 0) {
      console.log('\n⚠️  AKTION ERFORDERLICH:');
      console.log('   Führen Sie folgende Befehle aus:');
      console.log('   1. npm run db:push');
      console.log('   2. npm run db:seed');
      console.log('   3. npm run dev (Server neu starten)');
    } else {
      console.log('\n✅ Alles bereit! Starten Sie den Server mit: npm run dev');
      console.log('\n📋 Login-Optionen:');
      console.log('   • Gastcode: domburg2024');
      console.log('   • Magic Link: Beliebige E-Mail (Link in Terminal-Konsole)');
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('\n❌ FEHLER:', error.message);
    console.log('\n💡 Mögliche Lösung:');
    console.log('   1. Starten Sie Docker: npm run docker:up');
    console.log('   2. Warten Sie 10 Sekunden');
    console.log('   3. Führen Sie aus: npm run db:push');
    console.log('   4. Führen Sie aus: npm run db:seed');
    process.exit(1);
  }
}

testSetup();

