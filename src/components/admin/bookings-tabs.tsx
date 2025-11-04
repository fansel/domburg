"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ConflictManager } from "@/components/admin/conflict-manager";
import { CalendarBookingsManager } from "@/components/admin/calendar-bookings-manager";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, CheckCircle, Calendar, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookingsTabsProps {
  pendingCount: number;
  approvedCount: number;
  otherCount: number;
  conflictsCount?: number;
  pendingContent: React.ReactNode;
  approvedContent: React.ReactNode;
  otherContent: React.ReactNode;
}

export function BookingsTabs({
  pendingCount,
  approvedCount,
  otherCount,
  conflictsCount: initialConflictsCount = 0,
  pendingContent,
  approvedContent,
  otherContent,
}: BookingsTabsProps) {
  const { t } = useTranslation();
  const [conflictsCount, setConflictsCount] = useState<number>(initialConflictsCount);
  const [activeTab, setActiveTab] = useState<string>("pending");

  // Lade aktuelle Konfliktanzahl beim ersten Mount (damit sie aktuell ist, auch wenn Cron Job gerade gelaufen ist)
  useEffect(() => {
    const fetchConflictsCount = async () => {
      try {
        const response = await fetch("/api/admin/conflicts");
        const data = await response.json();
        if (data.success && data.count !== undefined) {
          setConflictsCount(data.count);
        }
      } catch (error) {
        console.error("Error fetching conflicts count:", error);
        // Bei Fehler: Initialwert beibehalten
      }
    };

    fetchConflictsCount();
  }, []);

  const tabs = [
    {
      id: "pending",
      label: t("admin.pendingRequests"),
      labelMobile: "Ausstehend",
      icon: Clock,
      count: pendingCount,
      showCount: true,
      className: "text-yellow-600",
    },
    {
      id: "approved",
      label: t("admin.approvedRequests"),
      labelMobile: "Genehmigt",
      icon: CheckCircle,
      count: approvedCount,
      showCount: true,
      className: "text-green-600",
    },
    {
      id: "calendar",
      label: t("admin.calendarBookings"),
      labelMobile: "Kalender",
      icon: Calendar,
      count: null,
      showCount: false,
      className: "text-blue-600",
    },
    {
      id: "conflicts",
      label: t("admin.conflicts"),
      labelMobile: "Probleme",
      icon: AlertTriangle,
      count: conflictsCount,
      showCount: conflictsCount > 0,
      className: "text-red-600",
    },
    {
      id: "other",
      label: t("admin.other"),
      labelMobile: t("admin.other"),
      icon: MoreHorizontal,
      count: otherCount,
      showCount: true,
      className: "text-gray-600",
    },
  ];

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
      {/* Modern Button-based Navigation */}
      <div className="border-b border-border">
        <div className="flex flex-wrap gap-2 sm:gap-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 h-9 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-all",
                  isActive && "shadow-sm"
                )}
              >
                <Icon className={cn(
                  "h-4 w-4 flex-shrink-0",
                  isActive ? "text-primary-foreground" : tab.className,
                  !isActive && "opacity-70"
                )} />
                <span className="hidden sm:inline whitespace-nowrap">{tab.label}</span>
                <span className="sm:hidden whitespace-nowrap">{tab.labelMobile}</span>
                {tab.showCount && (
                  <span className={cn(
                    "ml-1 sm:ml-1 px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-semibold min-w-[1.75rem] text-center",
                    isActive 
                      ? "bg-primary-foreground/20 text-primary-foreground" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    {tab.count}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      <TabsContent value="conflicts" className="space-y-4 mt-6">
        <ConflictManager onConflictsChange={setConflictsCount} />
      </TabsContent>

      <TabsContent value="calendar" className="space-y-4 mt-6">
        <CalendarBookingsManager />
      </TabsContent>

      <TabsContent value="pending" className="space-y-4 mt-6">
        {pendingContent}
      </TabsContent>

      <TabsContent value="approved" className="space-y-4 mt-6">
        {approvedContent}
      </TabsContent>

      <TabsContent value="other" className="space-y-4 mt-6">
        {otherContent}
      </TabsContent>
    </Tabs>
  );
}

