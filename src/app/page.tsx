"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Search, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function HomePage() {
  const router = useRouter();
  const { t, isReady } = useTranslation();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showGuestCodeDialog, setShowGuestCodeDialog] = useState(false);
  const [guestCode, setGuestCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/check");
        const data = await res.json();
        
        if (data.authenticated && data.role === "ADMIN") {
          router.push("/admin/bookings");
          return;
        }
        
        // Prüfe ob bereits Gastcode validiert wurde
        const validated = sessionStorage.getItem("guestCodeValidated");
        if (validated !== "true") {
          // Zeige Dialog wenn kein Gastcode validiert wurde
          setShowGuestCodeDialog(true);
        }
        
        setIsAuthenticated(false);
      } catch (error) {
        console.error("Auth check error:", error);
        setIsAuthenticated(false);
        setShowGuestCodeDialog(true);
      } finally {
        setIsChecking(false);
      }
    }

    checkAuth();
  }, [router]);

  const handleGuestCodeSubmit = async () => {
    if (!guestCode.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Gastcode ein",
        variant: "destructive",
      });
      return;
    }

    setIsValidating(true);

    try {
      const response = await fetch("/api/auth/validate-guest-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: guestCode.trim() }),
      });

      const data = await response.json();

      if (data.valid) {
        sessionStorage.setItem("guestCodeValidated", "true");
        sessionStorage.setItem("guestCode", guestCode.trim());
        setShowGuestCodeDialog(false);
        setIsAuthenticated(true);
        toast({
          title: "Erfolgreich",
          description: "Gastcode wurde akzeptiert",
        });
      } else {
        toast({
          title: "Fehler",
          description: data.error || "Ungültiger Gastcode",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error validating guest code:", error);
      toast({
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleBookNow = () => {
    if (sessionStorage.getItem("guestCodeValidated") !== "true") {
      setShowGuestCodeDialog(true);
      return;
    }
    router.push("/book");
  };

  if (isChecking || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Domburg</CardTitle>
            <CardDescription>
              {t("booking.selectDates")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full"
              size="lg"
              onClick={handleBookNow}
            >
              <Calendar className="mr-2 h-5 w-5" />
              {t("booking.bookNow")}
            </Button>
            <Button
              className="w-full"
              variant="outline"
              size="lg"
              onClick={() => router.push("/booking/status")}
            >
              <Search className="mr-2 h-5 w-5" />
              {t("booking.checkStatus")}
            </Button>
            
            <div className="pt-4 border-t">
              <Link 
                href="/auth/login" 
                className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors"
              >
                <ShieldCheck className="h-3 w-3" />
                Admin Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showGuestCodeDialog} onOpenChange={setShowGuestCodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gastcode eingeben</DialogTitle>
            <DialogDescription>
              Bitte geben Sie Ihren Gastcode ein, um fortzufahren
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="guestCode">Gastcode</Label>
              <Input
                id="guestCode"
                value={guestCode}
                onChange={(e) => setGuestCode(e.target.value)}
                placeholder="Ihr Gastcode"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleGuestCodeSubmit();
                  }
                }}
                disabled={isValidating}
                autoFocus
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowGuestCodeDialog(false)}
              disabled={isValidating}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleGuestCodeSubmit}
              disabled={isValidating || !guestCode.trim()}
            >
              {isValidating ? "Wird geprüft..." : "Bestätigen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
