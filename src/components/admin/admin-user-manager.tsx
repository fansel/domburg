"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Mail, Trash2, ShieldCheck } from "lucide-react";
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
import { createAdminUser, sendMagicLinkToAdmin, deleteAdminUser } from "@/app/actions/settings";
import type { User } from "@prisma/client";
import { useTranslation } from "@/contexts/LanguageContext";

interface AdminUserManagerProps {
  initialUsers: User[];
}

export function AdminUserManager({ initialUsers }: AdminUserManagerProps) {
  const { t } = useTranslation();
  const [users, setUsers] = useState(initialUsers);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
  });
  const { toast } = useToast();

  // Reset newUser wenn Dialog geschlossen wird
  useEffect(() => {
    if (!isCreateOpen) {
      setNewUser({ email: "", name: "" });
    }
  }, [isCreateOpen]);

  const handleCreate = async () => {
    if (!newUser.email || !newUser.name) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Felder aus",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    const result = await createAdminUser({
      email: newUser.email,
      name: newUser.name,
    });

    if (result.success && result.user) {
      setUsers([result.user, ...users]);
      setIsCreateOpen(false);
      setNewUser({ email: "", name: "" });
      toast({
        title: "Administrator erstellt",
        description: "Der neue Administrator wurde erfolgreich erstellt",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Benutzer konnte nicht erstellt werden",
        variant: "destructive",
      });
    }
    setIsCreating(false);
  };

  const handleSendMagicLink = async (userId: string, email: string) => {
    const result = await sendMagicLinkToAdmin(userId);
    if (result.success) {
      toast({
        title: "Magic Link gesendet",
        description: `Ein Login-Link wurde an ${email} gesendet`,
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Magic Link konnte nicht gesendet werden",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Möchten Sie den Administrator ${email} wirklich löschen?`)) return;

    const result = await deleteAdminUser(id);
    if (result.success) {
      setUsers(users.filter((u) => u.id !== id));
      toast({
        title: "Gelöscht",
        description: "Administrator wurde erfolgreich gelöscht",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Benutzer konnte nicht gelöscht werden",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("settings.adminAccounts")}</CardTitle>
              <CardDescription>
                {t("settings.adminAccountsDescription")}
              </CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("settings.newAdmin")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("settings.createNewAdmin")}</DialogTitle>
                  <DialogDescription>
                    {t("settings.createNewAdminDescription")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("settings.emailAddress")}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@example.com"
                      value={newUser.email}
                      onChange={(e) =>
                        setNewUser({ ...newUser, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Max Mustermann"
                      value={newUser.name}
                      onChange={(e) =>
                        setNewUser({ ...newUser, name: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
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
          {users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Keine Administratoren vorhanden
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("settings.name")}</TableHead>
                  <TableHead>{t("auth.email")}</TableHead>
                  <TableHead>{t("settings.status")}</TableHead>
                  <TableHead>{t("settings.createdAt")}</TableHead>
                  <TableHead className="text-right">{t("settings.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      {user.name}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Badge variant="default">{t("pricing.active")}</Badge>
                      ) : (
                        <Badge variant="secondary">{t("pricing.inactive")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendMagicLink(user.id, user.email)}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          {t("settings.sendMagicLink")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user.id, user.email)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

