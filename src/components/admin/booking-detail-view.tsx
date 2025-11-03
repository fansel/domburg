"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, User, Mail, Users, Edit, Trash2, 
  Save, X, RotateCcw, RefreshCw
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cancelBooking, restoreBooking } from "@/app/actions/booking";
import {
  updateBooking,
} from "@/app/actions/booking-management";
import type { Booking, Message, User as UserType } from "@prisma/client";

interface BookingWithMessages extends Booking {
  messages: (Message & {
    user: Pick<UserType, "id" | "name" | "email" | "role"> | null;
  })[];
}

interface BookingDetailViewProps {
  booking: BookingWithMessages;
  currentUser: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    canApproveBookings?: boolean;
  };
}

export function BookingDetailView({
  booking: initialBooking,
  currentUser,
}: BookingDetailViewProps) {
  const [booking, setBooking] = useState(initialBooking);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [editData, setEditData] = useState({
    startDate: new Date(booking.startDate).toISOString().split("T")[0],
    endDate: new Date(booking.endDate).toISOString().split("T")[0],
    numberOfAdults: (booking as any).numberOfAdults ?? (booking as any).numberOfGuests ?? 1,
    numberOfChildren: (booking as any).numberOfChildren ?? 0,
    guestName: booking.guestName || "",
    guestEmail: booking.guestEmail,
    guestPhone: (booking as any).guestPhone || "",
    adminNotes: booking.adminNotes || "",
  });

  // Aktualisiere editData wenn booking sich ändert oder Bearbeiten-Modus aktiviert wird
  useEffect(() => {
    if (isEditing) {
      setEditData({
        startDate: new Date(booking.startDate).toISOString().split("T")[0],
        endDate: new Date(booking.endDate).toISOString().split("T")[0],
        numberOfAdults: (booking as any).numberOfAdults ?? (booking as any).numberOfGuests ?? 1,
        numberOfChildren: (booking as any).numberOfChildren ?? 0,
        guestName: booking.guestName || "",
        guestEmail: booking.guestEmail,
        guestPhone: (booking as any).guestPhone || "",
        adminNotes: booking.adminNotes || "",
      });
    }
  }, [booking, isEditing]);

  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateBooking(booking.id, {
      startDate: editData.startDate,
      endDate: editData.endDate,
      numberOfAdults: editData.numberOfAdults,
      numberOfChildren: editData.numberOfChildren,
      guestName: editData.guestName,
      guestEmail: editData.guestEmail,
      guestPhone: editData.guestPhone,
      adminNotes: editData.adminNotes,
    });

    if (result.success && result.booking) {
      setBooking({...booking, ...result.booking, messages: booking.messages});
      setIsEditing(false);
      toast({
        title: "Gespeichert",
        description: "Buchung aktualisiert",
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Fehler beim Speichern",
        variant: "destructive",
      });
    }
    setIsSaving(false);
  };

  const handleCancel = async (reason: string) => {
    const result = await cancelBooking(booking.id, reason);
    if (result.success) {
      toast({
        title: "Storniert",
        description: "Buchung wurde storniert",
      });
      // Kurze Verzögerung, damit Toast angezeigt wird, dann Seite neu laden
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      toast({
        title: "Fehler",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const handleRestore = async (restoreToStatus: "PENDING" | "APPROVED") => {
    const result = await restoreBooking(booking.id, restoreToStatus);
    if (result.success) {
      window.location.reload();
      toast({
        title: "Wiederhergestellt",
        description: `Buchung wurde wiederhergestellt (Status: ${restoreToStatus === "APPROVED" ? "Genehmigt" : "Ausstehend"})`,
      });
    } else {
      toast({
        title: "Fehler",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: Date) => {
    // Verwende lokale Zeitzone (Europe/Amsterdam) für konsistente Anzeige
    // Damit werden UTC-gespeicherte Daten korrekt in der lokalen Zeitzone interpretiert
    return new Intl.DateTimeFormat("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Europe/Amsterdam",
    }).format(new Date(date));
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      PENDING: { variant: "secondary", label: "Ausstehend" },
      APPROVED: { variant: "default", label: "Bestätigt" },
      REJECTED: { variant: "destructive", label: "Abgelehnt" },
      CANCELLED: { variant: "outline", label: "Storniert" },
    };
    const config = variants[status] || variants.PENDING;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-xl sm:text-2xl truncate">Buchung {booking.bookingCode}</CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                {getStatusBadge(booking.status)}
                <span className="hidden sm:inline">•</span>
                <span className="text-xs sm:text-sm">Erstellt am {formatDate(booking.createdAt)}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isEditing && booking.status !== "CANCELLED" && (
                (currentUser.role === "SUPERADMIN" || currentUser.canApproveBookings !== false) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Bearbeiten
                  </Button>
                )
              )}
              {!isEditing && booking.status === "CANCELLED" && (
                (currentUser.role === "SUPERADMIN" || currentUser.canApproveBookings !== false) && (
                  <RestoreDialog onRestore={handleRestore} />
                )
              )}
              {!isEditing && booking.status === "APPROVED" && (
                (currentUser.role === "SUPERADMIN" || currentUser.canApproveBookings !== false) && (
                  <CancelDialog onCancel={handleCancel} />
                )
              )}
              {isEditing && (
                <>
                  <Button 
                    size="sm" 
                    className="w-full sm:w-auto" 
                    onClick={handleSave} 
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Speichern..." : "Speichern"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setIsEditing(false);
                      setEditData({
                        startDate: new Date(booking.startDate).toISOString().split("T")[0],
                        endDate: new Date(booking.endDate).toISOString().split("T")[0],
                        numberOfAdults: (booking as any).numberOfAdults ?? (booking as any).numberOfGuests ?? 1,
                        numberOfChildren: (booking as any).numberOfChildren ?? 0,
                        guestName: booking.guestName || "",
                        guestEmail: booking.guestEmail,
                        guestPhone: (booking as any).guestPhone || "",
                        adminNotes: booking.adminNotes || "",
                      });
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Abbrechen
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Gast-Informationen */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Gast-Informationen
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="guestName">Name</Label>
                {isEditing ? (
                  <Input
                    id="guestName"
                    value={editData.guestName}
                    onChange={(e) =>
                      setEditData({ ...editData, guestName: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-sm">{booking.guestName || "Nicht angegeben"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="guestEmail">E-Mail</Label>
                {isEditing ? (
                  <Input
                    id="guestEmail"
                    type="email"
                    value={editData.guestEmail}
                    onChange={(e) =>
                      setEditData({ ...editData, guestEmail: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-sm">{booking.guestEmail}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="guestPhone">Telefonnummer</Label>
                {isEditing ? (
                  <Input
                    id="guestPhone"
                    type="tel"
                    value={editData.guestPhone}
                    onChange={(e) =>
                      setEditData({ ...editData, guestPhone: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-sm">
                    {(booking as any).guestPhone ? (
                      <a 
                        href={`tel:${(booking as any).guestPhone.replace(/\s/g, '')}`}
                        className="text-primary hover:underline"
                      >
                        {(booking as any).guestPhone}
                      </a>
                    ) : (
                      "Nicht angegeben"
                    )}
                  </p>
                )}
              </div>
              {(booking as any).guestCode && (
                <div className="space-y-2">
                  <Label>Verwendeter Zugangscode</Label>
                  <p className="text-sm font-mono bg-muted px-3 py-2 rounded-md">
                    {(booking as any).guestCode}
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Buchungsdetails */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Buchungsdetails
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">Anreise</Label>
                {isEditing ? (
                  <Input
                    id="startDate"
                    type="date"
                    value={editData.startDate}
                    onChange={(e) =>
                      setEditData({ ...editData, startDate: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-sm font-medium">{formatDate(booking.startDate)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Abreise</Label>
                {isEditing ? (
                  <Input
                    id="endDate"
                    type="date"
                    value={editData.endDate}
                    onChange={(e) =>
                      setEditData({ ...editData, endDate: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-sm font-medium">{formatDate(booking.endDate)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="numberOfAdults">Anzahl Erwachsene</Label>
                {isEditing ? (
                  <Input
                    id="numberOfAdults"
                    type="number"
                    min="1"
                    value={editData.numberOfAdults}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        numberOfAdults: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                ) : (
                  <p className="text-sm font-medium">{(booking as any).numberOfAdults ?? (booking as any).numberOfGuests ?? 1}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="numberOfChildren">Anzahl Kinder</Label>
                {isEditing ? (
                  <Input
                    id="numberOfChildren"
                    type="number"
                    min="0"
                    value={editData.numberOfChildren}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        numberOfChildren: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                ) : (
                  <p className="text-sm font-medium">{(booking as any).numberOfChildren ?? 0}</p>
                )}
              </div>
            </div>
            
            {booking.totalPrice && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Gesamtpreis:</span>
                  <span className="text-2xl font-bold">
                    {formatCurrency(parseFloat(booking.totalPrice.toString()))}
                  </span>
                </div>
              </div>
            )}

            {booking.message && (
              <div className="mt-4 space-y-2">
                <Label>Nachricht vom Gast</Label>
                <p className="text-sm p-3 bg-muted rounded-lg">{booking.message}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Admin-Notizen */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Admin-Notizen</h3>
            {isEditing ? (
              <Textarea
                value={editData.adminNotes}
                onChange={(e) =>
                  setEditData({ ...editData, adminNotes: e.target.value })
                }
                placeholder="Interne Notizen..."
                rows={4}
              />
            ) : (
              <p className="text-sm p-3 bg-muted rounded-lg">
                {booking.adminNotes || "Keine Notizen"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Cancel Dialog Component
function CancelDialog({ onCancel }: { onCancel: (reason: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const handleConfirm = async () => {
    if (reason.trim() && !isCancelling) {
      setIsCancelling(true);
      try {
        await onCancel(reason);
        setIsOpen(false);
        setReason("");
      } finally {
        setIsCancelling(false);
      }
    }
  };

  const handleClose = () => {
    if (!isCancelling) {
      setIsOpen(false);
      setReason("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && !isCancelling) {
        handleClose();
      } else if (open) {
        setIsOpen(true);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="w-full sm:w-auto">
          <Trash2 className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Stornieren</span>
          <span className="sm:hidden">Cancel</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buchung stornieren</DialogTitle>
          <DialogDescription>
            Sind Sie sicher, dass Sie diese Buchung stornieren möchten?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Grund für die Stornierung</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Bitte geben Sie einen Grund an..."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose}
            type="button"
            disabled={isCancelling}
          >
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason.trim() || isCancelling}
            type="button"
          >
            {isCancelling ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Wird storniert...
              </>
            ) : (
              "Stornieren bestätigen"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Restore Dialog Component
function RestoreDialog({ onRestore }: { onRestore: (status: "PENDING" | "APPROVED") => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="w-full sm:w-auto">
          <RotateCcw className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Wiederherstellen</span>
          <span className="sm:hidden">Restore</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buchung wiederherstellen</DialogTitle>
          <DialogDescription>
            Wählen Sie, ob die Buchung als ausstehend oder genehmigt wiederhergestellt werden soll.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Die Buchung wird wiederhergestellt und kann anschließend bearbeitet werden.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onRestore("PENDING");
              setOpen(false);
            }}
          >
            Als ausstehend
          </Button>
          <Button
            variant="default"
            onClick={() => {
              onRestore("APPROVED");
              setOpen(false);
            }}
          >
            Als genehmigt
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

