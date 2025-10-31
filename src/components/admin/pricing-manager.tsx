"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Calendar, Euro } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
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
} from "@/app/actions/pricing";
import type { PricingPhase, PricingSetting } from "@prisma/client";

interface PricingManagerProps {
  initialPhases: PricingPhase[];
  initialSettings: PricingSetting[];
}

export function PricingManager({
  initialPhases,
  initialSettings,
}: PricingManagerProps) {
  const { t } = useTranslation();
  const [phases, setPhases] = useState(initialPhases);
  const [settings, setSettings] = useState(initialSettings);
  const [editingSetting, setEditingSetting] = useState<string | null>(null);
  const [editingPhase, setEditingPhase] = useState<PricingPhase | null>(null);
  const [isPhaseDialogOpen, setIsPhaseDialogOpen] = useState(false);
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
  const handleSavePhase = async (data: Partial<PricingPhase>) => {
    if (editingPhase) {
      const result = await updatePricingPhase(editingPhase.id, data);
      if (result.success && result.phase) {
        setPhases(phases.map((p) => (p.id === editingPhase.id ? result.phase! : p)));
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
        setPhases([...phases, result.phase]);
        setIsPhaseDialogOpen(false);
        toast({
          title: "Erstellt",
          description: "Neue Preisphase wurde erstellt",
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

  return (
    <div className="space-y-6">
      {/* Grundeinstellungen */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            {t("pricing.baseSettings")}
          </CardTitle>
          <CardDescription>
            {t("pricing.basePricesDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
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

      {/* Preisphasen */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t("pricing.phases")}
              </CardTitle>
              <CardDescription>
                {t("pricing.phasesDescription")}
              </CardDescription>
            </div>
            <PhaseDialog
              isOpen={isPhaseDialogOpen}
              onOpenChange={(open) => {
                setIsPhaseDialogOpen(open);
                if (!open) setEditingPhase(null);
              }}
              phase={editingPhase}
              onSave={handleSavePhase}
            />
          </div>
        </CardHeader>
        <CardContent>
          {phases.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Keine Preisphasen definiert
              </h3>
              <p className="text-muted-foreground">
                Der Basispreis wird für alle Zeiträume verwendet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {phases.map((phase) => (
                <div
                  key={phase.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{phase.name}</p>
                      {phase.isActive ? (
                        <Badge variant="default">{t("pricing.active")}</Badge>
                      ) : (
                        <Badge variant="secondary">{t("common.no")}</Badge>
                      )}
                      <Badge variant="outline">{t("pricing.priority")}: {phase.priority}</Badge>
                    </div>
                    {phase.description && (
                      <p className="text-sm text-muted-foreground">
                        {phase.description}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {formatDate(phase.startDate)} - {formatDate(phase.endDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right space-y-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="text-xl font-bold">
                            {formatCurrency(parseFloat(phase.pricePerNight.toString()))}
                          </div>
                          <p className="text-xs text-muted-foreground">{t("settings.standard")}</p>
                        </div>
                        {phase.familyPricePerNight && (
                          <div className="border-l pl-3">
                            <div className="text-xl font-bold text-green-700">
                              {formatCurrency(parseFloat(phase.familyPricePerNight.toString()))}
                            </div>
                            <p className="text-xs text-green-700">{t("settings.family")}</p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{t("pricing.perNight")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPhase(phase);
                          setIsPhaseDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePhase(phase.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
    <div className="flex flex-col p-4 border rounded-lg space-y-3">
      <div className="flex-1">
        <p className="font-medium">{setting.description || setting.key}</p>
        <p className="text-xs text-muted-foreground">{setting.key}</p>
      </div>
      
      {hasDualPrice ? (
        // Dual-Preis Anzeige (Standard / Family)
        <div className="space-y-2">
          {isEditing ? (
            <>
              <div className="flex items-center gap-2">
                <Label className="w-20 text-xs">{t("settings.standard")}:</Label>
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="flex-1"
                  step="0.01"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="w-20 text-xs">{t("settings.family")}:</Label>
                <Input
                  type="number"
                  value={value2}
                  onChange={(e) => setValue2(e.target.value)}
                  className="flex-1"
                  step="0.01"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" onClick={() => onSave(value)}>
                  {t("common.save")}
                </Button>
                <Button size="sm" variant="outline" onClick={onCancel}>
                  {t("common.cancel")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("settings.standard")}:</span>
                <span className="text-lg font-bold">{formatCurrency(parseFloat(setting.value))}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-700">{t("settings.family")}:</span>
                <span className="text-lg font-bold text-green-700">{formatCurrency(parseFloat(setting.value2 || "0"))}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={onEdit} className="w-full">
                <Edit className="h-4 w-4 mr-2" />
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
                className="flex-1"
                step={isPrice ? "0.01" : "1"}
              />
              <Button size="sm" onClick={() => onSave(value)}>
                {t("common.save")}
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel}>
                {t("common.cancel")}
              </Button>
            </>
          ) : (
            <>
              <div className="text-lg font-bold">
                {isPrice ? formatCurrency(parseFloat(setting.value)) : setting.value}
              </div>
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4" />
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
  phase: PricingPhase | null;
  onSave: (data: Partial<PricingPhase>) => void;
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<PricingPhase>>({
    name: "",
    description: "",
    pricePerNight: 0,
    familyPricePerNight: 0,
    startDate: new Date(),
    endDate: new Date(),
    priority: 1,
    isActive: true,
  });

  // Aktualisiere formData wenn phase sich ändert
  useEffect(() => {
    if (phase) {
      setFormData({
        name: phase.name || "",
        description: phase.description || "",
        pricePerNight: phase.pricePerNight || 0,
        familyPricePerNight: phase.familyPricePerNight || 0,
        startDate: phase.startDate ? new Date(phase.startDate) : new Date(),
        endDate: phase.endDate ? new Date(phase.endDate) : new Date(),
        priority: phase.priority || 1,
        isActive: phase.isActive ?? true,
      });
    } else {
      // Reset für neue Phase
      setFormData({
        name: "",
        description: "",
        pricePerNight: 0,
        familyPricePerNight: 0,
        startDate: new Date(),
        endDate: new Date(),
        priority: 1,
        isActive: true,
      });
    }
  }, [phase]);

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t("pricing.newPhase")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {phase ? t("pricing.editPhase") : t("pricing.newPhase")}
          </DialogTitle>
          <DialogDescription>
            {t("pricing.phasesDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("pricing.phaseName")}</Label>
            <Input
              id="name"
              placeholder="z.B. Hochsaison 2025"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t("settings.description")} ({t("booking.optional")})</Label>
            <Textarea
              id="description"
              placeholder="Zusätzliche Informationen..."
              value={formData.description || ""}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{t("calendar.from")}</Label>
              <Input
                id="startDate"
                type="date"
                value={
                  formData.startDate
                    ? new Date(formData.startDate).toISOString().split("T")[0]
                    : ""
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    startDate: new Date(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">{t("calendar.to")}</Label>
              <Input
                id="endDate"
                type="date"
                value={
                  formData.endDate
                    ? new Date(formData.endDate).toISOString().split("T")[0]
                    : ""
                }
                onChange={(e) =>
                  setFormData({ ...formData, endDate: new Date(e.target.value) })
                }
              />
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">{t("pricing.pricePerNight")} ({t("settings.standard")})</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.pricePerNight}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pricePerNight: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="familyPrice" className="text-green-700">
                  {t("settings.family")} {t("pricing.pricePerNight")}
                </Label>
                <Input
                  id="familyPrice"
                  type="number"
                  step="0.01"
                  value={formData.familyPricePerNight || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      familyPricePerNight: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">{t("pricing.priority")}</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: parseInt(e.target.value) })
                }
              />
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
            <Label htmlFor="isActive">{t("pricing.active")}</Label>
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

