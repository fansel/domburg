"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookingForm } from "@/components/booking-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function BookPage() {
  const [isValidated, setIsValidated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Prüfe ob Gastcode validiert wurde
    const validated = sessionStorage.getItem("guestCodeValidated");
    if (validated === "true") {
      setIsValidated(true);
    } else {
      // Nicht validiert -> zurück zur Startseite
      router.push("/");
    }
  }, [router]);

  if (!isValidated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Überprüfe Zugangsberechtigung...</p>
        </div>
      </div>
    );
  }

  // Buchungsformular
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück
          </Button>
          <h1 className="text-3xl font-bold mb-2">Neue Buchung erstellen</h1>
          <p className="text-muted-foreground">
            Wählen Sie Ihren gewünschten Zeitraum und senden Sie eine Buchungsanfrage
          </p>
        </div>

        <BookingForm />
      </div>
    </div>
  );
}

