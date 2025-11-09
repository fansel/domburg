"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Calendar, Euro, BarChart3, Home } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { PricingStatistics } from "@/components/admin/pricing-statistics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  updatePricingSetting,
  createPricingPhase,
  updatePricingPhase,
  deletePricingPhase,
  createBeachHutSession,
  updateBeachHutSession,
  deleteBeachHutSession,
} from "@/app/actions/pricing";
import type { PricingPhase, PricingSetting, BeachHutSession } from "@prisma/client";

// Type für konvertierte PricingPhase (Decimal -> number)
type PricingPhaseWithNumbers = Omit<PricingPhase, 'pricePerNight' | 'familyPricePerNight'> & {
  pricePerNight: number;
  familyPricePerNight: number | null;
  minNights?: number | null;
  saturdayToSaturday?: boolean;
};

interface PricingManagerProps {
  initialPhases: PricingPhaseWithNumbers[];
  initialSettings: PricingSetting[];
  initialBeachHutSessions: BeachHutSession[];
}

export function PricingManager({
  initialPhases,
  initialSettings,
  initialBeachHutSessions,
}: PricingManagerProps) {
  const { t } = useTranslation();
  const [phases, setPhases] = useState(initialPhases);
  const [settings, setSettings] = useState(initialSettings);
  const [beachHutSessions, setBeachHutSessions] = useState(initialBeachHutSessions);
  const [editingSetting, setEditingSetting] = useState<string | null>(null);
  const [editingPhase, setEditingPhase] = useState<PricingPhaseWithNumbers | null>(null);
  const [editingSession, setEditingSession] = useState<BeachHutSession | null>(null);
  const [isPhaseDialogOpen, setIsPhaseDialogOpen] = useState(false);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const { toast } = useToast();

  // Settings bearbeiten
  const handleUpdateSetting = async (key: string, value: string) => {
    const result = await updatePricingSetting(key, value);
    if (result.success && result.setting) {
      setSettings(
        settings.map((s) => (s.key === key ? result.setting! : s))
      );
      setEditingSetting(null);
      toast({
        title: "Gespeichert",
        description: "Einstellung wurde aktualisiert",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Fehler beim Speichern",
        variant: "destructive",
      });
    }
  };

  // Phase erstellen/bearbeiten
  const handleSavePhase = async (data: Partial<PricingPhaseWithNumbers>) => {
    if (editingPhase) {
      const result = await updatePricingPhase(editingPhase.id, data);
      if (result.success && result.phase) {
        // Konvertiere Decimal zu number
        const convertedPhase: PricingPhaseWithNumbers = {
          ...result.phase,
          pricePerNight: parseFloat(result.phase.pricePerNight.toString()),
          familyPricePerNight: result.phase.familyPricePerNight ? parseFloat(result.phase.familyPricePerNight.toString()) : null,
          minNights: (result.phase as any).minNights ?? null,
          saturdayToSaturday: (result.phase as any).saturdayToSaturday ?? false,
        };
        const updatedPhases = phases.map((p) => (p.id === editingPhase.id ? convertedPhase : p));
        // Sortiere nach Startdatum
        updatedPhases.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        setPhases(updatedPhases);
        setIsPhaseDialogOpen(false);
        setEditingPhase(null);
        toast({
          title: "Aktualisiert",
          description: "Preisphase wurde aktualisiert",
        });
      } else {
        toast({
          title: "Fehler",
          description: result.error,
          variant: "destructive",
        });
      }
    } else {
      const result = await createPricingPhase(data as any);
      if (result.success && result.phase) {
        // Konvertiere Decimal zu number
        const convertedPhase: PricingPhaseWithNumbers = {
          ...result.phase,
          pricePerNight: parseFloat(result.phase.pricePerNight.toString()),
          familyPricePerNight: result.phase.familyPricePerNight ? parseFloat(result.phase.familyPricePerNight.toString()) : null,
          minNights: (result.phase as any).minNights ?? null,
          saturdayToSaturday: (result.phase as any).saturdayToSaturday ?? false,
        };
        const updatedPhases = [...phases, convertedPhase];
        // Sortiere nach Startdatum
        updatedPhases.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        setPhases(updatedPhases);
        setIsPhaseDialogOpen(false);
        toast({
          title: "Erstellt",
          description: "Preisphase erstellt",
        });
      } else {
        toast({
          title: "Fehler",
          description: result.error,
          variant: "destructive",
        });
      }
    }
  };

  // Phase löschen
  const handleDeletePhase = async (id: string) => {
    if (!confirm("Möchten Sie diese Preisphase wirklich löschen?")) return;

    const result = await deletePricingPhase(id);
    if (result.success) {
      setPhases(phases.filter((p) => p.id !== id));
      toast({
        title: "Gelöscht",
        description: "Preisphase wurde gelöscht",
      });
    }
  };

  // Strandbuden-Saison speichern
  const handleSaveSession = async (data: Partial<BeachHutSession>) => {
    if (editingSession) {
      const result = await updateBeachHutSession(editingSession.id, data);
      if (result.success && result.session) {
        setBeachHutSessions(beachHutSessions.map((s) => (s.id === editingSession.id ? result.session! : s)));
        setIsSessionDialogOpen(false);
        setEditingSession(null);
        toast({
          title: "Aktualisiert",
          description: "Strandbuden-Saison wurde aktualisiert",
        });
      } else {
        toast({
          title: "Fehler",
          description: result.error,
          variant: "destructive",
        });
      }
    } else {
      const result = await createBeachHutSession(data as any);
      if (result.success && result.session) {
        setBeachHutSessions([...beachHutSessions, result.session]);
        setIsSessionDialogOpen(false);
        toast({
          title: "Erstellt",
          description: "Strandbuden-Saison erstellt",
        });
      } else {
        toast({
          title: "Fehler",
          description: result.error,
          variant: "destructive",
        });
      }
    }
  };

  // Strandbuden-Saison löschen
  const handleDeleteSession = async (id: string) => {
    if (!confirm("Möchten Sie diese Strandbuden-Saison wirklich löschen?")) return;

    const result = await deleteBeachHutSession(id);
    if (result.success) {
      setBeachHutSessions(beachHutSessions.filter((s) => s.id !== id));
      toast({
        title: "Gelöscht",
        description: "Strandbuden-Saison wurde gelöscht",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(date));
  };

  const currentYear = new Date().getFullYear();

  // Finde alle Jahre, die in den Preisphasen und Strandbuden-Saisons vorkommen
  const getYearsFromPhases = (): number[] => {
    const yearsSet = new Set<number>();
    
    // Jahre aus Preisphasen
    phases.forEach(phase => {
      const startYear = new Date(phase.startDate).getFullYear();
      const endYear = new Date(phase.endDate).getFullYear();
      
      // Füge alle Jahre zwischen Start und Ende hinzu
      for (let year = startYear; year <= endYear; year++) {
        yearsSet.add(year);
      }
    });
    
    // Jahre aus Strandbuden-Saisons
    beachHutSessions.forEach(session => {
      const startYear = new Date(session.startDate).getFullYear();
      const endYear = new Date(session.endDate).getFullYear();
      
      // Füge alle Jahre zwischen Start und Ende hinzu
      for (let year = startYear; year <= endYear; year++) {
        yearsSet.add(year);
      }
    });
    
    // Füge immer mindestens das aktuelle Jahr und ±1 Jahr hinzu
    yearsSet.add(currentYear - 1);
    yearsSet.add(currentYear);
    yearsSet.add(currentYear + 1);
    
    // Sortiere Jahre aufsteigend
    return Array.from(yearsSet).sort((a, b) => a - b);
  };

  const availableYears = getYearsFromPhases();
  const defaultYear = availableYears.includes(currentYear) ? currentYear : availableYears[0] || currentYear;

  // Gruppiere Phasen nach Jahren
  // Eine Phase kann in mehreren Jahren erscheinen, wenn sie über Jahresgrenzen geht
  const getPhasesForYear = (year: number): PricingPhaseWithNumbers[] => {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);
    
    return phases.filter(phase => {
      const phaseStart = new Date(phase.startDate);
      const phaseEnd = new Date(phase.endDate);
      
      // Phase wird angezeigt, wenn sie sich mit dem Jahr überschneidet
      return phaseStart <= yearEnd && phaseEnd >= yearStart;
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  };

  // Gruppiere Strandbuden-Saisons nach Jahren
  const getSessionsForYear = (year: number): BeachHutSession[] => {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);
    
    return beachHutSessions.filter(session => {
      const sessionStart = new Date(session.startDate);
      const sessionEnd = new Date(session.endDate);
      
      // Saison wird angezeigt, wenn sie sich mit dem Jahr überschneidet
      return sessionStart <= yearEnd && sessionEnd >= yearStart;
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  };

  return (
    <Tabs defaultValue="prices" className="space-y-4 sm:space-y-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="prices" className="flex items-center gap-2">
          <Euro className="h-4 w-4" />
          <span className="hidden sm:inline">Preise</span>
          <span className="sm:hidden">Preise</span>
        </TabsTrigger>
        <TabsTrigger value="statistics" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Statistiken</span>
          <span className="sm:hidden">Stats</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="prices" className="space-y-4 sm:space-y-6 mt-6">
        {/* Grundeinstellungen */}
      <Card>
        <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Euro className="h-4 w-4 sm:h-5 sm:w-5" />
            {t("pricing.baseSettings")}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {t("pricing.basePricesDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
            {settings.map((setting) => (
              <SettingCard
                key={setting.id}
                setting={setting}
                isEditing={editingSetting === setting.key}
                onEdit={() => setEditingSetting(setting.key)}
                onCancel={() => setEditingSetting(null)}
                onSave={(value) => handleUpdateSetting(setting.key, value)}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preisphasen und Strandbuden-Saisons */}
      <Card>
        <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                {t("pricing.phases")} & Strandbuden-Saisons
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t("pricing.phasesDescription")}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <PhaseDialog
                isOpen={isPhaseDialogOpen}
                onOpenChange={(open) => {
                  setIsPhaseDialogOpen(open);
                  if (!open) setEditingPhase(null);
                }}
                phase={editingPhase}
                onSave={handleSavePhase}
              />
              <BeachHutSessionDialog
                isOpen={isSessionDialogOpen}
                onOpenChange={(open) => {
                  setIsSessionDialogOpen(open);
                  if (!open) setEditingSession(null);
                }}
                session={editingSession}
                onSave={handleSaveSession}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          {phases.length === 0 && beachHutSessions.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Calendar className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">
                Keine Preisphasen oder Strandbuden-Saisons definiert
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground">
                Der Basispreis wird für alle Zeiträume verwendet
              </p>
            </div>
          ) : (
            <Tabs defaultValue={`year-${defaultYear}`} className="space-y-4">
              <TabsList className={`grid w-full gap-1 sm:gap-2 overflow-x-auto ${
                availableYears.length === 1 ? 'grid-cols-1' :
                availableYears.length === 2 ? 'grid-cols-2' :
                availableYears.length === 3 ? 'grid-cols-3' :
                availableYears.length === 4 ? 'grid-cols-2 sm:grid-cols-4' :
                'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6'
              }`}>
                {availableYears.map((year) => (
                  <TabsTrigger key={year} value={`year-${year}`} className="flex-shrink-0">
                    {year}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {availableYears.map((year) => {
                const yearPhases = getPhasesForYear(year);
                const yearSessions = getSessionsForYear(year);
                const hasContent = yearPhases.length > 0 || yearSessions.length > 0;
                
                return (
                  <TabsContent key={year} value={`year-${year}`} className="space-y-4 sm:space-y-6 mt-4">
                    {!hasContent ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Keine Preisphasen oder Strandbuden-Saisons für {year}
                      </div>
                    ) : (
                      <>
                        {/* Preisphasen für dieses Jahr */}
                        {yearPhases.length > 0 && (
                          <div className="space-y-2 sm:space-y-3">
                            <h3 className="text-sm sm:text-base font-semibold text-muted-foreground mb-2">
                              Preisphasen
                            </h3>
                            {yearPhases.map((phase) => (
                              <PhaseCard
                                key={phase.id}
                                phase={phase}
                                formatDate={formatDate}
                                formatCurrency={formatCurrency}
                                t={t}
                                onEdit={() => {
                                  setEditingPhase(phase);
                                  setIsPhaseDialogOpen(true);
                                }}
                                onDelete={() => handleDeletePhase(phase.id)}
                              />
                            ))}
                          </div>
                        )}
                        
                        {/* Strandbuden-Saisons für dieses Jahr */}
                        {yearSessions.length > 0 && (
                          <div className="space-y-2 sm:space-y-3">
                            <h3 className="text-sm sm:text-base font-semibold text-muted-foreground mb-2">
                              Strandbuden-Saisons
                            </h3>
                            {yearSessions.map((session) => (
                              <div
                                key={session.id}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                              >
                                <div className="space-y-1 flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                    <p className="font-medium text-sm sm:text-base">{session.name}</p>
                                    {session.isActive ? (
                                      <Badge variant="default" className="text-[10px] sm:text-xs">Aktiv</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[10px] sm:text-xs">Inaktiv</Badge>
                                    )}
                                  </div>
                                  {session.description && (
                                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                                      {session.description}
                                    </p>
                                  )}
                                  <p className="text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
                                    {formatDate(session.startDate)} - {formatDate(session.endDate)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                      setEditingSession(session);
                                      setIsSessionDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleDeleteSession(session.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="statistics" className="space-y-4 sm:space-y-6 mt-6">
        <PricingStatistics currentYear={currentYear} />
      </TabsContent>
    </Tabs>
  );
}

// Phase Card Component
const PhaseCard = ({
  phase,
  formatDate,
  formatCurrency,
  t,
  onEdit,
  onDelete,
}: {
  phase: PricingPhaseWithNumbers;
  formatDate: (date: Date) => string;
  formatCurrency: (value: number) => string;
  t: (key: string) => string;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="space-y-1 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <p className="font-medium text-sm sm:text-base">{phase.name}</p>
          {phase.isActive ? (
            <Badge variant="default" className="text-[10px] sm:text-xs">{t("pricing.active")}</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] sm:text-xs">{t("common.no")}</Badge>
          )}
          <Badge variant="outline" className="text-[10px] sm:text-xs">{t("pricing.priority")}: {phase.priority}</Badge>
        </div>
        {phase.description && (
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
            {phase.description}
          </p>
        )}
        <p className="text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
          {formatDate(phase.startDate)} - {formatDate(phase.endDate)}
        </p>
      </div>
      <div className="flex items-start sm:items-center justify-between sm:justify-end gap-3 sm:gap-4">
        <div className="text-left sm:text-right space-y-1 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div>
              <div className="text-base sm:text-lg lg:text-xl font-bold">
                {formatCurrency(phase.pricePerNight)}
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t("settings.standard")}</p>
            </div>
            {phase.familyPricePerNight && (
              <div className="border-l pl-2 sm:pl-3">
                <div className="text-base sm:text-lg lg:text-xl font-bold text-green-700">
                  {formatCurrency(phase.familyPricePerNight)}
                </div>
                <p className="text-[10px] sm:text-xs text-green-700">{t("settings.family")}</p>
              </div>
            )}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{t("pricing.perNight")}</p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onEdit}
          >
            <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// Setting Card Component  
const SettingCard = ({
  setting,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  formatCurrency,
}: {
  setting: PricingSetting;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (value: string) => void;
  formatCurrency: (value: number) => string;
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(setting.value);
  const [value2, setValue2] = useState(setting.value2 || "");
  const isPrice = setting.key.includes("price") || setting.key.includes("fee");
  const hasDualPrice = setting.value2 !== null && isPrice && setting.key === "base_price_per_night";

  // Aktualisiere Werte wenn setting sich ändert oder Bearbeitungsmodus aktiviert wird
  useEffect(() => {
    if (isEditing) {
      setValue(setting.value);
      setValue2(setting.value2 || "");
    }
  }, [setting.value, setting.value2, isEditing]);

  return (
    <div className="flex flex-col p-3 sm:p-4 border rounded-lg space-y-2 sm:space-y-3">
      <div className="flex-1">
        <p className="font-medium text-sm sm:text-base">{setting.description || setting.key}</p>
      </div>
      
      {hasDualPrice ? (
        // Dual-Preis Anzeige (Standard / Family)
        <div className="space-y-2">
          {isEditing ? (
            <>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <Label className="w-16 sm:w-20 text-[11px] sm:text-xs">{t("settings.standard")}:</Label>
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="flex-1 text-sm sm:text-base"
                  step="0.01"
                />
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <Label className="w-16 sm:w-20 text-[11px] sm:text-xs">{t("settings.family")}:</Label>
                <Input
                  type="number"
                  value={value2}
                  onChange={(e) => setValue2(e.target.value)}
                  className="flex-1 text-sm sm:text-base"
                  step="0.01"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button size="sm" className="text-xs sm:text-sm h-8 sm:h-9" onClick={() => onSave(value)}>
                  {t("common.save")}
                </Button>
                <Button size="sm" variant="outline" className="text-xs sm:text-sm h-8 sm:h-9" onClick={onCancel}>
                  {t("common.cancel")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-muted-foreground">{t("settings.standard")}:</span>
                <span className="text-base sm:text-lg font-bold">{formatCurrency(parseFloat(setting.value))}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-green-700">{t("settings.family")}:</span>
                <span className="text-base sm:text-lg font-bold text-green-700">{formatCurrency(parseFloat(setting.value2 || "0"))}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={onEdit} className="w-full mt-1 text-xs sm:text-sm h-8 sm:h-9">
                <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                {t("common.edit")}
              </Button>
            </>
          )}
        </div>
      ) : (
        // Single-Preis Anzeige
        <div className="flex items-center justify-between gap-2">
          {isEditing ? (
            <>
              <Input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="flex-1 text-sm sm:text-base"
                step={isPrice ? "0.01" : "1"}
              />
              <Button size="sm" className="text-xs sm:text-sm h-8 sm:h-9" onClick={() => onSave(value)}>
                {t("common.save")}
              </Button>
              <Button size="sm" variant="outline" className="text-xs sm:text-sm h-8 sm:h-9" onClick={onCancel}>
                {t("common.cancel")}
              </Button>
            </>
          ) : (
            <>
              <div className="text-base sm:text-lg font-bold">
                {isPrice ? formatCurrency(parseFloat(setting.value)) : setting.value}
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onEdit}>
                <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Phase Dialog Component
const PhaseDialog = ({
  isOpen,
  onOpenChange,
  phase,
  onSave,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  phase: PricingPhaseWithNumbers | null;
  onSave: (data: Partial<PricingPhaseWithNumbers>) => void;
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<PricingPhaseWithNumbers>>({
    name: "",
    description: "",
    pricePerNight: 0,
    familyPricePerNight: null,
    startDate: new Date(),
    endDate: new Date(),
    priority: 1,
    isActive: true,
    minNights: null,
    saturdayToSaturday: false,
  });

  // Aktualisiere formData wenn phase sich ändert
  useEffect(() => {
    if (phase) {
      // Cast zu any um Zugriff auf neue Felder zu ermöglichen (falls Prisma-Typen noch nicht aktualisiert wurden)
      const phaseWithNewFields = phase as any;
      setFormData({
        name: phase.name || "",
        description: phase.description || "",
        pricePerNight: phase.pricePerNight || 0,
        familyPricePerNight: phase.familyPricePerNight || null,
        startDate: phase.startDate ? new Date(phase.startDate) : new Date(),
        endDate: phase.endDate ? new Date(phase.endDate) : new Date(),
        priority: phase.priority || 1,
        isActive: phase.isActive ?? true,
        // Explizit neue Felder laden (mit Type-Assertion)
        minNights: phaseWithNewFields.minNights !== undefined ? phaseWithNewFields.minNights : null,
        saturdayToSaturday: phaseWithNewFields.saturdayToSaturday !== undefined ? phaseWithNewFields.saturdayToSaturday : false,
      });
    } else {
      // Reset für neue Phase
      setFormData({
        name: "",
        description: "",
        pricePerNight: 0,
        familyPricePerNight: null,
        startDate: new Date(),
        endDate: new Date(),
        priority: 1,
        isActive: true,
        minNights: null,
        saturdayToSaturday: false,
      });
    }
  }, [phase]);

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10">
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
          {t("pricing.newPhase")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {phase ? t("pricing.editPhase") : t("pricing.newPhase")}
          </DialogTitle>
          <DialogDescription>
            {t("pricing.phasesDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs sm:text-sm">{t("pricing.phaseName")}</Label>
            <Input
              id="name"
              placeholder="z.B. Hochsaison 2025"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="text-sm sm:text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs sm:text-sm">{t("settings.description")} ({t("booking.optional")})</Label>
            <Textarea
              id="description"
              placeholder="Zusätzliche Informationen..."
              value={formData.description || ""}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="text-sm sm:text-base"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-xs sm:text-sm">{t("calendar.from")}</Label>
              <Input
                id="startDate"
                type="date"
                value={
                  formData.startDate && !isNaN(new Date(formData.startDate).getTime())
                    ? new Date(formData.startDate).toISOString().split("T")[0]
                    : ""
                }
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : null;
                  if (date && !isNaN(date.getTime())) {
                    setFormData({
                      ...formData,
                      startDate: date,
                    });
                  }
                }}
                className="text-sm sm:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-xs sm:text-sm">{t("calendar.to")}</Label>
              <Input
                id="endDate"
                type="date"
                value={
                  formData.endDate && !isNaN(new Date(formData.endDate).getTime())
                    ? new Date(formData.endDate).toISOString().split("T")[0]
                    : ""
                }
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : null;
                  if (date && !isNaN(date.getTime())) {
                    setFormData({ ...formData, endDate: date });
                  }
                }}
                className="text-sm sm:text-base"
              />
            </div>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="price" className="text-xs sm:text-sm">{t("pricing.pricePerNight")} ({t("settings.standard")})</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.pricePerNight?.toString() || "0"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pricePerNight: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="text-sm sm:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="familyPrice" className="text-xs sm:text-sm text-green-700">
                  {t("settings.family")} {t("pricing.pricePerNight")}
                </Label>
                <Input
                  id="familyPrice"
                  type="number"
                  step="0.01"
                  value={formData.familyPricePerNight?.toString() || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      familyPricePerNight: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="text-sm sm:text-base"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority" className="text-xs sm:text-sm">{t("pricing.priority")}</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: parseInt(e.target.value) })
                }
                className="text-sm sm:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minNights" className="text-xs sm:text-sm">Mindestanzahl Nächte (optional)</Label>
              <Input
                id="minNights"
                type="number"
                min="1"
                value={formData.minNights || ""}
                onChange={(e) =>
                  setFormData({ ...formData, minNights: e.target.value ? parseInt(e.target.value) : null })
                }
                placeholder="z.B. 7"
                className="text-sm sm:text-base"
              />
              <p className="text-xs text-muted-foreground">
                Wenn gesetzt, muss mindestens diese Anzahl Nächte gebucht werden
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="saturdayToSaturday"
                checked={formData.saturdayToSaturday || false}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, saturdayToSaturday: checked })
                }
              />
              <Label htmlFor="saturdayToSaturday" className="text-xs sm:text-sm">
                Nur Samstag zu Samstag erlauben
              </Label>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isActive: checked })
              }
            />
            <Label htmlFor="isActive" className="text-xs sm:text-sm">{t("pricing.active")}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit}>
            {phase ? t("common.save") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Beach Hut Saison Dialog Component
const BeachHutSessionDialog = ({
  isOpen,
  onOpenChange,
  session,
  onSave,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  session: BeachHutSession | null;
  onSave: (data: Partial<BeachHutSession>) => void;
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<BeachHutSession>>({
    name: "",
    description: "",
    startDate: new Date(),
    endDate: new Date(),
    isActive: true,
  });

  // Aktualisiere formData wenn session sich ändert
  useEffect(() => {
    if (session) {
      setFormData({
        name: session.name || "",
        description: session.description || "",
        startDate: session.startDate ? new Date(session.startDate) : new Date(),
        endDate: session.endDate ? new Date(session.endDate) : new Date(),
        isActive: session.isActive ?? true,
      });
    } else {
      // Reset für neue Saison
      setFormData({
        name: "",
        description: "",
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
      });
    }
  }, [session]);

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10">
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
          Neue Strandbudensaison
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {session ? "Strandbuden-Saison bearbeiten" : "Neue Strandbuden-Saison"}
          </DialogTitle>
          <DialogDescription>
            Saison definieren, in der die Strandbude verfügbar ist
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
          <div className="space-y-2">
            <Label htmlFor="sessionName" className="text-xs sm:text-sm">Name</Label>
            <Input
              id="sessionName"
              placeholder="z.B. Sommer 2025"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="text-sm sm:text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sessionDescription" className="text-xs sm:text-sm">Beschreibung ({t("booking.optional")})</Label>
            <Textarea
              id="sessionDescription"
              placeholder="Zusätzliche Informationen..."
              value={formData.description || ""}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="text-sm sm:text-base"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="sessionStartDate" className="text-xs sm:text-sm">Von</Label>
              <Input
                id="sessionStartDate"
                type="date"
                value={
                  formData.startDate && !isNaN(new Date(formData.startDate).getTime())
                    ? new Date(formData.startDate).toISOString().split("T")[0]
                    : ""
                }
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : null;
                  if (date && !isNaN(date.getTime())) {
                    setFormData({
                      ...formData,
                      startDate: date,
                    });
                  }
                }}
                className="text-sm sm:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sessionEndDate" className="text-xs sm:text-sm">Bis</Label>
              <Input
                id="sessionEndDate"
                type="date"
                value={
                  formData.endDate && !isNaN(new Date(formData.endDate).getTime())
                    ? new Date(formData.endDate).toISOString().split("T")[0]
                    : ""
                }
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : null;
                  if (date && !isNaN(date.getTime())) {
                    setFormData({ ...formData, endDate: date });
                  }
                }}
                className="text-sm sm:text-base"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="sessionIsActive"
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isActive: checked })
              }
            />
            <Label htmlFor="sessionIsActive" className="text-xs sm:text-sm">Aktiv</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit}>
            {session ? t("common.save") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

