"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, isReady } = useTranslation();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showGuestCodeDialog, setShowGuestCodeDialog] = useState(false);
  const [guestCode, setGuestCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidatedCode, setHasValidatedCode] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    async function checkAuth() {
      try {
        // Verhindere mehrfache API-Aufrufe
        if (isRedirecting || typeof window === "undefined") return;
        
        const res = await fetch("/api/auth/check");
        const data = await res.json();
        
        if (!mounted) return;
        
        // SUPERADMIN ist auch ADMIN - prüfe Berechtigungen vor Weiterleitung
        if (data.authenticated && (data.role === "ADMIN" || data.role === "SUPERADMIN")) {
          setIsRedirecting(true);
          // Verzögerung, damit State gesetzt werden kann
          // Prüfe ob User Buchungen sehen darf, sonst zu Settings
          if (data.role === "SUPERADMIN" || data.permissions?.canSeeBookings) {
            setTimeout(() => {
              window.location.href = "/admin/bookings";
            }, 100);
          } else {
            setTimeout(() => {
              window.location.href = "/admin/settings";
            }, 100);
          }
          return;
        }
        
        // Prüfe ob Housekeeper eingeloggt ist
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          const isHousekeeper = data.user.name === 'Housekeeper' || 
                                data.user.email?.includes('housekeeper-');
          
          if (isHousekeeper) {
            setIsRedirecting(true);
            setTimeout(() => {
              window.location.href = "/housekeeping";
            }, 100);
            return;
          }
          
          // Wenn bereits authentifiziert (über Cookie/Token), aber KEIN Gastcode validiert wurde,
          // dann ist das wahrscheinlich ein Rest-Cookie nach Logout -> Cookie löschen und Gastcode verlangen
          const validated = sessionStorage.getItem("guestCodeValidated");
          if (validated !== "true") {
            // Cookie ist vorhanden, aber kein Gastcode validiert -> Cookie löschen
            await fetch("/api/auth/logout", { method: "POST" });
            if (!mounted) return;
            setHasValidatedCode(false);
            setIsAuthenticated(false);
            // Dialog nur auf Desktop öffnen (auf Mobile wird die Card-Seite angezeigt)
            if (typeof window !== "undefined" && window.innerWidth >= 768) {
              setShowGuestCodeDialog(true);
            }
            return;
          }
          
          // Wenn authentifiziert UND Gastcode validiert, alles ok
          setHasValidatedCode(true);
          setIsAuthenticated(true);
          setShowGuestCodeDialog(false);
          return;
        }
        
        // Nicht authentifiziert über Cookie/Token -> Prüfe sessionStorage
        const validated = sessionStorage.getItem("guestCodeValidated");
        if (validated !== "true") {
          // Zeige Eingabe nur wenn weder Cookie noch sessionStorage vorhanden
          setHasValidatedCode(false);
          setIsAuthenticated(false);
          // Dialog nur auf Desktop öffnen (auf Mobile wird die Card-Seite angezeigt)
          if (typeof window !== "undefined" && window.innerWidth >= 768) {
            setShowGuestCodeDialog(true);
          }
        } else {
          setHasValidatedCode(true);
          setIsAuthenticated(true);
          setShowGuestCodeDialog(false);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        if (!mounted) return;
        setIsAuthenticated(false);
        setHasValidatedCode(false);
        // Dialog nur auf Desktop öffnen (auf Mobile wird die Card-Seite angezeigt)
        if (typeof window !== "undefined" && window.innerWidth >= 768) {
          setShowGuestCodeDialog(true);
        }
      } finally {
        if (mounted) {
          setIsChecking(false);
        }
      }
    }

    checkAuth();
    
    return () => {
      mounted = false;
    };
  }, []);

  const handleGuestCodeSubmit = async () => {
    if (!guestCode.trim()) {
      toast({
        title: t("home.error"),
        description: t("home.pleaseEnterCode"),
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
        // Prüfe ob es ein Cleaning-Code ist
        if (data.accessType === 'CLEANING') {
          // Code über guest-code Route einloggen (setzt Cookie und Token)
          const loginResponse = await fetch("/api/auth/guest-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: guestCode.trim() }),
          });

          const loginData = await loginResponse.json();
          
          if (loginData.success) {
            setShowGuestCodeDialog(false);
            toast({
              title: t("home.success"),
              description: t("home.codeAccepted"),
            });
            router.push("/housekeeping");
          } else {
            toast({
              title: t("home.error"),
              description: loginData.error || t("auth.invalidCredentials"),
              variant: "destructive",
            });
          }
          return;
        }
        
        // Normaler Gastcode
        // Stelle sicher, dass alle Auth-Cookies gelöscht werden (falls noch vorhanden)
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch (error) {
          // Ignoriere Fehler beim Logout (kann sein dass kein Cookie vorhanden war)
        }
        
        sessionStorage.setItem("guestCodeValidated", "true");
        sessionStorage.setItem("guestCode", guestCode.trim());
        setHasValidatedCode(true);
        setShowGuestCodeDialog(false);
        setIsAuthenticated(true);
        toast({
          title: t("home.success"),
          description: t("home.codeAccepted"),
        });
        
        // Weiterleitung zur ursprünglich aufgerufenen Seite
        const redirectPath = searchParams.get("redirect");
        if (redirectPath) {
          router.push(decodeURIComponent(redirectPath));
        }
      } else {
        toast({
          title: t("home.error"),
          description: data.error || t("home.invalidCode"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error validating guest code:", error);
      toast({
        title: t("home.error"),
        description: t("home.errorOccurred"),
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Hilfsfunktion: Prüft ob Zugang gewährt ist (Admin/Superadmin oder Gastcode validiert)
  // SUPERADMIN hat automatisch alle ADMIN-Rechte
  const hasAccess = () => {
    // SUPERADMIN ist auch ADMIN - hat automatisch Zugang
    if (currentUser && (currentUser.role === "ADMIN" || currentUser.role === "SUPERADMIN")) {
      return true;
    }
    // Gäste brauchen validierten Gastcode
    return sessionStorage.getItem("guestCodeValidated") === "true";
  };

  const handleBookNow = () => {
    if (!hasAccess()) {
      setShowGuestCodeDialog(true);
      return;
    }
    router.push("/book");
  };

  if (isChecking || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      {/* Hauptseite nur anzeigen wenn Code validiert wurde */}
      {hasValidatedCode ? (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col md:items-center md:justify-center md:p-4">
        {/* Mobile: Native Vollbild-Layout */}
        <div className="flex-1 flex flex-col md:hidden">
          {/* Header Bereich */}
          <div className="flex-1 flex flex-col justify-center px-6 pb-12">
            <div className="space-y-8 max-w-sm mx-auto w-full">
              {/* Logo/Titel Bereich */}
              <div className="space-y-4 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20 mb-2">
                  <Calendar className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                  Hollandhaus
                </h1>
                <p className="text-base text-gray-600 leading-relaxed">
                  {t("booking.selectDates")}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4">
                <Button
                  className="w-full h-14 text-base font-semibold rounded-xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all"
                  size="lg"
                  onClick={handleBookNow}
                >
                  <Calendar className="mr-2 h-5 w-5" />
                  {t("booking.bookNow")}
                </Button>
                
                <Button
                  className="w-full h-14 text-base font-medium rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-all"
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    if (!hasAccess()) {
                      setShowGuestCodeDialog(true);
                      return;
                    }
                    router.push("/calendar");
                  }}
                >
                  <Calendar className="mr-2 h-5 w-5" />
                  {t("home.viewCalendar")}
                </Button>
                
                <Button
                  className="w-full h-14 text-base font-medium rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-all"
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    if (!hasAccess()) {
                      setShowGuestCodeDialog(true);
                      return;
                    }
                    router.push("/booking/status");
                  }}
                >
                  <Search className="mr-2 h-5 w-5" />
                  {t("booking.checkStatus")}
                </Button>
              </div>
            </div>
          </div>

          {/* Footer Bereich */}
          <div className="px-6 pb-8 pt-4 border-t border-gray-200/60">
            <Button
              variant="ghost"
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={async () => {
                // Ausloggen: Sowohl Cookie als auch sessionStorage löschen
                sessionStorage.removeItem("guestCodeValidated");
                sessionStorage.removeItem("guestCode");
                try {
                  await fetch("/api/auth/logout", { method: "POST" });
                } catch (error) {
                  console.error("Logout error:", error);
                }
                setHasValidatedCode(false);
                setIsAuthenticated(false);
                // Nach Logout zur Startseite zurückkehren und Gastcode-Dialog zeigen
                if (typeof window !== "undefined" && window.innerWidth >= 768) {
                  setShowGuestCodeDialog(true);
                }
                // Kurz warten damit Cookie gelöscht wird
                setTimeout(() => {
                  router.refresh();
                }, 100);
              }}
            >
              {t("home.logout")}
            </Button>
          </div>
        </div>

        {/* Desktop: Card-Layout bleibt */}
        <Card className="w-full max-w-md hidden md:block">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Hollandhaus</CardTitle>
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
              onClick={() => {
                if (sessionStorage.getItem("guestCodeValidated") !== "true") {
                  setShowGuestCodeDialog(true);
                  return;
                }
                router.push("/calendar");
              }}
            >
              <Calendar className="mr-2 h-5 w-5" />
              {t("home.viewCalendar")}
            </Button>
            <Button
              className="w-full"
              variant="outline"
              size="lg"
              onClick={() => {
                if (sessionStorage.getItem("guestCodeValidated") !== "true") {
                  setShowGuestCodeDialog(true);
                  return;
                }
                router.push("/booking/status");
              }}
            >
              <Search className="mr-2 h-5 w-5" />
              {t("booking.checkStatus")}
            </Button>
            
            <div className="pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={async () => {
                  // Ausloggen: Sowohl Cookie als auch sessionStorage löschen
                  sessionStorage.removeItem("guestCodeValidated");
                  sessionStorage.removeItem("guestCode");
                  try {
                    await fetch("/api/auth/logout", { method: "POST" });
                  } catch (error) {
                    console.error("Logout error:", error);
                  }
                  setHasValidatedCode(false);
                  setIsAuthenticated(false);
                  setShowGuestCodeDialog(true);
                  // Kurz warten damit Cookie gelöscht wird
                  setTimeout(() => {
                    router.refresh();
                  }, 100);
                }}
              >
                {t("home.logout")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      ) : (
        <>
          {/* Mobile: Native Vollbild-Seite */}
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 md:hidden flex flex-col">
            {/* Header Bereich */}
            <div className="flex-1 flex flex-col justify-center px-6 pb-20">
              <div className="space-y-8 max-w-sm mx-auto w-full">
                {/* Logo/Titel Bereich */}
                <div className="space-y-4 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
                    <ShieldCheck className="h-10 w-10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      {t("home.welcome")}
                    </h1>
                    <p className="text-sm text-gray-600">
                      {t("home.enterAccessCode")}
                    </p>
                  </div>
                </div>

                {/* Formular Bereich */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      id="guestCodeMobile"
                      value={guestCode}
                      onChange={(e) => setGuestCode(e.target.value.toUpperCase())}
                      placeholder={t("home.accessCodePlaceholder")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isValidating && guestCode.trim()) {
                          handleGuestCodeSubmit();
                        }
                      }}
                      disabled={isValidating}
                      autoFocus
                      autoComplete="off"
                      className="h-12 text-base text-center font-medium border-2 border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 text-center">
                      {t("home.findInConfirmation")}
                    </p>
                  </div>
                  
                  <Button
                    onClick={handleGuestCodeSubmit}
                    disabled={isValidating || !guestCode.trim()}
                    className="w-full h-12 text-base font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    size="lg"
                  >
                    {isValidating ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>{t("home.checking")}</span>
                      </span>
                    ) : (
                      t("home.continue")
                    )}
                  </Button>
                  
                  {guestCode && !isValidating && (
                    <p className="text-xs text-gray-400 text-center pt-1">
                      {t("home.tip")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Bereich */}
            <div className="px-6 pb-8 pt-4 border-t border-gray-200/60 bg-white/50 backdrop-blur-sm">
              <Link 
                href="/auth/login" 
                className="text-sm text-gray-600 hover:text-primary flex items-center justify-center gap-2 transition-colors py-3 font-medium"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{t("home.adminLogin")}</span>
              </Link>
            </div>
          </div>

          {/* Desktop: Dialog bleibt - nur auf Desktop sichtbar */}
          <div className="hidden md:block">
            <Dialog 
              open={showGuestCodeDialog} 
              onOpenChange={(open) => {
                // Dialog darf nur geschlossen werden wenn Code validiert wurde
                if (!open && !hasValidatedCode) {
                  // Verhindere Schließen wenn kein Code validiert wurde
                  return;
                }
                setShowGuestCodeDialog(open);
              }}
            >
              <DialogContent 
                className="bg-white max-w-md"
                hideClose={!hasValidatedCode}
                whiteBackground={!hasValidatedCode}
                onEscapeKeyDown={(e) => {
                  // Verhindere ESC-Taste wenn kein Code validiert wurde
                  if (!hasValidatedCode) {
                    e.preventDefault();
                  }
                }}
                onInteractOutside={(e) => {
                  // Verhindere Klick außerhalb wenn kein Code validiert wurde
                  if (!hasValidatedCode) {
                    e.preventDefault();
                  }
                }}
              >
                <DialogHeader className="text-center space-y-3">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20 flex items-center justify-center">
                    <ShieldCheck className="h-8 w-8 text-white" />
                  </div>
                  <div className="space-y-1">
                    <DialogTitle className="text-xl font-bold">{t("home.welcome")}</DialogTitle>
                    <DialogDescription className="text-sm text-gray-600">
                      {t("home.enterAccessCode")}
                    </DialogDescription>
                  </div>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Input
                      id="guestCode"
                      value={guestCode}
                      onChange={(e) => setGuestCode(e.target.value.toUpperCase())}
                      placeholder={t("home.accessCodePlaceholder")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isValidating && guestCode.trim()) {
                          handleGuestCodeSubmit();
                        }
                      }}
                      disabled={isValidating}
                      autoFocus
                      autoComplete="off"
                      className="h-12 text-center font-medium border-2 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="text-xs text-gray-500 text-center">
                      {t("home.findInConfirmation")}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Button
                    onClick={handleGuestCodeSubmit}
                    disabled={isValidating || !guestCode.trim()}
                    className="w-full h-12 text-base font-semibold"
                    size="lg"
                  >
                    {isValidating ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        {t("home.checking")}
                      </span>
                    ) : (
                      t("home.continue")
                    )}
                  </Button>
                  {guestCode && !isValidating && (
                    <p className="text-xs text-gray-400 text-center">
                      {t("home.tip")}
                    </p>
                  )}
                  <div className="pt-3 border-t">
                    <Link 
                      href="/auth/login" 
                      className="text-sm text-gray-600 hover:text-primary flex items-center justify-center gap-2 transition-colors font-medium"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {t("home.adminLogin")}
                    </Link>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </>
      )}
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Lade...</p>
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
