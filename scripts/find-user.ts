import prisma from "../src/lib/prisma";

async function findUser() {
  try {
    // Suche nach verschiedenen Varianten
    const emails = [
      "hey@ƒansel.dev",
      "hey@fansel.dev",
      "hey@mansel.dev",
      "hey@ansel.dev",
    ];

    for (const email of emails) {
      const user = await prisma.user.findUnique({
        where: { email },
      });
      if (user) {
        console.log(`✓ Gefunden: ${email}`);
        console.log(`  Rolle: ${user.role}`);
        console.log(`  Name: ${user.name}`);
        console.log(`  ID: ${user.id}`);
        return user;
      }
    }

    // Alle Admin-User auflisten
    console.log("\nAlle Admin/Superadmin User:");
    const admins = await prisma.user.findMany({
      where: {
        OR: [
          { role: "ADMIN" },
          { role: "SUPERADMIN" }
        ]
      },
      select: {
        email: true,
        name: true,
        role: true,
      }
    });

    if (admins.length === 0) {
      console.log("Keine Admin-User gefunden");
    } else {
      admins.forEach(admin => {
        console.log(`  - ${admin.email} (${admin.name}) - ${admin.role}`);
      });
    }
  } catch (error) {
    console.error("Fehler:", error);
  } finally {
    await prisma.$disconnect();
  }
}

findUser();

