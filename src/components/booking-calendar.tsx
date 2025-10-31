"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAvailability();
  }, [currentMonth]);

  const loadAvailability = async () => {
    setIsLoading(true);
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 2, 0);

    try {
      const response = await fetch(
        `/api/bookings/availability?start=${start.toISOString()}&end=${end.toISOString()}`
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
    const dateStr = date.toISOString().split("T")[0];
    return blockedDates.includes(dateStr);
  };

  const isDateInPast = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isDateSelected = (date: Date): boolean => {
    if (!selectedStartDate || !selectedEndDate) return false;
    return date >= selectedStartDate && date <= selectedEndDate;
  };

  const handleDateClick = (date: Date) => {
    if (isDateBlocked(date) || isDateInPast(date)) return;

    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      // Neue Auswahl starten
      onDateSelect(date, null);
    } else {
      // Enddatum setzen
      if (date > selectedStartDate) {
        // Prüfen ob Zeitraum verfügbar ist
        const isRangeAvailable = checkRangeAvailable(selectedStartDate, date);
        if (isRangeAvailable) {
          onDateSelect(selectedStartDate, date);
        }
      } else {
        // Wenn vor Startdatum, neues Startdatum
        onDateSelect(date, null);
      }
    }
  };

  const checkRangeAvailable = (start: Date, end: Date): boolean => {
    const current = new Date(start);
    while (current <= end) {
      if (isDateBlocked(current)) {
        return false;
      }
      current.setDate(current.getDate() + 1);
    }
    return true;
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const monthName = currentMonth.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });

  const weekDays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const days = getDaysInMonth(currentMonth);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={previousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="capitalize">{monthName}</CardTitle>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Wählen Sie Ihren gewünschten Zeitraum
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Lade Kalender...</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2 mb-2">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} />;
                }

                const blocked = isDateBlocked(day);
                const past = isDateInPast(day);
                const selected = isDateSelected(day);
                const isStart = selectedStartDate?.toDateString() === day.toDateString();
                const isEnd = selectedEndDate?.toDateString() === day.toDateString();

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => handleDateClick(day)}
                    disabled={blocked || past}
                    className={cn(
                      "aspect-square rounded-md text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      selected && "bg-primary text-primary-foreground hover:bg-primary/90",
                      (isStart || isEnd) && "font-bold",
                      blocked && "bg-red-100 hover:bg-red-100",
                      past && "text-muted-foreground"
                    )}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-primary" />
                <span>Ausgewählt</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-red-100" />
                <span>Belegt</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

