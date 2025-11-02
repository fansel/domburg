"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar, Users, RefreshCw, ExternalLink, CheckCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useTranslation } from "@/contexts/LanguageContext";

interface BookingConflict {
  type: "OVERLAPPING_REQUESTS" | "CALENDAR_CONFLICT" | "OVERLAPPING_CALENDAR_EVENTS";
  bookings: any[];
  calendarEvent?: {
    id: string;
    summary: string;
    start: string;
    end: string;
  };
  calendarEvents?: Array<{
    id: string;
    summary: string;
    start: string;
    end: string;
  }>;
  severity: "HIGH" | "MEDIUM";
  isPotentialConflict?: boolean; // true wenn nur PENDING Anfragen betroffen sind
}

interface ConflictManagerProps {
  onConflictsChange?: (count: number) => void;
}

export function ConflictManager({ onConflictsChange }: ConflictManagerProps) {
  const { t } = useTranslation();
  const [conflicts, setConflicts] = useState<BookingConflict[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadConflicts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/conflicts");
      const data = await response.json();
      const conflictsData = data.conflicts || [];
      setConflicts(conflictsData);
      setLastUpdate(new Date());
      // Benachrichtige Parent über Anzahl der Konflikte
      if (onConflictsChange) {
        onConflictsChange(conflictsData.length);
      }
    } catch (error) {
      console.error("Error loading conflicts:", error);
      if (onConflictsChange) {
        onConflictsChange(0);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConflicts();
  }, []);

  const getSeverityColor = (severity: "HIGH" | "MEDIUM") => {
    return severity === "HIGH" 
      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" 
      : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t("admin.conflicts")}
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

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{t("admin.conflicts")}</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              {t("admin.conflictsDescription")}
            </CardDescription>
          </div>
          <Button onClick={loadConflicts} variant="outline" size="sm" className="w-full sm:w-auto flex-shrink-0">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("common.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-6">
        {conflicts.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold mb-2">{t("admin.noConflicts")}</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              {t("admin.allOk")}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              {t("admin.lastCheck")}: {format(lastUpdate, "HH:mm:ss", { locale: de })}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5 sm:mt-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm sm:text-base text-red-900 dark:text-red-100">
                  {conflicts.length} {t("admin.conflictsFound")}
                </p>
                <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 mt-0.5">
                  {t("admin.reviewConflicts")}
                </p>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {conflicts.map((conflict, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-3 sm:p-4 space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
                        <Badge className={`text-xs ${conflict.isPotentialConflict 
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" 
                          : getSeverityColor(conflict.severity)}`}>
                          {conflict.isPotentialConflict 
                            ? "Potenzieller Konflikt"
                            : conflict.severity === "HIGH" 
                            ? t("admin.highPriority") 
                            : t("admin.mediumPriority")}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {conflict.type === "OVERLAPPING_REQUESTS" 
                            ? conflict.isPotentialConflict
                              ? "Mehrere Anfragen"
                              : t("admin.overlappingRequests")
                            : conflict.type === "CALENDAR_CONFLICT"
                            ? t("admin.calendarConflict")
                            : t("admin.overlappingCalendarEvents")}
                        </Badge>
                      </div>

                      {conflict.type === "OVERLAPPING_CALENDAR_EVENTS" ? (
                          <>
                            <h4 className="font-semibold text-sm sm:text-base mb-2">
                              {conflict.calendarEvents?.length || 0} {t("admin.overlappingCalendarEvents")}
                            </h4>
                            <div className="space-y-2">
                              {conflict.calendarEvents?.map((event) => (
                                <div
                                  key={event.id}
                                  className="flex items-start sm:items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Calendar className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                                      <span className="font-medium text-xs sm:text-sm text-orange-900 dark:text-orange-100 truncate">
                                        {event.summary}
                                      </span>
                                    </div>
                                    <div className="text-xs sm:text-sm text-orange-700 dark:text-orange-300 pl-6">
                                      {format(new Date(event.start), "dd.MM.yyyy", { locale: de })} - {format(new Date(event.end), "dd.MM.yyyy", { locale: de })}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                              {t("admin.checkIfIntended")}
                            </p>
                          </>
                        ) : conflict.type === "OVERLAPPING_REQUESTS" ? (
                          <>
                            <h4 className="font-semibold text-sm sm:text-base mb-2">
                              {conflict.bookings.length} {t("admin.overlappingRequests")}
                            </h4>
                            <div className="space-y-2">
                              {conflict.bookings.map((booking) => (
                                <div
                                  key={booking.id}
                                  className={`flex items-start sm:items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg ${
                                    conflict.isPotentialConflict
                                      ? "bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"
                                      : "bg-muted"
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                                      <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                      <span className="font-medium text-xs sm:text-sm break-words">
                                        {booking.guestName || booking.user?.name || booking.user?.email}
                                      </span>
                                      {booking.bookingCode && (
                                        <Badge variant="outline" className="font-mono text-xs">
                                          {booking.bookingCode}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap pl-6">
                                      <Calendar className="h-3 w-3 flex-shrink-0" />
                                      <span className="break-words">
                                        {format(new Date(booking.startDate || booking.checkIn), "dd.MM.yyyy", { locale: de })} - {format(new Date(booking.endDate || booking.checkOut), "dd.MM.yyyy", { locale: de })}
                                      </span>
                                      <Badge variant="secondary" className="text-xs ml-1 sm:ml-2">
                                        {(() => {
                                          const adults = booking.numberOfAdults ?? (booking as any).numberOfGuests ?? 1;
                                          const children = booking.numberOfChildren ?? 0;
                                          const total = adults + children;
                                          return `${total} ${total === 1 ? t("booking.guest") : t("booking.guests")}`;
                                        })()}
                                      </Badge>
                                    </div>
                                  </div>
                                  <Link href={`/admin/bookings/${booking.id}`} className="flex-shrink-0">
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <h4 className="font-semibold text-sm sm:text-base mb-2">
                              {t("admin.conflictWithCalendar")}
                            </h4>
                            <div className="p-2.5 sm:p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-2">
                              <div className="flex items-start gap-2">
                                <Calendar className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-xs sm:text-base text-yellow-900 dark:text-yellow-100 break-words">
                                    {conflict.calendarEvent?.summary}
                                  </p>
                                  <p className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 mt-0.5">
                                    {conflict.calendarEvent && format(new Date(conflict.calendarEvent.start), "dd.MM.yyyy", { locale: de })} - {conflict.calendarEvent && format(new Date(conflict.calendarEvent.end), "dd.MM.yyyy", { locale: de })}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {conflict.bookings.map((booking) => (
                                <div
                                  key={booking.id}
                                  className={`flex items-start sm:items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg ${
                                    conflict.isPotentialConflict
                                      ? "bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"
                                      : "bg-muted"
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                                      <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                      <span className="font-medium text-xs sm:text-sm break-words">
                                        {booking.guestName || booking.user?.name || booking.user?.email}
                                      </span>
                                      {booking.bookingCode && (
                                        <Badge variant="outline" className="font-mono text-xs">
                                          {booking.bookingCode}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap pl-6">
                                      <Calendar className="h-3 w-3 flex-shrink-0" />
                                      <span className="break-words">
                                        {format(new Date(booking.startDate || booking.checkIn), "dd.MM.yyyy", { locale: de })} - {format(new Date(booking.endDate || booking.checkOut), "dd.MM.yyyy", { locale: de })}
                                      </span>
                                    </div>
                                  </div>
                                  <Link href={`/admin/bookings/${booking.id}`} className="flex-shrink-0">
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                </div>
                              ))}
                            </div>
                          </>
                      )}
                    </div>
                  </div>

                  {conflict.bookings.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                      {conflict.bookings.map((booking) => (
                        <Link key={booking.id} href={`/admin/bookings/${booking.id}`} className="w-full sm:w-auto">
                          <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                            {t("admin.openRequest")} #{booking.bookingCode}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

