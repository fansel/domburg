import { redirect } from "next/navigation";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@prisma/client";
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
import { PublicUrlManager } from "@/components/admin/public-url-manager";
import { ReplyToManager } from "@/components/admin/reply-to-manager";
import { EmailLogManager } from "@/components/admin/email-log-manager";
import { BookingHistoryResetManager } from "@/components/admin/booking-history-reset-manager";
import { BookingLimitSettingManager } from "@/components/admin/booking-limit-setting-manager";
import { HousekeeperEmailManager } from "@/components/admin/housekeeper-email-manager";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();

  if (!user || !hasAdminRights(user.role)) {
    redirect("/");
  }
  
  // Stelle sicher, dass die Rolle wirklich aus der DB kommt, nicht aus dem Token
  // Hole den User nochmal direkt aus der DB, um sicherzugehen
  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { role: true },
  });
  
  const actualRole = dbUser?.role || user.role;
  const isSuperAdmin = actualRole === "SUPERADMIN";
  
  // Lade vollständige User-Daten für Berechtigungen
  const fullUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { 
      role: true,
      canManageBookingLimit: true,
    },
  });
  
  const canManageBookingLimit = isSuperAdmin || (fullUser?.canManageBookingLimit === true);

  // Lade Daten
  const [guestTokens, adminUsers, calendarSettings, emailTemplates, smtpSettings, publicUrlSetting, replyToSetting, emailLogs, bookingLimitSetting, housekeeperEmailsSetting, housekeeperLastSentSetting] = await Promise.all([
    prisma.guestAccessToken.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { 
        OR: [
          { role: UserRole.ADMIN },
          { role: UserRole.SUPERADMIN }
        ]
      },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        password: true,
        role: true,
        isActive: true,
        canSeeBookings: true,
        canApproveBookings: true,
        canManagePricing: true,
        canManageBookingLimit: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
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
    prisma.setting.findUnique({
      where: { key: "PUBLIC_URL" },
    }),
    prisma.setting.findUnique({
      where: { key: "REPLY_TO_EMAIL" },
    }),
    prisma.emailLog.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
    }),
    prisma.setting.findUnique({
      where: { key: "BOOKING_LIMIT_DATE" },
    }),
    prisma.setting.findUnique({
      where: { key: "HOUSEKEEPER_EMAILS" },
    }),
    prisma.setting.findUnique({
      where: { key: "HOUSEKEEPER_LAST_SENT" },
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

  // Verwende die aktuelle Rolle aus DB für isSuperAdmin
  const userWithCorrectRole = {
    ...user,
    role: actualRole as any,
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={userWithCorrectRole} />
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-6xl">
        <BackButton href="/admin/bookings" />

        <PageHeader
          title="settings.systemSettings"
          description="settings.systemSettingsDescription"
          icon={<Shield className="h-8 w-8" />}
        />

        <Tabs defaultValue="guest-codes" className="space-y-4 sm:space-y-6">
          <SettingsTabsList isSuperAdmin={!!isSuperAdmin} />

          <TabsContent value="guest-codes">
            <GuestCodeManager initialTokens={guestTokens} />
          </TabsContent>

          <TabsContent value="admins">
            <AdminUserManager 
              initialUsers={adminUsers} 
              currentUser={user as any} 
            />
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="calendar">
              <GoogleCalendarManager initialSettings={googleCalendarSettings} />
            </TabsContent>
          )}

          <TabsContent value="email">
            <div className="space-y-6">
              {isSuperAdmin && (
                <>
                  <ReplyToManager initialEmail={replyToSetting?.value || smtpConfig.fromEmail || ""} />
                  <SmtpManager initialSettings={smtpConfig} />
                </>
              )}
              <EmailTemplateManager templates={emailTemplates} />
              <EmailLogManager initialLogs={emailLogs} />
            </div>
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="system">
              <div className="space-y-6">
                <PublicUrlManager initialUrl={publicUrlSetting?.value || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"} />
                {(isSuperAdmin || canManageBookingLimit) && (
                  <BookingLimitSettingManager initialDate={bookingLimitSetting?.value || undefined} />
                )}
                <BookingHistoryResetManager />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

