
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";

interface CalendarDay {
  type?: 'arrival' | 'departure' | 'both' | 'occupied';
  isCheckIn?: boolean;
  isCheckOut?: boolean;
  periodIds?: Array<{ id: string; colorIndex: number }>;
  bookings?: number;
}

interface HousekeepingCalendarProps {
  title?: string;
  description?: string;
  showHeader?: boolean;
  headerActions?: React.ReactNode;
}

export function HousekeepingCalendar({ 
  title,
  description,
  showHeader = true,
  headerActions
}: HousekeepingCalendarProps) {
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const [calendarData, setCalendarData] = useState<Record<string, CalendarDay>>({});
  const [periods, setPeriods] = useState<Array<{ id: string; start: string; end: string; type: 'booking' | 'external'; colorIndex: number }>>([]);
  const [colorPalette, setColorPalette] = useState<Array<{ bg: string; border: string; label: string }>>([]);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(false);

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  // Kalender laden
  const loadCalendar = async () => {
    // Setze isLoading nur für Klick-Prevention
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/cleaning/calendar?month=${month}&year=${year}`
      );
      const data = await response.json();
      setCalendarData(data.calendarData || {});
      setPeriods(data.periods || []);
      setColorPalette(data.colorPalette || []);
    } catch (error) {
      console.error("Error loading calendar:", error);
      toast({
        title: t("housekeeping.error"),
        description: t("housekeeping.calendarNotLoaded"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Kalender neu laden wenn Monat sich ändert
  useEffect(() => {
    loadCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const goToPreviousMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(year, month + 1, 1);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  // Monatsnamen
  const monthNames = [
    t("housekeeping.months.january"),
    t("housekeeping.months.february"),
    t("housekeeping.months.march"),
    t("housekeeping.months.april"),
    t("housekeeping.months.may"),
    t("housekeeping.months.june"),
    t("housekeeping.months.july"),
    t("housekeeping.months.august"),
    t("housekeeping.months.september"),
    t("housekeeping.months.october"),
    t("housekeeping.months.november"),
    t("housekeeping.months.december")
  ];

  // Wochentage
  const weekDays = [
    t("housekeeping.weekdays.monday"),
    t("housekeeping.weekdays.tuesday"),
    t("housekeeping.weekdays.wednesday"),
    t("housekeeping.weekdays.thursday"),
    t("housekeeping.weekdays.friday"),
    t("housekeeping.weekdays.saturday"),
    t("housekeeping.weekdays.sunday")
  ];

  // Tage im Monat berechnen
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  // Kalender-Grid erstellen
  const calendarDays: (Date | null)[] = [];
  
  // Leere Tage am Anfang
  for (let i = 0; i < adjustedFirstDay; i++) {
    calendarDays.push(null);
  }
  
  // Tatsächliche Tage
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  return (
    <>
      {showHeader && (
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="pb-3 sm:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                  {title || t("housekeeping.title")}
                </CardTitle>
                <CardDescription className="mt-1 sm:mt-2 text-xs sm:text-sm">
                  {description || t("housekeeping.description")}
                </CardDescription>
              </div>
              {headerActions}
            </div>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex items-center justify-between">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={goToPreviousMonth}
              disabled={isLoading}
              className="h-9 w-9 sm:h-10 sm:w-10 disabled:opacity-50"
              type="button"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <h2 className="text-lg sm:text-xl font-semibold text-center">
                {monthNames[month]} {year}
              </h2>
              <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={goToToday} type="button">
                {t("housekeeping.today")}
              </Button>
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={goToNextMonth}
              disabled={isLoading}
              className="h-9 w-9 sm:h-10 sm:w-10 disabled:opacity-50"
              type="button"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Keine Ladeanzeige - Kalender wird sofort angezeigt, Daten erscheinen nach dem Laden */}
          <div className={isLoading ? "pointer-events-none opacity-50" : ""}>
            {/* Legende */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded relative overflow-hidden flex-shrink-0">
                  <div className="absolute inset-0 bg-green-500" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', opacity: 0.6 }}></div>
                  <div className="absolute inset-0 border-2 border-green-700" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
                </div>
                <span className="text-xs sm:text-sm">{t("housekeeping.legend.arrival")}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded relative overflow-hidden flex-shrink-0">
                  <div className="absolute inset-0 bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)', opacity: 0.6 }}></div>
                  <div className="absolute inset-0 border-2 border-red-700" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                </div>
                <span className="text-xs sm:text-sm">{t("housekeeping.legend.departure")}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded relative overflow-hidden flex-shrink-0">
                  <div className="absolute inset-0 bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                  <div className="absolute inset-0 bg-green-500" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
                  <div className="absolute inset-0 border-2 border-red-700" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                  <div className="absolute inset-0 border-2 border-green-700" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
                </div>
                <span className="text-xs sm:text-sm">{t("housekeeping.legend.arrivalAndDeparture")}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-blue-500 border-2 border-blue-700 flex-shrink-0"></div>
                <span className="text-xs sm:text-sm">{t("housekeeping.legend.occupied")}</span>
              </div>
            </div>

            {/* Kalender-Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {/* Wochentage */}
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground p-1 sm:p-2"
                >
                  {day}
                </div>
              ))}

              {/* Tage */}
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} />;
                }

                // Verwende lokales Datum ohne Zeitzone-Umwandlung (konsistent mit API)
                const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                const dayData = calendarData[dayKey];
                const isToday = day.toDateString() === new Date().toDateString();
                const isPast = day < new Date() && !isToday;

                let bgColor = "";
                let borderColor = "";
                let label = "";
                let isSplit = false;
                let periodColor = "";

                if (dayData) {
                  // Wenn mehrere Perioden, verwende die erste für die Hauptfarbe
                  if (dayData.periodIds && dayData.periodIds.length > 0 && colorPalette.length > 0) {
                    const firstPeriod = dayData.periodIds[0];
                    if (colorPalette[firstPeriod.colorIndex]) {
                      const color = colorPalette[firstPeriod.colorIndex];
                      periodColor = color.bg;
                    }
                  }

                  if (dayData.type === 'both') {
                    isSplit = true;
                    label = t("housekeeping.legend.arrivalAndDeparture");
                    if (periodColor) {
                      bgColor = periodColor;
                      const color = colorPalette[dayData.periodIds?.[0]?.colorIndex || 0];
                      borderColor = `border-2 ${color.border}`;
                    }
                  } else if (dayData.type === 'arrival') {
                    isSplit = true;
                    label = t("housekeeping.legend.arrival");
                    if (periodColor) {
                      bgColor = periodColor;
                      const color = colorPalette[dayData.periodIds?.[0]?.colorIndex || 0];
                      borderColor = `border-2 ${color.border}`;
                    } else {
                      borderColor = "border-2 border-green-700";
                    }
                  } else if (dayData.type === 'departure') {
                    isSplit = true;
                    label = t("housekeeping.legend.departure");
                    if (periodColor) {
                      bgColor = periodColor;
                      const color = colorPalette[dayData.periodIds?.[0]?.colorIndex || 0];
                      borderColor = `border-2 ${color.border}`;
                    } else {
                      borderColor = "border-2 border-red-700";
                    }
                  } else if (dayData.type === 'occupied') {
                    if (dayData.periodIds && dayData.periodIds.length > 0 && colorPalette.length > 0) {
                      const firstPeriod = dayData.periodIds[0];
                      if (colorPalette[firstPeriod.colorIndex]) {
                        const color = colorPalette[firstPeriod.colorIndex];
                        bgColor = color.bg;
                        borderColor = `border ${color.border}`;
                      } else {
                        bgColor = "bg-muted/50";
                        borderColor = "border border-border";
                      }
                    } else {
                      bgColor = periodColor || "bg-muted/50";
                      borderColor = "border border-border";
                    }
                    label = t("housekeeping.legend.occupied");
                  }
                }

                return (
                  <div
                    key={dayKey}
                    className={`
                      aspect-square rounded-md p-0.5 sm:p-1 md:p-2 text-[10px] sm:text-xs md:text-sm
                      flex flex-col items-center justify-center relative overflow-hidden
                      ${isSplit ? "" : bgColor}
                      ${borderColor}
                      ${isPast ? "opacity-60" : ""}
                      ${isToday ? "ring-1 sm:ring-2 ring-primary ring-offset-0 sm:ring-offset-1" : ""}
                    `}
                    title={dayData ? `${label} (${dayData.bookings || 0} ${dayData.bookings === 1 ? t("housekeeping.bookingCount.one").replace("{{count}}", String(dayData.bookings)) : t("housekeeping.bookingCount.other").replace("{{count}}", String(dayData.bookings))})` : ""}
                  >
                    {isSplit && dayData?.periodIds && dayData.periodIds.length > 0 && colorPalette.length > 0 && (
                      <>
                        {dayData.type === 'both' && (() => {
                          if (dayData.periodIds.length === 1) {
                            const color = colorPalette[dayData.periodIds[0].colorIndex];
                            return (
                              <>
                                <div className={`absolute inset-0 ${color.bg}`} style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                                <div className={`absolute inset-0 ${color.bg}`} style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
                              </>
                            );
                          } else {
                            const checkOutPeriods: typeof dayData.periodIds = [];
                            const checkInPeriods: typeof dayData.periodIds = [];
                            
                            dayData.periodIds.forEach(period => {
                              const periodInfo = periods.find(p => p.id === period.id);
                              if (periodInfo) {
                                if (periodInfo.start === dayKey) {
                                  checkInPeriods.push(period);
                                } else if (periodInfo.end === dayKey) {
                                  checkOutPeriods.push(period);
                                }
                              }
                            });
                            
                            const checkOutElements = checkOutPeriods.map((period, idx) => {
                              const color = colorPalette[period.colorIndex];
                              return (
                                <div key={`checkout-${idx}`} className={`absolute inset-0 ${color.bg}`} style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                              );
                            });
                            
                            const checkInElements = checkInPeriods.map((period, idx) => {
                              const color = colorPalette[period.colorIndex];
                              return (
                                <div key={`checkin-${idx}`} className={`absolute inset-0 ${color.bg}`} style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
                              );
                            });
                            
                            return [...checkOutElements, ...checkInElements];
                          }
                        })()}
                        {dayData.type === 'arrival' && dayData.periodIds.length > 0 && (
                          <div className={`absolute inset-0 ${colorPalette[dayData.periodIds[0].colorIndex].bg || 'bg-green-500'}`} style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
                        )}
                        {dayData.type === 'departure' && dayData.periodIds.length > 0 && (
                          <div className={`absolute inset-0 ${colorPalette[dayData.periodIds[0].colorIndex].bg || 'bg-red-500'}`} style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                        )}
                      </>
                    )}
                    {isSplit && (!dayData?.periodIds || dayData.periodIds.length === 0) && (
                      <>
                        {dayData?.type === 'both' && (
                          <>
                            <div className="absolute inset-0 bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)', opacity: 0.6 }}></div>
                            <div className="absolute inset-0 bg-green-500" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', opacity: 0.6 }}></div>
                          </>
                        )}
                        {dayData?.type === 'arrival' && (
                          <div className="absolute inset-0 bg-green-500" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', opacity: 0.6 }}></div>
                        )}
                        {dayData?.type === 'departure' && (
                          <div className="absolute inset-0 bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)', opacity: 0.6 }}></div>
                        )}
                      </>
                    )}
                    {/* Tagesnummer */}
                    <div className="absolute inset-0 flex items-center justify-center relative z-10 pointer-events-none">
                      <span className={`
                        font-medium text-[10px] sm:text-xs md:text-sm
                        ${dayData && dayData.type === 'both' ? "text-white" : ""}
                        ${dayData && (dayData.type === 'arrival' || dayData.type === 'departure') ? "text-foreground" : ""}
                      `}>
                        {day.getDate()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Übersicht der belegten Zeiträume */}
      {(() => {
        // Filtere Perioden: Die, die über den Monatswechsel hinausgehen ODER im aktuellen Monat liegen
        const monthStart = new Date(year, month, 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(year, month + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        const nextMonthStart = new Date(year, month + 1, 1);
        nextMonthStart.setHours(0, 0, 0, 0);
        const prevMonthStart = new Date(year, month - 1, 1);
        prevMonthStart.setHours(0, 0, 0, 0);
        const prevMonthEnd = new Date(year, month, 0);
        prevMonthEnd.setHours(23, 59, 59, 999);
        
        const periodsSpanningMonths = periods.filter((period) => {
          const startDate = new Date(period.start + 'T00:00:00');
          const endDate = new Date(period.end + 'T00:00:00');
          
          // Periode wird angezeigt wenn:
          // 1. Sie über einen Monatswechsel geht (startet im aktuellen Monat und endet im nächsten Monat)
          // 2. ODER startet im Vormonat und endet im aktuellen Monat
          // 3. ODER liegt vollständig im aktuellen Monat
          const startsInCurrentMonth = startDate >= monthStart && startDate <= monthEnd;
          const endsInNextMonth = endDate >= nextMonthStart;
          const startsInPrevMonth = startDate >= prevMonthStart && startDate <= prevMonthEnd;
          const endsInCurrentMonth = endDate >= monthStart && endDate <= monthEnd;
          const fullyInCurrentMonth = startDate >= monthStart && endDate <= monthEnd;
          
          return (startsInCurrentMonth && endsInNextMonth) || (startsInPrevMonth && endsInCurrentMonth) || fullyInCurrentMonth;
        });
        
        return periodsSpanningMonths.length > 0 ? (
          <Card className="mt-4 sm:mt-6">
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">{t("housekeeping.occupiedPeriods.title")}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t("housekeeping.occupiedPeriods.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {periodsSpanningMonths.map((period) => {
                const startDate = new Date(period.start);
                const endDate = new Date(period.end);
                const locale = language === "nl" ? "nl-NL" : language === "en" ? "en-US" : "de-DE";
                const formatDate = (dateStr: string) => {
                  const d = new Date(dateStr);
                  return d.toLocaleDateString(locale, { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric' 
                  });
                };
                const nights = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                const displayDays = period.start === period.end ? 0 : nights;
                const periodColor = colorPalette[period.colorIndex] || { bg: 'bg-gray-500', border: 'border-gray-700' };

                return (
                  <div
                    key={period.id}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-2.5 sm:p-3 border-2 ${periodColor.border} rounded-lg ${periodColor.bg} bg-opacity-20 gap-2 sm:gap-0`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div 
                        className={`w-3 h-3 sm:w-4 sm:h-4 rounded ${periodColor.bg} border-2 ${periodColor.border} flex-shrink-0`}
                      ></div>
                      <span className="text-xs sm:text-sm font-medium">{formatDate(period.start)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-xs sm:text-sm font-medium">{formatDate(period.end)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex-shrink-0 sm:ml-4">
                      {displayDays} {displayDays === 1 ? t("housekeeping.occupiedPeriods.night") : t("housekeeping.occupiedPeriods.nights")}
                    </div>
                  </div>
                );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null;
      })()}

      {/* Übersicht der Reinigungstage */}
      {(() => {
        const cleaningDays: Array<{ 
          date: string; 
          dateObj: Date;
          reason: 'both' | 'between';
          description: string;
          hoursUntilCheckin?: number; // Stunden bis zum nächsten Checkin
          checkinDate?: string; // Checkin-Datum für "bis zum"
        }> = [];

        const locale = language === "nl" ? "nl-NL" : language === "en" ? "en-US" : "de-DE";
        
        // Monatsgrenzen für Filterung
        const monthStart = new Date(year, month, 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(year, month + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        
        // 1. Finde Tage wo Check-in UND Check-out am selben Tag ist
        Object.keys(calendarData).forEach((dayKey) => {
          const dayData = calendarData[dayKey];
          if (dayData && dayData.type === 'both') {
            const dateObj = new Date(dayKey + 'T00:00:00');
            cleaningDays.push({
              date: dayKey,
              dateObj,
              reason: 'both',
              description: t("housekeeping.cleaningDays.sameDay")
            });
          }
        });

        // 2. Finde Tage zwischen Check-out (11:00) und nächstem Check-in (15:00) mit genug Zeit (mindestens 4 Stunden)
        if (periods.length > 0) {
          const sortedPeriods = [...periods].sort((a, b) => {
            const endA = new Date(a.end);
            const endB = new Date(b.end);
            return endA.getTime() - endB.getTime();
          });

          for (let i = 0; i < sortedPeriods.length; i++) {
            const currentPeriod = sortedPeriods[i];
            const checkoutDay = new Date(currentPeriod.end);
            const checkoutDate = new Date(checkoutDay);
            checkoutDate.setHours(11, 0, 0, 0);

            let nextPeriod = null;
            for (let j = i + 1; j < sortedPeriods.length; j++) {
              const candidatePeriod = sortedPeriods[j];
              const candidateStartDay = new Date(candidatePeriod.start);
              if (candidateStartDay >= checkoutDay) {
                nextPeriod = candidatePeriod;
                break;
              }
            }

            if (nextPeriod) {
              const checkinDay = new Date(nextPeriod.start);
              const checkinDate = new Date(checkinDay);
              checkinDate.setHours(15, 0, 0, 0);

              checkoutDay.setHours(0, 0, 0, 0);
              checkinDay.setHours(0, 0, 0, 0);

              const hours = (checkinDate.getTime() - checkoutDate.getTime()) / (1000 * 60 * 60);
              
              if (hours >= 4 && checkoutDay <= checkinDay) {
                const cleaningDayKey = currentPeriod.end;
                const checkinDateStr = nextPeriod.start;
                
                // Prüfe ob die Periode (Start oder Ende) im aktuellen Monat liegt
                const periodStart = new Date(currentPeriod.start + 'T00:00:00');
                const periodEnd = new Date(currentPeriod.end + 'T00:00:00');
                const periodInMonth = (periodStart >= monthStart && periodStart <= monthEnd) || 
                                     (periodEnd >= monthStart && periodEnd <= monthEnd);
                
                // Prüfe ob Checkout oder Checkin im aktuellen Monat liegt
                const checkoutInMonth = checkoutDay >= monthStart && checkoutDay <= monthEnd;
                const checkinInMonth = checkinDay >= monthStart && checkinDay <= monthEnd;
                
                // Zeige an, wenn die Periode im aktuellen Monat liegt (Start oder Ende)
                // ODER wenn Checkout oder Checkin im aktuellen Monat liegt
                if (periodInMonth || checkoutInMonth || checkinInMonth) {
                  if (!cleaningDays.find(c => c.date === cleaningDayKey)) {
                    const dateObj = new Date(cleaningDayKey + 'T00:00:00');
                    
                    // Prüfe ob Checkin und Checkout am selben Tag sind
                    const isSameDay = checkoutDay.getTime() === checkinDay.getTime();
                    
                    if (isSameDay) {
                      // Wenn Checkin und Checkout am selben Tag sind, wird dieser Fall bereits in Schritt 1 behandelt
                      // Hier sollte das nicht vorkommen, aber zur Sicherheit
                      cleaningDays.push({
                        date: cleaningDayKey,
                        dateObj,
                        reason: 'both',
                        description: t("housekeeping.cleaningDays.sameDay")
                      });
                    } else {
                      // Wenn Checkin und Checkout NICHT am selben Tag sind
                      // Speichere Checkin-Datum für Anzeige
                      cleaningDays.push({
                        date: cleaningDayKey,
                        dateObj,
                        reason: 'between',
                        description: '', // Wird nicht mehr verwendet
                        checkinDate: checkinDateStr
                      });
                    }
                  }
                }
              }
            }
          }
        }

        cleaningDays.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

        const formatDate = (dateStr: string) => {
          const d = new Date(dateStr + 'T00:00:00');
          
          if (language === "de") {
            // Einfache Formatierung für Deutsch: "Mo, 10.11.2025" (ohne Punkt nach Wochentag)
            const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
            const weekday = weekdays[d.getDay()];
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${weekday}, ${day}.${month}.${year}`;
          }
          
          // Für andere Sprachen die Standard-Formatierung verwenden
          return d.toLocaleDateString(locale, { 
            weekday: 'short',
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
          });
        };

        return cleaningDays.length > 0 ? (
          <Card className="mt-4 sm:mt-6">
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">{t("housekeeping.cleaningDays.title")}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t("housekeeping.cleaningDays.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cleaningDays.map((cleaningDay, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border-2 border-orange-200 rounded-lg bg-orange-50 gap-2 sm:gap-0"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-orange-500 border-2 border-orange-700 flex-shrink-0"></div>
                      <span className="text-xs sm:text-sm font-medium">
                        {cleaningDay.reason === 'between' 
                          ? (() => {
                              const fromDatePrefix = t("housekeeping.cleaningDays.fromDatePrefix");
                              // Prüfe ob Übersetzung geladen wurde
                              if (fromDatePrefix === "housekeeping.cleaningDays.fromDatePrefix") {
                                // Fallback basierend auf Sprache
                                const fallback = language === "de" ? "ab" : language === "nl" ? "vanaf" : "from";
                                return `${fallback} ${formatDate(cleaningDay.date)}`;
                              }
                              return `${fromDatePrefix} ${formatDate(cleaningDay.date)}`;
                            })()
                          : formatDate(cleaningDay.date)}
                      </span>
                    </div>
                    {cleaningDay.reason === 'between' && cleaningDay.checkinDate && (
                      <div className="text-xs sm:text-sm text-muted-foreground flex-shrink-0 sm:ml-4">
                        {(() => {
                          const toPrefix = t("housekeeping.cleaningDays.fromPrefix");
                          // Prüfe ob Übersetzung geladen wurde
                          if (toPrefix === "housekeeping.cleaningDays.fromPrefix") {
                            // Fallback basierend auf Sprache
                            const fallback = language === "de" ? "bis zum" : language === "nl" ? "tot" : "until";
                            return `${fallback} ${formatDate(cleaningDay.checkinDate)}`;
                          }
                          return `${toPrefix} ${formatDate(cleaningDay.checkinDate)}`;
                        })()}
                      </div>
                    )}
                    {cleaningDay.reason === 'both' && (
                      <div className="text-xs sm:text-sm text-muted-foreground flex-shrink-0 sm:ml-4">
                        {cleaningDay.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null;
      })()}
    </>
  );
}

