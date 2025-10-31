"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, RefreshCw, Edit, Save, X, Trash2, Plus, Info } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CalendarBooking {
  id: string;
  summary: string;
  start: string;
  end: string;
  colorId?: string;
  isInfo?: boolean;
}

export function CalendarBookingsManager() {
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ summary: "", start: "", end: "", isInfo: false });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newBooking, setNewBooking] = useState({ summary: "", start: "", end: "", isInfo: false });
  const { toast } = useToast();

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/calendar-bookings");
      const data = await response.json();
      if (data.success) {
        setBookings(data.bookings || []);
      } else {
        toast({
          title: "Fehler",
          description: data.error || "Fehler beim Laden der Kalender-Buchungen",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler beim Laden der Kalender-Buchungen",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  // Aktualisiere editForm wenn editingId sich ändert
  useEffect(() => {
    if (editingId) {
      const booking = bookings.find(b => b.id === editingId);
      if (booking) {
        setEditForm({
          summary: booking.summary,
          start: format(new Date(booking.start), "yyyy-MM-dd"),
          end: format(new Date(booking.end), "yyyy-MM-dd"),
          isInfo: booking.isInfo || false,
        });
      }
    } else {
      // Reset editForm wenn nicht mehr im Bearbeitungsmodus
      setEditForm({ summary: "", start: "", end: "", isInfo: false });
    }
  }, [editingId, bookings]);

  // Reset newBooking wenn Dialog geschlossen wird
  useEffect(() => {
    if (!isDialogOpen) {
      setNewBooking({ summary: "", start: "", end: "", isInfo: false });
    }
  }, [isDialogOpen]);

  const handleEdit = (booking: CalendarBooking) => {
    setEditingId(booking.id);
    setEditForm({
      summary: booking.summary,
      start: format(new Date(booking.start), "yyyy-MM-dd"),
      end: format(new Date(booking.end), "yyyy-MM-dd"),
      isInfo: booking.isInfo || false,
    });
  };

  const handleSave = async (id: string) => {
    try {
      const response = await fetch("/api/admin/calendar-bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          summary: editForm.summary,
          start: editForm.start,
          end: editForm.end,
          isInfo: editForm.isInfo,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Gespeichert",
          description: "Kalendereintrag wurde aktualisiert",
        });
        setEditingId(null);
        loadBookings();
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
        description: "Fehler beim Speichern",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Möchtest du diesen Kalendereintrag wirklich löschen?")) {
      return;
    }

    try {
      const response = await fetch("/api/admin/calendar-bookings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Gelöscht",
          description: "Kalendereintrag wurde gelöscht",
        });
        loadBookings();
      } else {
        toast({
          title: "Fehler",
          description: data.error || "Fehler beim Löschen",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler beim Löschen",
        variant: "destructive",
      });
    }
  };

  const handleCreate = async () => {
    if (!newBooking.summary || !newBooking.start || !newBooking.end) {
      toast({
        title: "Fehler",
        description: "Bitte fülle alle Felder aus",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/admin/calendar-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBooking),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Erstellt",
          description: "Kalendereintrag wurde erstellt",
        });
        setIsDialogOpen(false);
        setNewBooking({ summary: "", start: "", end: "", isInfo: false });
        loadBookings();
      } else {
        toast({
          title: "Fehler",
          description: data.error || "Fehler beim Erstellen",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler beim Erstellen",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Buchungen über Kalender
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const blockingBookings = bookings.filter(b => !b.isInfo);
  const infoBookings = bookings.filter(b => b.isInfo);

  const BookingList = ({ bookings: listBookings }: { bookings: CalendarBooking[] }) => (
    <>
      {listBookings.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Keine Einträge</h3>
          <p className="text-muted-foreground mb-4">
            Es gibt keine Einträge in dieser Kategorie
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {listBookings.map((booking) => (
            <Card key={booking.id} className="border">
              <CardContent className="pt-4">
                {editingId === booking.id ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`edit-summary-${booking.id}`}>Titel</Label>
                      <Input
                        id={`edit-summary-${booking.id}`}
                        value={editForm.summary}
                        onChange={(e) =>
                          setEditForm({ ...editForm, summary: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor={`edit-start-${booking.id}`}>Von</Label>
                        <Input
                          id={`edit-start-${booking.id}`}
                          type="date"
                          value={editForm.start}
                          onChange={(e) =>
                            setEditForm({ ...editForm, start: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-end-${booking.id}`}>Bis</Label>
                        <Input
                          id={`edit-end-${booking.id}`}
                          type="date"
                          value={editForm.end}
                          onChange={(e) =>
                            setEditForm({ ...editForm, end: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 py-2">
                      <Checkbox
                        id={`edit-info-${booking.id}`}
                        checked={editForm.isInfo}
                        onCheckedChange={(checked) =>
                          setEditForm({ ...editForm, isInfo: !!checked })
                        }
                      />
                      <label
                        htmlFor={`edit-info-${booking.id}`}
                        className="text-sm cursor-pointer"
                      >
                        Als Info markieren (nicht blockierend)
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSave(booking.id)}
                        size="sm"
                        className="flex-1"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Speichern
                      </Button>
                      <Button
                        onClick={() => setEditingId(null)}
                        variant="outline"
                        size="sm"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2">{booking.summary}</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {format(new Date(booking.start), "dd.MM.yyyy", { locale: de })} -{" "}
                          {format(new Date(booking.end), "dd.MM.yyyy", { locale: de })}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {booking.isInfo ? (
                          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                            <Info className="h-3 w-3 mr-1" />
                            Info
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            Blockierung
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        onClick={() => handleEdit(booking)}
                        variant="ghost"
                        size="sm"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleDelete(booking.id)}
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Buchungen über Kalender
            </CardTitle>
            <CardDescription>
              Manuelle Blockierungen und Info-Einträge aus Google Calendar verwalten
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Neu
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neue Blockierung erstellen</DialogTitle>
                  <DialogDescription>
                    Erstelle einen neuen Eintrag im Google Calendar
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-summary">Titel</Label>
                    <Input
                      id="new-summary"
                      placeholder="z.B. Renovierung"
                      value={newBooking.summary}
                      onChange={(e) =>
                        setNewBooking({ ...newBooking, summary: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-start">Von</Label>
                    <Input
                      id="new-start"
                      type="date"
                      value={newBooking.start}
                      onChange={(e) =>
                        setNewBooking({ ...newBooking, start: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-end">Bis</Label>
                    <Input
                      id="new-end"
                      type="date"
                      value={newBooking.end}
                      onChange={(e) =>
                        setNewBooking({ ...newBooking, end: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="new-info"
                      checked={newBooking.isInfo}
                      onCheckedChange={(checked) =>
                        setNewBooking({ ...newBooking, isInfo: !!checked })
                      }
                    />
                    <label
                      htmlFor="new-info"
                      className="text-sm cursor-pointer"
                    >
                      Als Info markieren (nicht blockierend)
                    </label>
                  </div>
                  <Button onClick={handleCreate} className="w-full">
                    Erstellen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={loadBookings} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Aktualisieren
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="blockings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="blockings">
              Blockierungen ({blockingBookings.length})
            </TabsTrigger>
            <TabsTrigger value="info" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Info-Einträge ({infoBookings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="blockings" className="space-y-3">
            {blockingBookings.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine Blockierungen</h3>
                <p className="text-muted-foreground mb-4">
                  Es gibt keine Blockierungen im Google Calendar
                </p>
                <Button onClick={() => setIsDialogOpen(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Erste Blockierung erstellen
                </Button>
              </div>
            ) : (
              <BookingList bookings={blockingBookings} />
            )}
          </TabsContent>

          <TabsContent value="info" className="space-y-3">
            {infoBookings.length === 0 ? (
              <div className="text-center py-12">
                <Info className="mx-auto h-12 w-12 text-blue-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine Info-Einträge</h3>
                <p className="text-muted-foreground mb-4">
                  Es gibt keine Info-Einträge im Google Calendar
                </p>
                <Button onClick={() => {
                  setNewBooking({ summary: "", start: "", end: "", isInfo: true });
                  setIsDialogOpen(true);
                }} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Ersten Info-Eintrag erstellen
                </Button>
              </div>
            ) : (
              <BookingList bookings={infoBookings} />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}


