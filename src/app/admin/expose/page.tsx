import { redirect } from "next/navigation";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { ExposeManager } from "@/components/admin/expose-manager";
import { ExposeContactManager } from "@/components/admin/expose-contact-manager";
import { ExposeSectionManager } from "@/components/admin/expose-section-manager";
import { Image as ImageIcon } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { BackButton } from "@/components/admin/back-button";
import { PageHeader } from "@/components/admin/page-header";

export default async function AdminExposePage() {
  const user = await getCurrentUser();

  if (!user || !hasAdminRights(user.role)) {
    redirect("/");
  }

  // Prüfe ob User canManageExpose hat (oder SUPERADMIN)
  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { canManageExpose: true, role: true },
  });

  if (dbUser?.role !== "SUPERADMIN" && !dbUser?.canManageExpose) {
    redirect("/admin/bookings");
  }

  // Lade Expose-Einträge und Kontaktdaten
  const [exposes, sections, contactSettings] = await Promise.all([
    prisma.expose.findMany({
      orderBy: { order: "asc" },
      include: { section: true },
    }),
    prisma.exposeSection.findMany({
      orderBy: { order: "asc" },
    }),
    prisma.setting.findMany({
      where: {
        key: {
          in: [
            "EXPOSE_CONTACT1_NAME",
            "EXPOSE_CONTACT1_PHONE",
            "EXPOSE_CONTACT1_MOBILE",
            "EXPOSE_CONTACT1_EMAIL",
            "EXPOSE_CONTACT2_NAME",
            "EXPOSE_CONTACT2_PHONE",
            "EXPOSE_CONTACT2_MOBILE",
            "EXPOSE_CONTACT2_EMAIL",
            "EXPOSE_HOUSE_ADDRESS",
            "EXPOSE_HOUSE_PHONE",
          ],
        },
      },
    }),
  ]);

  // Parse Kontaktdaten
  const contacts = {
    contact1Name: contactSettings.find((s) => s.key === "EXPOSE_CONTACT1_NAME")?.value || "",
    contact1Phone: contactSettings.find((s) => s.key === "EXPOSE_CONTACT1_PHONE")?.value || "",
    contact1Mobile: contactSettings.find((s) => s.key === "EXPOSE_CONTACT1_MOBILE")?.value || "",
    contact1Email: contactSettings.find((s) => s.key === "EXPOSE_CONTACT1_EMAIL")?.value || "",
    contact2Name: contactSettings.find((s) => s.key === "EXPOSE_CONTACT2_NAME")?.value || "",
    contact2Phone: contactSettings.find((s) => s.key === "EXPOSE_CONTACT2_PHONE")?.value || "",
    contact2Mobile: contactSettings.find((s) => s.key === "EXPOSE_CONTACT2_MOBILE")?.value || "",
    contact2Email: contactSettings.find((s) => s.key === "EXPOSE_CONTACT2_EMAIL")?.value || "",
    houseAddress: contactSettings.find((s) => s.key === "EXPOSE_HOUSE_ADDRESS")?.value || "",
    housePhone: contactSettings.find((s) => s.key === "EXPOSE_HOUSE_PHONE")?.value || "",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-6xl">
        <BackButton href="/admin/bookings" />

        <PageHeader
          title="Expose-Verwaltung"
          description="Verwalten Sie Bilder und Texte für das Expose"
          icon={<ImageIcon className="h-8 w-8" />}
        />

        <div className="space-y-6">
          <ExposeSectionManager initialSections={sections} />
          <ExposeContactManager initialContacts={contacts} />
          <ExposeManager initialExposes={exposes} sections={sections} />
        </div>
      </div>
    </div>
  );
}

