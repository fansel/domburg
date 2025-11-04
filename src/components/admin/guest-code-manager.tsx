"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Copy, Trash2, Check, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createGuestToken, toggleGuestToken, deleteGuestToken } from "@/app/actions/settings";
import type { GuestAccessToken } from "@prisma/client";
import { useTranslation } from "@/contexts/LanguageContext";

interface GuestCodeManagerProps {
  initialTokens: GuestAccessToken[];
}

export function GuestCodeManager({ initialTokens }: GuestCodeManagerProps) {
  const { t } = useTranslation();
  const [tokens, setTokens] = useState(initialTokens);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newToken, setNewToken] = useState({
    description: "",
    code: "",
    maxUsage: "",
    expiresInDays: "",
    useFamilyPrice: false,
    accessType: "GUEST" as "GUEST" | "CLEANING",
  });
  const { toast } = useToast();

  // Reset newToken wenn Dialog geschlossen wird
  useEffect(() => {
    if (!isCreateOpen) {
      setNewToken({ description: "", code: "", maxUsage: "", expiresInDays: "", useFamilyPrice: false, accessType: "GUEST" });
    }
  }, [isCreateOpen]);

  const handleCreate = async () => {
    if (!newToken.description) {
      toast({
        title: "Fehler",
        description: "Bezeichnung fehlt",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    const result = await createGuestToken({
      description: newToken.description,
      maxUsage: newToken.maxUsage ? parseInt(newToken.maxUsage) : undefined,
      expiresInDays: newToken.expiresInDays ? parseInt(newToken.expiresInDays) : undefined,
      useFamilyPrice: newToken.useFamilyPrice,
      accessType: newToken.accessType,
    });

    if (result.success && result.token) {
      setTokens([result.token, ...tokens]);
      setIsCreateOpen(false);
      setNewToken({ description: "", code: "", maxUsage: "", expiresInDays: "", useFamilyPrice: false, accessType: "GUEST" });
      toast({
        title: "Code erstellt",
        description: "Gäste-Code erstellt",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Code konnte nicht erstellt werden",
        variant: "destructive",
      });
    }
    setIsCreating(false);
  };

  const handleCopy = async (code: string) => {
    try {
      // Prüfe ob Clipboard API verfügbar ist
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
        toast({
          title: "Kopiert",
          description: "Code wurde in die Zwischenablage kopiert",
        });
      } else {
        // Fallback-Methode: Verwende temporäres Input-Element
        const textArea = document.createElement("textarea");
        textArea.value = code;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand("copy");
          if (successful) {
            toast({
              title: "Kopiert",
              description: "Code wurde in die Zwischenablage kopiert",
            });
          } else {
            throw new Error("Copy-Befehl fehlgeschlagen");
          }
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (error) {
      console.error("Fehler beim Kopieren:", error);
      toast({
        title: "Fehler",
        description: "Code konnte nicht kopiert werden. Bitte manuell kopieren.",
        variant: "destructive",
      });
    }
  };

  const handleToggle = async (id: string, currentState: boolean) => {
    const result = await toggleGuestToken(id, !currentState);
    if (result.success && result.token) {
      setTokens(tokens.map((t) => (t.id === id ? result.token! : t)));
      toast({
        title: currentState ? "Deaktiviert" : "Aktiviert",
        description: `Code wurde ${currentState ? "deaktiviert" : "aktiviert"}`,
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Möchten Sie diesen Code wirklich löschen?")) return;

    const result = await deleteGuestToken(id);
    if (result.success) {
      setTokens(tokens.filter((t) => t.id !== id));
      toast({
        title: "Gelöscht",
        description: "Code wurde erfolgreich gelöscht",
      });
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return t("settings.unlimited");
    return new Intl.DateTimeFormat("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(date));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg sm:text-xl">{t("settings.guestAccessCodes")}</CardTitle>
              <CardDescription className="text-sm">
                {t("settings.guestAccessCodesDescription")}
              </CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("settings.newCode")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("settings.addCode")}</DialogTitle>
                  <DialogDescription>
                    {t("settings.guestAccessCodesDescription")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="description">{t("settings.label")}</Label>
                    <Input
                      id="description"
                      placeholder="z.B. Hauptcode 2025"
                      value={newToken.description}
                      onChange={(e) =>
                        setNewToken({ ...newToken, description: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">
                      Code (optional - wird automatisch generiert wenn leer)
                    </Label>
                    <Input
                      id="code"
                      placeholder="z.B. HOLLANDHAUS2024"
                      value={newToken.code}
                      onChange={(e) => {
                        // Automatisch zu Großbuchstaben konvertieren
                        const upperValue = e.target.value.toUpperCase();
                        setNewToken({ ...newToken, code: upperValue });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Wenn leer gelassen, wird automatisch ein Code generiert
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxUsage">
                      Maximale Verwendungen (optional)
                    </Label>
                    <Input
                      id="maxUsage"
                      type="number"
                      placeholder="Unbegrenzt"
                      value={newToken.maxUsage}
                      onChange={(e) =>
                        setNewToken({ ...newToken, maxUsage: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiresInDays">
                      Gültig für (Tage, optional)
                    </Label>
                    <Input
                      id="expiresInDays"
                      type="number"
                      placeholder="Unbegrenzt"
                      value={newToken.expiresInDays}
                      onChange={(e) =>
                        setNewToken({
                          ...newToken,
                          expiresInDays: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accessType" className="text-sm font-medium">
                      Zugangstyp
                    </Label>
                    <select
                      id="accessType"
                      value={newToken.accessType}
                      onChange={(e) =>
                        setNewToken({ ...newToken, accessType: e.target.value as "GUEST" | "CLEANING" })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="GUEST">Normal (Buchungen)</option>
                      <option value="CLEANING">Housekeeper (nur Kalender)</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {newToken.accessType === "CLEANING"
                        ? "Gibt Zugang zum Housekeeper-Kalender (ohne Namen, nur Ankunft/Abreise)"
                        : "Standard-Zugang für Buchungen"}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-4 bg-muted/50">
                    <Switch
                      id="useFamilyPrice"
                      checked={newToken.useFamilyPrice}
                      onCheckedChange={(checked) =>
                        setNewToken({ ...newToken, useFamilyPrice: checked })
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor="useFamilyPrice" className="cursor-pointer font-semibold">
                        Family-Preis aktivieren
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Dieser Code erhält den ermäßigten Family-Preis (120€ statt 180€ pro Nacht)
                      </p>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Abbrechen
                  </Button>
                  <Button onClick={handleCreate} disabled={isCreating}>
                    {isCreating ? "Erstelle..." : "Erstellen"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Keine Gäste-Codes vorhanden
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                <TableRow>
                  <TableHead>{t("settings.label")}</TableHead>
                  <TableHead>{t("settings.code")}</TableHead>
                  <TableHead>{t("settings.status")}</TableHead>
                  <TableHead>{t("settings.uses")}</TableHead>
                  <TableHead>{t("settings.validUntil")}</TableHead>
                  <TableHead className="text-right">{t("settings.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => {
                  const isExpired =
                    token.expiresAt && new Date(token.expiresAt) < new Date();
                  const isMaxUsageReached =
                    token.maxUsage &&
                    token.usageCount >= token.maxUsage;

                  return (
                    <TableRow key={token.id}>
                      <TableCell className="font-medium">
                        {token.description || "Kein Name"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                            {token.token}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(token.token)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          {isExpired || isMaxUsageReached ? (
                            <Badge variant="destructive">Abgelaufen</Badge>
                          ) : token.isActive ? (
                            <Badge variant="default">Aktiv</Badge>
                          ) : (
                            <Badge variant="secondary">Inaktiv</Badge>
                          )}
                          {(token as any).useFamilyPrice && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                              {t("settings.family")}
                            </Badge>
                          )}
                          {(token as any).accessType === 'CLEANING' && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                              Housekeeper
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {token.usageCount}
                        {token.maxUsage && ` / ${token.maxUsage}`}
                      </TableCell>
                      <TableCell>{formatDate(token.expiresAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={token.isActive}
                            onCheckedChange={() =>
                              handleToggle(token.id, token.isActive)
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(token.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {tokens.map((token) => {
                  const isExpired =
                    token.expiresAt && new Date(token.expiresAt) < new Date();
                  const isMaxUsageReached =
                    token.maxUsage &&
                    token.usageCount >= token.maxUsage;

                  return (
                    <Card key={token.id}>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div>
                            <h3 className="font-medium text-base mb-3 break-words">
                              {token.description || "Kein Name"}
                            </h3>
                            <div className="flex items-center gap-2 mb-3">
                              <code className="px-2 py-1.5 bg-muted rounded text-xs font-mono break-all flex-1">
                                {token.token}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 flex-shrink-0"
                                onClick={() => handleCopy(token.token)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {isExpired || isMaxUsageReached ? (
                              <Badge variant="destructive">Abgelaufen</Badge>
                            ) : token.isActive ? (
                              <Badge variant="default">Aktiv</Badge>
                            ) : (
                              <Badge variant="secondary">Inaktiv</Badge>
                            )}
                            {(token as any).useFamilyPrice && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                {t("settings.family")}
                              </Badge>
                            )}
                            {(token as any).accessType === 'CLEANING' && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                                Putzhilfe
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">{t("settings.uses")}</p>
                              <p className="font-medium">
                                {token.usageCount}
                                {token.maxUsage && ` / ${token.maxUsage}`}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">{t("settings.validUntil")}</p>
                              <p className="font-medium">{formatDate(token.expiresAt)}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={token.isActive}
                                onCheckedChange={() =>
                                  handleToggle(token.id, token.isActive)
                                }
                              />
                              <span className="text-sm text-muted-foreground">
                                {token.isActive ? "Aktiv" : "Inaktiv"}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(token.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Löschen
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

