"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Save, Calendar as CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface BookingLimitSettingManagerProps {
  initialDate?: string; // YYYY-MM-DD Format
}

export function BookingLimitSettingManager({ initialDate }: BookingLimitSettingManagerProps) {
  const [date, setDate] = useState(initialDate || "");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/booking-limit-setting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: date || null }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Gespeichert",
          description: "Einstellung für Buchungslimit wurde erfolgreich gespeichert",
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

  // Berechne das minimale Datum (heute)
  const today = new Date().toISOString().split('T')[0];

  return (
    <Card>
      <CardHeader className="space-y-2 pb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
          <CardTitle className="text-lg sm:text-xl">Buchungen erlauben bis</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Legen Sie fest, bis zu welchem Datum Buchungen erlaubt sind. Nach diesem Datum können keine neuen Buchungen mehr erstellt werden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
              : "Kein Limit gesetzt - Buchungen sind unbegrenzt erlaubt."}
          </p>
          <p className="text-xs text-muted-foreground">
            Tipp: Lassen Sie das Feld leer, um Buchungen unbegrenzt zu erlauben.
          </p>
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

