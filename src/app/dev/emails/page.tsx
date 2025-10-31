"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, RefreshCw, Trash2, ExternalLink } from "lucide-react";

interface DevEmail {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  timestamp: string;
}

export default function DevEmailsPage() {
  const [emails, setEmails] = useState<DevEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<DevEmail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadEmails = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/dev/emails");
      const data = await response.json();
      setEmails(data.emails || []);
    } catch (error) {
      console.error("Error loading emails:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearEmails = async () => {
    try {
      await fetch("/api/dev/emails", { method: "DELETE" });
      setEmails([]);
      setSelectedEmail(null);
    } catch (error) {
      console.error("Error clearing emails:", error);
    }
  };

  useEffect(() => {
    loadEmails();
    // Auto-refresh alle 5 Sekunden
    const interval = setInterval(loadEmails, 5000);
    return () => clearInterval(interval);
  }, []);


  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 tracking-tight flex items-center gap-3">
                <Mail className="h-8 w-8" />
                Development Email Postfach
              </h1>
              <p className="text-muted-foreground">
                Alle gesendeten Emails in Development
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={loadEmails} variant="outline" size="sm" disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Aktualisieren
              </Button>
              <Button onClick={clearEmails} variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Alle löschen
              </Button>
            </div>
          </div>
        </div>

        {emails.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Keine Emails</h3>
              <p className="text-sm text-muted-foreground">
                Gesendete Emails erscheinen hier automatisch
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Email Liste */}
            <div className="lg:col-span-1 space-y-2">
              <div className="mb-3">
                <Badge variant="outline">
                  {emails.length} {emails.length === 1 ? "Email" : "Emails"}
                </Badge>
              </div>
              <div className="space-y-2">
                {emails.map((email) => (
                  <Card
                    key={email.id}
                    className={`cursor-pointer hover:border-foreground transition-colors ${
                      selectedEmail?.id === email.id ? "border-foreground" : ""
                    }`}
                    onClick={() => setSelectedEmail(email)}
                  >
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm truncate">{email.subject}</CardTitle>
                      <CardDescription className="text-xs space-y-1">
                        <div className="truncate">An: {email.to}</div>
                        <div>{new Date(email.timestamp).toLocaleString("de-DE")}</div>
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>

            {/* Email Vorschau */}
            <div className="lg:col-span-2">
              {selectedEmail ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="mb-2">{selectedEmail.subject}</CardTitle>
                        <CardDescription className="space-y-1">
                          <div><strong>An:</strong> {selectedEmail.to}</div>
                          <div><strong>Zeit:</strong> {new Date(selectedEmail.timestamp).toLocaleString("de-DE")}</div>
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const win = window.open("", "_blank");
                          if (win) {
                            win.document.write(selectedEmail.html);
                            win.document.close();
                          }
                        }}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        In neuem Tab
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Tabs für HTML und Text */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold mb-2">HTML Vorschau:</h4>
                        <div className="border rounded-lg overflow-hidden">
                          <iframe
                            srcDoc={selectedEmail.html}
                            className="w-full h-96 border-0"
                            title="Email Preview"
                            sandbox="allow-same-origin"
                          />
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-2">Text Version:</h4>
                        <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                          {selectedEmail.text}
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                      Wählen Sie eine Email aus der Liste
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

