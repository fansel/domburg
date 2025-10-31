"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Search, Calendar, Users, Mail, MessageSquare, Euro, CheckCircle, Clock, XCircle } from "lucide-react";

interface Booking {
  id: string;
  bookingCode: string;
  guestEmail: string;
  guestName: string | null;
  startDate: string;
  endDate: string;
  numberOfGuests: number;
  status: string;
  message: string | null;
  totalPrice: string | null;
  createdAt: string;
  adminNotes: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
}

export default function BookingStatusPage() {
  const [email, setEmail] = useState("");
  const [bookingCode, setBookingCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setBooking(null);

    try {
      const response = await fetch("/api/bookings/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          bookingCode: bookingCode.trim().toUpperCase() 
        }),
      });

      const data = await response.json();

      if (response.ok && data.booking) {
        setBooking(data.booking);
      } else {
        toast({
          variant: "destructive",
          title: "Nicht gefunden",
          description: data.error || "Buchung wurde nicht gefunden. Bitte prüfen Sie Ihre Angaben.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />In Prüfung</Badge>;
      case "APPROVED":
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3" />Bestätigt</Badge>;
      case "REJECTED":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Abgelehnt</Badge>;
      case "CANCELLED":
        return <Badge variant="outline"><XCircle className="mr-1 h-3 w-3" />Storniert</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 tracking-tight">Buchungsstatus</h1>
          <p className="text-muted-foreground">
            Geben Sie Ihre E-Mail-Adresse und Buchungsnummer ein
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Buchung finden
            </CardTitle>
            <CardDescription>
              Sie haben Ihre Buchungsnummer per E-Mail erhalten
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail-Adresse</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ihre@email.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSearching}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Buchungsnummer</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="DOM-ABC123"
                  value={bookingCode}
                  onChange={(e) => setBookingCode(e.target.value.toUpperCase())}
                  required
                  disabled={isSearching}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Format: DOM-XXXXXX (z.B. DOM-A1B2C3)
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isSearching}>
                {isSearching ? "Suche läuft..." : "Buchung finden"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {booking && (
          <Card className="border-2">
            <CardHeader className="bg-muted/50">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl mb-2">
                    Buchung {booking.bookingCode}
                  </CardTitle>
                  <CardDescription>
                    Erstellt am {formatDate(new Date(booking.createdAt))}
                  </CardDescription>
                </div>
                {getStatusBadge(booking.status)}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Zeitraum */}
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">Reisezeitraum</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(new Date(booking.startDate))} - {formatDate(new Date(booking.endDate))}
                  </p>
                </div>
              </div>

              {/* Gäste */}
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">Anzahl Gäste</p>
                  <p className="text-sm text-muted-foreground">
                    {booking.numberOfGuests} {booking.numberOfGuests === 1 ? "Person" : "Personen"}
                  </p>
                </div>
              </div>

              {/* Kontakt */}
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">Kontakt</p>
                  <p className="text-sm text-muted-foreground">
                    {booking.guestName && <span>{booking.guestName}<br /></span>}
                    {booking.guestEmail}
                  </p>
                </div>
              </div>

              {/* Preis */}
              {booking.totalPrice && (
                <div className="flex items-start gap-3">
                  <Euro className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold">Gesamtpreis</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(parseFloat(booking.totalPrice))}
                    </p>
                  </div>
                </div>
              )}

              {/* Nachricht */}
              {booking.message && (
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Ihre Nachricht</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {booking.message}
                    </p>
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              {booking.adminNotes && (
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="font-semibold text-sm mb-1">Hinweis von uns:</p>
                  <p className="text-sm text-muted-foreground">{booking.adminNotes}</p>
                </div>
              )}

              {/* Ablehnung */}
              {booking.status === "REJECTED" && booking.rejectionReason && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <p className="font-semibold text-sm text-red-900 mb-1">Grund der Ablehnung:</p>
                  <p className="text-sm text-red-700">{booking.rejectionReason}</p>
                </div>
              )}

              {/* Stornierung */}
              {booking.status === "CANCELLED" && booking.cancellationReason && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                  <p className="font-semibold text-sm text-gray-900 mb-1">Grund der Stornierung:</p>
                  <p className="text-sm text-gray-700">{booking.cancellationReason}</p>
                </div>
              )}

              {/* Status-spezifische Hinweise */}
              {booking.status === "PENDING" && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Ihre Buchungsanfrage wird geprüft.</strong><br />
                    Sie erhalten eine E-Mail, sobald wir Ihre Anfrage bearbeitet haben.
                  </p>
                </div>
              )}

              {booking.status === "APPROVED" && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                  <p className="text-sm text-green-800">
                    <strong>Ihre Buchung wurde bestätigt.</strong><br />
                    Sie haben eine Bestätigungs-E-Mail mit allen Details erhalten.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Button 
            variant="link" 
            onClick={() => window.location.href = '/'}
          >
            ← Zurück zur Startseite
          </Button>
        </div>
      </div>
    </div>
  );
}
