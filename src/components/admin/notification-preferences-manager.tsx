"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NotificationPreferences {
  newBooking: boolean;
  bookingApproved: boolean;
  bookingRejected: boolean;
  bookingConflict: boolean;
}

interface NotificationPreferencesManagerProps {
  initialPreferences?: NotificationPreferences;
  currentUserId?: string;
}

const notificationTypes = [
  {
    key: "newBooking" as keyof NotificationPreferences,
    label: "Neue Buchung",
    description: "Erhalte eine E-Mail, wenn eine neue Buchungsanfrage eingeht",
    hasTemplate: true,
  },
  {
    key: "bookingApproved" as keyof NotificationPreferences,
    label: "Buchung genehmigt",
    description: "Erhalte eine E-Mail, wenn ein anderer Admin eine Buchung genehmigt",
    hasTemplate: true,
  },
  {
    key: "bookingRejected" as keyof NotificationPreferences,
    label: "Buchung abgelehnt",
    description: "Erhalte eine E-Mail, wenn ein anderer Admin eine Buchung ablehnt",
    hasTemplate: true,
  },
  {
    key: "bookingConflict" as keyof NotificationPreferences,
    label: "Konflikt erkannt",
    description: "Erhalte eine E-Mail, wenn ein Buchungskonflikt erkannt wird",
    hasTemplate: true,
  },
];

export function NotificationPreferencesManager({
  initialPreferences,
  currentUserId,
}: NotificationPreferencesManagerProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    newBooking: true,
    bookingApproved: false,
    bookingRejected: false,
    bookingConflict: false, // Standard: deaktiviert
    ...initialPreferences,
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/notification-preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferences),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Fehler beim Speichern");
      }

      toast({
        title: "Gespeichert",
        description: "Benachrichtigungseinstellungen wurden aktualisiert",
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Speichern der Einstellungen",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
          <CardTitle className="text-lg sm:text-xl">Benachrichtigungseinstellungen</CardTitle>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          Wähle aus, über welche Ereignisse du per E-Mail informiert werden möchtest
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-4">
            {notificationTypes.map((type) => (
              <div
                key={type.key}
                className="flex items-start justify-between gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={type.key}
                      className="text-sm sm:text-base font-semibold cursor-pointer"
                    >
                      {type.label}
                    </Label>
                    {!type.hasTemplate && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
                        Template fehlt
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {type.description}
                  </p>
                </div>
                <Switch
                  id={type.key}
                  checked={preferences[type.key]}
                  onCheckedChange={() => handleToggle(type.key)}
                  className="flex-shrink-0"
                  disabled={!type.hasTemplate}
                />
              </div>
            ))}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Speichert..." : "Einstellungen speichern"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

