"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Users, Calendar, Mail, Settings } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

interface SettingsTabsListProps {
  isSuperAdmin?: boolean;
}

export function SettingsTabsList({ isSuperAdmin = false }: SettingsTabsListProps) {
  const { t } = useTranslation();
  
  const tabCount = isSuperAdmin ? 5 : 3;
  // Verwende feste Klassen statt Template-Literal für Tailwind
  const gridColsClass = isSuperAdmin 
    ? "sm:grid-cols-5" 
    : "sm:grid-cols-3";

  return (
    <TabsList className={`inline-flex w-full sm:grid ${gridColsClass} gap-1 sm:gap-2 overflow-x-auto`}>
        <TabsTrigger value="guest-codes" className="flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-3 flex-shrink-0">
          <Key className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="hidden sm:inline">{t("settings.guestCodes")}</span>
          <span className="sm:hidden">Codes</span>
        </TabsTrigger>
        <TabsTrigger value="admins" className="flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-3 flex-shrink-0">
          <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="hidden sm:inline">{t("settings.admins")}</span>
          <span className="sm:hidden">Admins</span>
        </TabsTrigger>
        {Boolean(isSuperAdmin) && (
        <>
          <TabsTrigger value="calendar" className="flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-3 flex-shrink-0">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">{t("settings.googleCalendar")}</span>
            <span className="sm:hidden">Kalender</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-3 flex-shrink-0">
            <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">{t("settings.email")}</span>
            <span className="sm:hidden">E-Mail</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-3 flex-shrink-0">
            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">System</span>
            <span className="sm:hidden">Sys</span>
          </TabsTrigger>
        </>
      )}
        {!isSuperAdmin && (
          <TabsTrigger value="email" className="flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-3 flex-shrink-0">
            <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">{t("settings.email")}</span>
            <span className="sm:hidden">E-Mail</span>
          </TabsTrigger>
        )}
      </TabsList>
  );
}

