"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  createExposeSection,
  updateExposeSection,
  deleteExposeSection,
  updateExposeSectionOrder,
} from "@/app/actions/expose-sections";
import type { ExposeSection } from "@prisma/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowUp, ArrowDown, Plus, Trash2, Save } from "lucide-react";

interface ExposeSectionManagerProps {
  initialSections: ExposeSection[];
}

export function ExposeSectionManager({ initialSections }: ExposeSectionManagerProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [sections, setSections] = useState<ExposeSection[]>(initialSections);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSection, setNewSection] = useState({ title: "", content: "" });
  const [isPending, startTransition] = useTransition();
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);

  useEffect(() => {
    setSections(initialSections);
  }, [initialSections]);

  const hasSections = sections.length > 0;

  const handleLocalChange = (id: string, field: "title" | "content", value: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id
          ? {
              ...section,
              [field]: field === "title" ? value : value,
            }
          : section
      )
    );
  };

  const handleSaveSection = async (id: string) => {
    const section = sections.find((s) => s.id === id);
    if (!section) return;

    if (!section.content.trim()) {
      toast({
        title: "Fehler",
        description: "Der Abschnittsinhalt darf nicht leer sein.",
        variant: "destructive",
      });
      return;
    }

    setSavingSectionId(id);
    const result = await updateExposeSection(id, {
      title: section.title ?? "",
      content: section.content,
    });
    setSavingSectionId(null);

    if (result.success && result.data) {
      setSections((prev) => prev.map((s) => (s.id === id ? result.data! : s)));
      toast({
        title: "Erfolg",
        description: "Abschnitt gespeichert.",
      });
      startTransition(() => router.refresh());
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Abschnitt konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSection = async (id: string) => {
    if (!confirm("Möchten Sie diesen Abschnitt wirklich löschen? Zugeordnete Bilder müssen vorher entfernt oder neu zugewiesen werden.")) {
      return;
    }

    setDeletingSectionId(id);
    const result = await deleteExposeSection(id);
    setDeletingSectionId(null);

    if (result.success) {
      setSections((prev) => prev.filter((s) => s.id !== id));
      toast({
        title: "Erfolg",
        description: "Abschnitt gelöscht.",
      });
      startTransition(() => router.refresh());
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Abschnitt konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === sections.length - 1)) {
      return;
    }

    const newOrder = [...sections];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];

    setSections(newOrder);
    setOrdering(true);
    const result = await updateExposeSectionOrder(newOrder.map((section) => section.id));
    setOrdering(false);

    if (result.success) {
      toast({
        title: "Erfolg",
        description: "Abschnittsreihenfolge aktualisiert.",
      });
      startTransition(() => router.refresh());
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Reihenfolge konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      // revert on failure
      setSections(sections);
    }
  };

  const handleCreateSection = async () => {
    if (!newSection.content.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Inhalt für den Abschnitt ein.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      const result = await createExposeSection({
        title: newSection.title,
        content: newSection.content,
      });

      if (result.success && result.data) {
        setSections((prev) => [...prev, result.data!]);
        setNewSection({ title: "", content: "" });
        setIsCreateOpen(false);
        toast({
          title: "Erfolg",
          description: "Abschnitt erstellt.",
        });
        router.refresh();
      } else {
        toast({
          title: "Fehler",
          description: result.error || "Abschnitt konnte nicht erstellt werden.",
          variant: "destructive",
        });
      }
    });
  };

  const sectionHint = (index: number) => {
    if (index === 0) {
      return (
        <Badge variant="secondary" className="uppercase tracking-wide">
          Einführung
        </Badge>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Abschnitte &amp; Texte</CardTitle>
          <CardDescription>
            Strukturieren Sie den Exposé-Text in Abschnitte. Formatierung durch Zeilenumbrüche bleibt erhalten.
          </CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Neuer Abschnitt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Neuer Abschnitt</DialogTitle>
              <DialogDescription>
                Legen Sie einen neuen Abschnitt an. Lassen Sie den Titel leer, wenn Sie einen einleitenden Abschnitt erstellen möchten.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-section-title">Titel (optional)</Label>
                <Input
                  id="new-section-title"
                  value={newSection.title}
                  onChange={(e) => setNewSection((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="z. B. Ausstattung"
                />
                <p className="text-xs text-muted-foreground mt-1">Leer lassen, um den Abschnitt als Einleitung zu markieren.</p>
              </div>
              <div>
                <Label htmlFor="new-section-content">Inhalt *</Label>
                <Textarea
                  id="new-section-content"
                  value={newSection.content}
                  onChange={(e) => setNewSection((prev) => ({ ...prev, content: e.target.value }))}
                  rows={8}
                  placeholder="Beschreiben Sie den Abschnitt..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Mehrzeilige Texte und Leerzeichen bleiben bei der Anzeige erhalten.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleCreateSection} disabled={isPending}>
                {isPending ? "Erstelle..." : "Erstellen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {!hasSections ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            Noch keine Abschnitte vorhanden. Legen Sie den ersten Abschnitt an, um den Text zu strukturieren.
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map((section, index) => (
              <div key={section.id} className="rounded-lg border p-4 sm:p-6 space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2 flex-1">
                    <Label htmlFor={`section-title-${section.id}`}>Titel (optional)</Label>
                    <Input
                      id={`section-title-${section.id}`}
                      value={section.title ?? ""}
                      onChange={(e) => handleLocalChange(section.id, "title", e.target.value)}
                      placeholder="Leer lassen für die Einleitung"
                    />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {sectionHint(index)}
                      <span>
                        Reihenfolge: {index + 1}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMove(index, "up")}
                      disabled={index === 0 || ordering}
                      aria-label="Nach oben verschieben"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMove(index, "down")}
                      disabled={index === sections.length - 1 || ordering}
                      aria-label="Nach unten verschieben"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor={`section-content-${section.id}`}>Inhalt *</Label>
                  <Textarea
                    id={`section-content-${section.id}`}
                    value={section.content}
                    onChange={(e) => handleLocalChange(section.id, "content", e.target.value)}
                    rows={8}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leerzeilen und Zeilenumbrüche werden auf der öffentlichen Seite übernommen.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveSection(section.id)}
                    disabled={savingSectionId === section.id}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {savingSectionId === section.id ? "Speichere..." : "Abschnitt speichern"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteSection(section.id)}
                    disabled={deletingSectionId === section.id}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deletingSectionId === section.id ? "Lösche..." : "Abschnitt löschen"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


