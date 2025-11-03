"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BookingCalendar } from "@/components/booking-calendar";
import { createBooking } from "@/app/actions/booking";
import { formatCurrency, formatDate, getDaysBetween } from "@/lib/utils";
import { CalendarDays, Users, Euro, Loader2, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Kompakte Datumsanzeige (z.B. "3.11.25-7.11.25")
// WICHTIG: Normalisiert auf lokale Zeitzone (Europe/Amsterdam) für konsistente Anzeige
const formatCompactDate = (startDate: Date, endDate: Date): string => {
  // Normalisiere Daten auf lokale Zeitzone (Europe/Amsterdam) für konsistente Anzeige
  const getLocalDateString = (date: Date): string => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Amsterdam',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  };

  const startLocal = getLocalDateString(startDate);
  const endLocal = getLocalDateString(endDate);
  
  const [startYear, startMonth, startDay] = startLocal.split('-').map(Number);
  const [endYear, endMonth, endDay] = endLocal.split('-').map(Number);
  
  const startYearShort = startYear.toString().slice(-2);
  const endYearShort = endYear.toString().slice(-2);

  return `${startDay}.${startMonth}.${startYearShort}-${endDay}.${endMonth}.${endYearShort}`;
};

interface PriceCalculation {
  nights: number;
  basePrice: number;
  cleaningFee: number;
  beachHutPrice?: number;
  totalPrice: number;
  pricePerNight: number;
  warnings?: string[];
  minNights?: number;
}

const variants = {
  enter: (direction: "forward" | "backward") => ({
    x: direction === "forward" ? 300 : -300,
    opacity: 0,
    position: "absolute" as const,
    width: "100%",
  }),
  center: {
    x: 0,
    opacity: 1,
    position: "relative" as const,
    width: "100%",
  },
  exit: (direction: "forward" | "backward") => ({
    x: direction === "forward" ? -300 : 300,
    opacity: 0,
    position: "absolute" as const,
    width: "100%",
  }),
};

export function BookingForm() {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [numberOfAdults, setNumberOfAdults] = useState<number | "">("");
  const [numberOfChildren, setNumberOfChildren] = useState<number | "">("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PriceCalculation | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [guestCode, setGuestCode] = useState<string | null>(null);
  const [useFamilyPrice, setUseFamilyPrice] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [warningDialog, setWarningDialog] = useState<{
    open: boolean;
    warnings: string[];
    nights: number;
    minNights?: number;
  }>({
    open: false,
    warnings: [],
    nights: 0,
  });
  const { toast } = useToast();
  const { t } = useTranslation();
  const stepContentRef = useRef<HTMLDivElement>(null);

  // Scroll zurücksetzen beim Step-Wechsel
  const resetScroll = useCallback(() => {
    // Window scroll zurücksetzen
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Alle scrollbaren Container im Step-Content zurücksetzen
    if (stepContentRef.current) {
      const scrollableElements = stepContentRef.current.querySelectorAll('[class*="overflow-y-auto"]');
      scrollableElements.forEach((el) => {
        (el as HTMLElement).scrollTop = 0;
      });
    }
  }, []);

  // Lade Guest Code aus sessionStorage
  useEffect(() => {
    const code = typeof window !== "undefined" ? sessionStorage.getItem("guestCode") : null;
    setGuestCode(code);
  }, []);

  // Scroll zurücksetzen beim Step-Wechsel
  useEffect(() => {
    const timer = setTimeout(() => {
      resetScroll();
    }, 150);
    return () => clearTimeout(timer);
  }, [currentStep, resetScroll]);

  // Live-Preisberechnung wenn Datum geändert wird
  useEffect(() => {
    if (startDate && endDate) {
      void calculatePrice();
    } else {
      setPricing(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate?.toISOString(), endDate?.toISOString()]);

  // Auto-Focus auf Name-Feld wenn Schritt 2 aktiv wird
  useEffect(() => {
    if (currentStep === 2) {
      const t = setTimeout(() => {
        document.getElementById("nameMobile")?.focus();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [currentStep]);

  const calculatePrice = async () => {
    if (!startDate || !endDate) return;

    setIsLoadingPrice(true);
    try {
      const response = await fetch("/api/pricing/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCode: guestCode,
        }),
      });

      const data = await response.json();
      if (data?.success) {
        const prevWarnings = pricing?.warnings ?? [];
        const nextPricing: PriceCalculation = data.pricing;
        setPricing(nextPricing);
        setUseFamilyPrice(Boolean(data.useFamilyPrice));
        
        const changed = JSON.stringify(prevWarnings) !== JSON.stringify(nextPricing?.warnings ?? []);
        if (changed && nextPricing?.warnings?.length) {
            const nights = getDaysBetween(startDate, endDate);
            setWarningDialog({
              open: true,
            warnings: nextPricing.warnings,
              nights,
            minNights: nextPricing.minNights,
            });
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error calculating price:", error);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const handleDateSelect = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
  };

  const nextStep = () => {
    setDirection("forward");
    if (currentStep === 1 && startDate && endDate) {
      setCurrentStep(2);
      setTimeout(resetScroll, 100);
    } else if (currentStep === 2) {
      setCurrentStep(3);
      setTimeout(resetScroll, 100);
    } else if (currentStep === 3) {
      setCurrentStep(4);
      setTimeout(resetScroll, 100);
    }
  };

  const prevStep = () => {
    setDirection("backward");
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
      setTimeout(resetScroll, 100);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !endDate) {
      toast({ variant: "destructive", title: t("bookingForm.error"), description: t("bookingForm.selectDates") });
      return;
    }
    if (!guestEmail) {
      toast({ variant: "destructive", title: t("bookingForm.error"), description: t("bookingForm.emailMissing") });
      return;
    }
    if (!guestName || !guestName.trim()) {
      toast({ variant: "destructive", title: t("bookingForm.error"), description: t("bookingForm.nameMissing") });
      return;
    }

    const adults = numberOfAdults === "" ? 1 : numberOfAdults;
    const children = numberOfChildren === "" ? 0 : numberOfChildren;

    if (adults < 1) {
      toast({ variant: "destructive", title: t("bookingForm.error"), description: t("bookingForm.adultRequired") });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createBooking({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        numberOfAdults: adults,
        numberOfChildren: children,
        guestEmail,
        guestName: guestName || undefined,
        guestPhone: guestPhone.trim(),
        message,
        guestCode: guestCode || undefined,
      });

      if (result.success) {
        setBookingCode(result.bookingCode || null);
        toast({ title: t("bookingForm.requestSent"), description: `${t("bookingForm.bookingNumber")}: ${result.bookingCode}`, duration: 4000 });
      } else {
        toast({ variant: "destructive", title: t("bookingForm.error"), description: result.error || t("bookingForm.bookingFailed") });
      }
    } catch (error) {
      toast({ variant: "destructive", title: t("bookingForm.error"), description: t("bookingForm.unexpectedError") });
    } finally {
      setIsSubmitting(false);
    }
  };

  const nights = startDate && endDate ? getDaysBetween(startDate, endDate) : 0;
  const totalSteps = 4;

  // Buchungsbestätigung anzeigen
  if (bookingCode) {
    return (
      <div className="w-full lg:flex lg:items-center lg:justify-center lg:min-h-[calc(100vh-8rem)]">
        <div className="w-full max-w-3xl lg:max-w-5xl mx-auto lg:bg-card lg:rounded-xl lg:shadow-lg lg:border lg:border-border lg:p-8">
          <Card>
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-primary/10 text-primary">
                  <Check className="h-8 w-8 lg:h-10 lg:w-10" />
                </div>
              </div>
              <CardTitle className="text-2xl lg:text-3xl">{t("bookingForm.bookingSuccess")}</CardTitle>
              <CardDescription className="text-base lg:text-lg mt-2">
                {t("bookingForm.requestSubmitted")}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Booking Code */}
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-6 lg:p-8 text-center">
                <p className="text-sm lg:text-base text-muted-foreground mb-3">{t("bookingForm.yourBookingNumber")}</p>
                <p className="text-2xl lg:text-4xl font-bold text-primary font-mono break-all">
                  {bookingCode}
                </p>
                <p className="text-xs lg:text-sm text-muted-foreground mt-4">
                  {t("bookingForm.pleaseNote")}
                </p>
              </div>

              {/* Booking Details */}
              <div className="space-y-4 text-base lg:text-lg">
                <div className="flex justify-between items-start py-2 border-b">
                  <span className="font-semibold text-foreground">{t("bookingForm.nameLabel")}</span>
                  <span className="text-muted-foreground ml-4 text-right">{guestName || "-"}</span>
                </div>
                <div className="flex justify-between items-start py-2 border-b">
                  <span className="font-semibold text-foreground">{t("bookingForm.emailLabel")}</span>
                  <span className="text-muted-foreground ml-4 text-right break-all">{guestEmail}</span>
                </div>
                <div className="flex justify-between items-start py-2 border-b">
                  <span className="font-semibold text-foreground">{t("bookingForm.phoneLabel")}</span>
                  <span className="text-muted-foreground ml-4 text-right">{guestPhone || "-"}</span>
                </div>
                  {startDate && endDate && (
                  <div className="flex justify-between items-start py-2 border-b">
                    <span className="font-semibold text-foreground">{t("bookingForm.periodLabel")}</span>
                    <span className="text-muted-foreground ml-4 text-right">{formatDate(startDate)} - {formatDate(endDate)}</span>
                  </div>
                  )}
                <div className="flex justify-between items-start py-2 border-b">
                  <span className="font-semibold text-foreground">{t("bookingForm.guestsLabel")}</span>
                  <span className="text-muted-foreground ml-4 text-right">
                    {numberOfAdults === "" ? 1 : numberOfAdults} {(numberOfAdults === "" ? 1 : numberOfAdults) === 1 ? t("bookingForm.adult") : t("bookingForm.adults")}
                    {(numberOfChildren === "" ? 0 : numberOfChildren) > 0 ? `, ${numberOfChildren === "" ? 0 : numberOfChildren} ${(numberOfChildren === "" ? 0 : numberOfChildren) === 1 ? t("bookingForm.child") : t("bookingForm.children")}` : ""}
                  </span>
                </div>
                  {message && (
                    <div className="pt-4 border-t">
                    <p className="font-semibold text-foreground mb-2">{t("booking.message")}:</p>
                    <p className="text-muted-foreground">{message}</p>
                    </div>
                  )}
              </div>

              {/* Info */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-semibold mb-1 text-foreground">{t("bookingForm.nextSteps")}</p>
                    <p>{t("bookingForm.reviewMessage")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full lg:flex lg:items-center lg:justify-center lg:min-h-[calc(100vh-8rem)]">
      <div className="w-full max-w-3xl lg:max-w-5xl mx-auto lg:bg-card lg:rounded-xl lg:shadow-lg lg:border lg:border-border lg:p-8">
        {/* Step-by-Step Layout */}
        <div className="h-[calc(100vh-2rem)] lg:h-auto lg:min-h-[600px] flex flex-col">
         {/* Progress Indicator */}
           <div className="mb-4 lg:mb-6 px-2 pt-0 pb-0 flex-shrink-0">
          <div className="flex items-center justify-center w-full">
              <div className="flex items-center justify-center w-full max-w-[600px]">
              {[1, 2, 3, 4].map((step, index) => (
                <React.Fragment key={step}>
                    <div
                      className={`flex items-center justify-center w-10 h-10 lg:w-14 lg:h-14 rounded-full font-semibold text-sm lg:text-lg transition-all flex-shrink-0 z-10 border-2 ${
                    step < currentStep
                      ? "bg-primary text-white border-primary"
                      : step === currentStep
                      ? "bg-primary text-white ring-2 ring-primary/20 border-primary"
                      : "bg-white text-gray-500 border-gray-300"
                      }`}
                    >
                      {step < currentStep ? <Check className="h-5 w-5 lg:h-7 lg:w-7" /> : step}
                  </div>
                  {index < 3 && (
                      <div className={`h-1 lg:h-1.5 flex-1 mx-3 lg:mx-6 transition-all duration-300 ${
                        step < currentStep ? "bg-primary/60" : "bg-gray-200"
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

          {/* Step Content with Framer Motion */}
          <div ref={stepContentRef} className="relative overflow-hidden flex-1 min-h-0 w-full">
            <AnimatePresence custom={direction} mode="sync" initial={false}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                className="w-full h-full"
                style={{ willChange: "transform, opacity" }}
              >
                {currentStep === 1 && (
                  <>
            {/* Step 1: Kalender */}
             <div className="pb-3 flex flex-col h-full relative overflow-y-auto">
               <div className="px-2 lg:px-8 flex-1 min-h-0 flex flex-col items-center pt-2 pb-4">
                <div className="w-full max-w-2xl lg:max-w-4xl relative">
                  <BookingCalendar selectedStartDate={startDate} selectedEndDate={endDate} onDateSelect={handleDateSelect} />
                </div>
              {startDate && endDate && (
                  <div className="mt-4 lg:mt-6 px-4 lg:px-8 w-full max-w-2xl lg:max-w-4xl flex gap-3 lg:gap-4 z-10">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStartDate(null);
                        setEndDate(null);
                      }}
                    className="flex-1 h-11 lg:h-14 text-sm lg:text-lg"
                    >
                      {t("bookingForm.reset")}
                    </Button>
                  <Button 
                    onClick={() => {
                      nextStep();
                    }} 
                    disabled={!startDate || !endDate} 
                      className="flex-1 h-11 lg:h-14 text-sm lg:text-lg"
                    type="button"
                  >
                      {t("bookingForm.continue")}
                    <ChevronRight className="ml-1.5 h-4 w-4 lg:h-6 lg:w-6" />
                    </Button>
                  </div>
              )}
              </div>
            </div>
                  </>
                )}

                {currentStep === 2 && (
                  <>
            {/* Step 2: Kontaktdaten */}
            <div className="px-4 lg:px-8 pb-3 flex flex-col h-full">
              <div className="flex flex-col h-full min-h-0">
                <div className="p-4 lg:p-8 space-y-4 lg:space-y-8 flex-1 overflow-y-auto max-w-2xl lg:max-w-3xl mx-auto w-full">
                  <div className="space-y-2 lg:space-y-4">
                    <Label htmlFor="nameMobile" className="text-sm lg:text-lg font-semibold text-foreground">{t("booking.name")} *</Label>
                    <Input
                      id="nameMobile"
                      type="text"
                      placeholder={t("bookingForm.yourName")}
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          document.getElementById("emailMobile")?.focus();
                        }
                      }}
                      required
                      disabled={isSubmitting}
                      className="h-11 lg:h-14 text-base lg:text-xl"
                    />
                  </div>

                  <div className="space-y-2 lg:space-y-4">
                    <Label htmlFor="emailMobile" className="text-sm lg:text-lg font-semibold text-foreground">{t("auth.email")} *</Label>
                    <Input
                      id="emailMobile"
                      type="email"
                      placeholder="deine@email.de"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          document.getElementById("phoneMobile")?.focus();
                        }
                      }}
                      required
                      disabled={isSubmitting}
                      className="h-11 lg:h-14 text-base lg:text-xl"
                    />
                    <p className="text-xs lg:text-base text-gray-500">{t("bookingForm.emailHint")}</p>
                  </div>

                  <div className="space-y-2 lg:space-y-4">
                    <Label htmlFor="phoneMobile" className="text-sm lg:text-lg font-semibold text-foreground">{t("bookingForm.phoneRequired")}</Label>
                    <Input
                      id="phoneMobile"
                      type="tel"
                      placeholder={t("bookingForm.phoneExample")}
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      required
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          document.getElementById("guestsMobile")?.focus();
                        }
                      }}
                      disabled={isSubmitting}
                      className="h-11 lg:h-14 text-base lg:text-xl"
                    />
                  </div>

                  <div className="space-y-2 lg:space-y-4">
                    <Label htmlFor="adultsMobile" className="text-sm lg:text-lg font-semibold text-foreground flex items-center gap-1.5">
                      <Users className="h-4 w-4 lg:h-6 lg:w-6" /> {t("bookingForm.numberOfAdults")}
                    </Label>
                    <Input
                      id="adultsMobile"
                      type="number"
                      min="1"
                      max="20"
                      value={numberOfAdults === "" ? "" : numberOfAdults}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNumberOfAdults(val === "" ? "" : Math.max(1, parseInt(val) || 1));
                      }}
                      onBlur={(e) => {
                        if (e.target.value === "" || parseInt(e.target.value) < 1) {
                          setNumberOfAdults(1);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if ((numberOfAdults === "" ? 1 : numberOfAdults) >= 1) {
                            document.getElementById("childrenMobile")?.focus();
                          }
                        }
                      }}
                      required
                      disabled={isSubmitting}
                      className="h-11 lg:h-14 text-base lg:text-xl"
                      inputMode="numeric"
                    />
                  </div>

                  <div className="space-y-2 lg:space-y-4">
                    <Label htmlFor="childrenMobile" className="text-sm lg:text-lg font-semibold text-foreground">
                      {t("bookingForm.numberOfChildren")}
                    </Label>
                    <Input
                      id="childrenMobile"
                      type="number"
                      min="0"
                      max="20"
                      value={numberOfChildren === "" ? "" : numberOfChildren}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNumberOfChildren(val === "" ? "" : Math.max(0, parseInt(val) || 0));
                      }}
                      onBlur={(e) => {
                        if (e.target.value === "") {
                          setNumberOfChildren(0);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && guestEmail && guestName?.trim()) {
                          e.preventDefault();
                          nextStep();
                        }
                      }}
                      disabled={isSubmitting}
                      className="h-11 lg:h-14 text-base lg:text-xl"
                      inputMode="numeric"
                    />
                  </div>

                  {/* Buttons direkt unter Anzahl Gäste */}
                  <div className="mt-6 lg:mt-8 flex gap-3 lg:gap-4 flex-shrink-0 w-full">
                  <Button type="button" variant="outline" onClick={prevStep} className="flex-1 h-11 lg:h-14 text-sm lg:text-lg">
                    <ChevronLeft className="mr-1.5 h-4 w-4 lg:h-6 lg:w-6" /> {t("bookingForm.back")}
                  </Button>
                    <Button type="button" onClick={nextStep} disabled={!guestEmail || !guestName?.trim() || (numberOfAdults === "" ? 0 : numberOfAdults) < 1} className="flex-1 h-11 lg:h-14 text-sm lg:text-lg">
                    {t("bookingForm.continue")} <ChevronRight className="ml-1.5 h-4 w-4 lg:h-6 lg:w-6" />
                  </Button>
                  </div>
                </div>
              </div>
            </div>
                  </>
                )}

                {currentStep === 3 && (
                  <>
            {/* Step 3: Nachricht */}
            <div className="px-2 lg:px-8 pb-3 flex flex-col h-full">
              <div className="flex flex-col h-full min-h-0">
                <div className="p-4 lg:p-8 flex-1 overflow-y-auto max-w-2xl lg:max-w-3xl mx-auto w-full">
                  <div className="space-y-3 lg:space-y-4">
                    <Label htmlFor="messageMobile" className="text-sm lg:text-lg font-semibold text-foreground flex items-center gap-1.5">
                      <svg className="h-4 w-4 lg:h-6 lg:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      {t("booking.message")} ({t("booking.optional")})
                    </Label>
                    <Textarea 
                      id="messageMobile" 
                      placeholder={t("bookingForm.messagePlaceholder")} 
                      value={message} 
                      onChange={(e) => setMessage(e.target.value)} 
                      rows={8} 
                      className="h-40 lg:h-48 text-base lg:text-xl resize-none rounded-2xl border-gray-300 focus:border-primary focus:ring-primary shadow-sm" 
                    />
                    {message.length > 0 && (
                      <p className="text-xs lg:text-sm text-muted-foreground px-1">{message.length} {t("bookingForm.characters")}</p>
                    )}
                  </div>
                  
                  {/* Buttons direkt unter Textarea */}
                  <div className="mt-4 lg:mt-6 flex gap-3 lg:gap-4 flex-shrink-0 w-full">
                  <Button type="button" variant="outline" onClick={prevStep} className="flex-1 h-11 lg:h-14 text-sm lg:text-lg">
                    <ChevronLeft className="mr-1.5 h-4 w-4 lg:h-6 lg:w-6" /> {t("bookingForm.back")}
                  </Button>
                  <Button type="button" onClick={nextStep} className="flex-1 h-11 lg:h-14 text-sm lg:text-lg">
                    {t("bookingForm.continue")} <ChevronRight className="ml-1.5 h-4 w-4 lg:h-6 lg:w-6" />
                  </Button>
                </div>
              </div>
            </div>
            </div>
                  </>
                )}

                {currentStep === 4 && (
                  <>
            {/* Step 4: Übersicht mit Preis - Split View */}
            <div className="px-4 lg:px-8 pb-3 flex flex-col h-full">
              <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0 max-w-2xl lg:max-w-4xl mx-auto w-full">
                <div className="grid grid-rows-[1fr_auto] h-full overflow-hidden">
                  {/* Scrollbarer Content oben */}
                  <div className="overflow-y-auto p-4 lg:p-8">
                    {startDate && endDate && (
                      <div className="space-y-4 lg:space-y-6">
                        <div className="flex items-center gap-3 lg:gap-4 p-4 lg:p-5 bg-gray-50 rounded-lg">
                          <div className="p-2 lg:p-3 bg-primary/10 rounded">
                            <CalendarDays className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm lg:text-base text-gray-600">{t("bookingForm.period")}</p>
                            <p className="font-semibold text-lg lg:text-xl text-gray-900 mt-1">{formatCompactDate(startDate, endDate)}</p>
                            <p className="text-sm lg:text-base text-gray-500 mt-1">{nights} {nights === 1 ? t("bookingForm.night") : t("bookingForm.nights")}</p>
                          </div>
                        </div>

                        <div className="space-y-3 lg:space-y-4 p-4 lg:p-5 bg-gray-50 rounded-lg">
                          <p className="text-sm lg:text-base font-semibold text-gray-700 mb-3">{t("bookingForm.contactDetails")}</p>
                          <div className="space-y-2 lg:space-y-3 text-sm lg:text-base">
                            <p className="text-gray-900"><span className="text-gray-600 font-medium">{t("bookingForm.emailLabel")}</span> {guestEmail}</p>
                            <p className="text-gray-900"><span className="text-gray-600 font-medium">{t("bookingForm.nameLabel")}</span> {guestName}</p>
                            <p className="text-gray-900"><span className="text-gray-600 font-medium">{t("bookingForm.phoneLabel")}</span> {guestPhone}</p>
                            <p className="text-gray-900"><span className="text-gray-600 font-medium">{t("bookingForm.guestsLabel")}</span> {numberOfAdults === "" ? 1 : numberOfAdults} {(numberOfAdults === "" ? 1 : numberOfAdults) === 1 ? t("bookingForm.adult") : t("bookingForm.adults")}{(numberOfChildren === "" ? 0 : numberOfChildren) > 0 ? `, ${numberOfChildren === "" ? 0 : numberOfChildren} ${(numberOfChildren === "" ? 0 : numberOfChildren) === 1 ? t("bookingForm.child") : t("bookingForm.children")}` : ""}</p>
                          </div>
                        </div>

                        {pricing?.warnings && pricing.warnings.length > 0 && (
                          <div className="p-4 lg:p-5 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm lg:text-base font-semibold text-yellow-800 mb-2">{t("bookingForm.bookingNote")}:</p>
                            {pricing.warnings.map((warning: string, index: number) => {
                              // Übersetze Warnungen im Frontend
                              let translatedWarning = warning;
                              
                              // Erkenne Samstag-zu-Samstag Warnung
                              if (warning.includes('Samstag zu Samstag') || warning.includes('Samstag-zu-Samstag')) {
                                translatedWarning = t("bookingForm.saturdayToSaturdayRequired");
                              }
                              // Erkenne Mindestnächte-Warnung (wenn minNights vorhanden ist, verwende die bereits übersetzte Version)
                              else if (pricing.minNights && (warning.includes('Mindestbuchung') || warning.includes('Mindest'))) {
                                // Verwende die bereits übersetzte Version aus dem Dialog
                                const bookingNights = pricing.nights || nights;
                                translatedWarning = `${t("bookingForm.youWantToBook")} ${bookingNights} ${bookingNights === 1 ? t("bookingForm.night") : t("bookingForm.nights")} ${t("bookingForm.nightsButMinimum")} ${pricing.minNights} ${pricing.minNights === 1 ? t("bookingForm.night") : t("bookingForm.nights")} ${t("bookingForm.nightsRequired")}`;
                              }
                              
                              return (
                                <p key={index} className="text-xs lg:text-sm text-yellow-700">{translatedWarning}</p>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Feste Leiste unten mit Preis & Buttons */}
                  <div className="border-t p-4 lg:p-6">
                    {isLoadingPrice ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-gray-500">
                        <Loader2 className="h-5 w-5 lg:h-6 lg:w-6 animate-spin" />
                        <span className="text-sm lg:text-base">{t("bookingForm.calculatingPrice")}</span>
                      </div>
                    ) : pricing ? (
                      <div className="space-y-4 lg:space-y-5 mb-4 lg:mb-6">
                        <div className="flex justify-between items-center py-1">
                          <span className="text-sm lg:text-base text-gray-600">{pricing.nights} {pricing.nights === 1 ? t("bookingForm.night") : t("bookingForm.nights")}</span>
                          <span className="font-medium text-sm lg:text-base">{formatCurrency(pricing.basePrice)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 text-xs lg:text-sm">
                          <span className="text-gray-600">{t("bookingForm.pricePerNightShort")} {formatCurrency(pricing.pricePerNight)}</span>
                          <span className="text-gray-500">{t("bookingForm.pricePerNightLabel")}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 text-sm lg:text-base border-t pt-3 lg:pt-4">
                          <span className="text-gray-600">{t("bookingForm.finalCleaning")}</span>
                          <span className="font-medium">{formatCurrency(pricing.cleaningFee)}</span>
                        </div>
                        {pricing.beachHutPrice && (
                          <div className="flex justify-between items-center py-1 text-sm lg:text-base">
                            <span className="text-gray-600">{t("bookingForm.beachHut")}</span>
                            <span className="font-medium">{formatCurrency(pricing.beachHutPrice)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-3 lg:pt-4 border-t-2 border-primary/20">
                          <span className="text-lg lg:text-2xl font-bold text-gray-900">{t("bookingForm.totalPrice")}</span>
                          <span className="text-2xl lg:text-3xl font-bold text-primary flex items-center gap-2">
                            <Euro className="h-6 w-6 lg:h-7 lg:w-7" /> {formatCurrency(pricing.totalPrice)}
                          </span>
                        </div>
                      </div>
                    ) : null}
                    <div className="flex gap-3 lg:gap-4">
                      <Button type="button" variant="outline" onClick={prevStep} className="flex-1 h-11 lg:h-14 text-sm lg:text-lg">
                        <ChevronLeft className="mr-1.5 h-4 w-4 lg:h-6 lg:w-6" /> {t("bookingForm.back")}
                      </Button>
                      <Button type="submit" className="flex-1 h-11 lg:h-14 text-sm lg:text-lg" disabled={!guestEmail || !guestName?.trim() || !guestPhone?.trim() || isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 lg:h-6 lg:w-6 animate-spin" /> {t("bookingForm.sending")}
                          </>
                        ) : (
                          <>
                            {t("bookingForm.sendRequest")} <ChevronRight className="ml-2 h-4 w-4 lg:h-6 lg:w-6" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Warnungs-Dialog - muss explizit über Button geschlossen werden */}
      <AlertDialog 
        open={warningDialog.open}
        onOpenChange={() => {
          // bewusst leer: nur Buttons steuern den State
        }}
      >
        <AlertDialogContent className="border-2 shadow-xl max-w-[85vw] sm:max-w-sm mx-auto rounded-xl-all">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-xl font-semibold">{t("bookingForm.bookingNote")}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 text-base">
              {warningDialog.minNights ? (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p className="text-sm text-gray-600">
                      {t("bookingForm.youWantToBook")} <strong className="text-gray-900">{warningDialog.nights} {warningDialog.nights === 1 ? t("bookingForm.night") : t("bookingForm.nights")}</strong> {t("bookingForm.nightsButMinimum")} <strong className="text-gray-900">{warningDialog.minNights} {warningDialog.minNights === 1 ? t("bookingForm.night") : t("bookingForm.nights")}</strong> {t("bookingForm.nightsRequired")}
                    </p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-900">{t("bookingForm.requestWarning")}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {warningDialog.warnings.map((warning, index) => (
                      <p key={index} className="text-sm text-gray-600">{warning}</p>
                    ))}
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-900">{t("bookingForm.periodWarning")}</p>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 mt-6">
            <AlertDialogCancel
              className="w-full sm:w-auto order-2 sm:order-1 rounded-lg"
              onClick={() => {
                setStartDate(null);
                setEndDate(null);
                setPricing(null);
                if (currentStep > 1) setCurrentStep(1);
                setWarningDialog({ open: false, warnings: [], nights: 0 });
              }}
            >
              {t("bookingForm.selectNewPeriod")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="w-full sm:w-auto order-1 sm:order-2 rounded-lg"
              onClick={() => setWarningDialog({ open: false, warnings: [], nights: 0 })}
            >
              {t("bookingForm.continueAnyway")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
