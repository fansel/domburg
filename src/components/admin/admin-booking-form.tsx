"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createBooking } from "@/app/actions/booking";
import { formatCurrency } from "@/lib/utils";
import { Loader2, CalendarDays, Users, Mail, User, Euro } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/contexts/LanguageContext";

interface AdminBookingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStartDate?: Date | null;
  initialEndDate?: Date | null;
}

interface PriceCalculation {
  nights: number;
  basePrice: number;
  cleaningFee: number;
  totalPrice: number;
  pricePerNight: number;
}

export function AdminBookingForm({ open, onOpenChange, initialStartDate, initialEndDate }: AdminBookingFormProps) {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [numberOfAdults, setNumberOfAdults] = useState(2);
  const [numberOfChildren, setNumberOfChildren] = useState(0);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pricing, setPricing] = useState<PriceCalculation | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [useFamilyPrice, setUseFamilyPrice] = useState(false);
  const [activeTab, setActiveTab] = useState<"booking" | "manual">("booking");
  const { toast } = useToast();
  const router = useRouter();
  
  const isManualEntry = activeTab === "manual";

  // Hilfsfunktion: Konvertiere Date zu lokaler YYYY-MM-DD Format
  const formatDateToLocalString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Pre-fill dates if provided
  useEffect(() => {
    if (initialStartDate) {
      setStartDate(formatDateToLocalString(initialStartDate));
    }
    if (initialEndDate) {
      setEndDate(formatDateToLocalString(initialEndDate));
    }
  }, [initialStartDate, initialEndDate, open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStartDate(initialStartDate ? formatDateToLocalString(initialStartDate) : "");
      setEndDate(initialEndDate ? formatDateToLocalString(initialEndDate) : "");
      setNumberOfAdults(2);
      setNumberOfChildren(0);
      setGuestEmail("");
      setGuestName("");
      setGuestPhone("");
      setMessage("");
      setPricing(null);
      setUseFamilyPrice(false);
      setActiveTab("booking");
    }
  }, [open, initialStartDate, initialEndDate]);

  // Live-Preisberechnung wenn Datum oder Family-Preis geändert wird
  useEffect(() => {
    if (startDate && endDate && !isManualEntry) {
      calculatePrice();
    } else {
      setPricing(null);
    }
  }, [startDate, endDate, useFamilyPrice, isManualEntry]);

  const calculatePrice = async () => {
    if (!startDate || !endDate) return;

    setIsLoadingPrice(true);
    try {
      const response = await fetch("/api/pricing/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          useFamilyPrice: useFamilyPrice,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setPricing(data.pricing);
      }
    } catch (error) {
      console.error("Error calculating price:", error);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Zeitraum auswählen",
      });
      return;
    }

    // Bei manuellem Eintrag nur Titel/Titel prüfen
    if (isManualEntry) {
      if (!guestName || !guestName.trim()) {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: "Titel fehlt",
        });
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await fetch("/api/admin/calendar-bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: guestName.trim(),
            start: new Date(startDate).toISOString(),
            end: new Date(endDate).toISOString(),
            isInfo: false,
          }),
        });

        const data = await response.json();
        if (data.success) {
          toast({
            title: "Erfolgreich",
            description: "Manueller Eintrag erstellt",
          });
          onOpenChange(false);
          router.refresh();
        } else {
          toast({
            variant: "destructive",
            title: "Fehler",
            description: data.error || "Fehler beim Erstellen des Eintrags",
          });
        }
      } catch (error) {
        console.error("Error creating manual entry:", error);
        toast({
          variant: "destructive",
          title: "Fehler",
          description: "Fehler aufgetreten",
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Normale Buchung validieren
    if (!guestEmail) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "E-Mail-Adresse fehlt",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createBooking({
        startDate,
        endDate,
        numberOfAdults,
        numberOfChildren,
        guestEmail: guestEmail.trim(),
        guestName: guestName.trim() || undefined,
        guestPhone: guestPhone.trim() || undefined,
        message: message.trim() || undefined,
        useFamilyPrice: useFamilyPrice,
      });

      if (result.success) {
        toast({
          title: "Erfolgreich",
          description: "Buchung erstellt",
        });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: result.error || "Fehler beim Erstellen der Buchung",
        });
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Fehler aufgetreten",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neue Buchung erstellen</DialogTitle>
          <DialogDescription>
            Erstellen Sie eine neue Buchungsanfrage für einen Gast oder einen manuellen Kalendereintrag
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "booking" | "manual")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="booking">Buchung</TabsTrigger>
            <TabsTrigger value="manual">Manueller Eintrag</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Anreisedatum
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate" className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Abreisedatum
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                min={startDate || undefined}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="guestName" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {isManualEntry ? "Titel *" : "Name (optional)"}
              </Label>
              <Input
                id="guestName"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder={isManualEntry ? "z.B. Wartung" : "Max Mustermann"}
                required={isManualEntry}
                disabled={isSubmitting}
              />
            </div>

            {!isManualEntry && (
              <div className="space-y-2">
                <Label htmlFor="guestEmail" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  E-Mail *
                </Label>
                <Input
                  id="guestEmail"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="gast@example.com"
                  required
                  disabled={isSubmitting}
                />
              </div>
            )}
          </div>

          {!isManualEntry && (
            <>
              <div className="space-y-2">
                <Label htmlFor="guestPhone" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Telefonnummer (optional)
                </Label>
                <Input
                  id="guestPhone"
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="+49 123 456789"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="numberOfAdults" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Anzahl Erwachsene
                </Label>
                <Input
                  id="numberOfAdults"
                  type="number"
                  min="1"
                  max="20"
                  value={numberOfAdults}
                  onChange={(e) => setNumberOfAdults(parseInt(e.target.value) || 1)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="numberOfChildren">
                  Anzahl Kinder
                </Label>
                <Input
                  id="numberOfChildren"
                  type="number"
                  min="0"
                  max="20"
                  value={numberOfChildren}
                  onChange={(e) => setNumberOfChildren(parseInt(e.target.value) || 0)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex items-center space-x-2 border rounded-lg p-4 bg-muted/50">
                <Switch
                  id="useFamilyPrice"
                  checked={useFamilyPrice}
                  onCheckedChange={setUseFamilyPrice}
                  disabled={isSubmitting}
                />
                <div className="flex-1">
                  <Label htmlFor="useFamilyPrice" className="cursor-pointer font-semibold">
                    Familienrabatt aktivieren
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ermäßigter Preis (120€ statt 180€ pro Nacht)
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">Nachricht (optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Zusätzliche Informationen..."
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {!isManualEntry && pricing && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <Euro className="h-4 w-4" />
                Preisübersicht
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>{pricing.nights} {pricing.nights === 1 ? "Nacht" : "Nächte"}</span>
                  <span>{formatCurrency(pricing.basePrice)}</span>
                </div>
                {pricing.cleaningFee > 0 && (
                  <div className="flex justify-between">
                    <span>Reinigungsgebühr</span>
                    <span>{formatCurrency(pricing.cleaningFee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium border-t pt-1 mt-1">
                  <span>Gesamt</span>
                  <span>{formatCurrency(pricing.totalPrice)}</span>
                </div>
              </div>
            </div>
          )}

          {!isManualEntry && isLoadingPrice && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preis wird berechnet...
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting || (isLoadingPrice && !isManualEntry)}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird erstellt...
                </>
              ) : (
                isManualEntry ? "Eintrag erstellen" : "Buchung erstellen"
              )}
            </Button>
          </div>
        </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

