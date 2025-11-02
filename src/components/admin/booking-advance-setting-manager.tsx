"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface BookingAdvanceSettingManagerProps {
  initialEnabled: boolean;
}

export function BookingAdvanceSettingManager({ initialEnabled }: BookingAdvanceSettingManagerProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/booking-advance-setting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Gespeichert",
          description: "Einstellung für Vorausplanung wurde erfolgreich gespeichert",
        });
        router.refresh();
      } else {
        toast({
          title: "Fehler",
          description: data.error || "Einstellung konnte nicht gespeichert werden",
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

  return (
    <Card>
      <CardHeader className="space-y-2 pb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
          <CardTitle className="text-lg sm:text-xl">Vorausplanung</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Legen Sie fest, wie weit im Voraus gebucht werden kann
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
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

