"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BookingCalendar } from "@/components/booking-calendar";
import { createBooking } from "@/app/actions/booking";
import { formatCurrency, formatDate, getDaysBetween } from "@/lib/utils";
import { CalendarDays, Users, Euro, Loader2 } from "lucide-react";

interface PriceCalculation {
  nights: number;
  basePrice: number;
  cleaningFee: number;
  totalPrice: number;
  pricePerNight: number;
}

export function BookingForm() {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [numberOfGuests, setNumberOfGuests] = useState(2);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PriceCalculation | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [guestCode, setGuestCode] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  // Lade Guest Code aus sessionStorage
  useEffect(() => {
    const code = sessionStorage.getItem('guestCode');
    setGuestCode(code);
  }, []);

  // Live-Preisberechnung wenn Datum geändert wird
  useEffect(() => {
    if (startDate && endDate) {
      calculatePrice();
    } else {
      setPricing(null);
    }
  }, [startDate, endDate]);

  const calculatePrice = async () => {
    if (!startDate || !endDate) return;

    setIsLoadingPrice(true);
    try {
      const response = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCode: guestCode,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setPricing(data.pricing);
      }
    } catch (error) {
      console.error('Error calculating price:', error);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const handleDateSelect = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte wählen Sie einen Zeitraum aus.",
      });
      return;
    }

    if (!guestEmail) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte geben Sie Ihre E-Mail-Adresse an.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createBooking({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        numberOfGuests,
        guestEmail,
        guestName: guestName || undefined,
        message,
      });

      if (result.success) {
        setBookingCode(result.bookingCode || null);
        toast({
          title: "Buchungsanfrage gesendet",
          description: `Ihre Buchungsnummer: ${result.bookingCode}`,
          duration: 10000,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: result.error || "Buchung konnte nicht erstellt werden.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const nights = startDate && endDate ? getDaysBetween(startDate, endDate) : 0;

  // Buchungsbestätigung anzeigen
  if (bookingCode) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <CardTitle className="text-2xl">Buchungsanfrage erfolgreich!</CardTitle>
            <CardDescription>
              Ihre Anfrage wurde an uns übermittelt
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border-2 border-primary bg-primary/5 p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">Ihre Buchungsnummer:</p>
              <p className="text-3xl font-bold text-primary font-mono">{bookingCode}</p>
              <p className="text-xs text-muted-foreground mt-4">
                Bitte notieren Sie sich diese Nummer!
              </p>
            </div>

            <div className="space-y-3 text-sm">
              <p><strong>E-Mail:</strong> {guestEmail}</p>
              {guestName && <p><strong>Name:</strong> {guestName}</p>}
              {startDate && endDate && (
                <p><strong>Zeitraum:</strong> {formatDate(startDate)} - {formatDate(endDate)}</p>
              )}
              <p><strong>Gäste:</strong> {numberOfGuests}</p>
            </div>

            <div className="rounded-lg bg-blue-50 p-4 text-sm">
              <h4 className="font-semibold mb-2">Nächste Schritte:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Sie erhalten eine Bestätigungs-E-Mail</li>
                <li>• Wir prüfen Ihre Anfrage</li>
                <li>• Sie werden über den Status informiert</li>
              </ul>
            </div>

            <div className="pt-4">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.location.href = '/booking/status'}
              >
                Buchungsstatus prüfen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <BookingCalendar
          selectedStartDate={startDate}
          selectedEndDate={endDate}
          onDateSelect={handleDateSelect}
        />

        {/* Live-Preisanzeige */}
        {startDate && endDate && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Deine Auswahl</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span>
                  {formatDate(startDate)} - {formatDate(endDate)}
                </span>
                <span className="text-muted-foreground">
                  ({getDaysBetween(startDate, endDate)} Nächte)
                </span>
              </div>

              {isLoadingPrice ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Preis wird berechnet...</span>
                </div>
              ) : pricing ? (
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{pricing.nights} Nächte à {formatCurrency(pricing.pricePerNight)}</span>
                    <span>{formatCurrency(pricing.basePrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Endreinigung</span>
                    <span>{formatCurrency(pricing.cleaningFee)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg border-t pt-2">
                    <span>Gesamtpreis</span>
                    <span className="flex items-center gap-1">
                      <Euro className="h-5 w-5" />
                      {formatCurrency(pricing.totalPrice)}
                    </span>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Buchungsdetails</CardTitle>
              <CardDescription>
                Geben Sie Ihre Buchungsinformationen ein
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {startDate && endDate && (
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDays className="h-4 w-4" />
                    <span className="font-medium">Gewählter Zeitraum:</span>
                  </div>
                  <div className="text-sm">
                    {formatDate(startDate)} - {formatDate(endDate)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {nights} {nights === 1 ? "Nacht" : "Nächte"}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-Mail-Adresse *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ihre@email.de"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  Sie erhalten Ihren Buchungscode per E-Mail
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name (optional)</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ihr Name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guests">
                  <Users className="inline h-4 w-4 mr-2" />
                  Anzahl Gäste
                </Label>
                <Input
                  id="guests"
                  type="number"
                  min="1"
                  max="10"
                  value={numberOfGuests}
                  onChange={(e) => setNumberOfGuests(parseInt(e.target.value) || 1)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Nachricht (optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Haben Sie besondere Wünsche oder Fragen?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                />
              </div>

              {startDate && endDate && (
                <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Geschätzter Preis:</span>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        wird nach Anfrage berechnet
                      </div>
                      <div className="text-lg font-bold text-primary">
                        <Euro className="inline h-4 w-4" /> Auf Anfrage
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Der finale Preis wird nach Prüfung Ihrer Buchungsanfrage mitgeteilt.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={!startDate || !endDate || isSubmitting}
              >
                {isSubmitting ? "Wird gesendet..." : "Buchungsanfrage senden"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}

