"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, User, Calendar, RefreshCw, Info, X, Plus } from "lucide-react";
import type { Booking } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markEventAsInfo, unmarkEventAsInfo } from "@/app/actions/google-calendar";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { AdminBookingForm } from "@/components/admin/admin-booking-form";

interface CalendarEvent {
  id: string;
  summary: string;
  start: Date;
  end: Date;
  colorId?: string;
}

interface BookingCalendarViewProps {
  bookings: Booking[];
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
  const router = useRouter();
  const { toast } = useToast();

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

  const handleMarkAsInfo = async (eventId: string) => {
    setMarkingEventId(eventId);
    const result = await markEventAsInfo(eventId);
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
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    
    bookings.forEach((booking) => {
      const start = new Date(booking.startDate);
      const end = new Date(booking.endDate);
      
      // Für jeden Tag der Buchung einen Eintrag erstellen
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === month && d.getFullYear() === year) {
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const existing = map.get(key) || [];
          existing.push(booking);
          map.set(key, existing);
        }
      }
    });
    
    return map;
  }, [bookings, month, year]);

  // Calendar Events für den aktuellen Monat gruppieren
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    
    calendarEvents.forEach((event) => {
      const start = new Date(event.start);
      const end = new Date(event.end);
      
      // Für jeden Tag des Events einen Eintrag erstellen
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === month && d.getFullYear() === year) {
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const existing = map.get(key) || [];
          existing.push(event);
          map.set(key, existing);
        }
      }
    });
    
    return map;
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
    return bookingsByDate.get(key) || [];
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
    const clickedDate = new Date(year, month, day);
    const dayBookings = getBookingsForDay(day);
    const isCheckOutDay = isCheckOutOnlyDay(day);
    
    // Erlaube Klicks auf leere Tage oder nur Check-out Tage
    if (dayBookings.length > 0 && !isCheckOutDay) {
      return;
    }

    // Wenn noch kein Startdatum gesetzt ist, setze es
    if (!selectedStartDate) {
      setSelectedStartDate(clickedDate);
      setSelectedEndDate(null);
      return;
    }

    // Wenn Startdatum gesetzt ist
    if (selectedStartDate) {
      // Wenn auf dasselbe Datum geklickt wird, öffne Formular mit einem Tag
      if (clickedDate.getTime() === selectedStartDate.getTime()) {
        setSelectedEndDate(clickedDate);
        setIsFormOpen(true);
        return;
      }

      // Wenn auf ein früheres Datum geklickt wird, setze es als neues Startdatum
      if (clickedDate < selectedStartDate) {
        setSelectedStartDate(clickedDate);
        setSelectedEndDate(null);
        return;
      }

      // Wenn auf ein späteres Datum geklickt wird, setze es als Enddatum und öffne Formular
      if (clickedDate > selectedStartDate) {
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">
                {monthNames[month]} {year}
              </CardTitle>
              <CardDescription>
                {bookings.length} {bookings.length === 1 ? "Buchung" : "Buchungen"}
                {calendarEvents.length > 0 && ` • ${calendarEvents.length} blockierte Termine`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="default"
                size="sm"
                onClick={() => setIsFormOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Neue Buchung
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Aktualisieren
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Heute
              </Button>
              <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Wochentage Header */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-semibold text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Kalender-Tage */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const dayBookings = getBookingsForDay(day);
              const dayEvents = getEventsForDay(day);
              const today = isToday(day);
              const totalItems = dayBookings.length + dayEvents.length;
              const isSelected = isDaySelected(day);
              const isEmpty = totalItems === 0;
              const isCheckOutDay = isCheckOutOnlyDay(day);
              const isClickable = isEmpty || isCheckOutDay;

              return (
                <div
                  key={day}
                  onClick={() => isClickable && handleDayClick(day)}
                  className={`
                    aspect-square border rounded-lg p-2
                    ${today ? "border-primary bg-primary/5" : "border-border"}
                    ${totalItems > 0 && !isCheckOutDay ? "bg-muted/50" : ""}
                    ${isSelected ? "bg-primary/20 border-primary border-2" : ""}
                    ${isCheckOutDay ? "border-dashed border-primary/50" : ""}
                    ${isClickable ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""}
                  `}
                  title={isCheckOutDay ? "Check-out Tag - Klicken für neue Buchung möglich" : undefined}
                >
                  <div className="h-full flex flex-col">
                    <div
                      className={`
                        text-sm font-medium mb-1
                        ${today ? "text-primary font-bold" : "text-foreground"}
                      `}
                    >
                      {day}
                    </div>
                    <div className="flex-1 space-y-1 overflow-hidden">
                      {/* Buchungen anzeigen */}
                      {dayBookings.slice(0, 2).map((booking) => (
                        <Link
                          key={booking.id}
                          href={`/admin/bookings/${booking.id}?from=calendar&month=${month + 1}&year=${year}`}
                          className="block"
                        >
                          <div
                            className={`
                              text-xs p-1 rounded truncate cursor-pointer
                              hover:opacity-80 transition-opacity
                              ${
                                booking.status === "APPROVED"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-secondary-foreground"
                              }
                            `}
                            title={`${booking.guestName || booking.guestEmail} - ${getStatusLabel(booking.status)}`}
                          >
                            {booking.guestName?.split(" ")[0] || booking.guestEmail.split("@")[0]}
                          </div>
                        </Link>
                      ))}
                      
                      {/* Calendar Events anzeigen */}
                      {dayEvents.slice(0, Math.max(0, 2 - dayBookings.length)).map((event) => (
                        <div
                          key={event.id}
                          className="text-xs p-1 rounded truncate bg-orange-100 dark:bg-orange-900 text-orange-900 dark:text-orange-100 border border-orange-300 dark:border-orange-700 group relative"
                          title={`Blockiert: ${event.summary}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{event.summary}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleMarkAsInfo(event.id)}
                              disabled={markingEventId === event.id}
                              title="Als Info markieren (blockiert nicht mehr)"
                            >
                              <Info className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      {totalItems > 2 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{totalItems - 2}
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

      {/* Buchungsliste */}
      <Card>
        <CardHeader>
          <CardTitle>{t("calendar.bookingsInMonth", { month: monthNames[month] })}</CardTitle>
          <CardDescription>
            {t("calendar.detailedOverview")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bookings.filter((b) => {
            const start = new Date(b.startDate);
            const end = new Date(b.endDate);
            return (
              (start.getMonth() === month && start.getFullYear() === year) ||
              (end.getMonth() === month && end.getFullYear() === year) ||
              (start < new Date(year, month, 1) && end > new Date(year, month + 1, 0))
            );
          }).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t("calendar.noBookingsInMonth")}
            </div>
          ) : (
            <div className="space-y-3">
              {bookings
                .filter((b) => {
                  const start = new Date(b.startDate);
                  const end = new Date(b.endDate);
                  return (
                    (start.getMonth() === month && start.getFullYear() === year) ||
                    (end.getMonth() === month && end.getFullYear() === year) ||
                    (start < new Date(year, month, 1) && end > new Date(year, month + 1, 0))
                  );
                })
                .map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/admin/bookings/${booking.id}?from=calendar&month=${month + 1}&year=${year}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {booking.guestName || booking.guestEmail}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(booking.startDate).toLocaleDateString("de-DE")} -{" "}
                            {new Date(booking.endDate).toLocaleDateString("de-DE")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-muted-foreground">
                          {booking.numberOfGuests} {booking.numberOfGuests === 1 ? "Gast" : "Gäste"}
                        </div>
                        <Badge variant={getStatusBadgeVariant(booking.status)}>
                          {getStatusLabel(booking.status)}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <AdminBookingForm 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen}
        initialStartDate={selectedStartDate}
        initialEndDate={selectedEndDate}
      />
    </div>
  );
}

