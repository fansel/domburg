"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Mail, Edit, RotateCcw, Code, Eye } from "lucide-react";
import { EmailTemplate } from "@prisma/client";
import { updateEmailTemplate, resetEmailTemplate } from "@/app/actions/email-templates";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface EmailTemplateManagerProps {
  templates: EmailTemplate[];
}

// Beispieldaten für Vorschau
const sampleData: Record<string, string> = {
  guestName: "Max Mustermann",
  adminName: "Familie Waubke",
  bookingCode: "DOM-2025-ABC123",
  startDate: "15.06.2025",
  endDate: "22.06.2025",
  numberOfGuests: "4",
  totalPrice: "1.470,00",
  message: "Wir freuen uns schon riesig auf unseren Aufenthalt bei euch!",
  adminNotes: "Check-in ab 15:00 Uhr möglich. Schlüssel liegt wie besprochen bereit.",
  rejectionReason: "Dieser Zeitraum ist leider schon an andere Gäste vergeben.",
  guestEmail: "max.mustermann@example.com",
  loginUrl: "https://ferienhaus.local/auth/verify?token=abc123",
  statusUrl: "https://ferienhaus.local/booking/status",
  replyUrl: "https://ferienhaus.local/booking/status?code=DOM-2025-ABC123",
  adminUrl: "https://ferienhaus.local/admin/bookings/DOM-2025-ABC123",
  expiryMinutes: "15",
  messageContent: "Habt ihr noch Fragen zum Check-in oder zur Anreise?",
  senderName: "Familie Waubke",
};

// Funktion zum Ersetzen von Variablen mit Beispieldaten
const replaceVariables = (text: string): string => {
  let result = text;
  Object.entries(sampleData).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  });
  // Entferne {{#if}} und {{/if}} Blöcke für die Vorschau
  result = result.replace(/{{#if [^}]+}}/g, '');
  result = result.replace(/{{\/if}}/g, '');
  return result;
};

export function EmailTemplateManager({ templates }: EmailTemplateManagerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [formData, setFormData] = useState({
    subject: "",
    bodyHtml: "",
    bodyText: "",
    isActive: true,
  });

  // Aktualisiere formData wenn selectedTemplate sich ändert oder Dialog geöffnet wird
  useEffect(() => {
    if (selectedTemplate && isEditing) {
      setFormData({
        subject: selectedTemplate.subject || "",
        bodyHtml: selectedTemplate.bodyHtml || "",
        bodyText: selectedTemplate.bodyText || "",
        isActive: selectedTemplate.isActive ?? true,
      });
    } else if (!isEditing) {
      // Reset formData wenn Dialog geschlossen wird
      setSelectedTemplate(null);
      setFormData({
        subject: "",
        bodyHtml: "",
        bodyText: "",
        isActive: true,
      });
    }
  }, [selectedTemplate, isEditing]);

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;

    setIsSaving(true);
    const result = await updateEmailTemplate(selectedTemplate.id, formData);

    if (result.success) {
      toast({
        title: "Gespeichert",
        description: "Email-Template wurde aktualisiert",
      });
      setIsEditing(false);
      router.refresh();
    } else {
      toast({
        title: "Fehler",
        description: result.error,
        variant: "destructive",
      });
    }
    setIsSaving(false);
  };

  const handleReset = async (template: EmailTemplate) => {
    if (!confirm("Möchtest du dieses Template wirklich auf die Standardwerte zurücksetzen?")) {
      return;
    }

    const result = await resetEmailTemplate(template.id);
    if (result.success) {
      toast({
        title: "Zurückgesetzt",
        description: "Template wurde auf Standardwerte zurückgesetzt",
      });
      setIsEditing(false);
      setSelectedTemplate(null);
      router.refresh();
    } else {
      toast({
        title: "Fehler",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.querySelector('textarea[name="bodyHtml"]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.bodyHtml;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const varText = `{{${variable}}}`;

    setFormData({
      ...formData,
      bodyHtml: before + varText + after,
    });

    // Set cursor after inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + varText.length, start + varText.length);
    }, 0);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email-Templates
              </CardTitle>
              <CardDescription>
                Verwalte deine Email-Vorlagen mit klickbaren Variablen
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{template.name}</h3>
                        <Badge variant={template.isActive ? "default" : "secondary"}>
                          {template.isActive ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {template.description}
                        </p>
                      )}
                      <p className="text-sm font-mono bg-muted px-2 py-1 rounded inline-block mb-2">
                        {template.key}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.variables.map((variable) => (
                          <Badge key={variable} variant="outline" className="text-xs">
                            {`{{${variable}}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            Vorschau
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{template.name} - Vorschau</DialogTitle>
                            <DialogDescription>
                              Betreff: {replaceVariables(template.subject)}
                            </DialogDescription>
                          </DialogHeader>
                          <Tabs defaultValue="html" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="html">HTML Ansicht</TabsTrigger>
                              <TabsTrigger value="text">Text Ansicht</TabsTrigger>
                            </TabsList>
                            <TabsContent value="html" className="space-y-2">
                              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                                💡 Variablen werden mit Beispieldaten gefüllt
                              </div>
                              <div className="border rounded-lg p-4 bg-white">
                                <div dangerouslySetInnerHTML={{ __html: replaceVariables(template.bodyHtml) }} />
                              </div>
                            </TabsContent>
                            <TabsContent value="text" className="space-y-2">
                              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                                💡 Variablen werden mit Beispieldaten gefüllt
                              </div>
                              <div className="border rounded-lg p-4 bg-muted">
                                <pre className="whitespace-pre-wrap text-sm font-mono">
                                  {replaceVariables(template.bodyText)}
                                </pre>
                              </div>
                            </TabsContent>
                          </Tabs>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleEdit(template)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Bearbeiten
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReset(template)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name} bearbeiten</DialogTitle>
            <DialogDescription>
              Verwende die Variablen-Buttons um Platzhalter einzufügen. Diese werden beim Versand automatisch ersetzt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Variables */}
            <div>
              <Label className="text-xs text-muted-foreground">Verfügbare Variablen (klicken zum Einfügen)</Label>
              <div className="flex flex-wrap gap-2 mt-2 p-3 bg-muted rounded-lg">
                {selectedTemplate?.variables.map((variable) => (
                  <Button
                    key={variable}
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => insertVariable(variable)}
                    className="text-xs font-mono"
                  >
                    <Code className="h-3 w-3 mr-1" />
                    {`{{${variable}}}`}
                  </Button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <Label htmlFor="subject">Betreff</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Email-Betreff"
              />
            </div>

            {/* Tabs for HTML and Text */}
            <Tabs defaultValue="html">
              <TabsList>
                <TabsTrigger value="html">HTML</TabsTrigger>
                <TabsTrigger value="text">Plain Text</TabsTrigger>
                <TabsTrigger value="preview">Vorschau</TabsTrigger>
              </TabsList>

              <TabsContent value="html" className="space-y-2">
                <Label htmlFor="bodyHtml">HTML-Inhalt</Label>
                <Textarea
                  id="bodyHtml"
                  name="bodyHtml"
                  value={formData.bodyHtml}
                  onChange={(e) => setFormData({ ...formData, bodyHtml: e.target.value })}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="HTML-Template mit Variablen..."
                />
              </TabsContent>

              <TabsContent value="text" className="space-y-2">
                <Label htmlFor="bodyText">Plain-Text Inhalt</Label>
                <Textarea
                  id="bodyText"
                  value={formData.bodyText}
                  onChange={(e) => setFormData({ ...formData, bodyText: e.target.value })}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="Plain-Text Alternative..."
                />
              </TabsContent>

              <TabsContent value="preview" className="space-y-2">
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  💡 Live-Vorschau mit Beispieldaten
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Betreff:</Label>
                    <div className="text-sm font-semibold bg-muted p-2 rounded">
                      {replaceVariables(formData.subject)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">HTML-Ansicht:</Label>
                    <div className="border rounded-lg p-4 bg-white mt-2">
                      <div dangerouslySetInnerHTML={{ __html: replaceVariables(formData.bodyHtml) }} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Text-Ansicht:</Label>
                    <div className="border rounded-lg p-4 bg-muted mt-2">
                      <pre className="whitespace-pre-wrap text-sm font-mono">
                        {replaceVariables(formData.bodyText)}
                      </pre>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Active Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Template aktiv</Label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Speichert..." : "Speichern"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

