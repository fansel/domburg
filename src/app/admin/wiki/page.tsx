import { redirect } from "next/navigation";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { AdminWiki } from "@/components/admin/admin-wiki";
import { BackButton } from "@/components/admin/back-button";
import { PageHeader } from "@/components/admin/page-header";
import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminWikiPage() {
  const user = await getCurrentUser();

  if (!user || !hasAdminRights(user.role)) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-6xl lg:max-w-[85%] xl:max-w-[1200px]">
        <BackButton href="/admin/bookings" />

        <PageHeader
          title="Admin Wiki"
          description="Vollständige Anleitung für alle Funktionen des Buchungssystems"
          icon={<BookOpen className="h-8 w-8" />}
        />

        <AdminWiki />
      </div>
    </div>
  );
}

