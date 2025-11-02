"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Mail, Save, Eye, EyeOff, Send, Power } from "lucide-react";

interface SmtpSettings {
  host: string;
  port: string;
  user: string;
  password: string;
  hasPassword?: boolean; // Flag ob Passwort gesetzt ist (aber nicht geladen wird)
  fromEmail: string;
  fromName: string;
  enabled: boolean;
}

interface SmtpManagerProps {
  initialSettings: SmtpSettings;
}

export function SmtpManager({ initialSettings }: SmtpManagerProps) {
  const [settings, setSettings] = useState<SmtpSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const { toast } = useToast();
  const router = useRouter();

  const handleTestConnection = async () => {
    if (!settings.host || !settings.port || !settings.user) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie Host, Port und Benutzername aus",
        variant: "destructive",
      });
      return;
    }

    // Warnung wenn kein Passwort gesetzt/geändert wurde
    if (!passwordChanged && !settings.hasPassword) {
      toast({
        title: "Warnung",
        description: "Bitte geben Sie ein Passwort ein, um die Verbindung zu testen",
        variant: "destructive",
      });
      return;
    }

    setIsTestingConnection(true);
    
    try {
      const response = await fetch('/api/admin/smtp-test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: settings.host,
          port: settings.port,
          user: settings.user,
          password: passwordChanged ? settings.password : undefined, // Nur senden wenn geändert
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Verbindung erfolgreich!",
          description: "SMTP-Verbindung wurde erfolgreich getestet",
        });
      } else {
        toast({
          title: "Verbindung fehlgeschlagen",
          description: data.error || "SMTP-Verbindung konnte nicht hergestellt werden",
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
      setIsTestingConnection(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const response = await fetch('/api/admin/smtp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          passwordChanged, // Nur Passwort senden wenn geändert
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Gespeichert",
          description: "SMTP-Einstellungen wurden aktualisiert",
        });
        setPasswordChanged(false);
        router.refresh();
      } else {
        toast({
          title: "Fehler",
          description: data.error || "Fehler beim Speichern",
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

  const handleTest = async () => {
    if (!testEmail) {
      toast({
        title: "Fehler",
        description: "Bitte gib eine Test-E-Mail-Adresse ein",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    
    try {
      const response = await fetch('/api/admin/smtp-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, testEmail }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Test erfolgreich!",
          description: `Test-E-Mail wurde an ${testEmail} gesendet`,
        });
      } else {
        toast({
          title: "Test fehlgeschlagen",
          description: data.error || "E-Mail konnte nicht gesendet werden",
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
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-2 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <CardTitle className="text-lg sm:text-xl">E-Mail-Versand</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="smtp-enabled" className="text-xs sm:text-sm font-normal">
              {settings.enabled ? (
                <span className="text-green-600 dark:text-green-400">SMTP aktiv</span>
              ) : (
                <span className="text-orange-600 dark:text-orange-400">Dev-Modus</span>
              )}
            </Label>
            <Switch
              id="smtp-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
            />
          </div>
        </div>
        <CardDescription className="text-sm">
          {settings.enabled 
            ? "SMTP ist aktiviert - Alle E-Mails werden über deinen SMTP-Server versendet"
            : "Dev-Modus aktiv - E-Mails werden nur lokal gespeichert"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="host" className="text-sm font-medium">SMTP Host</Label>
            <Input
              id="host"
              placeholder="smtp.gmail.com"
              value={settings.host}
              onChange={(e) => setSettings({ ...settings, host: e.target.value })}
              className="text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="port" className="text-sm font-medium">SMTP Port</Label>
            <Input
              id="port"
              type="number"
              placeholder="587"
              value={settings.port}
              onChange={(e) => setSettings({ ...settings, port: e.target.value })}
              className="text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user" className="text-sm font-medium">SMTP Benutzername (E-Mail)</Label>
            <Input
              id="user"
              type="email"
              placeholder="deine@email.de"
              value={settings.user}
              onChange={(e) => setSettings({ ...settings, user: e.target.value })}
              className="text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">SMTP Passwort</Label>
            <div className="relative">
              <Input
                id="password"
                type={passwordChanged && showPassword ? "text" : "password"}
                placeholder={settings.hasPassword && !passwordChanged ? "••••••••" : "Passwort eingeben"}
                value={passwordChanged ? settings.password : ""}
                onChange={(e) => {
                  setSettings({ ...settings, password: e.target.value });
                  setPasswordChanged(true);
                }}
                className={`text-base ${passwordChanged ? "pr-10" : ""}`}
                readOnly={!passwordChanged && settings.hasPassword}
              />
              {passwordChanged && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {settings.hasPassword && !passwordChanged && (
              <p className="text-xs text-muted-foreground">
                Passwort ist gespeichert. Nur neu eingeben wenn du es ändern möchtest.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fromEmail" className="text-sm font-medium">Absender E-Mail</Label>
            <Input
              id="fromEmail"
              type="email"
              placeholder="noreply@ferienhaus.de"
              value={settings.fromEmail}
              onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })}
              className="text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fromName" className="text-sm font-medium">Absender Name</Label>
            <Input
              id="fromName"
              placeholder="Familie Waubke"
              value={settings.fromName}
              onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
              className="text-base"
            />
          </div>
        </div>

        <div className="border-t pt-4 space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <Label className="text-sm font-medium">SMTP-Verbindung testen</Label>
            <p className="text-sm text-muted-foreground">
              Testet die Verbindung zum SMTP-Server (ohne E-Mail zu versenden)
            </p>
            <Button 
              onClick={handleTestConnection} 
              disabled={isTestingConnection || !settings.host || !settings.port || !settings.user}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Power className="h-4 w-4 mr-2" />
              {isTestingConnection ? "Teste..." : "Verbindung testen"}
            </Button>
          </div>

          {settings.host && settings.port && settings.user && (
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <Label className="text-sm font-medium">Test-E-Mail senden</Label>
              <p className="text-sm text-muted-foreground">
                Sendet eine Test-E-Mail an die angegebene Adresse
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="flex-1 text-base"
                />
                <Button onClick={handleTest} disabled={isTesting} variant="outline" className="w-full sm:w-auto">
                  <Send className="h-4 w-4 mr-2" />
                  {isTesting ? "Sende..." : "E-Mail senden"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Speichere..." : "Speichern"}
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}

