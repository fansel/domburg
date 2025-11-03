"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, RefreshCw, Edit, Save, X, Trash2, Plus, Info, Link as LinkIcon, CheckCircle2, Unlink } from "lucide-react";
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
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [isGrouping, setIsGrouping] = useState(false);
  const [isUngrouping, setIsUngrouping] = useState(false);
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
        setSelectedBookings(new Set()); // Selection zurücksetzen
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

  const handleToggleSelection = (id: string) => {
    const newSelection = new Set(selectedBookings);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedBookings(newSelection);
  };

  // Prüfe ob ausgewählte Events bereits die gleiche Farbe haben
  const areSelectedBookingsAlreadyGrouped = () => {
    if (selectedBookings.size < 2) return false;
    
    const selectedBookingObjects = bookings.filter(b => selectedBookings.has(b.id));
    if (selectedBookingObjects.length < 2) return false;
    
    // Filtere Info-Events heraus
    const nonInfoEvents = selectedBookingObjects.filter(b => !b.isInfo && b.colorId !== '10');
    if (nonInfoEvents.length < 2) return false;
    
    // Prüfe ob alle die gleiche Farbe haben
    const firstColorId = nonInfoEvents[0]?.colorId;
    if (!firstColorId) return false;
    
    return nonInfoEvents.every(b => b.colorId === firstColorId);
  };

  const handleGroupSelected = async () => {
    if (selectedBookings.size < 2) {
      toast({
        title: "Fehler",
        description: "Bitte wähle mindestens 2 Einträge aus",
        variant: "destructive",
      });
      return;
    }

    // Prüfe ob bereits gruppiert
    if (areSelectedBookingsAlreadyGrouped()) {
      toast({
        title: "Bereits zusammengelegt",
        description: "Diese Events haben bereits die gleiche Farbe und sind zusammengelegt.",
        variant: "default",
      });
      return;
    }

    try {
      setIsGrouping(true);
      
      // Hole die erste Farbe der ausgewählten Events als Ziel-Farbe
      // Wenn keines eine Farbe hat, verwende Farbe 1 (Lavendel)
      const selectedBookingObjects = bookings.filter(b => selectedBookings.has(b.id));
      const firstWithColor = selectedBookingObjects.find(b => b.colorId && b.colorId !== '10');
      const targetColorId = firstWithColor?.colorId || '1'; // Fallback auf Farbe 1

      // Update alle ausgewählten Events mit der gleichen Farbe
      const updatePromises = Array.from(selectedBookings).map(id => 
        fetch("/api/admin/calendar-bookings/group", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: id,
            colorId: targetColorId,
          }),
        })
      );

      const results = await Promise.all(updatePromises);
      const allSuccess = results.every(res => res.ok);

      if (allSuccess) {
        toast({
          title: "Erfolgreich",
          description: `${selectedBookings.size} Einträge wurden zusammengelegt (gleiche Farbe)`,
        });
        setSelectedBookings(new Set());
        setIsGrouping(false);
        loadBookings();
      } else {
        throw new Error("Einige Updates sind fehlgeschlagen");
      }
    } catch (error: any) {
      setIsGrouping(false);
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Zusammenlegen",
        variant: "destructive",
      });
    }
  };

  const handleUngroupSelected = async () => {
    if (selectedBookings.size < 2) {
      toast({
        title: "Fehler",
        description: "Wähle mindestens 2 Einträge zum Trennen aus",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUngrouping(true);

      const response = await fetch("/api/admin/calendar-bookings/ungroup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: Array.from(selectedBookings) }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Fehler beim Trennen");
      }

      toast({
        title: "Erfolgreich",
        description: `${selectedBookings.size} Einträge wurden getrennt (jedes hat jetzt eine eigene Farbe)`,
      });
      setSelectedBookings(new Set());
      setIsUngrouping(false);
      loadBookings();
    } catch (error: any) {
      setIsUngrouping(false);
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Trennen",
        variant: "destructive",
      });
    }
  };

  // Finde alle Events mit der gleichen Farbe wie das gegebene Event
  const findEventsWithSameColor = (eventId: string): string[] => {
    const event = bookings.find(b => b.id === eventId);
    if (!event || !event.colorId || event.colorId === '10') return [];
    
    return bookings
      .filter(b => b.colorId === event.colorId && b.id !== eventId && !b.isInfo)
      .map(b => b.id);
  };

  // Trenne alle Events mit der gleichen Farbe (inkl. dem gegebenen Event)
  const handleUngroupByColor = async (eventId: string) => {
    const sameColorEvents = findEventsWithSameColor(eventId);
    if (sameColorEvents.length === 0) {
      toast({
        title: "Info",
        description: "Dieser Eintrag ist nicht gruppiert",
      });
      return;
    }

    // Füge das aktuelle Event zur Liste hinzu
    const allEventIds = [eventId, ...sameColorEvents];

    try {
      setIsUngrouping(true);

      const response = await fetch("/api/admin/calendar-bookings/ungroup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: allEventIds }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Fehler beim Trennen");
      }

      toast({
        title: "Erfolgreich",
        description: `${allEventIds.length} Einträge wurden getrennt (jedes hat jetzt eine eigene Farbe)`,
      });
      setSelectedBookings(new Set());
      setIsUngrouping(false);
      loadBookings();
    } catch (error: any) {
      setIsUngrouping(false);
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Trennen",
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
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Calendar className="h-5 w-5 flex-shrink-0" />
            <span>Buchungen über Kalender</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
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
        <div className="text-center py-8 sm:py-12">
          <Calendar className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
          <h3 className="text-base sm:text-lg font-semibold mb-2">Keine Einträge</h3>
          <p className="text-sm sm:text-base text-muted-foreground mb-4">
            Es gibt keine Einträge in dieser Kategorie
          </p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {listBookings.map((booking) => (
            <Card 
              key={booking.id} 
              className={`border relative ${selectedBookings.has(booking.id) ? 'ring-2 ring-primary bg-primary/5' : ''} ${booking.isInfo ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-3 sm:p-4 sm:pt-4">
                {!editingId && !booking.isInfo && (
                  <div className="absolute top-3 right-3 z-10 bg-background rounded border border-border p-0.5 shadow-sm">
                    <Checkbox
                      checked={selectedBookings.has(booking.id)}
                      onCheckedChange={() => handleToggleSelection(booking.id)}
                      className="h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </div>
                )}
                {editingId === booking.id ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`edit-summary-${booking.id}`} className="text-xs sm:text-sm">Titel</Label>
                      <Input
                        id={`edit-summary-${booking.id}`}
                        value={editForm.summary}
                        onChange={(e) =>
                          setEditForm({ ...editForm, summary: e.target.value })
                        }
                        className="text-sm sm:text-base"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`edit-start-${booking.id}`} className="text-xs sm:text-sm">Von</Label>
                        <Input
                          id={`edit-start-${booking.id}`}
                          type="date"
                          value={editForm.start}
                          onChange={(e) =>
                            setEditForm({ ...editForm, start: e.target.value })
                          }
                          className="text-sm sm:text-base"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-end-${booking.id}`} className="text-xs sm:text-sm">Bis</Label>
                        <Input
                          id={`edit-end-${booking.id}`}
                          type="date"
                          value={editForm.end}
                          onChange={(e) =>
                            setEditForm({ ...editForm, end: e.target.value })
                          }
                          className="text-sm sm:text-base"
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
                        className="text-xs sm:text-sm cursor-pointer"
                      >
                        Als Info markieren (nicht blockierend)
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSave(booking.id)}
                        size="sm"
                        className="flex-1 text-xs sm:text-sm"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Speichern
                      </Button>
                      <Button
                        onClick={() => setEditingId(null)}
                        variant="outline"
                        size="sm"
                        className="px-3"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm sm:text-base mb-2 break-words">{booking.summary}</h4>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span className="break-words">
                          {format(new Date(booking.start), "dd.MM.yyyy", { locale: de })} -{" "}
                          {format(new Date(booking.end), "dd.MM.yyyy", { locale: de })}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {booking.isInfo ? (
                          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-xs">
                            <Info className="h-3 w-3 mr-1" />
                            Info
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Blockierung
                          </Badge>
                        )}
                        {/* Zeige wenn Event zu einer Gruppe gehört (gleiche Farbe wie andere Events) */}
                        {!booking.isInfo && booking.colorId && (() => {
                          const sameColorEvents = bookings.filter(b => 
                            b.id !== booking.id && 
                            !b.isInfo && 
                            b.colorId === booking.colorId &&
                            b.colorId !== '10'
                          );
                          const isGrouped = sameColorEvents.length > 0;
                          
                          return isGrouped ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Gruppiert ({sameColorEvents.length + 1})
                              </Badge>
                              {!editingId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUngroupByColor(booking.id)}
                                  disabled={isUngrouping}
                                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  <Unlink className="h-3 w-3 mr-1" />
                                  Trennen
                                </Button>
                              )}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    <div className="flex gap-1 sm:gap-1 flex-shrink-0">
                      <Button
                        onClick={() => handleEdit(booking)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleDelete(booking.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
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
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Calendar className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">Buchungen über Kalender</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Manuelle Blockierungen und Info-Einträge aus Google Calendar verwalten
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {selectedBookings.size > 0 && (
              <>
                {!areSelectedBookingsAlreadyGrouped() ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto text-xs sm:text-sm"
                    onClick={handleGroupSelected}
                    disabled={isGrouping || isUngrouping}
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Zusammenlegen ({selectedBookings.size})
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto text-xs sm:text-sm border-green-300 dark:border-green-700"
                      onClick={handleUngroupSelected}
                      disabled={isGrouping || isUngrouping}
                    >
                      <Unlink className="h-4 w-4 mr-2" />
                      {isUngrouping ? "Trennen..." : "Trennen"}
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full sm:w-auto text-xs sm:text-sm"
                  onClick={() => setSelectedBookings(new Set())}
                  disabled={isGrouping || isUngrouping}
                >
                  <X className="h-4 w-4 mr-2" />
                  Abbrechen
                </Button>
              </>
            )}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Neu
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg">Neue Blockierung erstellen</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    Erstelle einen neuen Eintrag im Google Calendar
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-summary" className="text-xs sm:text-sm">Titel</Label>
                    <Input
                      id="new-summary"
                      placeholder="z.B. Renovierung"
                      value={newBooking.summary}
                      onChange={(e) =>
                        setNewBooking({ ...newBooking, summary: e.target.value })
                      }
                      className="text-sm sm:text-base"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="new-start" className="text-xs sm:text-sm">Von</Label>
                      <Input
                        id="new-start"
                        type="date"
                        value={newBooking.start}
                        onChange={(e) =>
                          setNewBooking({ ...newBooking, start: e.target.value })
                        }
                        className="text-sm sm:text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-end" className="text-xs sm:text-sm">Bis</Label>
                      <Input
                        id="new-end"
                        type="date"
                        value={newBooking.end}
                        onChange={(e) =>
                          setNewBooking({ ...newBooking, end: e.target.value })
                        }
                        className="text-sm sm:text-base"
                      />
                    </div>
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
                      className="text-xs sm:text-sm cursor-pointer"
                    >
                      Als Info markieren (nicht blockierend)
                    </label>
                  </div>
                  <Button onClick={handleCreate} className="w-full text-xs sm:text-sm">
                    Erstellen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={loadBookings} variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Aktualisieren</span>
              <span className="sm:hidden">Aktual.</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <Tabs defaultValue="blockings" className="space-y-3 sm:space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="blockings" className="text-xs sm:text-sm flex-1 sm:flex-none">
              Blockierungen <span className="ml-1.5 sm:ml-2">({blockingBookings.length})</span>
            </TabsTrigger>
            <TabsTrigger value="info" className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-none">
              <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Info-Einträge <span className="ml-1.5 sm:ml-2">({infoBookings.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="blockings" className="space-y-2 sm:space-y-3 mt-4 sm:mt-6">
            {blockingBookings.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Calendar className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
                <h3 className="text-base sm:text-lg font-semibold mb-2">Keine Blockierungen</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  Es gibt keine Blockierungen im Google Calendar
                </p>
                <Button onClick={() => setIsDialogOpen(true)} variant="outline" size="sm" className="text-xs sm:text-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Erste Blockierung erstellen
                </Button>
              </div>
            ) : (
              <BookingList bookings={blockingBookings} />
            )}
          </TabsContent>

          <TabsContent value="info" className="space-y-2 sm:space-y-3 mt-4 sm:mt-6">
            {infoBookings.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Info className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-blue-500 mb-4" />
                <h3 className="text-base sm:text-lg font-semibold mb-2">Keine Info-Einträge</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  Es gibt keine Info-Einträge im Google Calendar
                </p>
                <Button onClick={() => {
                  setNewBooking({ summary: "", start: "", end: "", isInfo: true });
                  setIsDialogOpen(true);
                }} variant="outline" size="sm" className="text-xs sm:text-sm">
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


