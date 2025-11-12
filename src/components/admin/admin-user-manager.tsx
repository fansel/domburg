"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Mail, Trash2, ShieldCheck, Eye, CheckCircle, Settings, MoreHorizontal, Euro, CalendarCheck, Image } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createAdminUser, deleteAdminUser, updateUserRole, updateUserPermissions, resendWelcomeEmail } from "@/app/actions/settings";
import type { User } from "@prisma/client";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Crown } from "lucide-react";

interface AdminUserManagerProps {
  initialUsers: User[];
  currentUser?: User;
}

export function AdminUserManager({ initialUsers, currentUser }: AdminUserManagerProps) {
  const { t } = useTranslation();
  const [users, setUsers] = useState(initialUsers);
  const isSuperAdmin = currentUser?.role === ("SUPERADMIN" as any);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    username: "",
    password: "",
    generatePassword: false,
  });
  const { toast } = useToast();

  // Reset newUser wenn Dialog geschlossen wird
  useEffect(() => {
    if (!isCreateOpen) {
      setNewUser({ email: "", name: "", username: "", password: "", generatePassword: false });
    }
  }, [isCreateOpen]);

  const handleCreate = async () => {
    if (!newUser.email || !newUser.name || !newUser.username) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus",
        variant: "destructive",
      });
      return;
    }

    if (!newUser.generatePassword && !newUser.password) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie ein Passwort ein oder aktivieren Sie die automatische Passwort-Generierung",
        variant: "destructive",
      });
      return;
    }

    if (!newUser.generatePassword && newUser.password.length < 8) {
      toast({
        title: "Fehler",
        description: "Das Passwort muss mindestens 8 Zeichen lang sein",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    const result = await createAdminUser({
      email: newUser.email,
      name: newUser.name,
      username: newUser.username,
      password: newUser.generatePassword ? undefined : newUser.password,
      generatePassword: newUser.generatePassword,
    });

    if (result.success && result.user) {
      setUsers([result.user, ...users]);
      setIsCreateOpen(false);
      setNewUser({ email: "", name: "", username: "", password: "", generatePassword: false });
      
      if (result.generatedPassword) {
        toast({
          title: "Administrator erstellt",
          description: `Der neue Administrator wurde erstellt. E-Mail mit Zugangsdaten wurde gesendet. Passwort: ${result.generatedPassword}`,
          duration: 10000,
        });
      } else {
      toast({
        title: "Administrator erstellt",
          description: "Der neue Administrator wurde erfolgreich erstellt. E-Mail mit Zugangsdaten wurde gesendet.",
      });
      }
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Benutzer konnte nicht erstellt werden",
        variant: "destructive",
      });
    }
    setIsCreating(false);
  };

  const handleSendPasswordReset = async (userId: string, email: string) => {
    try {
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Passwort-Reset gesendet",
          description: `Eine E-Mail zum Zurücksetzen des Passworts wurde an ${email} gesendet`,
        });
      } else {
        toast({
          title: "Fehler",
          description: result.error || "E-Mail konnte nicht gesendet werden",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "E-Mail konnte nicht gesendet werden",
        variant: "destructive",
      });
    }
  };

  const handleResendWelcomeEmail = async (userId: string, email: string) => {
    if (!confirm(`Möchten Sie die Willkommens-E-Mail mit neuen Zugangsdaten an ${email} senden? Das Passwort wird neu generiert.`)) return;
    
    const result = await resendWelcomeEmail(userId);
    if (result.success) {
      toast({
        title: "Willkommens-E-Mail gesendet",
        description: result.generatedPassword 
          ? `Eine neue Willkommens-E-Mail mit Zugangsdaten wurde an ${email} gesendet. Neues Passwort: ${result.generatedPassword}`
          : `Eine neue Willkommens-E-Mail wurde an ${email} gesendet`,
        duration: result.generatedPassword ? 15000 : 5000,
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "E-Mail konnte nicht gesendet werden",
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
        <CardHeader className="space-y-2 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg sm:text-xl">{t("settings.adminAccounts")}</CardTitle>
              <CardDescription className="text-sm">
                {t("settings.adminAccountsDescription")}
              </CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("settings.newAdmin")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-lg sm:text-xl">{t("settings.createNewAdmin")}</DialogTitle>
                  <DialogDescription className="text-sm">
                    {t("settings.createNewAdminDescription")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">{t("settings.emailAddress")}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@example.com"
                      value={newUser.email}
                      onChange={(e) =>
                        setNewUser({ ...newUser, email: e.target.value })
                      }
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Name</Label>
                    <Input
                      id="name"
                      placeholder="Max Mustermann"
                      value={newUser.name}
                      onChange={(e) =>
                        setNewUser({ ...newUser, name: e.target.value })
                      }
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                    <Input
                      id="username"
                      placeholder="admin"
                      value={newUser.username}
                      onChange={(e) =>
                        setNewUser({ ...newUser, username: e.target.value })
                      }
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">Passwort</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mindestens 8 Zeichen"
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser({ ...newUser, password: e.target.value })
                      }
                      disabled={newUser.generatePassword}
                      className="text-base"
                    />
                    <p className="text-xs text-muted-foreground">
                      Wird ignoriert, wenn "Passwort automatisch generieren" aktiviert ist
                    </p>
                  </div>
                  <div className="flex items-start space-x-3 border rounded-lg p-4 bg-muted/50">
                    <Checkbox
                      id="generatePassword"
                      checked={newUser.generatePassword}
                      onCheckedChange={(checked) =>
                        setNewUser({ ...newUser, generatePassword: checked as boolean, password: "" })
                      }
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label htmlFor="generatePassword" className="cursor-pointer font-semibold text-sm">
                        Passwort automatisch generieren
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ein sicheres Passwort wird automatisch generiert und an den Benutzer gesendet. Das Passwort muss beim ersten Login geändert werden.
                      </p>
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                    className="w-full sm:w-auto"
                  >
                    Abbrechen
                  </Button>
                  <Button onClick={handleCreate} disabled={isCreating} className="w-full sm:w-auto">
                    {isCreating ? "Erstelle..." : "Erstellen"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Berechtigungs-Dialog */}
          {users.map((user) => (
            <Dialog
              key={`perms-${user.id}`}
              open={permissionsDialogOpen === user.id}
              onOpenChange={(open) => setPermissionsDialogOpen(open ? user.id : null)}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Berechtigungen für {user.name || user.email}</DialogTitle>
                  <DialogDescription>
                    Legen Sie fest, welche Aktionen dieser Administrator ausführen kann.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Eye className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <Label htmlFor={`canSee-${user.id}`} className="text-sm font-medium">
                          Buchungen sehen
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Kann Buchungen einsehen und anzeigen
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={`canSee-${user.id}`}
                      checked={(user as any).canSeeBookings !== false}
                      disabled={(user.role as string) === "SUPERADMIN" && user.id === currentUser?.id}
                      onCheckedChange={async (checked) => {
                        const result = await updateUserPermissions(
                          user.id,
                          checked,
                          (user as any).canApproveBookings !== false,
                          (user as any).canManagePricing,
                          (user as any).canManageBookingLimit
                        );
                        if (result.success) {
                          setUsers(users.map(u => 
                            u.id === user.id 
                              ? { ...u, canSeeBookings: checked } as any
                              : u
                          ));
                          toast({
                            title: "Berechtigung aktualisiert",
                            description: "Die Berechtigung wurde erfolgreich geändert",
                          });
                        } else {
                          toast({
                            title: "Fehler",
                            description: result.error || "Berechtigung konnte nicht geändert werden",
                            variant: "destructive",
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <Label htmlFor={`canApprove-${user.id}`} className="text-sm font-medium">
                          Buchungen genehmigen
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Kann Buchungen genehmigen, ablehnen oder stornieren
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={`canApprove-${user.id}`}
                      checked={(user as any).canApproveBookings !== false}
                      disabled={(user.role as string) === "SUPERADMIN" && user.id === currentUser?.id}
                      onCheckedChange={async (checked) => {
                        const result = await updateUserPermissions(
                          user.id,
                          (user as any).canSeeBookings !== false,
                          checked,
                          (user as any).canManagePricing,
                          (user as any).canManageBookingLimit
                        );
                        if (result.success) {
                          setUsers(users.map(u => 
                            u.id === user.id 
                              ? { ...u, canApproveBookings: checked } as any
                              : u
                          ));
                          toast({
                            title: "Berechtigung aktualisiert",
                            description: "Die Berechtigung wurde erfolgreich geändert",
                          });
                        } else {
                          toast({
                            title: "Fehler",
                            description: result.error || "Berechtigung konnte nicht geändert werden",
                            variant: "destructive",
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Euro className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <Label htmlFor={`canManagePricing-${user.id}`} className="text-sm font-medium">
                          Preise verwalten
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Kann Preise, Preisphasen und Strandbuden-Saisons verwalten
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={`canManagePricing-${user.id}`}
                      checked={(user as any).canManagePricing === true}
                      disabled={(user.role as string) === "SUPERADMIN" && user.id === currentUser?.id}
                      onCheckedChange={async (checked) => {
                        const result = await updateUserPermissions(
                          user.id,
                          (user as any).canSeeBookings !== false,
                          (user as any).canApproveBookings !== false,
                          checked,
                          (user as any).canManageBookingLimit
                        );
                        if (result.success) {
                          setUsers(users.map(u => 
                            u.id === user.id 
                              ? { ...u, canManagePricing: checked } as any
                              : u
                          ));
                          toast({
                            title: "Berechtigung aktualisiert",
                            description: "Die Berechtigung wurde erfolgreich geändert",
                          });
                        } else {
                          toast({
                            title: "Fehler",
                            description: result.error || "Berechtigung konnte nicht geändert werden",
                            variant: "destructive",
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CalendarCheck className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <Label htmlFor={`canManageBookingLimit-${user.id}`} className="text-sm font-medium">
                          Buchungslimit verwalten
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Kann das Datum festlegen, bis zu dem Buchungen erlaubt sind
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={`canManageBookingLimit-${user.id}`}
                      checked={(user as any).canManageBookingLimit === true}
                      disabled={(user.role as string) === "SUPERADMIN" && user.id === currentUser?.id}
                      onCheckedChange={async (checked) => {
                        const result = await updateUserPermissions(
                          user.id,
                          (user as any).canSeeBookings !== false,
                          (user as any).canApproveBookings !== false,
                          (user as any).canManagePricing,
                          checked
                        );
                        if (result.success) {
                          setUsers(users.map(u => 
                            u.id === user.id 
                              ? { ...u, canManageBookingLimit: checked } as any
                              : u
                          ));
                          toast({
                            title: "Berechtigung aktualisiert",
                            description: "Die Berechtigung wurde erfolgreich geändert",
                          });
                        } else {
                          toast({
                            title: "Fehler",
                            description: result.error || "Berechtigung konnte nicht geändert werden",
                            variant: "destructive",
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Image className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <Label htmlFor={`canManageExpose-${user.id}`} className="text-sm font-medium">
                          Expose verwalten
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Kann Bilder und Texte für das Expose verwalten
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={`canManageExpose-${user.id}`}
                      checked={(user as any).canManageExpose === true}
                      disabled={(user.role as string) === "SUPERADMIN" && user.id === currentUser?.id}
                      onCheckedChange={async (checked) => {
                        const result = await updateUserPermissions(
                          user.id,
                          (user as any).canSeeBookings !== false,
                          (user as any).canApproveBookings !== false,
                          (user as any).canManagePricing,
                          (user as any).canManageBookingLimit,
                          checked
                        );
                        if (result.success) {
                          setUsers(users.map(u => 
                            u.id === user.id 
                              ? { ...u, canManageExpose: checked } as any
                              : u
                          ));
                          toast({
                            title: "Berechtigung aktualisiert",
                            description: "Die Berechtigung wurde erfolgreich geändert",
                          });
                        } else {
                          toast({
                            title: "Fehler",
                            description: result.error || "Berechtigung konnte nicht geändert werden",
                            variant: "destructive",
                          });
                        }
                      }}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setPermissionsDialogOpen(null)}>Schließen</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ))}
          {users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Keine Administratoren vorhanden
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("settings.name")}</TableHead>
                      <TableHead>{t("auth.email")}</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Rolle</TableHead>
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
                        <TableCell className="text-muted-foreground">{user.username || "-"}</TableCell>
                        <TableCell>
                          {isSuperAdmin ? (
                            <Select
                              value={user.role}
                              onValueChange={async (newRole) => {
                                if (newRole !== user.role) {
                                  const result = await updateUserRole(user.id, newRole as "ADMIN" | "SUPERADMIN");
                                  if (result.success) {
                                    setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole as any } : u));
                                    toast({
                                      title: "Rolle aktualisiert",
                                      description: `Die Rolle wurde erfolgreich auf ${newRole} geändert`,
                                    });
                                  } else {
                                    toast({
                                      title: "Fehler",
                                      description: result.error || "Rolle konnte nicht geändert werden",
                                      variant: "destructive",
                                    });
                                  }
                                }
                              }}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ADMIN">ADMIN</SelectItem>
                                <SelectItem value="SUPERADMIN">
                                  <div className="flex items-center gap-2">
                                    <Crown className="h-4 w-4" />
                                    SUPERADMIN
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={(user.role as string) === "SUPERADMIN" ? "default" : "secondary"}>
                              {(user.role as string) === "SUPERADMIN" && <Crown className="h-3 w-3 mr-1 inline" />}
                              {user.role}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.isActive ? (
                            <Badge variant="default">{t("pricing.active")}</Badge>
                          ) : (
                            <Badge variant="secondary">{t("pricing.inactive")}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(user.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Menü öffnen</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isSuperAdmin && (user.role as string) !== "SUPERADMIN" && (
                                <>
                                  <DropdownMenuItem
                                    onSelect={(e) => {
                                      e.preventDefault();
                                      setPermissionsDialogOpen(user.id);
                                    }}
                                  >
                                    <Settings className="mr-2 h-4 w-4" />
                                    Berechtigungen verwalten
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  handleResendWelcomeEmail(user.id, user.email);
                                }}
                              >
                                <Mail className="mr-2 h-4 w-4" />
                                Willkommens-E-Mail erneut senden
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  handleSendPasswordReset(user.id, user.email);
                                }}
                              >
                                <Mail className="mr-2 h-4 w-4" />
                                Passwort zurücksetzen
                              </DropdownMenuItem>
                              {/* Nur Löschen anzeigen wenn User kein SUPERADMIN ist, oder wenn aktueller User SUPERADMIN ist */}
                              {((user.role as string) !== "SUPERADMIN" || isSuperAdmin) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={(e) => {
                                      e.preventDefault();
                                      handleDelete(user.id, user.email);
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Löschen
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {users.map((user) => (
                  <Card key={user.id}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <ShieldCheck className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-base mb-1 break-words">{user.name}</p>
                              <p className="text-sm text-muted-foreground break-all">{user.email}</p>
                              {user.username && (
                                <p className="text-xs text-muted-foreground mt-0.5">@{user.username}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                {isSuperAdmin ? (
                                  <Select
                                    value={user.role}
                                    onValueChange={async (newRole) => {
                                      if (newRole !== user.role) {
                                        const result = await updateUserRole(user.id, newRole as "ADMIN" | "SUPERADMIN");
                                        if (result.success) {
                                          setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole as any } : u));
                                          toast({
                                            title: "Rolle aktualisiert",
                                            description: `Die Rolle wurde erfolgreich auf ${newRole} geändert`,
                                          });
                                        } else {
                                          toast({
                                            title: "Fehler",
                                            description: result.error || "Rolle konnte nicht geändert werden",
                                            variant: "destructive",
                                          });
                                        }
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="w-[140px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                                      <SelectItem value="SUPERADMIN">
                                        <div className="flex items-center gap-2">
                                          <Crown className="h-4 w-4" />
                                          SUPERADMIN
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant={(user.role as string) === "SUPERADMIN" ? "default" : "secondary"} className="text-xs">
                                    {(user.role as string) === "SUPERADMIN" && <Crown className="h-3 w-3 mr-1 inline" />}
                                    {user.role}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {t("settings.createdAt")}: {formatDate(user.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 flex-shrink-0">
                            {user.isActive ? (
                              <Badge variant="default" className="text-xs">{t("pricing.active")}</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">{t("pricing.inactive")}</Badge>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Menü öffnen</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                {isSuperAdmin && (user.role as string) !== "SUPERADMIN" && (
                                  <>
                                    <DropdownMenuItem
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        setPermissionsDialogOpen(user.id);
                                      }}
                                    >
                                      <Settings className="mr-2 h-4 w-4" />
                                      Berechtigungen verwalten
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    handleResendWelcomeEmail(user.id, user.email);
                                  }}
                                >
                                  <Mail className="mr-2 h-4 w-4" />
                                  Willkommens-E-Mail erneut senden
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    handleSendPasswordReset(user.id, user.email);
                                  }}
                                >
                                  <Mail className="mr-2 h-4 w-4" />
                                  Passwort zurücksetzen
                                </DropdownMenuItem>
                                {/* Nur Löschen anzeigen wenn User kein SUPERADMIN ist, oder wenn aktueller User SUPERADMIN ist */}
                                {((user.role as string) !== "SUPERADMIN" || isSuperAdmin) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        handleDelete(user.id, user.email);
                                      }}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Löschen
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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
    </div>
  );
}

