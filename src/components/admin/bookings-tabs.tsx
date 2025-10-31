"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConflictManager } from "@/components/admin/conflict-manager";
import { CalendarBookingsManager } from "@/components/admin/calendar-bookings-manager";
import { useTranslation } from "@/contexts/LanguageContext";

interface BookingsTabsProps {
  pendingCount: number;
  approvedCount: number;
  otherCount: number;
  pendingContent: React.ReactNode;
  approvedContent: React.ReactNode;
  otherContent: React.ReactNode;
}

export function BookingsTabs({
  pendingCount,
  approvedCount,
  otherCount,
  pendingContent,
  approvedContent,
  otherContent,
}: BookingsTabsProps) {
  const { t } = useTranslation();
  const [conflictsCount, setConflictsCount] = useState<number | null>(null);

  return (
    <Tabs defaultValue="pending" className="space-y-4">
      <TabsList>
        <TabsTrigger value="conflicts">
          {t("admin.conflicts")}
          {conflictsCount !== null && conflictsCount > 0 && ` (${conflictsCount})`}
        </TabsTrigger>
        <TabsTrigger value="pending">
          {t("admin.pendingRequests")} ({pendingCount})
        </TabsTrigger>
        <TabsTrigger value="approved">
          {t("admin.approvedRequests")} ({approvedCount})
        </TabsTrigger>
        <TabsTrigger value="calendar">
          {t("admin.calendarBookings")}
        </TabsTrigger>
        <TabsTrigger value="other">
          {t("admin.other")} ({otherCount})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="conflicts" className="space-y-4">
        <ConflictManager onConflictsChange={setConflictsCount} />
      </TabsContent>

      <TabsContent value="calendar" className="space-y-4">
        <CalendarBookingsManager />
      </TabsContent>

      <TabsContent value="pending" className="space-y-4">
        {pendingContent}
      </TabsContent>

      <TabsContent value="approved" className="space-y-4">
        {approvedContent}
      </TabsContent>

      <TabsContent value="other" className="space-y-4">
        {otherContent}
      </TabsContent>
    </Tabs>
  );
}

