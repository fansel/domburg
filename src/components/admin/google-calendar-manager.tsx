"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  updateGoogleCalendarSettings,
  testGoogleCalendarConnection,
  syncAllBookingsToCalendar,
} from "@/app/actions/google-calendar";

interface GoogleCalendarManagerProps {
  initialSettings: {
    calendarId?: string;
    serviceAccountEmail?: string;
    isConnected?: boolean;
  };
}

export function GoogleCalendarManager({ initialSettings }: GoogleCalendarManagerProps) {
  const { t } = useTranslation();
  const [calendarId, setCalendarId] = useState(initialSettings.calendarId || "");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [isConnected, setIsConnected] = useState(initialSettings.isConnected || false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const { toast } = useToast();

  const handleSave = async () => {
    if (!calendarId.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte Calendar-ID eingeben",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    const result = await updateGoogleCalendarSettings({
      calendarId,
      serviceAccountJson: serviceAccountJson.trim() || undefined,
    });

    if (result.success) {
      setIsConnected(true);
      toast({
        title: "Gespeichert",
        description: "Google Calendar Einstellungen wurden gespeichert",
      });
      if (serviceAccountJson.trim()) {
        setServiceAccountJson(""); // Clear after successful save
      }
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Fehler beim Speichern",
        variant: "destructive",
      });
    }
    
    setIsSaving(false);
  };

  const handleTestConnection = async () => {
    if (!calendarId.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte speichern Sie zuerst die Einstellungen",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    
    const result = await testGoogleCalendarConnection();

    if (result.success) {
      setIsConnected(true);
      toast({
        title: "Verbindung erfolgreich",
        description: `Verbunden mit: ${result.calendarName}`,
      });
    } else {
      setIsConnected(false);
      toast({
        title: "Verbindungsfehler",
        description: result.error || "Verbindung fehlgeschlagen",
        variant: "destructive",
      });
    }
    
    setIsTesting(false);
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    
    const result = await syncAllBookingsToCalendar();

    if (result.success) {
      toast({
        title: "Synchronisiert",
        description: `${result.syncedCount || 0} Buchung(en) synchronisiert`,
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Synchronisation fehlgeschlagen",
        variant: "destructive",
      });
    }
    
    setIsSyncing(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t("settings.googleCalendarIntegration")}
              </CardTitle>
              <CardDescription className="mt-2">
                {t("settings.googleCalendarDescription")}
              </CardDescription>
            </div>
            {isConnected ? (
              <Badge variant="default" className="gap-2">
                <CheckCircle className="h-3 w-3" />
                {t("admin.connected")}
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-2">
                <XCircle className="h-3 w-3" />
                {t("admin.notConnected")}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Calendar ID */}
          <div className="space-y-2">
            <Label htmlFor="calendarId">{t("settings.calendarIdLabel")}</Label>
            <Input
              id="calendarId"
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              placeholder="beispiel@group.calendar.google.com"
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.calendarIdHint")}
            </p>
          </div>

          {/* Service Account JSON */}
          <div className="space-y-2">
            <Label htmlFor="serviceAccountJson">
              {t("settings.serviceAccountLabel")}
              {initialSettings.serviceAccountEmail && (
                <span className="text-xs text-muted-foreground ml-2">
                  {t("settings.currentServiceAccount")}: {initialSettings.serviceAccountEmail}
                </span>
              )}
            </Label>
            <Textarea
              id="serviceAccountJson"
              value={serviceAccountJson}
              onChange={(e) => setServiceAccountJson(e.target.value)}
              placeholder='{"type": "service_account", "project_id": "...", ...}'
              rows={8}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.serviceAccountHint")}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                t("settings.saveSettings")
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleTestConnection} 
              disabled={isTesting || !calendarId.trim()}
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                t("admin.testConnection")
              )}
            </Button>

            {isConnected && (
              <Button 
                variant="secondary" 
                onClick={handleSyncAll} 
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("common.loading")}
                  </>
                ) : (
                  t("admin.syncAll")
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("settings.setupInstructions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <h4 className="font-semibold mb-1">1. {t("settings.setupStep1")}</h4>
            <p className="text-muted-foreground">
              {t("settings.setupStep1Description")}
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-1">2. {t("settings.setupStep2")}</h4>
            <p className="text-muted-foreground">
              {t("settings.setupStep2Description")}
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-1">3. {t("settings.setupStep3")}</h4>
            <p className="text-muted-foreground">
              {t("settings.setupStep3Description")}
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-1">4. {t("settings.setupStep4")}</h4>
            <p className="text-muted-foreground">
              {t("settings.setupStep4Description")}
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-1">5. {t("settings.setupStep5")}</h4>
            <p className="text-muted-foreground">
              {t("settings.setupStep5Description")}
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-1">6. {t("settings.setupStep6")}</h4>
            <p className="text-muted-foreground">
              {t("settings.setupStep6Description")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

