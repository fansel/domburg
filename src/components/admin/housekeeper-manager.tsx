"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Plus, X, Edit, Save, User } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

interface Housekeeper {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

interface HousekeeperManagerProps {
  lastSentAt?: string | null;
  onHousekeepersChange?: () => void;
}

export function HousekeeperManager({ 
  lastSentAt = null,
  onHousekeepersChange
}: HousekeeperManagerProps) {
  const { t } = useTranslation();
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [lastSent, setLastSent] = useState<string | null>(lastSentAt);
  const { toast } = useToast();

  // Update lastSent when prop changes
  useEffect(() => {
    setLastSent(lastSentAt);
  }, [lastSentAt]);

  // Load housekeepers on mount
  useEffect(() => {
    loadHousekeepers();
  }, []);

  const loadHousekeepers = async () => {
    try {
      const response = await fetch("/api/admin/housekeepers");
      if (response.ok) {
        const data = await response.json();
        setHousekeepers(data.housekeepers || []);
        if (data.lastSentAt) {
          setLastSent(data.lastSentAt);
        } else if (lastSentAt) {
          setLastSent(lastSentAt);
        }
      }
    } catch (error) {
      console.error("Error loading housekeepers:", error);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddHousekeeper = async () => {
    const trimmedName = newName.trim();
    const trimmedEmail = newEmail.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      toast({
        title: t("errors.general"),
        description: "Name und E-Mail-Adresse sind erforderlich",
        variant: "destructive",
      });
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      toast({
        title: t("errors.general"),
        description: t("errors.invalidEmail"),
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/admin/housekeepers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fehler beim Erstellen");
      }

      const data = await response.json();
      setHousekeepers([...housekeepers, data.housekeeper]);
      setNewName("");
      setNewEmail("");
      onHousekeepersChange?.();
      toast({
        title: "Erfolg",
        description: "Housekeeper hinzugefügt",
      });
    } catch (error: any) {
      toast({
        title: t("errors.general"),
        description: error.message || "Fehler beim Hinzufügen",
        variant: "destructive",
      });
    }
  };

  const handleStartEdit = (housekeeper: Housekeeper) => {
    setEditingId(housekeeper.id);
    setEditName(housekeeper.name);
    setEditEmail(housekeeper.email);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditEmail("");
  };

  const handleSaveEdit = async (id: string) => {
    const trimmedName = editName.trim();
    const trimmedEmail = editEmail.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      toast({
        title: t("errors.general"),
        description: "Name und E-Mail-Adresse sind erforderlich",
        variant: "destructive",
      });
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      toast({
        title: t("errors.general"),
        description: t("errors.invalidEmail"),
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/admin/housekeepers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id, 
          name: trimmedName, 
          email: trimmedEmail,
          isActive: true 
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fehler beim Aktualisieren");
      }

      const data = await response.json();
      setHousekeepers(housekeepers.map(h => h.id === id ? data.housekeeper : h));
      setEditingId(null);
      onHousekeepersChange?.();
      toast({
        title: "Erfolg",
        description: "Housekeeper aktualisiert",
      });
    } catch (error: any) {
      toast({
        title: t("errors.general"),
        description: error.message || "Fehler beim Aktualisieren",
        variant: "destructive",
      });
    }
  };

  const handleDeleteHousekeeper = async (id: string) => {
    if (!confirm("Möchten Sie diesen Housekeeper wirklich löschen?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/housekeepers?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Fehler beim Löschen");
      }

      setHousekeepers(housekeepers.filter(h => h.id !== id));
      onHousekeepersChange?.();
      toast({
        title: "Erfolg",
        description: "Housekeeper gelöscht",
      });
    } catch (error) {
      toast({
        title: t("errors.general"),
        description: "Fehler beim Löschen",
        variant: "destructive",
      });
    }
  };

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Housekeeper Profile
        </CardTitle>
        <CardDescription>
          Verwalten Sie Housekeeper-Profile mit Namen und E-Mail-Adressen. Jeder Housekeeper erhält personalisierte E-Mails.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Neuen Housekeeper hinzufügen */}
        <div className="space-y-4">
          <Label>Neuen Housekeeper hinzufügen</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newEmail) {
                  handleAddHousekeeper();
                }
              }}
            />
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName) {
                    handleAddHousekeeper();
                  }
                }}
              />
              <Button onClick={handleAddHousekeeper} type="button">
                <Plus className="h-4 w-4 mr-2" />
                Hinzufügen
              </Button>
            </div>
          </div>
        </div>

        {/* Liste der Housekeeper */}
        {housekeepers.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              Housekeeper Profile ({housekeepers.length})
            </Label>
            <div className="space-y-2">
              {housekeepers.map((housekeeper) => (
                <div
                  key={housekeeper.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-md bg-muted/50"
                >
                  {editingId === housekeeper.id ? (
                    <>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Name"
                        />
                        <Input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="email@example.com"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleSaveEdit(housekeeper.id)}
                          size="sm"
                          type="button"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Speichern
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          variant="outline"
                          size="sm"
                          type="button"
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">{housekeeper.name}</div>
                          <div className="text-sm text-muted-foreground">{housekeeper.email}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleStartEdit(housekeeper)}
                          variant="outline"
                          size="sm"
                          type="button"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteHousekeeper(housekeeper.id)}
                          variant="outline"
                          size="sm"
                          type="button"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {housekeepers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Noch keine Housekeeper-Profile hinzugefügt
          </p>
        )}

        {/* Letztes Versanddatum */}
        <div className="space-y-2">
          <Label>Letzte Benachrichtigung</Label>
          <p className="text-sm text-muted-foreground">
            {formatDate(lastSent)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

