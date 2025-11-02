"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookingForm } from "@/components/booking-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft, House } from "lucide-react";

export default function BookPage() {
  const [isValidated, setIsValidated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkAccess() {
      try {
        // Prüfe erst über API ob User eingeloggt ist
        const authRes = await fetch("/api/auth/check");
        const authData = await authRes.json();
        
        // Wenn eingeloggt und Housekeeper -> zur Cleaning-Seite
        if (authData.authenticated && authData.user) {
          const isHousekeeper = authData.user.name === 'Housekeeper' || 
                                authData.user.email?.includes('housekeeper-');
          
          if (isHousekeeper) {
            router.push("/housekeeping");
            return;
          }
          
          // Wenn Admin oder Superadmin eingeloggt -> Zugriff erlauben (SUPERADMIN ist auch ADMIN)
          if (authData.role === 'ADMIN' || authData.role === 'SUPERADMIN') {
            setIsValidated(true);
            return;
          }
        }
        
        // Prüfe ob Gastcode validiert wurde (normale Gäste)
        const validated = sessionStorage.getItem("guestCodeValidated");
        if (validated === "true") {
          setIsValidated(true);
        } else {
          // Nicht validiert -> zur Startseite mit Redirect-Parameter
          const currentPath = window.location.pathname;
          router.push(`/?redirect=${encodeURIComponent(currentPath)}`);
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

  // Buchungsformular
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4 sm:py-8 lg:py-12">
        <div className="mb-4 lg:mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="mb-2 lg:mb-4"
            size="sm"
          >
            <House className="mr-2 h-4 w-4" />
            Hauptmenü
          </Button>
          <h1 className="text-center text-lg lg:text-2xl font-semibold text-muted-foreground">Neue Anfrage</h1>
        </div>
        <BookingForm />
      </div>
    </div>
  );
}

