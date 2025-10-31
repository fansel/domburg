"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Users, Calendar, Mail } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

export function SettingsTabsList() {
  const { t } = useTranslation();

  return (
    <TabsList className="grid w-full max-w-3xl grid-cols-4">
      <TabsTrigger value="guest-codes" className="flex items-center gap-2">
        <Key className="h-4 w-4" />
        {t("settings.guestCodes")}
      </TabsTrigger>
      <TabsTrigger value="admins" className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        {t("settings.admins")}
      </TabsTrigger>
      <TabsTrigger value="calendar" className="flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        {t("settings.googleCalendar")}
      </TabsTrigger>
      <TabsTrigger value="email" className="flex items-center gap-2">
        <Mail className="h-4 w-4" />
        {t("settings.email")}
      </TabsTrigger>
    </TabsList>
  );
}

