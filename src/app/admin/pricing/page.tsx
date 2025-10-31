import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import prisma from "@/lib/prisma";
import { PricingManager } from "@/components/admin/pricing-manager";
import { Euro } from "lucide-react";
import { BackButton } from "@/components/admin/back-button";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }

  const [pricingPhases, pricingSettings] = await Promise.all([
    prisma.pricingPhase.findMany({
      orderBy: { startDate: "asc" },
    }),
    prisma.pricingSetting.findMany({
      orderBy: { key: "asc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-8">
        <BackButton href="/admin/bookings" />

        <PageHeader
          title="pricing.title"
          description="pricing.description"
          icon={<Euro className="h-8 w-8" />}
        />

        <PricingManager
          initialPhases={pricingPhases}
          initialSettings={pricingSettings}
        />
      </div>
    </div>
  );
}

