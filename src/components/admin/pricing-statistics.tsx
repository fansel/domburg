"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BarChart3, Calendar, Euro, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface BookingItem {
  id: string;
  type: "booking" | "manual";
  startDate: Date;
  endDate: Date;
  guestName?: string;
  guestEmail?: string;
  bookingCode?: string;
  summary?: string;
  defaultUseFamilyPrice: boolean; // Buchungen: false, Manuelle: true
}

interface PricingStatisticsProps {
  currentYear: number;
}

export function PricingStatistics({ currentYear }: PricingStatisticsProps) {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [pricingData, setPricingData] = useState<Map<string, { totalPrice: number; useFamilyPrice: boolean }>>(new Map());
  const [enabledBookings, setEnabledBookings] = useState<Set<string>>(new Set()); // Welche Buchungen sind aktiviert
  const [isLoading, setIsLoading] = useState(true);

  // Lade Buchungen und manuelle Einträge für das ausgewählte Jahr
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin/pricing/statistics?year=${selectedYear}`);
        const data = await response.json();
        if (data.success) {
          // Konvertiere Datumsstrings zu Date-Objekten
          const bookingsWithDates = (data.bookings || []).map((booking: any) => ({
            ...booking,
            startDate: new Date(booking.startDate),
            endDate: new Date(booking.endDate),
          }));
          setBookings(bookingsWithDates);
          // Initialisiere pricingData mit Standardwerten
          const initialPricing = new Map<string, { totalPrice: number; useFamilyPrice: boolean }>();
          const initialEnabled = new Set<string>();
          bookingsWithDates.forEach((booking: BookingItem) => {
            initialPricing.set(booking.id, {
              totalPrice: 0,
              useFamilyPrice: booking.defaultUseFamilyPrice,
            });
            // Alle Buchungen sind standardmäßig aktiviert
            initialEnabled.add(booking.id);
          });
          setPricingData(initialPricing);
          setEnabledBookings(initialEnabled);
        }
      } catch (error) {
        console.error("Error loading statistics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedYear]);

  // Berechne Preise initial wenn bookings geladen werden
  useEffect(() => {
    const calculatePrices = async () => {
      if (bookings.length === 0) return;
      
      const newPricingData = new Map<string, { totalPrice: number; useFamilyPrice: boolean }>();
      
      for (const booking of bookings) {
        const useFamilyPrice = booking.defaultUseFamilyPrice;

        try {
          const response = await fetch("/api/pricing/calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              startDate: booking.startDate.toISOString(),
              endDate: booking.endDate.toISOString(),
              useFamilyPrice: useFamilyPrice,
            }),
          });

          const data = await response.json();
          if (data.success && data.pricing) {
            newPricingData.set(booking.id, {
              totalPrice: data.pricing.totalPrice,
              useFamilyPrice: useFamilyPrice,
            });
          } else {
            // Fallback: Setze Standardwerte
            newPricingData.set(booking.id, {
              totalPrice: 0,
              useFamilyPrice: useFamilyPrice,
            });
          }
        } catch (error) {
          console.error(`Error calculating price for booking ${booking.id}:`, error);
          // Fallback: Setze Standardwerte
          newPricingData.set(booking.id, {
            totalPrice: 0,
            useFamilyPrice: useFamilyPrice,
          });
        }
      }

      setPricingData(newPricingData);
    };

    // Berechne Preise immer wenn bookings geladen werden
    if (bookings.length > 0) {
      calculatePrices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  const toggleFamilyPrice = async (bookingId: string) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const currentData = pricingData.get(bookingId);
    const newUseFamilyPrice = !(currentData?.useFamilyPrice ?? booking.defaultUseFamilyPrice);

    // Aktualisiere sofort den State (optimistic update)
    setPricingData((prev) => {
      const newMap = new Map(prev);
      newMap.set(bookingId, {
        totalPrice: currentData?.totalPrice ?? 0,
        useFamilyPrice: newUseFamilyPrice,
      });
      return newMap;
    });

    // Berechne neuen Preis
    try {
      const response = await fetch("/api/pricing/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: booking.startDate.toISOString(),
          endDate: booking.endDate.toISOString(),
          useFamilyPrice: newUseFamilyPrice,
        }),
      });

      const data = await response.json();
      if (data.success && data.pricing) {
        // Aktualisiere mit dem berechneten Preis
        setPricingData((prev) => {
          const newMap = new Map(prev);
          newMap.set(bookingId, {
            totalPrice: data.pricing.totalPrice,
            useFamilyPrice: newUseFamilyPrice,
          });
          return newMap;
        });
      }
    } catch (error) {
      console.error(`Error calculating price for booking ${bookingId}:`, error);
    }
  };

  // Sortiere Buchungen chronologisch
  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      return a.startDate.getTime() - b.startDate.getTime();
    });
  }, [bookings]);

  // Berechne Gesamtsumme (nur für aktivierte Buchungen)
  const totalRevenue = useMemo(() => {
    let total = 0;
    pricingData.forEach((data, bookingId) => {
      if (enabledBookings.has(bookingId)) {
        total += data.totalPrice;
      }
    });
    return total;
  }, [pricingData, enabledBookings]);

  // Toggle für einzelne Buchung aktivieren/deaktivieren
  const toggleBookingEnabled = (bookingId: string) => {
    setEnabledBookings((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
  };

  // Alle Buchungen aktivieren/deaktivieren
  const toggleAllBookings = (enable: boolean) => {
    if (enable) {
      const allIds = new Set(bookings.map((b) => b.id));
      setEnabledBookings(allIds);
    } else {
      setEnabledBookings(new Set());
    }
  };

  // Generiere Jahre (aktuelles Jahr ± 2 Jahre)
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const yearList = [];
    for (let i = current - 2; i <= current + 2; i++) {
      yearList.push(i);
    }
    return yearList;
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Jahr-Auswahl und Gesamtsumme */}
      <Card>
        <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                Einnahmen-Statistiken
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Potenzielle Einnahmen pro Buchung und manueller Eintrag
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Label htmlFor="year-select" className="text-xs sm:text-sm whitespace-nowrap">
                  Jahr:
                </Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger id="year-select" className="w-full sm:w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAllBookings(true)}
                  className="text-xs"
                >
                  Alle ein
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAllBookings(false)}
                  className="text-xs"
                >
                  Alle aus
                </Button>
              </div>
              <div className="text-left sm:text-right w-full sm:w-auto">
                <div className="text-xs sm:text-sm text-muted-foreground">Gesamtsumme</div>
                <div className="text-lg sm:text-xl font-bold text-primary">
                  {formatCurrency(totalRevenue)}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : sortedBookings.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Calendar className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">
                Keine Buchungen für {selectedYear}
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground">
                Wählen Sie ein anderes Jahr aus
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedBookings.map((booking) => {
                const pricing = pricingData.get(booking.id);
                const isFamilyPrice = pricing?.useFamilyPrice ?? booking.defaultUseFamilyPrice;
                const isEnabled = enabledBookings.has(booking.id);

                return (
                  <div
                    key={booking.id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors ${
                      !isEnabled ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => toggleBookingEnabled(booking.id)}
                          className="flex-shrink-0"
                        />
                        <Badge variant={booking.type === "booking" ? "default" : "secondary"}>
                          {booking.type === "booking" ? "Buchung" : "Manuell"}
                        </Badge>
                        {booking.bookingCode && (
                          <span className="text-xs sm:text-sm font-mono text-muted-foreground">
                            {booking.bookingCode}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm sm:text-base">
                        <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium">
                          {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {booking.guestName || booking.summary || booking.guestEmail || "Unbekannt"}
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full sm:w-auto">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`family-${booking.id}`} className="text-xs sm:text-sm whitespace-nowrap">
                          {isFamilyPrice ? "Family" : "Normal"}
                        </Label>
                        <Switch
                          id={`family-${booking.id}`}
                          checked={isFamilyPrice}
                          onCheckedChange={() => toggleFamilyPrice(booking.id)}
                        />
                      </div>
                      <div className="text-right min-w-[100px] sm:min-w-[120px]">
                        <div className="text-xs sm:text-sm text-muted-foreground">Preis</div>
                        <div className="text-base sm:text-lg font-bold">
                          {pricing?.totalPrice ? formatCurrency(pricing.totalPrice) : "..."}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

