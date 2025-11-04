import { redirect } from "next/navigation";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { EmailTemplateManager } from "@/components/admin/email-template-manager";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const user = await getCurrentUser();

  if (!user || !hasAdminRights(user.role)) {
    redirect("/");
  }
  const templates = await prisma.emailTemplate.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-8 max-w-6xl lg:max-w-[85%] xl:max-w-[1200px]">
        <div className="mb-6">
          <Link href="/admin/settings">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Zurück zu Einstellungen
            </Button>
          </Link>
        </div>

        <EmailTemplateManager templates={templates} />
      </div>
    </div>
  );
}

