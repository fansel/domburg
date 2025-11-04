"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, User, Calendar, RefreshCw, Info, X, Plus, ExternalLink } from "lucide-react";
import type { Booking } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markEventAsInfo, unmarkEventAsInfo } from "@/app/actions/google-calendar";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { AdminBookingForm } from "@/components/admin/admin-booking-form";
import { getBookingColorClass, getBookingTextColorClass } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate, datesOverlap } from "@/lib/utils";
import { Link as LinkIcon, CheckCircle2, Unlink } from "lucide-react";

interface CalendarEvent {
  id: string;
  summary: string;
  start: Date;
  end: Date;
  colorId?: string;
}

// Serialisierte Booking für Client Component (Decimal als String)
type SerializedBooking = Omit<Booking, 'totalPrice'> & {
  totalPrice: string | null;
};

interface BookingCalendarViewProps {
  bookings: SerializedBooking[];
  calendarEvents?: CalendarEvent[];
  initialMonth?: number;
  initialYear?: number;
}

export function BookingCalendarView({ bookings, calendarEvents = [], initialMonth, initialYear }: BookingCalendarViewProps) {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(() => {
    if (initialMonth !== undefined && initialYear !== undefined) {
      return new Date(initialYear, initialMonth, 1);
    }
    return new Date();
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [markingEventId, setMarkingEventId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [selectedDayForDetails, setSelectedDayForDetails] = useState<number | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isGrouping, setIsGrouping] = useState(false);
  const [isUngrouping, setIsUngrouping] = useState(false);
  const [eventToMarkAsInfo, setEventToMarkAsInfo] = useState<string | null>(null);
  const [confirmInfoDialogOpen, setConfirmInfoDialogOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Google Calendar exakte Hex-Farbcodes
  const getGoogleCalendarColor = (colorId?: string) => {
    // Offizielle Google Calendar Farbcodes
    const colorMap: Record<string, { main: string; light: string; dark: string; text: string }> = {
      '1': { main: '#7986CB', light: '#E8EAF6', dark: '#5C6BC0', text: '#1A237E' }, // Lavendel (Lavender)
      '2': { main: '#33B679', light: '#C8E6C9', dark: '#26A69A', text: '#004D40' }, // Salbei (Sage)
      '3': { main: '#8E24AA', light: '#F3E5F5', dark: '#7B1FA2', text: '#4A148C' }, // Traube (Grape)
      '4': { main: '#E67C73', light: '#FFEBEE', dark: '#E53935', text: '#B71C1C' }, // Flamingo
      '5': { main: '#F6BF26', light: '#FFF9C4', dark: '#FBC02D', text: '#F57F17' }, // Banane (Banana)
      '6': { main: '#F4511E', light: '#FFE0B2', dark: '#E64A19', text: '#BF360C' }, // Mandarine (Tangerine)
      '7': { main: '#039BE5', light: '#B3E5FC', dark: '#0288D1', text: '#01579B' }, // Pfau (Peacock)
      '8': { main: '#616161', light: '#F5F5F5', dark: '#424242', text: '#212121' }, // Graphit (Graphite)
      '9': { main: '#3F51B5', light: '#C5CAE9', dark: '#303F9F', text: '#1A237E' }, // Blaubeere (Blueberry)
      '10': { main: '#0B8043', light: '#C8E6C9', dark: '#00695C', text: '#004D40' }, // Basilikum (Basil) - Info
      '11': { main: '#D50000', light: '#FFCDD2', dark: '#B71C1C', text: '#B71C1C' }, // Tomate (Tomato)
    };
    
    return colorMap[colorId || ''] || colorMap['6']; // Fallback zu Mandarine
  };

  // Konvertiere Google Calendar colorId zu inline Styles für Event-Badges
  const getEventColorStyle = (colorId?: string) => {
    const color = getGoogleCalendarColor(colorId);
    return {
      backgroundColor: color.light,
      borderColor: color.main,
      color: color.text,
    };
  };

  // Konvertiere Google Calendar colorId zu inline Styles für Dialog-Boxen
  const getEventDialogColorStyle = (colorId?: string) => {
    const color = getGoogleCalendarColor(colorId);
    return {
      backgroundColor: color.light,
      borderColor: color.main,
    };
  };

  // Aktueller Monat und Jahr
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  // Tage im Monat
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Montag = 0

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    router.refresh(); // Reload server components
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleMarkAsInfoClick = (eventId: string) => {
    setEventToMarkAsInfo(eventId);
    setConfirmInfoDialogOpen(true);
  };

  const handleConfirmMarkAsInfo = async () => {
    if (!eventToMarkAsInfo) return;
    
    setConfirmInfoDialogOpen(false);
    setMarkingEventId(eventToMarkAsInfo);
    const result = await markEventAsInfo(eventToMarkAsInfo);
    if (result.success) {
      toast({
        title: "Als Info markiert",
        description: "Event blockiert jetzt nicht mehr",
      });
      router.refresh();
    } else {
      toast({
        title: "Fehler",
        description: result.error,
        variant: "destructive",
      });
    }
    setMarkingEventId(null);
    setEventToMarkAsInfo(null);
  };

  const handleMarkAsInfo = (eventId: string) => {
    // Zeige Bestätigungsdialog (verwendet die gleiche Funktion wie handleMarkAsInfoClick)
    // Schließe Detail-Dialog, falls geöffnet, um Overlay-Probleme zu vermeiden
    if (isDetailDialogOpen) {
      setIsDetailDialogOpen(false);
    }
    setEventToMarkAsInfo(eventId);
    setConfirmInfoDialogOpen(true);
  };

  const handleUnmarkAsInfo = async (eventId: string) => {
    setMarkingEventId(eventId);
    const result = await unmarkEventAsInfo(eventId);
    if (result.success) {
      toast({
        title: "Info-Markierung entfernt",
        description: "Event blockiert jetzt wieder",
      });
      router.refresh();
    } else {
      toast({
        title: "Fehler",
        description: result.error,
        variant: "destructive",
      });
    }
    setMarkingEventId(null);
  };

  // Prüfe ob Events für Gruppierung überlappen (inkl. gleicher Tag)
  // Diese Funktion erlaubt auch Events, die sich nur am gleichen Tag berühren
  // (z.B. Check-out Tag X = Check-in Tag X), damit sie manuell zusammengelegt werden können
  const eventsOverlapForGrouping = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
    // Normalisiere auf Tagesanfang für Vergleich (ignoriere Uhrzeit)
    const getLocalDateString = (date: Date): string => {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Amsterdam',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(date);
    };

    const normalizeDate = (date: Date) => {
      const localDateStr = getLocalDateString(date);
      const [year, month, day] = localDateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };
    
    const s1 = normalizeDate(start1);
    const e1 = normalizeDate(end1);
    const s2 = normalizeDate(start2);
    const e2 = normalizeDate(end2);
    
    // Für Gruppierung: auch Events am gleichen Tag zulassen
    // Events überlappen wenn sie sich berühren oder überschneiden
    // Beispiel: 01.01-05.01 und 05.01-10.01 = ÜBERLAPPUNG für Gruppierung (5.1 ist Check-out + Check-in)
    return s1 <= e2 && s2 <= e1;
  };

  // Finde überlappende Events (für Gruppierung - inkl. Events am gleichen Tag)
  const findOverlappingEvents = (events: CalendarEvent[]): CalendarEvent[][] => {
    const overlappingGroups: CalendarEvent[][] = [];
    const processed = new Set<string>();

    for (let i = 0; i < events.length; i++) {
      if (processed.has(events[i].id)) continue;
      
      const group = [events[i]];
      processed.add(events[i].id);

      for (let j = i + 1; j < events.length; j++) {
        if (processed.has(events[j].id)) continue;

        // Prüfe ob dieses Event mit einem Event in der Gruppe überlappt (inkl. gleicher Tag)
        const overlaps = group.some(e => 
          eventsOverlapForGrouping(e.start, e.end, events[j].start, events[j].end)
        );

        if (overlaps) {
          group.push(events[j]);
          processed.add(events[j].id);
        }
      }

      // Nur Gruppen mit mehr als einem Event zurückgeben
      if (group.length > 1) {
        overlappingGroups.push(group);
      }
    }

    return overlappingGroups;
  };

  const handleGroupEvents = async (eventIds: string[]) => {
    if (eventIds.length < 2) return;

    try {
      setIsGrouping(true);
      
      // Hole die erste Farbe der Events als Ziel-Farbe
      const events = calendarEvents.filter(e => eventIds.includes(e.id));
      const firstWithColor = events.find(e => e.colorId && e.colorId !== '10');
      const targetColorId = firstWithColor?.colorId || '1'; // Fallback auf Farbe 1

      // Update alle Events mit der gleichen Farbe und speichere Verlinkungen in der DB
      const response = await fetch("/api/admin/calendar-bookings/group", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          eventIds: eventIds,
            colorId: targetColorId,
          }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Erfolgreich",
          description: `${eventIds.length} Events wurden zusammengelegt`,
        });
        setIsDetailDialogOpen(false);
        router.refresh();
        // Dispatch Event für Konfliktanzahl-Update
        window.dispatchEvent(new CustomEvent('calendar-event-grouped'));
      } else {
        throw new Error(result.error || "Fehler beim Zusammenlegen");
      }
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Zusammenlegen",
        variant: "destructive",
      });
    } finally {
      setIsGrouping(false);
    }
  };

  const handleUngroupEvents = async (eventIds: string[]) => {
    if (eventIds.length < 2) return;

    try {
      setIsUngrouping(true);

      const response = await fetch("/api/admin/calendar-bookings/ungroup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Fehler beim Trennen");
      }

      toast({
        title: "Erfolgreich",
        description: `${eventIds.length} Events wurden getrennt (jedes hat jetzt eine eigene Farbe)`,
      });
      setIsDetailDialogOpen(false);
      router.refresh();
      // Dispatch Event für Konfliktanzahl-Update
      window.dispatchEvent(new CustomEvent('calendar-event-ungrouped'));
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Trennen",
        variant: "destructive",
      });
    } finally {
      setIsUngrouping(false);
    }
  };


  // Monatsnamen
  const monthNames = [
    t("calendar.months.january"),
    t("calendar.months.february"),
    t("calendar.months.march"),
    t("calendar.months.april"),
    t("calendar.months.may"),
    t("calendar.months.june"),
    t("calendar.months.july"),
    t("calendar.months.august"),
    t("calendar.months.september"),
    t("calendar.months.october"),
    t("calendar.months.november"),
    t("calendar.months.december"),
  ];

  // Wochentage
  const weekDays = [
    t("calendar.weekdays.monday"),
    t("calendar.weekdays.tuesday"),
    t("calendar.weekdays.wednesday"),
    t("calendar.weekdays.thursday"),
    t("calendar.weekdays.friday"),
    t("calendar.weekdays.saturday"),
    t("calendar.weekdays.sunday"),
  ];

  // Buchungen für den aktuellen Monat gruppieren
  // WICHTIG: Gleiche Logik wie in availability/route.ts:
  // - Check-in Tag wird angezeigt
  // - Tage zwischen Check-in und Check-out werden angezeigt
  // - Check-out Tag wird nur angezeigt, wenn er auch Check-in Tag ist
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    
    // Sammle alle Check-in und Check-out Daten für Buchungen
    const bookingCheckInDates = new Set<string>();
    const bookingCheckOutDates = new Set<string>();
    
    bookings.forEach((booking) => {
      const start = new Date(booking.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(booking.endDate);
      end.setHours(0, 0, 0, 0);
      
      const startKey = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
      const endKey = `${end.getFullYear()}-${end.getMonth()}-${end.getDate()}`;
      
      bookingCheckInDates.add(startKey);
      bookingCheckOutDates.add(endKey);
    });
    
    bookings.forEach((booking) => {
      const start = new Date(booking.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(booking.endDate);
      end.setHours(0, 0, 0, 0);
      
      const startKey = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
      const endKey = `${end.getFullYear()}-${end.getMonth()}-${end.getDate()}`;
      
      // Check-in Tag immer anzeigen
      if (start.getMonth() === month && start.getFullYear() === year) {
        const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
        const existing = map.get(key) || [];
        existing.push(booking as any);
        map.set(key, existing);
      }
      
      // Tage zwischen Check-in und Check-out anzeigen
      let current = new Date(start);
      current.setDate(current.getDate() + 1); // Überspringe Check-in Tag
      
      while (current < end) {
        if (current.getMonth() === month && current.getFullYear() === year) {
          const key = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`;
          const existing = map.get(key) || [];
          existing.push(booking as any);
          map.set(key, existing);
        }
        current.setDate(current.getDate() + 1);
      }
      
      // Check-out Tag nur anzeigen, wenn er auch ein Check-in Tag ist
      if (bookingCheckInDates.has(endKey)) {
        if (end.getMonth() === month && end.getFullYear() === year) {
          const key = `${end.getFullYear()}-${end.getMonth()}-${end.getDate()}`;
          const existing = map.get(key) || [];
          existing.push(booking as any);
          map.set(key, existing);
        }
      }
    });
    
    return map;
  }, [bookings, month, year]);

  // Calendar Events für den aktuellen Monat gruppieren
  // WICHTIG: Gleiche Logik wie in availability/route.ts:
  // - Check-in Tag ist NICHT blockiert (kann als Check-out verwendet werden)
  // - Tage zwischen Check-in und Check-out sind blockiert
  // - Check-out Tag ist nur blockiert, wenn er auch Check-in Tag ist (bei Calendar Events ODER Buchungen)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    
    // Sammle alle Check-in und Check-out Daten für Events
    const eventCheckInDates = new Set<string>();
    const eventCheckOutDates = new Set<string>();
    
    calendarEvents.forEach((event) => {
      const start = new Date(event.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(event.end);
      end.setHours(0, 0, 0, 0);
      
      const startKey = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
      const endKey = `${end.getFullYear()}-${end.getMonth()}-${end.getDate()}`;
      
      eventCheckInDates.add(startKey);
      eventCheckOutDates.add(endKey);
    });
    
    // Sammle auch alle Check-in Tage der Buchungen (für kombinierte Blockierung)
    const bookingCheckInDates = new Set<string>();
    bookings.forEach((booking) => {
      const start = new Date(booking.startDate);
      start.setHours(0, 0, 0, 0);
      const startKey = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
      bookingCheckInDates.add(startKey);
    });
    
    calendarEvents.forEach((event) => {
      const start = new Date(event.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(event.end);
      end.setHours(0, 0, 0, 0);
      
      // Zeige alle Tage von Check-in bis Check-out (inklusive) im Kalender an
      // Hinweis: Die Blockierungslogik für Verfügbarkeitsprüfung ist anders (Check-in/Check-out Tage sind verfügbar)
      // Aber für die Anzeige im Kalender sollen alle Tage sichtbar sein
      let current = new Date(start);
      
      // Zeige alle Tage von Check-in bis einschließlich Check-out Tag an
      while (current <= end) {
        if (current.getMonth() === month && current.getFullYear() === year) {
          const key = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`;
          const existing = map.get(key) || [];
          existing.push(event);
          map.set(key, existing);
        }
        current.setDate(current.getDate() + 1);
      }
    });
    
    return map;
  }, [calendarEvents, bookings, month, year]);

  // Buchungen des aktuellen Monats filtern und sortieren
  const monthBookings = useMemo(() => {
    return bookings
      .filter(booking => {
        const start = new Date(booking.startDate);
        const end = new Date(booking.endDate);
        // Prüfe ob Buchung im aktuellen Monat liegt
        return (start.getMonth() === month && start.getFullYear() === year) ||
               (end.getMonth() === month && end.getFullYear() === year) ||
               (start < new Date(year, month, 1) && end > new Date(year, month + 1, 0));
      })
      .sort((a, b) => {
        // Sortiere nach Startdatum
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });
  }, [bookings, month, year]);

  // Calendar Events des aktuellen Monats filtern und sortieren
  const monthEvents = useMemo(() => {
    return calendarEvents
      .filter(event => {
        const start = new Date(event.start);
        const end = new Date(event.end);
        // Prüfe ob Event im aktuellen Monat liegt
        return (start.getMonth() === month && start.getFullYear() === year) ||
               (end.getMonth() === month && end.getFullYear() === year) ||
               (start < new Date(year, month + 1, 0) && end > new Date(year, month, 1));
      })
      .sort((a, b) => {
        // Sortiere nach Startdatum
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      });
  }, [calendarEvents, month, year]);

  // Kalender-Tage generieren
  const calendarDays = [];
  
  // Leere Tage am Anfang
  for (let i = 0; i < adjustedFirstDay; i++) {
    calendarDays.push(null);
  }
  
  // Tage des Monats
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Ist heute?
  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  // Prüfe ob Tag ausgewählt ist
  const isDaySelected = (day: number) => {
    const dayDate = new Date(year, month, day);
    if (selectedStartDate && dayDate.getTime() === selectedStartDate.getTime()) {
      return true;
    }
    if (selectedEndDate && dayDate.getTime() === selectedEndDate.getTime()) {
      return true;
    }
    // Prüfe ob Tag im Bereich liegt
    if (selectedStartDate && selectedEndDate) {
      return dayDate >= selectedStartDate && dayDate <= selectedEndDate;
    }
    return false;
  };

  // Buchungen für einen Tag abrufen
  const getBookingsForDay = (day: number): Booking[] => {
    const key = `${year}-${month}-${day}`;
    const bookings = bookingsByDate.get(key) || [];
    // Sortiere nach Erstellungsdatum (wer zuerst gebucht hat, kommt zuerst)
    return bookings.sort((a, b) => {
      const createdA = new Date(a.createdAt).getTime();
      const createdB = new Date(b.createdAt).getTime();
      return createdA - createdB;
    });
  };

  // Prüfe ob ein Tag nur Abreisetag ist (Check-out, aber kein Check-in oder Zwischentag)
  const isCheckOutOnlyDay = (day: number): boolean => {
    const dayDate = new Date(year, month, day);
    dayDate.setHours(0, 0, 0, 0);
    const dayBookings = getBookingsForDay(day);
    
    if (dayBookings.length === 0) {
      return false;
    }

    // Prüfe für jede Buchung, ob dieser Tag ein reiner Check-out Tag ist
    // Ein Tag ist nur ein Check-out Tag, wenn:
    // 1. Es ist der Endtag einer Buchung (endDate)
    // 2. Es ist NICHT der Starttag (startDate)
    // 3. Es ist NICHT ein Zwischentag (zwischen startDate und endDate)
    
    for (const booking of dayBookings) {
      const startDate = new Date(booking.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(booking.endDate);
      endDate.setHours(0, 0, 0, 0);
      
      // Prüfe ob dieser Tag der Starttag ist - dann nicht klickbar
      if (dayDate.getTime() === startDate.getTime()) {
        return false;
      }
      
      // Prüfe ob dieser Tag ein Zwischentag ist (nach Start, vor End) - dann nicht klickbar
      if (dayDate > startDate && dayDate < endDate) {
        return false;
      }
      
      // Prüfe ob dieser Tag der Endtag ist - dann klickbar
      if (dayDate.getTime() === endDate.getTime()) {
        // Aber nur wenn keine andere Buchung an diesem Tag startet
        continue;
      }
    }

    // Wenn wir hier sind und es Buchungen gibt, müssen alle ihre Endtage sein
    // Prüfe nochmal, ob wirklich alle nur Endtage sind
    const allAreEndDates = dayBookings.every(booking => {
      const endDate = new Date(booking.endDate);
      endDate.setHours(0, 0, 0, 0);
      return dayDate.getTime() === endDate.getTime();
    });
    
    return allAreEndDates;
  };

  const handleDayClick = (day: number) => {
    // Erstelle Datum mit lokaler Zeit, Stunden auf 0 setzen um Zeitverschiebungsprobleme zu vermeiden
    const clickedDate = new Date(year, month, day);
    clickedDate.setHours(0, 0, 0, 0);
    
    const dayBookings = getBookingsForDay(day);
    const dayEvents = getEventsForDay(day);
    const isCheckOutDay = isCheckOutOnlyDay(day);
    
    // Wenn Buchungen vorhanden sind und es kein Check-out Tag ist, öffne Detail-Dialog
    if (dayBookings.length > 0 || dayEvents.length > 0) {
      if (!isCheckOutDay) {
        setSelectedDayForDetails(day);
        setIsDetailDialogOpen(true);
        return;
      }
    }
    
    // Für neue Buchungen: Erlaube Klicks auf leere Tage oder nur Check-out Tage
    // Wenn noch kein Startdatum gesetzt ist, setze es
    if (!selectedStartDate) {
      setSelectedStartDate(clickedDate);
      setSelectedEndDate(null);
      return;
    }

    // Wenn Startdatum gesetzt ist
    if (selectedStartDate) {
      // Normalisiere Startdatum für Vergleich
      const normalizedStartDate = new Date(selectedStartDate);
      normalizedStartDate.setHours(0, 0, 0, 0);
      
      // Wenn auf dasselbe Datum geklickt wird, öffne Formular mit einem Tag
      if (clickedDate.getTime() === normalizedStartDate.getTime()) {
        setSelectedEndDate(clickedDate);
        setIsFormOpen(true);
        return;
      }

      // Wenn auf ein früheres Datum geklickt wird, setze es als neues Startdatum
      if (clickedDate < normalizedStartDate) {
        setSelectedStartDate(clickedDate);
        setSelectedEndDate(null);
        return;
      }

      // Wenn auf ein späteres Datum geklickt wird, setze es als Enddatum und öffne Formular
      if (clickedDate > normalizedStartDate) {
        setSelectedEndDate(clickedDate);
        setIsFormOpen(true);
        return;
      }
    }
  };

  // Reset selection when form closes
  useEffect(() => {
    if (!isFormOpen && selectedStartDate && selectedEndDate) {
      setSelectedStartDate(null);
      setSelectedEndDate(null);
    }
  }, [isFormOpen, selectedStartDate, selectedEndDate]);

  // Calendar Events für einen Tag abrufen
  const getEventsForDay = (day: number): CalendarEvent[] => {
    const key = `${year}-${month}-${day}`;
    return eventsByDate.get(key) || [];
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "default";
      case "PENDING":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "Bestätigt";
      case "PENDING":
        return "Ausstehend";
      case "REJECTED":
        return "Abgelehnt";
      case "CANCELLED":
        return "Storniert";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <CardTitle className="text-lg sm:text-xl md:text-2xl">
                {monthNames[month]} {year}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                {bookings.length} {bookings.length === 1 ? "Buchung" : "Buchungen"}
                {calendarEvents.length > 0 && ` • ${calendarEvents.length} blockierte Termine`}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
              <div className="flex items-center gap-2">
                <Button 
                  variant="default"
                  size="default"
                  onClick={() => setIsFormOpen(true)}
                  className="flex-1 sm:flex-initial text-sm sm:text-base h-10 sm:h-9"
                >
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Neue Buchung</span>
                  <span className="sm:hidden">Neu</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="default"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex-1 sm:flex-initial text-sm sm:text-base h-10 sm:h-9"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''} sm:mr-2`} />
                  <span className="hidden sm:inline">Aktualisieren</span>
                  <span className="sm:hidden">Aktual.</span>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="default" onClick={goToToday} className="flex-1 sm:flex-initial text-sm sm:text-sm h-10 sm:h-9">
                  Heute
                </Button>
                <Button variant="outline" size="icon" onClick={goToPreviousMonth} className="h-10 w-10 sm:h-9 sm:w-9">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-10 w-10 sm:h-9 sm:w-9">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6">
          {/* Wochentage Header */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 sm:mb-3">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-sm sm:text-sm font-semibold text-muted-foreground py-2 sm:py-2"
              >
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden text-base">{day.substring(0, 2)}</span>
              </div>
            ))}
          </div>

          {/* Kalender-Tage */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 lg:gap-3">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="min-h-[60px] sm:aspect-square" />;
              }

              const dayBookings = getBookingsForDay(day);
              const dayEvents = getEventsForDay(day);
              const today = isToday(day);
              const totalItems = dayBookings.length + dayEvents.length;
              const isSelected = isDaySelected(day);
              const isEmpty = totalItems === 0;
              const isCheckOutDay = isCheckOutOnlyDay(day);

              return (
                <div
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`
                    min-h-[80px] sm:aspect-square border-2 rounded-lg p-2 sm:p-1.5 md:p-2 lg:p-3 cursor-pointer
                    ${today ? "border-primary bg-primary/5" : "border-border"}
                    ${totalItems > 0 && !isCheckOutDay ? "bg-muted/50" : ""}
                    ${isSelected ? "bg-primary/20 border-primary border-2" : ""}
                    ${isCheckOutDay ? "border-dashed border-primary/50" : ""}
                    hover:bg-muted/30 transition-colors
                    relative touch-manipulation
                  `}
                  title={isCheckOutDay ? "Check-out Tag - Klicken für neue Buchung möglich" : totalItems > 0 ? "Klicken für Details" : "Klicken für neue Buchung"}
                >
                  <div className="h-full flex flex-col">
                    <div
                      className={`
                        text-base sm:text-sm md:text-base lg:text-lg font-semibold mb-1 sm:mb-1.5 flex-shrink-0
                        ${today ? "text-primary font-bold" : "text-foreground"}
                      `}
                    >
                      {day}
                    </div>
                    <div className="flex-1 overflow-hidden min-h-0">
                      {totalItems === 0 ? (
                        <div className="text-xs sm:text-xs text-muted-foreground opacity-50 hidden sm:block">Leer</div>
                      ) : (
                        <div className="space-y-1 sm:space-y-0.5 md:space-y-1 overflow-y-auto h-full custom-scrollbar">
                          {/* Auf mobilen Geräten bis zu 3 Buchungen/Events anzeigen, auf größeren Screens 2 */}
                          {dayBookings.slice(0, 3).map((booking) => {
                            const bgColorClass = getBookingColorClass(booking.id);
                            const textColorClass = getBookingTextColorClass(booking.id);
                            const isPending = booking.status === "PENDING";
                            
                            return (
                              <div
                                key={booking.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/admin/bookings/${booking.id}?from=calendar&month=${month + 1}&year=${year}`);
                                }}
                                className={`
                                  text-[10px] sm:text-xs md:text-[11px] p-1 sm:p-1.5 md:p-1.5 rounded cursor-pointer
                                  hover:opacity-90 transition-opacity flex-shrink-0 font-medium
                                  ${bgColorClass}
                                  ${textColorClass}
                                  ${isPending ? 'opacity-100 border-2 border-dashed border-yellow-500 dark:border-yellow-400 shadow-sm' : ''}
                                `}
                                style={isPending ? {
                                  backgroundImage: `repeating-linear-gradient(
                                    45deg,
                                    transparent,
                                    transparent 3px,
                                    rgba(255, 193, 7, 0.2) 3px,
                                    rgba(255, 193, 7, 0.2) 6px
                                  )`,
                                  boxShadow: '0 0 0 1px rgba(234, 179, 8, 0.3) inset'
                                } : {}}
                                title={`${booking.guestName || booking.guestEmail} - ${getStatusLabel(booking.status)}`}
                              >
                                <div className="font-semibold truncate leading-tight">{booking.guestName || booking.guestEmail.split("@")[0]}</div>
                              </div>
                            );
                          })}
                          
                          {/* Calendar Events anzeigen - auf mobilen Geräten bis zu 3 */}
                          {dayEvents.slice(0, Math.max(0, 3 - dayBookings.length)).map((event) => {
                            const eventData = calendarEvents.find(e => e.id === event.id);
                            const colorStyle = getEventColorStyle(eventData?.colorId);
                            
                            return (
                            <div
                              key={event.id}
                                className="text-[10px] sm:text-xs md:text-[11px] p-1 sm:p-1.5 md:p-1.5 rounded border flex-shrink-0 relative"
                                style={colorStyle}
                              title={`Blockiert: ${event.summary}`}
                            >
                              <div className="flex items-center gap-1 sm:gap-1.5 md:gap-1 min-w-0">
                                <svg className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3 md:w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                <span className="truncate leading-tight font-medium flex-1 min-w-0 text-left">{event.summary}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsInfoClick(event.id);
                                  }}
                                  className="flex-shrink-0 hover:opacity-70 transition-opacity ml-0.5 sm:ml-1 p-0.5"
                                  title="Als Info markieren (nicht blockierend)"
                                  disabled={markingEventId === event.id}
                                >
                                  {markingEventId === event.id ? (
                                    <RefreshCw className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3 md:w-3 animate-spin opacity-50" />
                                  ) : (
                                    <Info className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3 md:w-3 opacity-60 hover:opacity-100" />
                                  )}
                                </button>
                              </div>
                            </div>
                            );
                          })}
                          
                          {totalItems > 3 && (
                            <div className="text-xs sm:text-[9px] md:text-[10px] text-muted-foreground text-center pt-1 sm:pt-0.5 flex-shrink-0 font-semibold">
                              <span className="hidden sm:inline">+{totalItems - 3} {totalItems > 4 ? "weitere" : "weiterer"}</span>
                              <span className="sm:hidden">+{totalItems - 3}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Liste aller Buchungen des Monats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">
            Alle Buchungen - {monthNames[month]} {year}
          </CardTitle>
          <CardDescription>
            {monthBookings.length} {monthBookings.length === 1 ? "Buchung" : "Buchungen"} 
            {monthEvents.length > 0 && `, ${monthEvents.length} ${monthEvents.length === 1 ? "Blockierung" : "Blockierungen"}`} in diesem Monat
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {/* Buchungen */}
            {monthBookings.map((booking) => {
                const bgColorClass = getBookingColorClass(booking.id);
                const textColorClass = getBookingTextColorClass(booking.id);
                const isPending = booking.status === "PENDING";
                
                return (
                  <Link
                    key={booking.id}
                    href={`/admin/bookings/${booking.id}?from=calendar&month=${month + 1}&year=${year}`}
                    className="block"
                  >
                    <div className={`
                      p-3 sm:p-4 border-2 rounded-lg hover:opacity-90 transition-all cursor-pointer
                      ${isPending ? 'border-dashed border-yellow-500 dark:border-yellow-400 opacity-100 shadow-md bg-yellow-50/50 dark:bg-yellow-900/20' : ''}
                    `}
                    style={isPending ? {
                      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(234, 179, 8, 0.15) 4px, rgba(234, 179, 8, 0.15) 8px)`,
                      backgroundColor: bgColorClass.replace('bg-', '').split('-')[0] === 'purple' ? 'rgb(168 85 247 / 0.2)' :
                                       bgColorClass.replace('bg-', '').split('-')[0] === 'green' ? 'rgb(34 197 94 / 0.2)' :
                                       bgColorClass.replace('bg-', '').split('-')[0] === 'slate' ? 'rgb(100 116 139 / 0.2)' :
                                       bgColorClass.replace('bg-', '').split('-')[0] === 'pink' ? 'rgb(236 72 153 / 0.2)' :
                                       bgColorClass.replace('bg-', '').split('-')[0] === 'yellow' ? 'rgb(234 179 8 / 0.2)' :
                                       bgColorClass.replace('bg-', '').split('-')[0] === 'orange' ? 'rgb(249 115 22 / 0.2)' :
                                       bgColorClass.replace('bg-', '').split('-')[0] === 'cyan' ? 'rgb(6 182 212 / 0.2)' :
                                       bgColorClass.replace('bg-', '').split('-')[0] === 'gray' ? 'rgb(75 85 99 / 0.2)' :
                                       bgColorClass.replace('bg-', '').split('-')[0] === 'blue' ? 'rgb(59 130 246 / 0.2)' :
                                       bgColorClass.replace('bg-', '').split('-')[0] === 'red' ? 'rgb(239 68 68 / 0.2)' : 'transparent'
                    } : {
                      backgroundColor: bgColorClass === 'bg-purple-500' ? 'rgb(168 85 247 / 0.08)' :
                                     bgColorClass === 'bg-green-500' ? 'rgb(34 197 94 / 0.08)' :
                                     bgColorClass === 'bg-slate-500' ? 'rgb(100 116 139 / 0.08)' :
                                     bgColorClass === 'bg-pink-500' ? 'rgb(236 72 153 / 0.08)' :
                                     bgColorClass === 'bg-yellow-500' ? 'rgb(234 179 8 / 0.08)' :
                                     bgColorClass === 'bg-orange-500' ? 'rgb(249 115 22 / 0.08)' :
                                     bgColorClass === 'bg-cyan-500' ? 'rgb(6 182 212 / 0.08)' :
                                     bgColorClass === 'bg-gray-600' ? 'rgb(75 85 99 / 0.08)' :
                                     bgColorClass === 'bg-blue-500' ? 'rgb(59 130 246 / 0.08)' :
                                     bgColorClass === 'bg-red-500' ? 'rgb(239 68 68 / 0.08)' : 'transparent'
                    }}
                    >
                      <div className="flex items-start justify-between gap-2 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold ${isPending ? 'font-bold' : ''} text-sm sm:text-base flex items-center gap-2 mb-1 ${textColorClass} ${isPending ? 'text-yellow-700 dark:text-yellow-300' : ''}`}>
                            <User className="h-4 w-4 flex-shrink-0" />
                            <span className="break-words">{booking.guestName || booking.guestEmail}</span>
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3 flex-shrink-0" />
                              <span>{formatDate(new Date(booking.startDate))} - {formatDate(new Date(booking.endDate))}</span>
                            </div>
                            <span className="hidden sm:inline">•</span>
                            <span>
                              {(() => {
                                const adults = booking.numberOfAdults ?? (booking as any).numberOfGuests ?? 1;
                                const children = booking.numberOfChildren ?? 0;
                                const total = adults + children;
                                return `${total} ${total === 1 ? "Gast" : "Gäste"}${children > 0 ? ` (${children} ${children === 1 ? "Kind" : "Kinder"})` : ""}`;
                              })()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <Badge variant={getStatusBadgeVariant(booking.status)} className="text-xs">
                            {getStatusLabel(booking.status)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            
            {/* Manuelle Blockierungen */}
            {monthEvents.map((event) => {
              const colorStyle = getEventColorStyle(event.colorId);
              return (
                <div
                  key={event.id}
                  className="p-3 rounded-lg border flex items-start justify-between gap-3 hover:bg-muted/50 transition-colors cursor-pointer"
                  style={colorStyle}
                  onClick={() => {
                    const eventStart = new Date(event.start);
                    setSelectedDayForDetails(eventStart.getDate());
                    setIsDetailDialogOpen(true);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <span className="font-semibold text-sm truncate">{event.summary}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span>
                        {formatDate(event.start)} - {formatDate(event.end)}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="flex-shrink-0 text-xs">
                    Blockierung
                  </Badge>
                </div>
              );
            })}
            
            {monthBookings.length === 0 && monthEvents.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Keine Buchungen oder Blockierungen in diesem Monat
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detail-Dialog für Tag mit Buchungen */}
      {selectedDayForDetails !== null && (
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[95vh] sm:max-h-[80vh] overflow-y-auto w-[100vw] sm:w-full mx-0 sm:mx-0 p-2.5 sm:p-6">
            <DialogHeader className="pb-2 sm:pb-0">
              <DialogTitle className="text-sm sm:text-lg leading-tight">
                {new Date(year, month, selectedDayForDetails).toLocaleDateString("de-DE", { 
                  weekday: "long", 
                  day: "numeric", 
                  month: "long", 
                  year: "numeric" 
                })}
              </DialogTitle>
              <DialogDescription className="text-[10px] sm:text-sm mt-0.5 sm:mt-1">
                Alle Buchungen und Termine für diesen Tag
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 sm:space-y-3 mt-1 sm:mt-4">
              {(() => {
                const dayBookings = getBookingsForDay(selectedDayForDetails);
                const dayEvents = getEventsForDay(selectedDayForDetails);
                const overlappingEventGroups = findOverlappingEvents(dayEvents);
                
                if (dayBookings.length === 0 && dayEvents.length === 0) {
                  return (
                    <div className="text-center py-4 sm:py-8 text-muted-foreground text-xs sm:text-base">
                      Keine Buchungen oder Termine an diesem Tag
                    </div>
                  );
                }

                return (
                  <>
                    {/* Zeige Warnung und Zusammenleg-Button wenn überlappende Events vorhanden */}
                    {overlappingEventGroups.length > 0 && (
                      <>
                        {overlappingEventGroups.map((group, idx) => {
                          // Prüfe ob alle Events bereits die gleiche Farbe haben
                          const allSameColor = group.length > 0 && group.every(e => {
                            const event = calendarEvents.find(ce => ce.id === e.id);
                            const firstColorId = calendarEvents.find(ce => ce.id === group[0].id)?.colorId;
                            return event?.colorId && event.colorId !== '10' && event.colorId === firstColorId;
                          });

                          if (allSameColor) {
                            return (
                              <div key={idx} className="p-2 sm:p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md sm:rounded-lg">
                                <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-4">
                                  <div className="flex items-start gap-1.5 sm:gap-2 flex-1 min-w-0">
                                    <CheckCircle2 className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-semibold text-xs sm:text-base text-green-900 dark:text-green-100 mb-0.5 sm:mb-1 leading-tight">
                                        Bereits zusammengelegt ({group.length} Events)
                                      </h4>
                                      <p className="text-[10px] sm:text-sm text-green-700 dark:text-green-300 mb-1 sm:mb-2 leading-tight">
                                        Diese Events haben die gleiche Farbe und werden als zusammengehörig erkannt:
                                      </p>
                                      <ul className="text-[10px] sm:text-sm text-green-700 dark:text-green-300 space-y-0.5 sm:space-y-1 list-disc list-inside leading-tight">
                                        {group.map((e) => (
                                          <li key={e.id} className="truncate">
                                            {e.summary} ({formatDate(e.start)} - {formatDate(e.end)})
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleUngroupEvents(group.map(e => e.id))}
                                    disabled={isUngrouping}
                                    className="w-full sm:w-auto flex-shrink-0 border-green-300 dark:border-green-700 h-8 sm:h-8 text-[10px] sm:text-sm mt-1 sm:mt-0"
                                  >
                                    <Unlink className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                                    {isUngrouping ? "Trennen..." : "Trennen"}
                                  </Button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={idx} className="p-2 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md sm:rounded-lg">
                              <div className="mb-1.5 sm:mb-3">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-xs sm:text-base text-yellow-900 dark:text-yellow-100 mb-0.5 sm:mb-1 leading-tight">
                                    Überlappende Events gefunden ({group.length} Events)
                                  </h4>
                                  <p className="text-[10px] sm:text-sm text-yellow-700 dark:text-yellow-300 mb-1 sm:mb-2 leading-tight">
                                    Diese Events überlappen sich. Du kannst sie zusammenlegen, damit sie als zusammengehörig erkannt werden:
                                  </p>
                                  <ul className="text-[10px] sm:text-sm text-yellow-700 dark:text-yellow-300 space-y-0.5 sm:space-y-1 list-disc list-inside mb-1.5 sm:mb-3 leading-tight">
                                    {group.map((e) => (
                                      <li key={e.id} className="truncate">
                                        {e.summary} ({formatDate(e.start)} - {formatDate(e.end)})
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleGroupEvents(group.map(e => e.id))}
                                disabled={isGrouping}
                                className="w-full sm:w-auto border-yellow-300 dark:border-yellow-700 h-8 sm:h-8 text-[10px] sm:text-sm"
                              >
                                <LinkIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                                {isGrouping ? "Zusammenlegen..." : `${group.length} Events zusammenlegen`}
                              </Button>
                            </div>
                          );
                        })}
                      </>
                    )}
                    
                    {dayBookings.map((booking) => {
                      const bgColorClass = getBookingColorClass(booking.id);
                      const textColorClass = getBookingTextColorClass(booking.id);
                      const isPending = booking.status === "PENDING";
                      
                      return (
                        <Link
                          key={booking.id}
                          href={`/admin/bookings/${booking.id}?from=calendar&month=${month + 1}&year=${year}`}
                          className="block"
                        >
                          <div className={`
                            p-2 sm:p-4 border-2 rounded-md sm:rounded-lg hover:opacity-90 transition-all cursor-pointer
                            ${isPending ? 'border-dashed border-yellow-500 dark:border-yellow-400 opacity-100 shadow-md bg-yellow-50/50 dark:bg-yellow-900/20' : ''}
                          `}
                          style={isPending ? {
                            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(234, 179, 8, 0.15) 4px, rgba(234, 179, 8, 0.15) 8px)`,
                            backgroundColor: bgColorClass.replace('bg-', '').split('-')[0] === 'purple' ? 'rgb(168 85 247 / 0.2)' :
                                             bgColorClass.replace('bg-', '').split('-')[0] === 'green' ? 'rgb(34 197 94 / 0.2)' :
                                             bgColorClass.replace('bg-', '').split('-')[0] === 'slate' ? 'rgb(100 116 139 / 0.2)' :
                                             bgColorClass.replace('bg-', '').split('-')[0] === 'pink' ? 'rgb(236 72 153 / 0.2)' :
                                             bgColorClass.replace('bg-', '').split('-')[0] === 'yellow' ? 'rgb(234 179 8 / 0.2)' :
                                             bgColorClass.replace('bg-', '').split('-')[0] === 'orange' ? 'rgb(249 115 22 / 0.2)' :
                                             bgColorClass.replace('bg-', '').split('-')[0] === 'cyan' ? 'rgb(6 182 212 / 0.2)' :
                                             bgColorClass.replace('bg-', '').split('-')[0] === 'gray' ? 'rgb(75 85 99 / 0.2)' :
                                             bgColorClass.replace('bg-', '').split('-')[0] === 'blue' ? 'rgb(59 130 246 / 0.2)' :
                                             bgColorClass.replace('bg-', '').split('-')[0] === 'red' ? 'rgb(239 68 68 / 0.2)' : 'transparent'
                          } : {
                            backgroundColor: bgColorClass === 'bg-purple-500' ? 'rgb(168 85 247 / 0.1)' :
                                           bgColorClass === 'bg-green-500' ? 'rgb(34 197 94 / 0.1)' :
                                           bgColorClass === 'bg-slate-500' ? 'rgb(100 116 139 / 0.1)' :
                                           bgColorClass === 'bg-pink-500' ? 'rgb(236 72 153 / 0.1)' :
                                           bgColorClass === 'bg-yellow-500' ? 'rgb(234 179 8 / 0.1)' :
                                           bgColorClass === 'bg-orange-500' ? 'rgb(249 115 22 / 0.1)' :
                                           bgColorClass === 'bg-cyan-500' ? 'rgb(6 182 212 / 0.1)' :
                                           bgColorClass === 'bg-gray-600' ? 'rgb(75 85 99 / 0.1)' :
                                           bgColorClass === 'bg-blue-500' ? 'rgb(59 130 246 / 0.1)' :
                                           bgColorClass === 'bg-red-500' ? 'rgb(239 68 68 / 0.1)' : 'transparent'
                          }}
                          >
                            <div className="flex items-start justify-between gap-2 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                <div className={`font-medium ${isPending ? 'font-bold' : ''} text-xs sm:text-base flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2 ${textColorClass} ${isPending ? 'text-yellow-700 dark:text-yellow-300' : ''} leading-tight`}>
                                  <User className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                  <span className="break-words leading-tight">{booking.guestName || booking.guestEmail}</span>
                                </div>
                                <div className="text-[10px] sm:text-sm text-muted-foreground flex items-center gap-1.5 sm:gap-2 flex-wrap leading-tight">
                                  <div className="flex items-center gap-1.5 sm:gap-2">
                                    <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                    <span className="break-words leading-tight">{formatDate(new Date(booking.startDate))} - {formatDate(new Date(booking.endDate))}</span>
                                  </div>
                                  <span className="hidden sm:inline">•</span>
                                  <span className="leading-tight">
                                    {(() => {
                                      const adults = booking.numberOfAdults ?? (booking as any).numberOfGuests ?? 1;
                                      const children = booking.numberOfChildren ?? 0;
                                      const total = adults + children;
                                      return `${total} ${total === 1 ? "Gast" : "Gäste"}${children > 0 ? ` (${children} ${children === 1 ? "Kind" : "Kinder"})` : ""}`;
                                    })()}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <Badge variant={getStatusBadgeVariant(booking.status)} className="text-[10px] sm:text-xs">
                                  {getStatusLabel(booking.status)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                    
                    {dayEvents.map((event) => {
                      const eventData = calendarEvents.find(e => e.id === event.id);
                      const isInfo = eventData?.colorId === '10';
                      const dialogColorStyle = getEventDialogColorStyle(eventData?.colorId);
                      
                      return (
                        <div
                          key={event.id}
                          className="p-2 sm:p-4 border rounded-md sm:rounded-lg"
                          style={dialogColorStyle}
                        >
                          <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                            <div className="font-medium flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                              {isInfo ? (
                                <Info className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                              ) : (
                              <svg className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                              </svg>
                              )}
                              <span className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                                <span className="truncate text-xs sm:text-base leading-tight">{event.summary}</span>
                                {isInfo && (
                                  <Badge variant="secondary" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700 text-[10px] sm:text-xs flex-shrink-0">
                                    <Info className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                                    Info
                                  </Badge>
                                )}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => isInfo ? handleUnmarkAsInfo(event.id) : handleMarkAsInfo(event.id)}
                              disabled={markingEventId === event.id}
                              className="flex-shrink-0 h-7 w-7 sm:h-9 sm:w-9 p-0"
                              title={isInfo ? "Info-Markierung entfernen (wird wieder blockierend)" : "Als Info markieren (nicht blockierend)"}
                            >
                              {markingEventId === event.id ? (
                                <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                              ) : isInfo ? (
                                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              ) : (
                                <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              )}
                            </Button>
                          </div>
                          <div className="text-[10px] sm:text-sm text-muted-foreground flex items-center gap-1.5 sm:gap-2 leading-tight">
                            <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                            <span className="break-words leading-tight">{formatDate(event.start)} - {formatDate(event.end)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Bestätigungsdialog für Info-Markierung */}
      <AlertDialog open={confirmInfoDialogOpen} onOpenChange={setConfirmInfoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Event als Info markieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du dieses Event wirklich als Info markieren? Info-Events werden nicht mehr als blockierend angezeigt und erscheinen nicht mehr im Kalender.
              {eventToMarkAsInfo && (() => {
                const event = calendarEvents.find(e => e.id === eventToMarkAsInfo);
                return event ? (
                  <div className="mt-2 p-2 bg-muted rounded text-sm">
                    <strong>{event.summary}</strong>
                    <br />
                    {formatDate(event.start)} - {formatDate(event.end)}
                  </div>
                ) : null;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMarkAsInfo}>
              Als Info markieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      
      <AdminBookingForm 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen}
        initialStartDate={selectedStartDate}
        initialEndDate={selectedEndDate}
      />
    </div>
  );
}

