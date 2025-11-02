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
    bookingCode: "123456",
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
  replyUrl: "https://ferienhaus.local/booking/status?code=123456",
  adminUrl: "https://ferienhaus.local/admin/bookings/123456",
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
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="space-y-2 pb-4 p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <CardTitle className="text-lg sm:text-xl">Email-Templates</CardTitle>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            Verwalte deine Email-Vorlagen mit klickbaren Variablen
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-3 sm:space-y-4">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardContent className="p-4 sm:p-6 sm:pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-sm sm:text-base">{template.name}</h3>
                        <Badge variant={template.isActive ? "default" : "secondary"} className="text-xs">
                          {template.isActive ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </div>
                      {template.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                          {template.description}
                        </p>
                      )}
                      <p className="text-xs sm:text-sm font-mono bg-muted px-2 py-1 rounded inline-block mb-2 break-all">
                        {template.key}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.variables.map((variable) => (
                          <Badge key={variable} variant="outline" className="text-[10px] sm:text-xs">
                            {`{{${variable}}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-xs sm:text-sm flex-1 sm:flex-none">
                            <Eye className="h-4 w-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Vorschau</span>
                            <span className="sm:hidden">Ansicht</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-base sm:text-lg">{template.name} - Vorschau</DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm">
                              Betreff: {replaceVariables(template.subject)}
                            </DialogDescription>
                          </DialogHeader>
                          <Tabs defaultValue="html" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="html" className="text-xs sm:text-sm">HTML</TabsTrigger>
                              <TabsTrigger value="text" className="text-xs sm:text-sm">Text</TabsTrigger>
                            </TabsList>
                            <TabsContent value="html" className="space-y-2 mt-4">
                              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                                💡 Variablen werden mit Beispieldaten gefüllt
                              </div>
                              <div className="border rounded-lg p-3 sm:p-4 bg-white overflow-x-auto">
                                <div className="text-xs sm:text-sm" dangerouslySetInnerHTML={{ __html: replaceVariables(template.bodyHtml) }} />
                              </div>
                            </TabsContent>
                            <TabsContent value="text" className="space-y-2 mt-4">
                              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                                💡 Variablen werden mit Beispieldaten gefüllt
                              </div>
                              <div className="border rounded-lg p-3 sm:p-4 bg-muted overflow-x-auto">
                                <pre className="whitespace-pre-wrap text-xs sm:text-sm font-mono">
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
                        className="text-xs sm:text-sm flex-1 sm:flex-none"
                      >
                        <Edit className="h-4 w-4 mr-1 sm:mr-2" />
                        Bearbeiten
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReset(template)}
                        className="px-2 sm:px-3"
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
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{selectedTemplate?.name} bearbeiten</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Verwende die Variablen-Buttons um Platzhalter einzufügen. Diese werden beim Versand automatisch ersetzt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            {/* Variables */}
            <div>
              <Label className="text-xs text-muted-foreground">Verfügbare Variablen (klicken zum Einfügen)</Label>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2 p-2 sm:p-3 bg-muted rounded-lg">
                {selectedTemplate?.variables.map((variable) => (
                  <Button
                    key={variable}
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => insertVariable(variable)}
                    className="text-[10px] sm:text-xs font-mono h-7 sm:h-8 px-2 sm:px-3"
                  >
                    <Code className="h-3 w-3 mr-0.5 sm:mr-1" />
                    {`{{${variable}}}`}
                  </Button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <Label htmlFor="subject" className="text-xs sm:text-sm">Betreff</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Email-Betreff"
                className="text-sm sm:text-base mt-1"
              />
            </div>

            {/* Tabs for HTML and Text */}
            <Tabs defaultValue="html">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="html" className="text-xs sm:text-sm">HTML</TabsTrigger>
                <TabsTrigger value="text" className="text-xs sm:text-sm">Text</TabsTrigger>
                <TabsTrigger value="preview" className="text-xs sm:text-sm">Vorschau</TabsTrigger>
              </TabsList>

              <TabsContent value="html" className="space-y-2 mt-4">
                <Label htmlFor="bodyHtml" className="text-xs sm:text-sm">HTML-Inhalt</Label>
                <Textarea
                  id="bodyHtml"
                  name="bodyHtml"
                  value={formData.bodyHtml}
                  onChange={(e) => setFormData({ ...formData, bodyHtml: e.target.value })}
                  rows={12}
                  className="font-mono text-xs sm:text-sm"
                  placeholder="HTML-Template mit Variablen..."
                />
              </TabsContent>

              <TabsContent value="text" className="space-y-2 mt-4">
                <Label htmlFor="bodyText" className="text-xs sm:text-sm">Plain-Text Inhalt</Label>
                <Textarea
                  id="bodyText"
                  value={formData.bodyText}
                  onChange={(e) => setFormData({ ...formData, bodyText: e.target.value })}
                  rows={12}
                  className="font-mono text-xs sm:text-sm"
                  placeholder="Plain-Text Alternative..."
                />
              </TabsContent>

              <TabsContent value="preview" className="space-y-2 mt-4">
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  💡 Live-Vorschau mit Beispieldaten
                </div>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Betreff:</Label>
                    <div className="text-xs sm:text-sm font-semibold bg-muted p-2 rounded mt-1">
                      {replaceVariables(formData.subject)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">HTML-Ansicht:</Label>
                    <div className="border rounded-lg p-3 sm:p-4 bg-white mt-2 overflow-x-auto">
                      <div className="text-xs sm:text-sm" dangerouslySetInnerHTML={{ __html: replaceVariables(formData.bodyHtml) }} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Text-Ansicht:</Label>
                    <div className="border rounded-lg p-3 sm:p-4 bg-muted mt-2 overflow-x-auto">
                      <pre className="whitespace-pre-wrap text-xs sm:text-sm font-mono">
                        {replaceVariables(formData.bodyText)}
                      </pre>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Active Toggle */}
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive" className="text-xs sm:text-sm cursor-pointer">Template aktiv</Label>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setIsEditing(false)} className="w-full sm:w-auto text-xs sm:text-sm">
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto text-xs sm:text-sm">
                {isSaving ? "Speichert..." : "Speichern"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

