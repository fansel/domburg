"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarIcon, Send, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { HousekeeperManager } from "@/components/admin/housekeeper-manager";
import { HousekeepingCalendar } from "@/components/housekeeping-calendar";

interface Housekeeper {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

interface AdminHousekeepingViewProps {
  lastSentAt?: string | null;
}

export function AdminHousekeepingView({ 
  lastSentAt = null 
}: AdminHousekeepingViewProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isSending, setIsSending] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(lastSentAt);
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogSelectedHousekeepers, setDialogSelectedHousekeepers] = useState<Set<string>>(new Set());

  // Lade Housekeeper beim Mount
  useEffect(() => {
    loadHousekeepers();
  }, []);

  const loadHousekeepers = async () => {
    try {
      const response = await fetch("/api/admin/housekeepers");
      if (response.ok) {
        const data = await response.json();
        const loadedHousekeepers = (data.housekeepers || []) as Housekeeper[];
        setHousekeepers(loadedHousekeepers);
      }
    } catch (error) {
      console.error("Error loading housekeepers:", error);
    }
  };

  const handleOpenDialog = () => {
    // Beim Öffnen des Dialogs alle aktiven Housekeeper auswählen
    const activeIds = new Set<string>(housekeepers.filter(h => h.isActive).map(h => h.id));
    setDialogSelectedHousekeepers(activeIds);
    setIsDialogOpen(true);
  };

  const handleToggleDialogHousekeeper = (id: string) => {
    setDialogSelectedHousekeepers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleDialogSelectAll = () => {
    const activeIds = housekeepers.filter(h => h.isActive).map(h => h.id);
    setDialogSelectedHousekeepers(new Set(activeIds));
  };

  const handleDialogDeselectAll = () => {
    setDialogSelectedHousekeepers(new Set());
  };

  const handleSendNotification = async (housekeeperIds?: string[]) => {
    setIsSending(true);
    try {
      const response = await fetch("/api/admin/housekeeper-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          housekeeperIds: housekeeperIds
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fehler beim Versenden");
      }

      // Update last sent timestamp
      setLastSent(new Date().toISOString());

      toast({
        title: "Benachrichtigung versendet",
        description: `E-Mail wurde an ${data.sent} Empfänger gesendet`,
      });

      // Dialog schließen wenn von dort gesendet
      if (housekeeperIds) {
        setIsDialogOpen(false);
      }
    } catch (error: any) {
      toast({
        title: t("errors.general"),
        description: error.message || "Fehler beim Versenden der E-Mail",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendFromDialog = async () => {
    if (dialogSelectedHousekeepers.size === 0) {
      toast({
        title: t("errors.general"),
        description: "Bitte wählen Sie mindestens einen Housekeeper aus",
        variant: "destructive",
      });
      return;
    }
    await handleSendNotification(Array.from(dialogSelectedHousekeepers));
  };

  // Format date helper
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "Noch nie";
    
    try {
      const date = new Date(dateString);
      const locale = "nl-NL";
      return date.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Ungültiges Datum";
    }
  };

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header mit Send-Button */}
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                  Housekeeping Kalender
                </CardTitle>
                <CardDescription className="mt-1 sm:mt-2 text-xs sm:text-sm">
                  Übersicht der Ankünfte, Abreisen und belegten Zeiten
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                {lastSent && (
                  <div className="text-xs text-muted-foreground flex items-center">
                    Letzte Benachrichtigung: {formatDate(lastSent)}
                  </div>
                )}
                <div className="flex gap-2">
                <Button
                    onClick={() => handleSendNotification(undefined)}
                  disabled={isSending}
                  className="w-full sm:w-auto"
                >
                  {isSending ? (
                    <>
                      <Mail className="h-4 w-4 mr-2 animate-spin" />
                      Wird versendet...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                        Alle benachrichtigen
                    </>
                  )}
                </Button>
                  <Button
                    onClick={handleOpenDialog}
                    disabled={isSending}
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Auswahl
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Housekeeper-Verwaltung */}
        <HousekeeperManager 
          lastSentAt={lastSent !== null ? lastSent : lastSentAt}
          onHousekeepersChange={loadHousekeepers}
        />

        {/* Kalender - verwendet gemeinsame Komponente */}
        <HousekeepingCalendar showHeader={false} />

        {/* Dialog für Housekeeper-Auswahl */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Housekeeper auswählen</DialogTitle>
              <DialogDescription>
                Wählen Sie die Housekeeper aus, die benachrichtigt werden sollen
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDialogSelectAll}
                  type="button"
                >
                  Alle auswählen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDialogDeselectAll}
                  type="button"
                >
                  Alle abwählen
                </Button>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {housekeepers.filter(h => h.isActive).map((housekeeper) => (
                  <div
                    key={housekeeper.id}
                    className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`dialog-${housekeeper.id}`}
                      checked={dialogSelectedHousekeepers.has(housekeeper.id)}
                      onCheckedChange={() => handleToggleDialogHousekeeper(housekeeper.id)}
                    />
                    <label
                      htmlFor={`dialog-${housekeeper.id}`}
                      className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      <div className="font-medium">{housekeeper.name}</div>
                      <div className="text-xs text-muted-foreground">{housekeeper.email}</div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSending}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSendFromDialog}
                disabled={isSending || dialogSelectedHousekeepers.size === 0}
              >
                {isSending ? (
                  <>
                    <Mail className="h-4 w-4 mr-2 animate-spin" />
                    Wird versendet...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Benachrichtigung senden ({dialogSelectedHousekeepers.size})
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

