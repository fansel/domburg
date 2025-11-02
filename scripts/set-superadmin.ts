import prisma from "../src/lib/prisma";

async function setSuperAdmin() {
  const email = "hey@ƒansel.dev";
  
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`Benutzer mit E-Mail ${email} nicht gefunden`);
      process.exit(1);
    }

    console.log(`Aktuelle Rolle: ${user.role}`);

    if (user.role === "SUPERADMIN") {
      console.log("Benutzer ist bereits SUPERADMIN");
      process.exit(0);
    }

    const updated = await prisma.user.update({
      where: { email },
      data: { role: "SUPERADMIN" },
    });

    console.log(`✓ Benutzer ${email} wurde auf SUPERADMIN gesetzt`);
    console.log(`  Vorher: ${user.role}`);
    console.log(`  Jetzt: ${updated.role}`);
  } catch (error) {
    console.error("Fehler:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setSuperAdmin();

