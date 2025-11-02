"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface PublicUrlManagerProps {
  initialUrl: string;
}

export function PublicUrlManager({ initialUrl }: PublicUrlManagerProps) {
  const [url, setUrl] = useState(initialUrl);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSave = async () => {
    if (!url.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine gültige URL ein",
        variant: "destructive",
      });
      return;
    }

    // URL validieren (einfache Validierung)
    try {
      new URL(url);
    } catch {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine gültige URL ein (z.B. https://hollandhaus.example.com)",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/public-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Gespeichert",
          description: "Öffentliche URL wurde erfolgreich gespeichert",
        });
        router.refresh();
      } else {
        toast({
          title: "Fehler",
          description: data.error || "URL konnte nicht gespeichert werden",
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
          <Globe className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
          <CardTitle className="text-lg sm:text-xl">Öffentliche URL</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Diese URL wird für alle Links in E-Mails verwendet (z.B. Passwort-Zurücksetzen, Buchungslinks)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="publicUrl" className="text-sm font-medium">URL</Label>
          <Input
            id="publicUrl"
            type="url"
            placeholder="https://hollandhaus.example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="text-base"
          />
          <p className="text-xs text-muted-foreground">
            Beispiel: https://hollandhaus.example.com oder http://localhost:3000 (für Entwicklung)
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

