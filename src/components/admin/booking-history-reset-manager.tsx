"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trash2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";

export function BookingHistoryResetManager() {
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleReset = async () => {
    try {
      setIsResetting(true);

      const response = await fetch("/api/admin/bookings/reset-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Fehler beim Zurücksetzen");
      }

      toast({
        title: "Erfolgreich",
        description: `Buchungsgeschichte wurde zurückgesetzt. ${data.deletedCount} Buchungen gelöscht.`,
      });

      router.refresh();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Zurücksetzen der Buchungsgeschichte",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Buchungsgeschichte zurücksetzen
        </CardTitle>
        <CardDescription>
          Löscht alle Buchungen (genehmigte, stornierte, abgelehnte, etc.) aber behält manuelle Kalendereinträge.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-destructive mb-2">Warnung</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Alle Buchungen werden unwiderruflich gelöscht</li>
                  <li>• Manuelle Kalendereinträge bleiben erhalten</li>
                  <li>• Google Calendar Events von Buchungen werden gelöscht</li>
                  <li>• Diese Aktion kann nicht rückgängig gemacht werden</li>
                </ul>
              </div>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isResetting}>
                <Trash2 className="h-4 w-4 mr-2" />
                Buchungsgeschichte zurücksetzen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Buchungsgeschichte wirklich zurücksetzen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Diese Aktion löscht alle Buchungen aus der Datenbank:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Genehmigte Buchungen</li>
                    <li>Stornierte Buchungen</li>
                    <li>Abgelehnte Buchungen</li>
                    <li>Anstehende Anfragen</li>
                  </ul>
                  <p className="mt-2 font-medium">
                    Manuelle Kalendereinträge werden NICHT gelöscht.
                  </p>
                  <p className="mt-2 text-destructive font-semibold">
                    Diese Aktion kann nicht rückgängig gemacht werden!
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isResetting}
                >
                  {isResetting ? "Wird gelöscht..." : "Ja, alle Buchungen löschen"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

