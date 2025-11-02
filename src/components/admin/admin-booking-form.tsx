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
  const { toast } = useToast();
  const router = useRouter();

  // Pre-fill dates if provided
  useEffect(() => {
    if (initialStartDate) {
      setStartDate(initialStartDate.toISOString().split("T")[0]);
    }
    if (initialEndDate) {
      setEndDate(initialEndDate.toISOString().split("T")[0]);
    }
  }, [initialStartDate, initialEndDate, open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStartDate(initialStartDate?.toISOString().split("T")[0] || "");
      setEndDate(initialEndDate?.toISOString().split("T")[0] || "");
      setNumberOfAdults(2);
      setNumberOfChildren(0);
      setGuestEmail("");
      setGuestName("");
      setGuestPhone("");
      setMessage("");
      setPricing(null);
    }
  }, [open, initialStartDate, initialEndDate]);

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
      const response = await fetch("/api/pricing/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
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

    if (!guestEmail) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "E-Mail-Adresse fehlt",
      });
      return;
    }

    if (!guestPhone || !guestPhone.trim()) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Telefonnummer fehlt",
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
        guestPhone: guestPhone.trim(),
        message: message.trim() || undefined,
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
            Erstellen Sie eine neue Buchungsanfrage für einen Gast
          </DialogDescription>
        </DialogHeader>

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
                Name (optional)
              </Label>
              <Input
                id="guestName"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Max Mustermann"
                disabled={isSubmitting}
              />
            </div>

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
          </div>

          <div className="space-y-2">
            <Label htmlFor="guestPhone" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Telefonnummer *
            </Label>
            <Input
              id="guestPhone"
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="+49 123 456789"
              required
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

          {pricing && (
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

          {isLoadingPrice && (
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
            <Button type="submit" disabled={isSubmitting || isLoadingPrice}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird erstellt...
                </>
              ) : (
                "Buchung erstellen"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

