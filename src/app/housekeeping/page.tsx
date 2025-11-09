"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { HousekeepingCalendar } from "@/components/housekeeping-calendar";

export default function CleaningPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [guestCode, setGuestCode] = useState("");

  // Authentifizierung prüfen
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/check");
        const data = await res.json();
        
        if (data.authenticated) {
          // Token-basierte Authentifizierung (Admin oder Housekeeper)
          setIsAuthenticated(true);
        } else {
          setShowLoginDialog(true);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setShowLoginDialog(true);
      } finally {
        setIsChecking(false);
      }
    }

    checkAuth();
  }, []);

  const handleGuestCodeSubmit = async () => {
    if (!guestCode.trim()) {
      toast({
        title: t("housekeeping.error"),
        description: t("housekeeping.pleaseEnterCode"),
        variant: "destructive",
      });
      return;
    }

    try {
      // Code über guest-code Route einloggen (setzt Cookie)
      const response = await fetch("/api/auth/guest-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: guestCode.trim() }),
      });

      const data = await response.json();

      if (data.success && data.accessType === 'CLEANING') {
        // Erfolgreich eingeloggt - Token ist im Cookie
        setShowLoginDialog(false);
        setIsAuthenticated(true);
        toast({
          title: t("housekeeping.codeAccepted"),
          description: t("housekeeping.codeAccepted"),
        });
      } else {
        toast({
          title: t("housekeeping.error"),
          description: data.error || t("housekeeping.invalidCode"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error validating code:", error);
      toast({
        title: t("housekeeping.error"),
        description: t("housekeeping.errorOccurred"),
        variant: "destructive",
      });
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t("housekeeping.loading")}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">{t("housekeeping.title")}</CardTitle>
            <CardDescription>
              {t("housekeeping.pleaseEnterAccessCode")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="cleaningCode" className="text-sm font-medium">
                {t("housekeeping.accessCode")}
              </label>
              <input
                id="cleaningCode"
                type="text"
                value={guestCode}
                onChange={(e) => setGuestCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleGuestCodeSubmit();
                  }
                }}
                className="w-full px-3 py-2 border rounded-md"
                placeholder={t("housekeeping.accessCodePlaceholder")}
                autoFocus
              />
            </div>
            <Button
              className="w-full"
              onClick={handleGuestCodeSubmit}
              disabled={!guestCode.trim()}
            >
              <LogIn className="mr-2 h-4 w-4" />
              {t("housekeeping.login")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {!isAuthenticated ? (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">{t("housekeeping.title")}</CardTitle>
              <CardDescription>
                {t("housekeeping.pleaseEnterAccessCode")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="cleaningCode" className="text-sm font-medium">
                  {t("housekeeping.accessCode")}
                </label>
                <input
                  id="cleaningCode"
                  type="text"
                  value={guestCode}
                  onChange={(e) => setGuestCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleGuestCodeSubmit();
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder={t("housekeeping.accessCodePlaceholder")}
                  autoFocus
                />
              </div>
              <Button
                className="w-full"
                onClick={handleGuestCodeSubmit}
                disabled={!guestCode.trim()}
              >
                <LogIn className="mr-2 h-4 w-4" />
                {t("housekeeping.login")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <HousekeepingCalendar
              headerActions={
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    router.push("/");
                  }}
                >
                  {t("housekeeping.logout")}
                </Button>
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
