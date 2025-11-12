"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, ArrowUp, ArrowDown, X } from "lucide-react";
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
import { createExpose, updateExpose, deleteExpose, updateExposeOrder } from "@/app/actions/expose";
import type { Expose, ExposeSection, ExposeImagePlacement } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const placementLabels: Record<ExposeImagePlacement, string> = {
  ABOVE: "Bild über dem Abschnitt",
  BELOW: "Bild unter dem Abschnitt",
  GALLERY: "Galerie (Seitenende)",
};

type ExposeWithSection = Expose & { section: ExposeSection | null };

interface ExposeManagerProps {
  initialExposes: ExposeWithSection[];
  sections: ExposeSection[];
}

export function ExposeManager({ initialExposes, sections }: ExposeManagerProps) {
  const [exposes, setExposes] = useState<ExposeWithSection[]>(initialExposes);
  const [availableSections, setAvailableSections] = useState<ExposeSection[]>(sections);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingExpose, setEditingExpose] = useState<ExposeWithSection | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  
  useEffect(() => {
    setExposes(initialExposes);
  }, [initialExposes]);

  useEffect(() => {
    setAvailableSections(sections);
  }, [sections]);

  const getSectionLabel = (section: ExposeSection | null) =>
    section?.title?.trim() ? section.title : section ? "Einführung / Übersicht" : "Galerie";

  const getPlacementVariant = (placement: ExposeImagePlacement) =>
    placement === "GALLERY" ? "secondary" : "outline";
  const [newExpose, setNewExpose] = useState({
    title: "",
    description: "",
    imageUrl: "",
    imageText: "",
    sectionId: "",
    placement: "GALLERY" as ExposeImagePlacement,
  });

  const [editExpose, setEditExpose] = useState({
    title: "",
    description: "",
    imageUrl: "",
    imageText: "",
    sectionId: "",
    placement: "BELOW" as ExposeImagePlacement,
    isActive: true,
  });

  const { toast } = useToast();

  // Reset newExpose wenn Dialog geschlossen wird
  useEffect(() => {
    if (!isCreateOpen) {
      setNewExpose({
        title: "",
        description: "",
        imageUrl: "",
        imageText: "",
        sectionId: "",
        placement: "GALLERY",
      });
      setImagePreview(null);
    }
  }, [isCreateOpen]);

  // Reset editExpose wenn Dialog geschlossen wird
  useEffect(() => {
    if (!isEditing) {
      setEditExpose({
        title: "",
        description: "",
        imageUrl: "",
        imageText: "",
        sectionId: "",
        placement: "BELOW",
        isActive: true,
      });
      setEditImagePreview(null);
      setEditingExpose(null);
    }
  }, [isEditing]);

  // Bild aus Datei verarbeiten
  const processImageFile = (file: File, isEdit: boolean = false) => {
    // Prüfe Dateityp
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie eine Bilddatei aus",
        variant: "destructive",
      });
      return;
    }

    // Prüfe Dateigröße (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Fehler",
        description: "Bild ist zu groß (max. 5MB)",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (isEdit) {
        setEditExpose({ ...editExpose, imageUrl: base64String });
        setEditImagePreview(base64String);
      } else {
        setNewExpose({ ...newExpose, imageUrl: base64String });
        setImagePreview(base64String);
      }
      toast({
        title: "Bild hinzugefügt",
        description: "Bild wurde erfolgreich geladen",
      });
    };
    reader.readAsDataURL(file);
  };

  // Bild-Upload Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file, isEdit);
  };

  // Paste-Handler für Bilder
  const handlePaste = async (e: React.ClipboardEvent, isEdit: boolean = false) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Prüfe ob es ein Bild ist
      if (item.type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          processImageFile(file, isEdit);
        }
        return;
      }
    }
  };

  const handleCreate = async () => {
    if (!newExpose.imageUrl) {
      toast({
        title: "Fehler",
        description: "Bitte laden Sie ein Bild hoch",
        variant: "destructive",
      });
      return;
    }

    if (newExpose.placement !== "GALLERY" && !newExpose.sectionId) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Abschnitt aus oder setzen Sie die Platzierung auf Galerie",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    const result = await createExpose({
      title: newExpose.title || undefined,
      description: newExpose.description || undefined,
      imageUrl: newExpose.imageUrl,
      imageText: newExpose.imageText || undefined,
      sectionId: newExpose.sectionId || null,
      placement: newExpose.placement,
    });

    if (result.success && result.data) {
      setExposes([...exposes, result.data as ExposeWithSection]);
      setIsCreateOpen(false);
      setNewExpose({
        title: "",
        description: "",
        imageUrl: "",
        imageText: "",
        sectionId: "",
        placement: "GALLERY",
      });
      setImagePreview(null);
      toast({
        title: "Erfolg",
        description: "Expose-Eintrag erstellt",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Expose-Eintrag konnte nicht erstellt werden",
        variant: "destructive",
      });
    }
    setIsCreating(false);
  };

  const handleEdit = (expose: ExposeWithSection) => {
    setEditingExpose(expose);
    setEditExpose({
      title: expose.title || "",
      description: expose.description || "",
      imageUrl: expose.imageUrl,
      imageText: expose.imageText || "",
      sectionId: expose.sectionId || "",
      placement: expose.placement,
      isActive: expose.isActive,
    });
    setEditImagePreview(expose.imageUrl);
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    if (!editingExpose) return;

    if (!editExpose.imageUrl) {
      toast({
        title: "Fehler",
        description: "Bild ist erforderlich",
        variant: "destructive",
      });
      return;
    }

    if (editExpose.placement !== "GALLERY" && !editExpose.sectionId) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Abschnitt aus oder setzen Sie die Platzierung auf Galerie",
        variant: "destructive",
      });
      return;
    }

    const result = await updateExpose(editingExpose.id, {
      title: editExpose.title || undefined,
      description: editExpose.description || undefined,
      imageUrl: editExpose.imageUrl,
      imageText: editExpose.imageText || undefined,
      sectionId: editExpose.sectionId || null,
      placement: editExpose.placement,
      isActive: editExpose.isActive,
    });

    if (result.success && result.data) {
      setExposes(exposes.map((e) => (e.id === editingExpose.id ? (result.data as ExposeWithSection) : e)));
      setIsEditing(false);
      setEditingExpose(null);
      toast({
        title: "Erfolg",
        description: "Expose-Eintrag aktualisiert",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Expose-Eintrag konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Möchten Sie diesen Expose-Eintrag wirklich löschen?")) {
      return;
    }

    const result = await deleteExpose(id);
    if (result.success) {
      setExposes(exposes.filter((e) => e.id !== id));
      toast({
        title: "Erfolg",
        description: "Expose-Eintrag gelöscht",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Expose-Eintrag konnte nicht gelöscht werden",
        variant: "destructive",
      });
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;

    const newExposes = [...exposes];
    [newExposes[index - 1], newExposes[index]] = [newExposes[index], newExposes[index - 1]];
    
    const result = await updateExposeOrder(newExposes.map((e) => e.id));
    if (result.success) {
      setExposes(newExposes);
      toast({
        title: "Erfolg",
        description: "Reihenfolge aktualisiert",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Reihenfolge konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === exposes.length - 1) return;

    const newExposes = [...exposes];
    [newExposes[index], newExposes[index + 1]] = [newExposes[index + 1], newExposes[index]];
    
    const result = await updateExposeOrder(newExposes.map((e) => e.id));
    if (result.success) {
      setExposes(newExposes);
      toast({
        title: "Erfolg",
        description: "Reihenfolge aktualisiert",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Reihenfolge konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Expose-Verwaltung</CardTitle>
            <CardDescription>
              Verwalten Sie Bilder und Texte für das Expose
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Neuer Eintrag
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="max-w-2xl max-h-[90vh] overflow-y-auto"
              onPaste={(e) => handlePaste(e, false)}
            >
              <DialogHeader>
                <DialogTitle>Neuer Expose-Eintrag</DialogTitle>
                <DialogDescription>
                  Fügen Sie ein Bild und optional Text hinzu. Sie können auch ein Bild aus der Zwischenablage einfügen (Strg+V / Cmd+V).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new-title">Titel (optional)</Label>
                  <Input
                    id="new-title"
                    value={newExpose.title}
                    onChange={(e) => setNewExpose({ ...newExpose, title: e.target.value })}
                    placeholder="z.B. Wohnzimmer"
                  />
                </div>
                <div>
                  <Label htmlFor="new-description">Beschreibung (optional)</Label>
                  <Textarea
                    id="new-description"
                    value={newExpose.description}
                    onChange={(e) => setNewExpose({ ...newExpose, description: e.target.value })}
                    placeholder="Allgemeine Beschreibung..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="new-placement">Anzeigeort *</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Bestimmen Sie, wo das Bild angezeigt werden soll
                  </p>
                  <Select
                    value={newExpose.placement}
                    onValueChange={(value) => {
                      const placement = value as ExposeImagePlacement;
                      setNewExpose((prev) => ({
                        ...prev,
                        placement,
                        sectionId: placement === "GALLERY" ? "" : prev.sectionId,
                      }));
                    }}
                  >
                    <SelectTrigger id="new-placement">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(placementLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="new-section">
                    Abschnitt {newExpose.placement === "GALLERY" ? "(optional)" : "*"}
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    {newExpose.placement === "GALLERY"
                      ? "Bilder ohne Abschnitt erscheinen automatisch im Galerie-Bereich am Ende."
                      : "Wählen Sie den Abschnitt, zu dem das Bild gehört."}
                  </p>
                  <Select
                    value={newExpose.sectionId}
                    disabled={newExpose.placement === "GALLERY" || availableSections.length === 0}
                    onValueChange={(value) =>
                      setNewExpose((prev) => ({
                        ...prev,
                        sectionId: value,
                      }))
                    }
                  >
                    <SelectTrigger id="new-section">
                      <SelectValue placeholder={availableSections.length === 0 ? "Keine Abschnitte vorhanden" : "Abschnitt auswählen"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSections.length === 0 ? (
                        <SelectItem value="__placeholder" disabled>
                          Keine Abschnitte verfügbar
                        </SelectItem>
                      ) : (
                        availableSections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.title?.trim() ? section.title : "Einführung / Übersicht"}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="new-image">Bild *</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Datei auswählen oder Bild aus Zwischenablage einfügen (Strg+V / Cmd+V)
                  </p>
                  <Input
                    id="new-image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, false)}
                    className="cursor-pointer"
                  />
                  {imagePreview && (
                    <div className="mt-4 relative">
                      <img
                        src={imagePreview}
                        alt="Vorschau"
                        className="w-full h-64 object-contain rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setImagePreview(null);
                          setNewExpose({ ...newExpose, imageUrl: "" });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="new-image-text">Text zum Bild (optional)</Label>
                  <Textarea
                    id="new-image-text"
                    value={newExpose.imageText}
                    onChange={(e) => setNewExpose({ ...newExpose, imageText: e.target.value })}
                    placeholder="Beschreibung zu diesem Bild..."
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
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
        {exposes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Noch keine Expose-Einträge vorhanden
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Reihenfolge</TableHead>
                  <TableHead>Vorschau</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Abschnitt</TableHead>
                  <TableHead>Platzierung</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exposes.map((expose, index) => (
                  <TableRow key={expose.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === exposes.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <img
                        src={expose.imageUrl}
                        alt={expose.title || "Expose"}
                        className="w-20 h-20 object-cover rounded"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{expose.title || "Ohne Titel"}</div>
                      {expose.imageText && (
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {expose.imageText}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={expose.section ? "outline" : "secondary"}>
                        {getSectionLabel(expose.section)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPlacementVariant(expose.placement)}>
                        {placementLabels[expose.placement]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={expose.isActive ? "default" : "secondary"}>
                        {expose.isActive ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(expose)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(expose.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent 
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onPaste={(e) => handlePaste(e, true)}
        >
          <DialogHeader>
            <DialogTitle>Expose-Eintrag bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie Bild und Text. Sie können auch ein Bild aus der Zwischenablage einfügen (Strg+V / Cmd+V).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Titel (optional)</Label>
              <Input
                id="edit-title"
                value={editExpose.title}
                onChange={(e) => setEditExpose({ ...editExpose, title: e.target.value })}
                placeholder="z.B. Wohnzimmer"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Beschreibung (optional)</Label>
              <Textarea
                id="edit-description"
                value={editExpose.description}
                onChange={(e) => setEditExpose({ ...editExpose, description: e.target.value })}
                placeholder="Allgemeine Beschreibung..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-placement">Anzeigeort *</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Bestimmen Sie, wo das Bild angezeigt werden soll
              </p>
              <Select
                value={editExpose.placement}
                onValueChange={(value) => {
                  const placement = value as ExposeImagePlacement;
                  setEditExpose((prev) => ({
                    ...prev,
                    placement,
                    sectionId: placement === "GALLERY" ? "" : prev.sectionId,
                  }));
                }}
              >
                <SelectTrigger id="edit-placement">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(placementLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-section">
                Abschnitt {editExpose.placement === "GALLERY" ? "(optional)" : "*"}
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                {editExpose.placement === "GALLERY"
                  ? "Bilder ohne Abschnitt erscheinen automatisch im Galerie-Bereich am Ende."
                  : "Wählen Sie den Abschnitt, zu dem das Bild gehört."}
              </p>
              <Select
                value={editExpose.sectionId}
                disabled={editExpose.placement === "GALLERY" || availableSections.length === 0}
                onValueChange={(value) =>
                  setEditExpose((prev) => ({
                    ...prev,
                    sectionId: value,
                  }))
                }
              >
                <SelectTrigger id="edit-section">
                  <SelectValue placeholder={availableSections.length === 0 ? "Keine Abschnitte vorhanden" : "Abschnitt auswählen"} />
                </SelectTrigger>
                <SelectContent>
                  {availableSections.length === 0 ? (
                    <SelectItem value="__placeholder" disabled>
                      Keine Abschnitte verfügbar
                    </SelectItem>
                  ) : (
                    availableSections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.title?.trim() ? section.title : "Einführung / Übersicht"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-image">Bild *</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Datei auswählen oder Bild aus Zwischenablage einfügen (Strg+V / Cmd+V)
              </p>
              <Input
                id="edit-image"
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, true)}
                className="cursor-pointer"
              />
              {editImagePreview && (
                <div className="mt-4 relative">
                  <img
                    src={editImagePreview}
                    alt="Vorschau"
                    className="w-full h-64 object-contain rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setEditImagePreview(null);
                      setEditExpose({ ...editExpose, imageUrl: "" });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="edit-image-text">Text zum Bild (optional)</Label>
              <Textarea
                id="edit-image-text"
                value={editExpose.imageText}
                onChange={(e) => setEditExpose({ ...editExpose, imageText: e.target.value })}
                placeholder="Beschreibung zu diesem Bild..."
                rows={4}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-active"
                checked={editExpose.isActive}
                onCheckedChange={(checked) => setEditExpose({ ...editExpose, isActive: checked })}
              />
              <Label htmlFor="edit-active">Aktiv</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleUpdate}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

