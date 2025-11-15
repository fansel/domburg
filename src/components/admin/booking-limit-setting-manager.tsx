"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Save, Calendar as CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface BookingLimitSettingManagerProps {
  initialDate?: string; // YYYY-MM-DD Format
  initialEnabled?: boolean;
  initialAdvanceEnabled?: boolean; // Oktober-Regel
}

export function BookingLimitSettingManager({ 
  initialDate, 
  initialEnabled = false,
  initialAdvanceEnabled = false 
}: BookingLimitSettingManagerProps) {
  const [date, setDate] = useState(initialDate || "");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [advanceEnabled, setAdvanceEnabled] = useState(initialAdvanceEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Speichere beide Einstellungen parallel
      const [limitResponse, advanceResponse] = await Promise.all([
        fetch("/api/admin/booking-limit-setting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: date || null, enabled }),
        }),
        fetch("/api/admin/booking-advance-setting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: advanceEnabled }),
        }),
      ]);

      const limitData = await limitResponse.json();
      const advanceData = await advanceResponse.json();

      if (limitData.success && advanceData.success) {
        toast({
          title: "Gespeichert",
          description: "Buchungslimit-Einstellungen wurden erfolgreich gespeichert",
        });
        router.refresh();
      } else {
        toast({
          title: "Fehler",
          description: limitData.error || advanceData.error || "Einstellungen konnten nicht gespeichert werden",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Berechne das minimale Datum (heute)
  const today = new Date().toISOString().split('T')[0];

  return (
    <Card>
      <CardHeader className="space-y-2 pb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
          <CardTitle className="text-lg sm:text-xl">Buchungslimits</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Legen Sie fest, bis zu welchem Datum Buchungen erlaubt sind. Sie können ein explizites Datum setzen oder die automatische Oktober-Regel verwenden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-1 flex-1">
            <Label htmlFor="booking-limit-enabled" className="text-sm font-medium cursor-pointer">
              Explizites Buchungslimit aktivieren
            </Label>
            <p className="text-xs text-muted-foreground">
              Wenn aktiviert, können Buchungen nur bis zum angegebenen Datum erstellt werden.
            </p>
          </div>
          <Switch
            id="booking-limit-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
        
        {enabled && (
          <div className="space-y-2">
            <Label htmlFor="booking-limit-date" className="text-sm font-medium">
              Buchungen erlauben bis
            </Label>
            <Input
              id="booking-limit-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={today}
              className="w-full sm:w-auto"
            />
            <p className="text-xs text-muted-foreground">
              {date 
                ? `Buchungen sind bis zum ${new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} erlaubt.`
                : "Bitte wählen Sie ein Datum aus."}
            </p>
          </div>
        )}
        
        {!enabled && (
          <p className="text-xs text-muted-foreground">
            Explizites Buchungslimit ist deaktiviert. Andere Limit-Regeln können weiterhin aktiv sein.
          </p>
        )}
        
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1 flex-1">
              <Label htmlFor="booking-advance-enabled" className="text-sm font-medium cursor-pointer">
                Ab Oktober für das ganze nächste Jahr
              </Label>
              <p className="text-xs text-muted-foreground">
                Wenn aktiviert: Ab Oktober können Gäste für das komplette nächste Jahr (1. Januar bis 31. Dezember) buchen.
                <br />
                Wenn deaktiviert: Gäste können für das aktuelle Jahr und den Rest des Jahres buchen.
              </p>
            </div>
            <Switch
              id="booking-advance-enabled"
              checked={advanceEnabled}
              onCheckedChange={setAdvanceEnabled}
            />
          </div>
        </div>
        
        {!enabled && !advanceEnabled && (
          <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-lg p-3">
            <strong>Hinweis:</strong> Beide Limits sind deaktiviert. Buchungen sind unbegrenzt möglich.
          </p>
        )}
        
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Speichere..." : "Speichern"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}



