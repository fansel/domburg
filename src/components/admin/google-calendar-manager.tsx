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
  cleanupBookingEvents,
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
  const [isCleaning, setIsCleaning] = useState(false);
  
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
      const created = result.createdCount || 0;
      const updated = result.updatedCount || 0;
      const deleted = result.deletedCount || 0;
      const syncedFromCalendar = result.syncedFromCalendarCount || 0;
      
      const parts: string[] = [];
      if (created > 0) parts.push(`${created} erstellt`);
      if (updated > 0) parts.push(`${updated} aktualisiert`);
      if (deleted > 0) parts.push(`${deleted} gelöscht`);
      if (syncedFromCalendar > 0) parts.push(`${syncedFromCalendar} vom Kalender synchronisiert`);
      
      const description = parts.length > 0 
        ? `Events: ${parts.join(", ")}`
        : "Alle Events sind bereits synchronisiert";
      
      toast({
        title: "Synchronisiert",
        description,
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

  const handleCleanup = async () => {
    if (!confirm('Alle Buchungs-Events aus dem Kalender löschen? (Manuelle Blockierungen bleiben erhalten)')) {
      return;
    }

    setIsCleaning(true);
    
    const result = await cleanupBookingEvents();

    if (result.success) {
      toast({
        title: "Bereinigt",
        description: `${result.deletedCount} Buchungs-Event(s) aus ${result.totalEvents} Events gelöscht`,
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Bereinigung fehlgeschlagen",
        variant: "destructive",
      });
    }
    
    setIsCleaning(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <CardTitle className="text-lg sm:text-xl">{t("settings.googleCalendarIntegration")}</CardTitle>
            </div>
            {isConnected ? (
              <Badge variant="default" className="gap-2 flex-shrink-0">
                <CheckCircle className="h-3 w-3" />
                {t("admin.connected")}
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-2 flex-shrink-0">
                <XCircle className="h-3 w-3" />
                {t("admin.notConnected")}
              </Badge>
            )}
          </div>
          <CardDescription className="text-sm">
            {t("settings.googleCalendarDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Calendar ID */}
          <div className="space-y-2">
            <Label htmlFor="calendarId" className="text-sm font-medium">{t("settings.calendarIdLabel")}</Label>
            <Input
              id="calendarId"
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              placeholder="beispiel@group.calendar.google.com"
              className="text-base"
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.calendarIdHint")}
            </p>
          </div>

          {/* Service Account JSON */}
          <div className="space-y-2">
            <Label htmlFor="serviceAccountJson" className="text-sm font-medium">
              {t("settings.serviceAccountLabel")}
              {initialSettings.serviceAccountEmail && (
                <span className="text-xs text-muted-foreground ml-2 block sm:inline">
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
                <Loader2 className="h-4 w-4 animate-spin" />
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
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("admin.testConnection")
              )}
            </Button>

            {isConnected && (
              <>
                <Button 
                  variant="secondary" 
                  onClick={handleSyncAll} 
                  disabled={isSyncing || isCleaning}
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("admin.syncAll")
                  )}
                </Button>
                
                <Button 
                  variant="destructive" 
                  onClick={handleCleanup} 
                  disabled={isCleaning || isSyncing}
                >
                  {isCleaning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Bereinige...
                    </>
                  ) : (
                    "Kalender bereinigen"
                  )}
                </Button>
              </>
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

