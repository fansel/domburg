"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";

interface BookingCalendarProps {
  selectedStartDate: Date | null;
  selectedEndDate: Date | null;
  onDateSelect: (start: Date | null, end: Date | null) => void;
}

export function BookingCalendar({
  selectedStartDate,
  selectedEndDate,
  onDateSelect,
}: BookingCalendarProps) {
  const { t, language } = useTranslation();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstAllowedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  // Initialisiere mit dem ersten erlaubten Monat (nicht in der Vergangenheit)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const initial = new Date();
    if (initial < firstAllowedMonth) {
      return firstAllowedMonth;
    }
    return initial;
  });
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Starte ohne Ladeanzeige
  const [maxBookingDate, setMaxBookingDate] = useState<Date | null>(null);
  
  // Stelle sicher, dass currentMonth nie vor dem ersten erlaubten Monat liegt
  useEffect(() => {
    const currentMonthTime = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getTime();
    const firstAllowedTime = firstAllowedMonth.getTime();
    if (currentMonthTime < firstAllowedTime) {
      setCurrentMonth(new Date(firstAllowedMonth));
    }
  }, [currentMonth, firstAllowedMonth]);

  // Verfügbarkeit laden beim ersten Render und wenn sich Monat ändert
  useEffect(() => {
    loadAvailability();
  }, [currentMonth]);

  const loadAvailability = async () => {
    // Setze isLoading nur für Klick-Prevention, aber zeige kein Overlay
    setIsLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = today; // Ab heute
    
    // Lade maximale Buchungsdatum von der API
    // Priorität: BOOKING_LIMIT_DATE (wenn aktiviert) > BOOKING_ADVANCE_OCTOBER_TO_NEXT_YEAR (wenn aktiviert)
    let end: Date | null = null;
    try {
      // Prüfe zuerst explizites Buchungslimit (nur wenn aktiviert)
      const limitResponse = await fetch('/api/admin/booking-limit-setting');
      const limitData = await limitResponse.json();
      
      if (limitData.enabled === true && limitData.date && limitData.date !== "") {
        // Parse Datum als lokales Datum (YYYY-MM-DD Format)
        const dateParts = limitData.date.split('-');
        if (dateParts.length === 3) {
          const year = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10) - 1; // Monat ist 0-basiert
          const day = parseInt(dateParts[2], 10);
          const limitDate = new Date(year, month, day, 23, 59, 59, 999);
          if (!isNaN(limitDate.getTime())) {
            end = limitDate;
            setMaxBookingDate(limitDate);
          }
        }
      }
      
      // Wenn kein explizites Limit gesetzt ist, prüfe Oktober-Regel
      if (end === null) {
      const settingResponse = await fetch('/api/admin/booking-advance-setting');
      const settingData = await settingResponse.json();
      const enabled = settingData.enabled === true;
        
        if (enabled) {
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      
          if (currentMonth >= 10) {
        // Ab Oktober: Bis Ende des nächsten Jahres
        end = new Date(currentYear + 1, 11, 31);
      } else {
        // Vor Oktober: Bis Ende des aktuellen Jahres
        end = new Date(currentYear, 11, 31);
      }
      setMaxBookingDate(end);
        } else {
          // Beide Limits deaktiviert - kein Limit (zeige 2 Jahre in die Zukunft)
          end = new Date(today.getFullYear() + 2, 11, 31);
          setMaxBookingDate(null); // null = kein Limit
        }
      }
    } catch {
      // Fallback: 2 Jahre in die Zukunft wenn kein Limit
      end = new Date(today.getFullYear() + 2, 11, 31);
      setMaxBookingDate(null);
    }

    try {
      // Wenn kein Limit, verwende 2 Jahre in die Zukunft für Verfügbarkeitsprüfung
      const availabilityEnd = end || new Date(today.getFullYear() + 2, 11, 31);
      const response = await fetch(
        `/api/bookings/availability?start=${start.toISOString()}&end=${availabilityEnd.toISOString()}`
      );
      const data = await response.json();
      setBlockedDates(data.blockedDates || []);
    } catch (error) {
      console.error("Error loading availability:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Leere Tage am Anfang
    for (let i = 0; i < (startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1); i++) {
      days.push(null);
    }

    // Tatsächliche Tage
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const isDateBlocked = (date: Date): boolean => {
    // Konvertiere lokales Datum zu YYYY-MM-DD String (ohne Timezone-Umwandlung)
    // date ist bereits in lokaler Zeitzone (z.B. new Date(2025, 10, 10) für 10. November)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return blockedDates.includes(dateStr);
  };

  const isDateInPast = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };
  
  const isDateAfterMaxBookingDate = (date: Date): boolean => {
    // Wenn maxBookingDate null ist, gibt es kein Limit
    if (maxBookingDate === null) return false;
    const maxDate = new Date(maxBookingDate);
    maxDate.setHours(23, 59, 59, 999);
    return date > maxDate;
  };

  const isDateSelected = (date: Date): boolean => {
    if (!selectedStartDate || !selectedEndDate) return false;
    return date >= selectedStartDate && date <= selectedEndDate;
  };

  const handleDateClick = (date: Date) => {
    // Warte bis Daten geladen sind
    if (isLoading) return;
    // Vergangene Daten können nicht gewählt werden
    if (isDateInPast(date)) return;
    // Daten nach maximalem Buchungsdatum können nicht gewählt werden
    if (isDateAfterMaxBookingDate(date)) return;

    // Wenn noch kein Startdatum gewählt wurde, kann nur ein nicht-blockierter Tag als Startdatum gewählt werden
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      // Neue Auswahl starten - nur wenn Tag nicht blockiert ist
      if (isDateBlocked(date)) return;
      onDateSelect(date, null);
    } else {
      // Enddatum setzen - auch blockierte Tage sind als Check-out Tag erlaubt
      if (date > selectedStartDate) {
        // Prüfen ob Zeitraum verfügbar ist (inklusive Check-out Tag)
        const isRangeAvailable = checkRangeAvailable(selectedStartDate, date);
        if (isRangeAvailable) {
          onDateSelect(selectedStartDate, date);
        } else {
          // Wenn Zeitraum nicht verfügbar ist, mache den geklickten Tag zum neuen Startdatum
          // Nur wenn Tag nicht blockiert ist (kann nicht als Startdatum verwendet werden, wenn blockiert)
          if (!isDateBlocked(date)) {
            onDateSelect(date, null);
          }
        }
      } else {
        // Wenn vor Startdatum, neues Startdatum - nur wenn nicht blockiert
        if (isDateBlocked(date)) return;
        onDateSelect(date, null);
      }
    }
  };

  const checkRangeAvailable = (start: Date, end: Date): boolean => {
    // Prüfe alle Tage von start bis end (exklusive end)
    // Diese Tage sind blockiert, wenn sie zwischen Check-in und Check-out einer bestehenden Buchung liegen
    const current = new Date(start);
    while (current < end) {
      if (isDateBlocked(current)) {
        return false;
      }
      current.setDate(current.getDate() + 1);
    }
    
    // WICHTIG: Prüfe auch den Check-out Tag (end)
    // Er ist blockiert, wenn er zwischen Check-in und Check-out einer bestehenden Buchung liegt
    // (Check-out Tag kann nicht als Check-out verwendet werden, wenn er während einer anderen Buchung liegt)
    if (isDateBlocked(end)) {
      return false;
    }
    
    return true;
  };

  const previousMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
    const newMonthTime = new Date(newMonth.getFullYear(), newMonth.getMonth(), 1).getTime();
    const firstAllowedTime = firstAllowedMonth.getTime();
    // Verhindere Zurückblättern vor dem ersten erlaubten Monat
    if (newMonthTime >= firstAllowedTime) {
      setCurrentMonth(newMonth);
    }
  };

  // Maximal erlaubter Monat: Basierend auf maxBookingDate
  const nextMonth = () => {
    // Wenn kein Limit (null), erlaube 2 Jahre in die Zukunft
    if (maxBookingDate === null) {
      const maxAllowed = new Date(today.getFullYear() + 2, 11, 31);
      const maxMonth = new Date(maxAllowed.getFullYear(), maxAllowed.getMonth(), 1);
      const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
      const newMonthTime = new Date(newMonth.getFullYear(), newMonth.getMonth(), 1).getTime();
      const maxAllowedTime = maxMonth.getTime();
      if (newMonthTime <= maxAllowedTime) {
        setCurrentMonth(newMonth);
      }
      return;
    }
    
    const maxMonth = new Date(maxBookingDate.getFullYear(), maxBookingDate.getMonth(), 1);
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    const newMonthTime = new Date(newMonth.getFullYear(), newMonth.getMonth(), 1).getTime();
    const maxAllowedTime = maxMonth.getTime();
    // Verhindere Vorblättern über maximales Buchungsdatum hinaus
    if (newMonthTime <= maxAllowedTime) {
      setCurrentMonth(newMonth);
    }
  };
  
  // Prüfe ob Zurück-Button deaktiviert werden soll
  const currentMonthTime = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getTime();
  const firstAllowedTime = firstAllowedMonth.getTime();
  const canGoBack = currentMonthTime > firstAllowedTime;
  
  // Prüfe ob Vorwärts-Button deaktiviert werden soll (basierend auf maxBookingDate)
  const canGoForward = (() => {
    if (maxBookingDate === null) {
      // Kein Limit: Erlaube bis 2 Jahre in die Zukunft
      const maxAllowed = new Date(today.getFullYear() + 2, 11, 31);
      const maxMonth = new Date(maxAllowed.getFullYear(), maxAllowed.getMonth(), 1);
      return currentMonthTime < maxMonth.getTime();
    }
    const maxMonth = new Date(maxBookingDate.getFullYear(), maxBookingDate.getMonth(), 1);
    return currentMonthTime < maxMonth.getTime();
  })();

  // Monatsnamen aus Übersetzungen
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
    t("calendar.months.december")
  ];

  const weekDays = [
    t("calendar.weekdays.monday"),
    t("calendar.weekdays.tuesday"),
    t("calendar.weekdays.wednesday"),
    t("calendar.weekdays.thursday"),
    t("calendar.weekdays.friday"),
    t("calendar.weekdays.saturday"),
    t("calendar.weekdays.sunday")
  ];

  const month = currentMonth.getMonth();
  const year = currentMonth.getFullYear();
  const monthName = `${monthNames[month]} ${year}`;
  const days = getDaysInMonth(currentMonth);

  return (
    <Card>
      <CardHeader className="pb-3 lg:pb-4">
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-9 w-9 lg:h-10 lg:w-10"
            onClick={previousMonth}
            disabled={!canGoBack}
          >
            <ChevronLeft className="h-4 w-4 lg:h-5 lg:w-5" />
          </Button>
          <CardTitle className="text-lg lg:text-xl font-semibold">{monthName}</CardTitle>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-9 w-9 lg:h-10 lg:w-10"
            onClick={nextMonth}
            disabled={!canGoForward}
          >
            <ChevronRight className="h-4 w-4 lg:h-5 lg:w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2 lg:gap-3 mb-3 lg:mb-4">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-sm lg:text-base font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>
        {/* Keine Ladeanzeige - Kalender wird sofort angezeigt, blockierte Termine erscheinen nach dem Laden */}
        <div className={cn("grid grid-cols-7 gap-2 lg:gap-3", isLoading && "pointer-events-none")}>
          {days.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} />;
            }

            const blocked = isDateBlocked(day);
            const past = isDateInPast(day);
            const afterMax = isDateAfterMaxBookingDate(day);
            const selected = isDateSelected(day);
            const isStart = selectedStartDate?.toDateString() === day.toDateString();
            const isEnd = selectedEndDate?.toDateString() === day.toDateString();
            
            // Vergleiche Datum nur auf Tag-Ebene (ohne Zeit)
            // Normalisiere beide Dates auf Mitternacht für korrekten Vergleich
            const normalizeDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const dayNormalized = normalizeDate(day);
            const startNormalized = selectedStartDate ? normalizeDate(selectedStartDate) : null;
            const dayIsAfterStart = startNormalized ? dayNormalized > startNormalized : false;
            
            // Ein Tag ist nur disabled wenn:
            // - Er in der Vergangenheit liegt, ODER
            // - Er nach dem maximalen Buchungsdatum liegt, ODER
            // - Er blockiert ist UND (kein Startdatum gewählt ODER er ist vor/vom Startdatum)
            // Blockierte Tage NACH dem Startdatum können als Check-out gewählt werden
            const isDisabled = past || afterMax || (blocked && (!selectedStartDate || !dayIsAfterStart));
            
            // Ein Tag sollte rot angezeigt werden wenn er blockiert ist UND nicht als Check-out Tag für die aktuelle Auswahl verwendet wird
            // Blockierte Tage sind immer rot, außer wenn sie als Check-out Tag verwendet werden (selectedEndDate)
            // WICHTIG: Auch wenn ein Startdatum gewählt wurde, sollten blockierte Tage weiterhin rot sein
            const isActuallyBlocked = blocked && !selected && !(selectedEndDate && dayNormalized.getTime() === selectedEndDate.getTime());

            return (
              <button
                key={day.toISOString()}
                onClick={() => handleDateClick(day)}
                disabled={isDisabled || isLoading}
                className={cn(
                  "aspect-square rounded-md text-sm lg:text-base font-medium transition-colors",
                  // Blockierte Tage haben immer die gleiche rote Farbe
                  isActuallyBlocked && "bg-red-100 hover:bg-red-100",
                  // Selected hat Priorität über blockiert
                  selected && "bg-primary text-primary-foreground hover:bg-primary/90",
                  // Hover nur wenn nicht blockiert und nicht selected
                  !isActuallyBlocked && !selected && "hover:bg-accent hover:text-accent-foreground",
                  "disabled:cursor-not-allowed",
                  // Disabled-Opacity nur wenn nicht blockiert (blockierte Tage sollen immer voll sichtbar sein)
                  isDisabled && !isActuallyBlocked && "disabled:opacity-50",
                  (isStart || isEnd) && "font-bold lg:text-lg",
                  past && "text-muted-foreground"
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
        <div className="mt-4 lg:mt-6 flex gap-6 lg:gap-8 text-sm lg:text-base justify-center">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 lg:h-5 lg:w-5 rounded bg-primary" />
            <span>{t("calendar.legend.selected")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 lg:h-5 lg:w-5 rounded bg-red-100" />
            <span>{t("calendar.legend.occupied")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

