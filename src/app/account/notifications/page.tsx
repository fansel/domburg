"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Save, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/navbar";
import { BackButton } from "@/components/admin/back-button";

interface NotificationPreferences {
  newBooking: boolean;
  bookingApproved: boolean;
  bookingRejected: boolean;
  bookingConflict: boolean;
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

export default function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    newBooking: true,
    bookingApproved: false,
    bookingRejected: false,
    bookingConflict: false, // Standard: deaktiviert
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        // Prüfe Auth
        const authRes = await fetch("/api/auth/check");
        const authData = await authRes.json();
        
        if (!authData.authenticated) {
          router.push("/auth/login");
          return;
        }

        setUser(authData.user);

        // Lade Präferenzen
        const prefsRes = await fetch("/api/admin/notification-preferences");
        const prefsData = await prefsRes.json();

        if (prefsData.success && prefsData.preferences) {
          setPreferences(prefsData.preferences);
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

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

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center">Lädt...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-4xl">
        <BackButton href="/admin/bookings" />

        <Card className="mt-4 sm:mt-6">
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
      </div>
    </div>
  );
}

