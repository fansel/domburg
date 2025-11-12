"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface ExposeTextManagerProps {
  initialText: string;
}

export function ExposeTextManager({ initialText }: ExposeTextManagerProps) {
  const [text, setText] = useState(initialText || "");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/expose-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Gespeichert",
          description: "Allgemeiner Text wurde erfolgreich gespeichert",
        });
        router.refresh();
      } else {
        toast({
          title: "Fehler",
          description: data.error || "Text konnte nicht gespeichert werden",
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
          <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
          <CardTitle className="text-lg sm:text-xl">Allgemeiner Text</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Dieser Text wird ZUERST auf der Expose-Seite angezeigt, vor den Bildern. Sie können HTML verwenden (z.B. &lt;p&gt; für Absätze, &lt;h2&gt; für Überschriften, &lt;br&gt; für Zeilenumbrüche).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="exposeText" className="text-sm font-medium">Text</Label>
          <Textarea
            id="exposeText"
            placeholder='<p>Erster Absatz...</p><p>Zweiter Absatz...</p><h2>Überschrift</h2><p>Weiterer Text...</p>'
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={15}
            className="text-base font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Dieser Text wird auf der öffentlichen Expose-Seite ZUERST angezeigt, vor den Bildern. Verwenden Sie HTML für Formatierung (z.B. &lt;p&gt;Text&lt;/p&gt; für Absätze).
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

