import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GuestCodeManager } from "@/components/admin/guest-code-manager";
import { AdminUserManager } from "@/components/admin/admin-user-manager";
import { GoogleCalendarManager } from "@/components/admin/google-calendar-manager";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Shield } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { BackButton } from "@/components/admin/back-button";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsTabsList } from "@/components/admin/settings-tabs-list";
import { EmailTemplateManager } from "@/components/admin/email-template-manager";
import { SmtpManager } from "@/components/admin/smtp-manager";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }

  // Lade Daten
  const [guestTokens, adminUsers, calendarSettings, emailTemplates, smtpSettings] = await Promise.all([
    prisma.guestAccessToken.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.setting.findMany({
      where: {
        key: {
          in: ["GOOGLE_CALENDAR_ID", "GOOGLE_SERVICE_ACCOUNT_EMAIL"],
        },
      },
    }),
    prisma.emailTemplate.findMany({
      orderBy: { key: "asc" },
    }),
    prisma.setting.findMany({
      where: {
        key: {
          in: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM_EMAIL", "SMTP_FROM_NAME", "SMTP_ENABLED"],
        },
      },
    }),
  ]);

  // Parse calendar settings
  const googleCalendarSettings = {
    calendarId: calendarSettings.find((s) => s.key === "GOOGLE_CALENDAR_ID")?.value,
    serviceAccountEmail: calendarSettings.find((s) => s.key === "GOOGLE_SERVICE_ACCOUNT_EMAIL")?.value,
    isConnected: !!calendarSettings.find((s) => s.key === "GOOGLE_CALENDAR_ID")?.value,
  };

  // Parse SMTP settings
  // WICHTIG: Passwort wird NIEMALS ins Frontend geladen (aus Sicherheitsgründen)
  const smtpConfig = {
    host: smtpSettings.find((s) => s.key === "SMTP_HOST")?.value || "",
    port: smtpSettings.find((s) => s.key === "SMTP_PORT")?.value || "587",
    user: smtpSettings.find((s) => s.key === "SMTP_USER")?.value || "",
    password: "", // Niemals Passwort ins Frontend laden
    hasPassword: !!smtpSettings.find((s) => s.key === "SMTP_PASSWORD")?.value, // Nur Flag ob Passwort gesetzt ist
    fromEmail: smtpSettings.find((s) => s.key === "SMTP_FROM_EMAIL")?.value || "",
    fromName: smtpSettings.find((s) => s.key === "SMTP_FROM_NAME")?.value || "Familie Waubke",
    enabled: smtpSettings.find((s) => s.key === "SMTP_ENABLED")?.value === "true",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-8">
        <BackButton href="/admin/bookings" />

        <PageHeader
          title="settings.systemSettings"
          description="settings.systemSettingsDescription"
          icon={<Shield className="h-8 w-8" />}
        />

        <Tabs defaultValue="guest-codes" className="space-y-6">
          <SettingsTabsList />

          <TabsContent value="guest-codes">
            <GuestCodeManager initialTokens={guestTokens} />
          </TabsContent>

          <TabsContent value="admins">
            <AdminUserManager initialUsers={adminUsers} />
          </TabsContent>

          <TabsContent value="calendar">
            <GoogleCalendarManager initialSettings={googleCalendarSettings} />
          </TabsContent>

          <TabsContent value="email">
            <div className="space-y-6">
              <SmtpManager initialSettings={smtpConfig} />
              <EmailTemplateManager templates={emailTemplates} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

