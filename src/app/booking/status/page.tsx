"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Search, Calendar, Users, Mail, MessageSquare, Euro, CheckCircle, Clock, XCircle, ArrowLeft } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

interface Booking {
  id: string;
  bookingCode: string;
  guestEmail: string;
  guestName: string | null;
  guestPhone: string | null;
  startDate: string;
  endDate: string;
  numberOfAdults: number;
  numberOfChildren: number;
  status: string;
  message: string | null;
  totalPrice: string | null;
  createdAt: string;
  adminNotes: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
}

function BookingStatusPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [bookingCode, setBookingCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSearchFromParams = async (emailParam: string, codeParam: string) => {
    setIsSearching(true);
    setBooking(null);
    setIsChecking(false);

    try {
      const response = await fetch("/api/bookings/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: emailParam.trim().toLowerCase(), 
          bookingCode: codeParam.trim().toUpperCase() 
        }),
      });

      const data = await response.json();

      if (response.ok && data.booking) {
        setBooking(data.booking);
      } else {
        toast({
          variant: "destructive",
          title: t("bookingStatus.notFound"),
          description: data.error || t("bookingStatus.bookingNotFound"),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("bookingStatus.error"),
        description: t("bookingStatus.errorOccurred"),
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Lade URL-Parameter wenn vorhanden
  useEffect(() => {
    const urlEmail = searchParams.get("email");
    const urlCode = searchParams.get("code");
    
    if (urlEmail && urlCode) {
      setEmail(decodeURIComponent(urlEmail));
      setBookingCode(decodeURIComponent(urlCode));
      // Automatisch suchen nach kurzer Verzögerung
      const timer = setTimeout(() => {
        handleSearchFromParams(decodeURIComponent(urlEmail), decodeURIComponent(urlCode));
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Prüfe ob Gastcode validiert wurde nur wenn keine URL-Parameter vorhanden
    const validated = sessionStorage.getItem("guestCodeValidated");
    if (validated !== "true") {
      // Weiterleitung zur Startseite wenn kein Code validiert wurde
      router.push("/");
    } else {
      setIsChecking(false);
    }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router]);

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
          title: t("bookingStatus.notFound"),
          description: data.error || t("bookingStatus.bookingNotFoundDetails"),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("bookingStatus.error"),
        description: t("bookingStatus.errorOccurredDetails"),
      });
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />{t("bookingStatus.inReview")}</Badge>;
      case "APPROVED":
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3" />{t("bookingStatus.confirmed")}</Badge>;
      case "REJECTED":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />{t("bookingStatus.rejected")}</Badge>;
      case "CANCELLED":
        return <Badge variant="outline"><XCircle className="mr-1 h-3 w-3" />{t("bookingStatus.cancelled")}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Lädt...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 py-4 sm:py-8">
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        <div className="mb-4">
          <Button variant="outline" onClick={() => router.push("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> {t("common.back")}
          </Button>
        </div>
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">{t("bookingStatus.title")}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t("bookingStatus.description")}
          </p>
        </div>


        {!booking && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              {t("bookingStatus.findBooking")}
            </CardTitle>
            <CardDescription>
              {t("bookingStatus.findBookingDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("bookingStatus.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSearching}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">{t("booking.bookingNumber")}</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder={t("bookingStatus.codePlaceholder")}
                  value={bookingCode}
                  onChange={(e) => setBookingCode(e.target.value)}
                  required
                  disabled={isSearching}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {t("bookingStatus.bookingCodeFormat")}
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isSearching}>
                {isSearching ? t("bookingStatus.searching") : t("bookingStatus.findBooking")}
              </Button>
            </form>
          </CardContent>
        </Card>
        )}

        {booking && (
          <Card className="border-2">
            <CardHeader className="bg-muted/50">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-xl sm:text-2xl mb-2 break-words">
                    Buchung {booking.bookingCode}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Erstellt am {formatDate(new Date(booking.createdAt))}
                  </CardDescription>
                </div>
                <div className="flex-shrink-0">
                  {getStatusBadge(booking.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Zeitraum */}
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">{t("bookingStatus.travelPeriod")}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(new Date(booking.startDate))} - {formatDate(new Date(booking.endDate))}
                  </p>
                </div>
              </div>

              {/* Gäste */}
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">{t("bookingStatus.numberOfGuests")}</p>
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      const adults = booking.numberOfAdults ?? (booking as any).numberOfGuests ?? 1;
                      const children = booking.numberOfChildren ?? 0;
                      const total = adults + children;
                      return `${adults} ${adults === 1 ? t("bookingForm.adult") : t("bookingForm.adults")}${children > 0 ? `, ${children} ${children === 1 ? t("bookingForm.child") : t("bookingForm.children")}` : ""} (${total} ${total === 1 ? t("bookingStatus.person") : t("bookingStatus.persons")})`;
                    })()}
                  </p>
                </div>
              </div>

              {/* Kontakt */}
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">{t("bookingStatus.contact")}</p>
                  <p className="text-sm text-muted-foreground">
                    {booking.guestName && <span>{booking.guestName}<br /></span>}
                    {booking.guestEmail}
                    {booking.guestPhone && (
                      <>
                        <br />
                        <a 
                          href={`tel:${booking.guestPhone.replace(/\s/g, '')}`}
                          className="text-primary hover:underline"
                        >
                          {booking.guestPhone}
                        </a>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Preis */}
              {booking.totalPrice && (
                <div className="flex items-start gap-3">
                  <Euro className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold">{t("bookingForm.totalPrice")}</p>
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
                    <p className="font-semibold">{t("bookingStatus.yourMessage")}</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {booking.message}
                    </p>
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              {booking.adminNotes && (
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="font-semibold text-sm mb-1">{t("bookingStatus.noteFromUs")}</p>
                  <p className="text-sm text-muted-foreground">{booking.adminNotes}</p>
                </div>
              )}

              {/* Ablehnung */}
              {booking.status === "REJECTED" && booking.rejectionReason && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <p className="font-semibold text-sm text-red-900 mb-1">{t("bookingStatus.rejectionReason")}</p>
                  <p className="text-sm text-red-700">{booking.rejectionReason}</p>
                </div>
              )}

              {/* Stornierung */}
              {booking.status === "CANCELLED" && booking.cancellationReason && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                  <p className="font-semibold text-sm text-gray-900 mb-1">{t("bookingStatus.cancellationReason")}</p>
                  <p className="text-sm text-gray-700">{booking.cancellationReason}</p>
                </div>
              )}

              {/* Status-spezifische Hinweise */}
              {booking.status === "PENDING" && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>{t("bookingStatus.pendingMessage")}</strong><br />
                    {t("bookingStatus.pendingDetails")}
                  </p>
                </div>
              )}

              {booking.status === "APPROVED" && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                  <p className="text-sm text-green-800">
                    <strong>{t("bookingStatus.confirmedMessage")}</strong><br />
                    {t("bookingStatus.confirmedDetails")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}

export default function BookingStatusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Lädt...</p>
        </div>
      </div>
    }>
      <BookingStatusPageContent />
    </Suspense>
  );
}
