"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Mail, Plus, X } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

interface HousekeeperEmailManagerProps {
  initialEmails?: string;
  lastSentAt?: string | null;
}

export function HousekeeperEmailManager({ 
  initialEmails = "", 
  lastSentAt = null 
}: HousekeeperEmailManagerProps) {
  const { t } = useTranslation();
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [lastSent, setLastSent] = useState<string | null>(lastSentAt);
  const { toast } = useToast();

  // Parse initial emails (comma-separated string)
  useEffect(() => {
    if (initialEmails) {
      const parsed = initialEmails
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.length > 0);
      setEmails(parsed);
    }
  }, [initialEmails]);

  // Update lastSent when prop changes
  useEffect(() => {
    setLastSent(lastSentAt);
  }, [lastSentAt]);

  // Load current settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/admin/housekeeper-emails");
      if (response.ok) {
        const data = await response.json();
        if (data.emails) {
          const parsed = data.emails
            .split(",")
            .map((e: string) => e.trim())
            .filter((e: string) => e.length > 0);
          setEmails(parsed);
        }
        if (data.lastSentAt) {
          setLastSent(data.lastSentAt);
        } else if (lastSentAt) {
          // Fallback to prop if API doesn't return it
          setLastSent(lastSentAt);
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed) {
      toast({
        title: t("errors.general"),
        description: "E-Mail-Adresse eingeben",
        variant: "destructive",
      });
      return;
    }

    if (!validateEmail(trimmed)) {
      toast({
        title: t("errors.general"),
        description: t("errors.invalidEmail"),
        variant: "destructive",
      });
      return;
    }

    if (emails.includes(trimmed)) {
      toast({
        title: t("errors.general"),
        description: "Diese E-Mail-Adresse ist bereits vorhanden",
        variant: "destructive",
      });
      return;
    }

    setEmails([...emails, trimmed]);
    setNewEmail("");
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setEmails(emails.filter((e) => e !== emailToRemove));
  };

  const handleSaveEmails = async () => {
    try {
      const response = await fetch("/api/admin/housekeeper-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: emails.join(",") }),
      });

      if (!response.ok) {
        throw new Error("Fehler beim Speichern");
      }

      toast({
        title: t("common.save"),
        description: "E-Mail-Adressen gespeichert",
      });
    } catch (error) {
      toast({
        title: t("errors.general"),
        description: "Fehler beim Speichern der E-Mail-Adressen",
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
          <Mail className="h-5 w-5" />
          Housekeeper E-Mail Benachrichtigungen
        </CardTitle>
        <CardDescription>
          Verwalten Sie E-Mail-Adressen für Cleaning-Personal und senden Sie Benachrichtigungen bei Änderungen am Cleaning-Schedule
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* E-Mail-Adressen verwalten */}
        <div className="space-y-4">
          <Label>Housekeeper E-Mail-Adressen</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="email@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddEmail();
                }
              }}
            />
            <Button onClick={handleAddEmail} type="button">
              <Plus className="h-4 w-4 mr-2" />
              Hinzufügen
            </Button>
          </div>

          {/* Liste der E-Mail-Adressen */}
          {emails.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Aktuelle E-Mail-Adressen ({emails.length})
              </Label>
              <div className="flex flex-wrap gap-2">
                {emails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md"
                  >
                    <span className="text-sm">{email}</span>
                    <button
                      onClick={() => handleRemoveEmail(email)}
                      className="text-muted-foreground hover:text-destructive"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleSaveEmails}
                variant="outline"
                size="sm"
                type="button"
              >
                E-Mail-Adressen speichern
              </Button>
            </div>
          )}

          {emails.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Noch keine E-Mail-Adressen hinzugefügt
            </p>
          )}
        </div>

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

