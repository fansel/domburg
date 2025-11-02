"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";

interface CalendarDay {
  type?: 'arrival' | 'departure' | 'both' | 'occupied';
  isCheckIn?: boolean;
  isCheckOut?: boolean;
  periodIds?: Array<{ id: string; colorIndex: number }>;
  bookings?: number;
}

export default function CleaningPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [calendarData, setCalendarData] = useState<Record<string, CalendarDay>>({});
  const [periods, setPeriods] = useState<Array<{ id: string; start: string; end: string; type: 'booking' | 'external'; colorIndex: number }>>([]);
  const [colorPalette, setColorPalette] = useState<Array<{ bg: string; border: string; label: string }>>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [guestCode, setGuestCode] = useState("");

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  // Authentifizierung prüfen
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/check");
        const data = await res.json();
        
        if (data.authenticated) {
          // Token-basierte Authentifizierung (Admin oder Housekeeper)
          setIsAuthenticated(true);
          loadCalendar();
        } else {
          setShowLoginDialog(true);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setShowLoginDialog(true);
      } finally {
        setIsChecking(false);
      }
    }

    checkAuth();
  }, []);

  // Kalender laden
  const loadCalendar = async () => {
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
    if (isAuthenticated) {
      loadCalendar();
    }
  }, [month, year, isAuthenticated]);

  const handleGuestCodeSubmit = async () => {
    if (!guestCode.trim()) {
      toast({
        title: t("housekeeping.error"),
        description: t("housekeeping.pleaseEnterCode"),
        variant: "destructive",
      });
      return;
    }

    try {
      // Code über guest-code Route einloggen (setzt Cookie)
      const response = await fetch("/api/auth/guest-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: guestCode.trim() }),
      });

      const data = await response.json();

      if (data.success && data.accessType === 'CLEANING') {
        // Erfolgreich eingeloggt - Token ist im Cookie
        setShowLoginDialog(false);
        setIsAuthenticated(true);
        loadCalendar();
        toast({
          title: t("housekeeping.codeAccepted"),
          description: t("housekeeping.codeAccepted"),
        });
      } else {
        toast({
          title: t("housekeeping.error"),
          description: data.error || t("housekeeping.invalidCode"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error validating code:", error);
      toast({
        title: t("housekeeping.error"),
        description: t("housekeeping.errorOccurred"),
        variant: "destructive",
      });
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
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

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t("housekeeping.loading")}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">{t("housekeeping.title")}</CardTitle>
            <CardDescription>
              {t("housekeeping.pleaseEnterAccessCode")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="cleaningCode" className="text-sm font-medium">
                {t("housekeeping.accessCode")}
              </label>
              <input
                id="cleaningCode"
                type="text"
                value={guestCode}
                onChange={(e) => setGuestCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleGuestCodeSubmit();
                  }
                }}
                className="w-full px-3 py-2 border rounded-md"
                placeholder={t("housekeeping.accessCodePlaceholder")}
                autoFocus
              />
            </div>
            <Button
              className="w-full"
              onClick={handleGuestCodeSubmit}
              disabled={!guestCode.trim()}
            >
              <LogIn className="mr-2 h-4 w-4" />
              {t("housekeeping.login")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-6xl mx-auto">
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="pb-3 sm:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                  {t("housekeeping.title")}
                </CardTitle>
                <CardDescription className="mt-1 sm:mt-2 text-xs sm:text-sm">
                  {t("housekeeping.description")}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={async () => {
                  // Ausloggen über API
                  await fetch("/api/auth/logout", { method: "POST" });
                  router.push("/");
                }}
              >
                {t("housekeeping.logout")}
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-semibold">
                {monthNames[month]} {year}
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={goToToday}>
                  {t("housekeeping.today")}
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
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">{t("housekeeping.loadingCalendar")}</p>
              </div>
            ) : (
              <>
                {/* Legende */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded relative overflow-hidden flex-shrink-0">
                      {/* Ankunft: unten rechts grün */}
                      <div className="absolute inset-0 bg-green-500" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', opacity: 0.6 }}></div>
                      <div className="absolute inset-0 border-2 border-green-700" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
                    </div>
                    <span className="text-xs sm:text-sm">{t("housekeeping.legend.arrival")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded relative overflow-hidden flex-shrink-0">
                      {/* Abreise: oben links rot */}
                      <div className="absolute inset-0 bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)', opacity: 0.6 }}></div>
                      <div className="absolute inset-0 border-2 border-red-700" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                    </div>
                    <span className="text-xs sm:text-sm">{t("housekeeping.legend.departure")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded relative overflow-hidden flex-shrink-0">
                      {/* Ankunft & Abreise: oben links rot (Abreise), unten rechts grün (Ankunft) */}
                      <div className="absolute inset-0 bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                      <div className="absolute inset-0 bg-green-500" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
                      <div className="absolute inset-0 border-2 border-red-700" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                      <div className="absolute inset-0 border-2 border-green-700" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
                    </div>
                    <span className="text-xs sm:text-sm">{t("housekeeping.legend.arrivalAndDeparture")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-muted/50 border border-border flex-shrink-0"></div>
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
                    let showOccupied = false;
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
                        label = t("housekeeping.legend.arrivalAndDeparture"); // Check-out (Abreise) zuerst, dann Check-in (Ankunft)
                        if (periodColor) {
                          bgColor = periodColor;
                          const color = colorPalette[dayData.periodIds?.[0]?.colorIndex || 0];
                          borderColor = `border-2 ${color.border}`;
                        }
                      } else if (dayData.type === 'arrival') {
                        // Ankunft: nur rechte untere Hälfte (wie bei "both", aber nur eine Hälfte)
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
                        // Abreise: nur linke obere Hälfte (wie bei "both", aber nur eine Hälfte)
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
                        // Für occupied Tage: Wenn periodIds existieren, verwende die Farbe, sonst muted
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
                        showOccupied = true;
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
                              // Bei "both" können zwei Fälle auftreten:
                              // 1. Eine Periode: Buchung die am selben Tag Check-in und Check-out hat → beide Hälften mit derselben Farbe
                              // 2. Mehrere Perioden: periodIds sind sortiert als [checkOutPeriods..., checkInPeriods...]
                              //    Wir müssen prüfen, welche Periode wo startet/endet, basierend auf dem periods Array
                              
                              if (dayData.periodIds.length === 1) {
                                // Eine Periode = beide Hälften mit derselben Farbe
                                const color = colorPalette[dayData.periodIds[0].colorIndex];
                                return (
                                  <>
                                    {/* Linke obere Hälfte: Check-out (Abreise) */}
                                    <div className={`absolute inset-0 ${color.bg}`} style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                                    {/* Rechte untere Hälfte: Check-in (Ankunft) */}
                                    <div className={`absolute inset-0 ${color.bg}`} style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
                                  </>
                                );
                              } else {
                                // Mehrere Perioden: Bestimme für jede Periode, ob sie Check-in oder Check-out ist
                                const checkOutPeriods: typeof dayData.periodIds = [];
                                const checkInPeriods: typeof dayData.periodIds = [];
                                
                                dayData.periodIds.forEach(period => {
                                  const periodInfo = periods.find(p => p.id === period.id);
                                  if (periodInfo) {
                                    if (periodInfo.start === dayKey) {
                                      // Diese Periode startet hier (Check-in)
                                      checkInPeriods.push(period);
                                    } else if (periodInfo.end === dayKey) {
                                      // Diese Periode endet hier (Check-out)
                                      checkOutPeriods.push(period);
                                    }
                                  }
                                });
                                
                                // Zeige Check-out Perioden in der linken oberen Hälfte
                                const checkOutElements = checkOutPeriods.map((period, idx) => {
                                  const color = colorPalette[period.colorIndex];
                                  return (
                                    <div key={`checkout-${idx}`} className={`absolute inset-0 ${color.bg}`} style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                                  );
                                });
                                
                                // Zeige Check-in Perioden in der rechten unteren Hälfte
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
                              // Ankunft: nur rechte untere Hälfte - volle Farbe (keine Opacity, da es der Haupttag ist)
                              <div className={`absolute inset-0 ${colorPalette[dayData.periodIds[0].colorIndex].bg || 'bg-green-500'}`} style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
                            )}
                            {dayData.type === 'departure' && dayData.periodIds.length > 0 && (
                              // Abreise: nur linke obere Hälfte - volle Farbe (keine Opacity, da es der Haupttag ist)
                              <div className={`absolute inset-0 ${colorPalette[dayData.periodIds[0].colorIndex].bg || 'bg-red-500'}`} style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                            )}
                          </>
                        )}
                        {isSplit && (!dayData?.periodIds || dayData.periodIds.length === 0) && (
                          <>
                            {dayData?.type === 'both' && (
                              <>
                                {/* Linke obere Hälfte: Check-out (Abreise) = ROT */}
                                <div className="absolute inset-0 bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)', opacity: 0.6 }}></div>
                                {/* Rechte untere Hälfte: Check-in (Ankunft) = GRÜN */}
                                <div className="absolute inset-0 bg-green-500" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', opacity: 0.6 }}></div>
                              </>
                            )}
                            {dayData?.type === 'arrival' && (
                              // Ankunft: nur rechte untere Hälfte - GRÜN
                              <div className="absolute inset-0 bg-green-500" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', opacity: 0.6 }}></div>
                            )}
                            {dayData?.type === 'departure' && (
                              // Abreise: nur linke obere Hälfte - ROT
                              <div className="absolute inset-0 bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)', opacity: 0.6 }}></div>
                            )}
                          </>
                        )}
                        {/* Tagesnummer - immer genau mittig */}
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
              </>
            )}
          </CardContent>
        </Card>

        {/* Übersicht der freien Zeiten */}
        {periods.length > 0 && (() => {
          // Berechne freie Zeiten zwischen Buchungen
          // Sortiere Perioden nach Enddatum (Check-out)
          const sortedPeriods = [...periods].sort((a, b) => {
            const endA = new Date(a.end);
            const endB = new Date(b.end);
            return endA.getTime() - endB.getTime();
          });

          const freeTimes: Array<{ 
            checkoutDate: string; 
            checkinDate: string; 
            checkoutDateTime: Date; 
            checkinDateTime: Date;
            hours: number;
          }> = [];

          for (let i = 0; i < sortedPeriods.length - 1; i++) {
            const currentPeriod = sortedPeriods[i];
            const nextPeriod = sortedPeriods[i + 1];

            // Check-out Datum der aktuellen Periode (end ist der Check-out Tag)
            const checkoutDay = new Date(currentPeriod.end);
            const checkoutDate = new Date(checkoutDay);
            checkoutDate.setHours(11, 0, 0, 0); // Check-out um 11:00

            // Check-in Datum der nächsten Periode (start ist der Check-in Tag)
            const checkinDay = new Date(nextPeriod.start);
            const checkinDate = new Date(checkinDay);
            checkinDate.setHours(15, 0, 0, 0); // Check-in ab 15:00

            // Normalisiere Tage für Vergleich (nur Datum, keine Uhrzeit)
            checkoutDay.setHours(0, 0, 0, 0);
            checkinDay.setHours(0, 0, 0, 0);

            // Wenn Check-in Tag gleich oder nach Check-out Tag liegt, gibt es eine freie Zeit
            // (Check-out um 11:00 bis Check-in ab 15:00 am gleichen oder späteren Tag)
            if (checkinDay >= checkoutDay) {
              // Berechne Stunden zwischen Check-out und Check-in
              const hours = (checkinDate.getTime() - checkoutDate.getTime()) / (1000 * 60 * 60);
              
              // Nur anzeigen wenn mindestens 4 Stunden frei sind (Check-out 11:00 bis Check-in 15:00 am gleichen Tag = 4h)
              if (hours >= 4) {
                freeTimes.push({
                  checkoutDate: currentPeriod.end,
                  checkinDate: nextPeriod.start,
                  checkoutDateTime: checkoutDate,
                  checkinDateTime: checkinDate,
                  hours: Math.round(hours * 10) / 10, // Auf 1 Dezimalstelle runden
                });
              }
            }
          }

          return freeTimes.length > 0 ? (
            <Card className="mt-4 sm:mt-6">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-base sm:text-lg">{t("housekeeping.freeTimes.title")}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {t("housekeeping.freeTimes.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {freeTimes.map((freeTime, index) => {
                    const locale = language === "nl" ? "nl-NL" : language === "en" ? "en-US" : "de-DE";
                    const formatDate = (dateStr: string) => {
                      const d = new Date(dateStr);
                      return d.toLocaleDateString(locale, { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric' 
                      });
                    };

                    const formatDateTime = (date: Date) => {
                      return date.toLocaleDateString(locale, { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                    };

                    return (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border-2 border-green-200 rounded-lg bg-green-50 gap-2 sm:gap-0"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-green-500 border-2 border-green-700 flex-shrink-0"></div>
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                            <span className="text-xs sm:text-sm font-medium truncate">
                              {formatDateTime(freeTime.checkoutDateTime)}
                            </span>
                          </div>
                          <span className="text-muted-foreground">→</span>
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                            <span className="text-xs sm:text-sm font-medium truncate">
                              {formatDateTime(freeTime.checkinDateTime)}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground flex-shrink-0 sm:ml-4">
                          {freeTime.hours} {freeTime.hours === 1 ? t("housekeeping.freeTimes.hour") : t("housekeeping.freeTimes.hours")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null;
        })()}

        {/* Übersicht der belegten Zeiträume */}
        {periods.length > 0 && (
          <Card className="mt-4 sm:mt-6">
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">{t("housekeeping.occupiedPeriods.title")}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t("housekeeping.occupiedPeriods.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {periods.map((period, index) => {
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

                  const isSameDay = period.start === period.end;
                  // Berechne Anzahl der Nächte: period.end ist Check-out Tag
                  // Wenn start = 10.11 und end = 11.11, dann 1 Nacht (10. auf 11.)
                  const nights = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                  const displayDays = isSameDay ? 0 : nights;
                  
                  // Period-Nummer für Anzeige
                  const periodNumber = index + 1;

                  const periodColor = colorPalette[period.colorIndex] || { bg: 'bg-gray-500', border: 'border-gray-700' };

                  return (
                    <div
                      key={period.id}
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-2.5 sm:p-3 border-2 ${periodColor.border} rounded-lg ${periodColor.bg} bg-opacity-20 gap-2 sm:gap-0`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div 
                          className={`w-3 h-3 sm:w-4 sm:h-4 rounded ${periodColor.bg} border-2 ${periodColor.border} flex-shrink-0`}
                          title={`Farbe: ${periodColor.label}`}
                        ></div>
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <span className="text-xs sm:text-sm font-medium">{formatDate(period.start)}</span>
                        </div>
                        <span className="text-muted-foreground">→</span>
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <span className="text-xs sm:text-sm font-medium">{formatDate(period.end)}</span>
                        </div>
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
        )}
      </div>
    </div>
  );
}
