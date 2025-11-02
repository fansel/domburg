"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookingCalendar } from "@/components/booking-calendar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function CalendarPage() {
  const [isValidated, setIsValidated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);

  useEffect(() => {
    async function checkAccess() {
      try {
        // Prüfe ob Gastcode validiert wurde
        const validated = sessionStorage.getItem("guestCodeValidated");
        if (validated === "true") {
          setIsValidated(true);
        } else {
          // Nicht validiert -> zurück zur Startseite
          router.push("/");
        }
      } catch (error) {
        console.error("Error checking access:", error);
        router.push("/");
      } finally {
        setIsChecking(false);
      }
    }
    
    checkAccess();
  }, [router]);

  if (isChecking || !isValidated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Überprüfe Zugangsberechtigung...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4 sm:py-8">
        <Button variant="outline" className="mb-4" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
        </Button>
        <h1 className="text-2xl font-bold mb-6">Verfügbarkeitskalender</h1>
        <p className="text-muted-foreground mb-6">
          Übersicht über die Verfügbarkeit des Hauses. Rote Tage sind bereits belegt und nicht verfügbar.
        </p>
        <div className="max-w-4xl">
          <BookingCalendar
            selectedStartDate={null}
            selectedEndDate={null}
            onDateSelect={() => {
              // Kalender ist nur zur Anzeige, Auswahl wird nicht verwendet
            }}
          />
        </div>
      </div>
    </div>
  );
}

