"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Mail, Search, RefreshCw, Eye, Send } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

interface EmailLog {
  id: string;
  templateKey: string | null;
  emailType: string;
  to: string;
  from: string | null;
  fromName: string | null;
  replyTo: string | null;
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  status: string;
  sentVia: string | null;
  error: string | null;
  createdAt: Date;
}

interface EmailLogManagerProps {
  initialLogs: EmailLog[];
}

export function EmailLogManager({ initialLogs }: EmailLogManagerProps) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState(initialLogs);
  const [filteredLogs, setFilteredLogs] = useState(initialLogs);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [isResending, setIsResending] = useState<string | null>(null);
  const [isViewing, setIsViewing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredLogs(logs);
      return;
    }

    const filtered = logs.filter(
      (log) =>
        log.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.emailType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.from && log.from.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredLogs(filtered);
  }, [searchTerm, logs]);

  const handleResend = async (logId: string) => {
    setIsResending(logId);
    try {
      const response = await fetch(`/api/admin/email-log/${logId}/resend`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "E-Mail erneut versendet",
          description: `E-Mail erneut gesendet`,
        });
        // Logs neu laden
        const refreshResponse = await fetch("/api/admin/email-log?limit=100");
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (refreshData.success) {
            setLogs(refreshData.logs);
          }
        }
      } else {
        toast({
          title: "Fehler",
          description: data.error || "E-Mail konnte nicht erneut versendet werden",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler aufgetreten",
        variant: "destructive",
      });
    } finally {
      setIsResending(null);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="default">Gesendet</Badge>;
      case "failed":
        return <Badge variant="destructive">Fehlgeschlagen</Badge>;
      case "pending":
        return <Badge variant="secondary">Ausstehend</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEmailTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      booking_confirmation: "Buchungsbestätigung",
      booking_approved: "Buchung genehmigt",
      booking_rejected: "Buchung abgelehnt",
      new_message: "Neue Nachricht",
      admin_new_booking: "Neue Buchung (Admin)",
      password_reset: "Passwort zurücksetzen",
      new_user: "Neuer Benutzer",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2 pb-4">
          <CardTitle className="text-lg sm:text-xl">E-Mail Log</CardTitle>
          <CardDescription className="text-sm">
            Protokoll aller versendeten E-Mails des Systems
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nach E-Mail, Betreff oder Typ suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Keine E-Mails gefunden
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>An</TableHead>
                      <TableHead>Von</TableHead>
                      <TableHead>Betreff</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Versand über</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {formatDate(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getEmailTypeLabel(log.emailType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{log.to}</TableCell>
                        <TableCell className="text-sm">
                          {log.fromName && log.from ? (
                            <>{log.fromName} &lt;{log.from}&gt;</>
                          ) : (
                            log.from || "-"
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {log.subject}
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell>
                          {log.sentVia ? (
                            <Badge variant="secondary">{log.sentVia}</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedLog(log);
                                setIsViewing(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResend(log.id)}
                              disabled={isResending === log.id}
                            >
                              {isResending === log.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {filteredLogs.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{log.to}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(log.createdAt)}
                            </p>
                          </div>
                          {getStatusBadge(log.status)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{log.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {getEmailTypeLabel(log.emailType)}
                          </p>
                        </div>
                        {log.from && (
                          <div className="text-sm text-muted-foreground">
                            Von: {log.fromName || log.from}
                          </div>
                        )}
                        {log.error && (
                          <div className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
                            Fehler: {log.error}
                          </div>
                        )}
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setSelectedLog(log);
                              setIsViewing(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Anzeigen
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleResend(log.id)}
                            disabled={isResending === log.id}
                          >
                            {isResending === log.id ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            Erneut senden
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* View Email Dialog */}
      <Dialog open={isViewing} onOpenChange={setIsViewing}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>E-Mail Details</DialogTitle>
            <DialogDescription>
              Vollständige E-Mail-Informationen
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>An</Label>
                  <p className="text-sm">{selectedLog.to}</p>
                </div>
                <div>
                  <Label>Von</Label>
                  <p className="text-sm">
                    {selectedLog.fromName && selectedLog.from
                      ? `${selectedLog.fromName} <${selectedLog.from}>`
                      : selectedLog.from || "-"}
                  </p>
                </div>
                {selectedLog.replyTo && (
                  <div>
                    <Label>Reply-To</Label>
                    <p className="text-sm">{selectedLog.replyTo}</p>
                  </div>
                )}
                <div>
                  <Label>Typ</Label>
                  <p className="text-sm">{getEmailTypeLabel(selectedLog.emailType)}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>
                <div>
                  <Label>Versand über</Label>
                  <p className="text-sm">{selectedLog.sentVia || "-"}</p>
                </div>
                <div className="col-span-2">
                  <Label>Betreff</Label>
                  <p className="text-sm font-medium">{selectedLog.subject}</p>
                </div>
                {selectedLog.error && (
                  <div className="col-span-2">
                    <Label>Fehler</Label>
                    <p className="text-sm text-destructive">{selectedLog.error}</p>
                  </div>
                )}
              </div>
              <div>
                <Label>HTML Inhalt (Vorschau)</Label>
                <div
                  className="mt-2 p-4 border rounded-lg max-h-96 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: selectedLog.bodyHtml || "" }}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsViewing(false)}
                >
                  Schließen
                </Button>
                <Button
                  onClick={() => {
                    handleResend(selectedLog.id);
                    setIsViewing(false);
                  }}
                  disabled={isResending === selectedLog.id}
                >
                  {isResending === selectedLog.id ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Wird gesendet...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Erneut senden
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

