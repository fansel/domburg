import { redirect } from "next/navigation";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import prisma from "@/lib/prisma";
import { PricingManager } from "@/components/admin/pricing-manager";
import { Euro } from "lucide-react";
import { BackButton } from "@/components/admin/back-button";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const user = await getCurrentUser();

  if (!user || !hasAdminRights(user.role)) {
    redirect("/");
  }

  // Prüfe ob User Preise verwalten darf
  if (!user.canManagePricing && user.role !== "SUPERADMIN") {
    redirect("/");
  }

  // Stelle sicher, dass alle benötigten PricingSettings existieren
  await Promise.all([
    prisma.pricingSetting.upsert({
      where: { key: 'beach_hut_price_per_week' },
      update: {},
      create: {
        key: 'beach_hut_price_per_week',
        value: '100.00',
        description: 'Strandbuden-Preis pro Woche (EUR)',
      },
    }),
    prisma.pricingSetting.upsert({
      where: { key: 'beach_hut_price_per_day' },
      update: {},
      create: {
        key: 'beach_hut_price_per_day',
        value: '15.00',
        description: 'Strandbuden-Preis pro Tag (EUR)',
      },
    }),
  ]);

  const [pricingPhasesRaw, pricingSettings, beachHutSessions] = await Promise.all([
    prisma.pricingPhase.findMany({
      orderBy: { startDate: "asc" },
    }),
    prisma.pricingSetting.findMany({
      orderBy: { key: "asc" },
    }),
    prisma.beachHutSession.findMany({
      orderBy: { startDate: "asc" },
    }),
  ]);

  // Konvertiere Decimal-Objekte zu Zahlen für Client Component Kompatibilität
  const pricingPhases = pricingPhasesRaw.map(phase => ({
    ...phase,
    pricePerNight: parseFloat(phase.pricePerNight.toString()),
    familyPricePerNight: phase.familyPricePerNight ? parseFloat(phase.familyPricePerNight.toString()) : null,
    // Stelle sicher, dass alle Felder vorhanden sind (auch die neuen)
    minNights: (phase as any).minNights ?? null,
    saturdayToSaturday: (phase as any).saturdayToSaturday ?? false,
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-6 lg:py-8 max-w-6xl lg:max-w-[85%] xl:max-w-[1200px]">
        <BackButton href="/admin/bookings" />

        <PageHeader
          title="pricing.title"
          description="pricing.description"
          icon={<Euro className="h-6 w-6 sm:h-8 sm:w-8" />}
        />

        <PricingManager
          initialPhases={pricingPhases}
          initialSettings={pricingSettings}
          initialBeachHutSessions={beachHutSessions}
        />
      </div>
    </div>
  );
}

