"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, CalendarDays, User, Calendar, ShieldCheck, Euro, Menu, X, Key, Bell, Crown } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/contexts/LanguageContext";

interface NavbarProps {
  user?: {
    name?: string | null;
    email: string;
    role: string;
  };
}

export function Navbar({ user }: NavbarProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [canSeeBookings, setCanSeeBookings] = useState(true); // Default true, wird nach API-Call aktualisiert
  const [canManagePricing, setCanManagePricing] = useState(false); // Default false, wird nach API-Call aktualisiert
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

  // Lade Berechtigungen beim Mount
  useEffect(() => {
    if (user && (user.role === "ADMIN" || user.role === "SUPERADMIN")) {
      fetch("/api/auth/check")
        .then(res => res.json())
        .then(data => {
          if (data.authenticated && data.permissions) {
            setCanSeeBookings(data.role === "SUPERADMIN" || data.permissions.canSeeBookings);
            setCanManagePricing(data.role === "SUPERADMIN" || data.permissions.canManagePricing);
          }
        })
        .catch(err => console.error("Error fetching permissions:", err));
    }
  }, [user]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/auth/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!user) return null;

  // Filtere Navigation Items basierend auf Berechtigungen
  const allNavItems = [
    { href: "/admin/bookings", icon: CalendarDays, label: t("nav.requests"), pathMatch: "/admin/bookings", requiresBookingView: true, requiresPricing: false },
    { href: "/admin/calendar", icon: Calendar, label: t("nav.calendar"), pathMatch: "/admin/calendar", requiresBookingView: true, requiresPricing: false },
    { href: "/admin/pricing", icon: Euro, label: t("nav.pricing"), pathMatch: "/admin/pricing", requiresBookingView: false, requiresPricing: true },
    { href: "/admin/settings", icon: ShieldCheck, label: t("nav.settings"), pathMatch: "/admin/settings", requiresBookingView: false, requiresPricing: false },
  ];

  // Nur Items anzeigen, für die der User berechtigt ist
  const navItems = allNavItems.filter(item => {
    if (item.requiresBookingView && user.role !== "SUPERADMIN" && !canSeeBookings) {
      return false;
    }
    if (item.requiresPricing && user.role !== "SUPERADMIN" && !canManagePricing) {
      return false;
    }
    return true;
  });

  const isActive = (item: typeof navItems[0]) => {
    if (item.pathMatch === "/admin/bookings") {
      return pathname?.startsWith("/admin/bookings");
    }
    return pathname === item.pathMatch;
  };

  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <Button 
                    variant={isActive(item) ? "default" : "ghost"} 
                    size="sm"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden sm:flex">
                  <User className="mr-2 h-4 w-4" />
                  <span className="hidden lg:inline">{user.name || user.email}</span>
                  <span className="lg:hidden">{user.name || user.email.split("@")[0]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.name || "Administrator"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {user.role === "SUPERADMIN" && <Crown className="h-3 w-3 text-yellow-600" />}
                      <p className="text-xs font-semibold text-primary">
                        {user.role === "SUPERADMIN" ? "SUPERADMIN" : user.role}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onSelect={(e) => {
                    e.preventDefault();
                    router.push("/change-password");
                  }}
                  className="cursor-pointer"
                >
                  <Key className="mr-2 h-4 w-4" />
                  Passwort ändern
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onSelect={(e) => {
                    e.preventDefault();
                    router.push("/account/notifications");
                  }}
                  className="cursor-pointer"
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Benachrichtigungen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onSelect={(e) => {
                    e.preventDefault();
                    handleLogout();
                  }}
                  disabled={isLoggingOut}
                  className="cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {isLoggingOut ? `${t("nav.logout")}...` : t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Mobile User Button - öffnet das Dropdown-Menü */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
              <User className="h-4 w-4" />
            </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user.name || "Administrator"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {user.role === "SUPERADMIN" && <Crown className="h-3 w-3 text-yellow-600" />}
                        <p className="text-xs font-semibold text-primary">
                          {user.role === "SUPERADMIN" ? "SUPERADMIN" : user.role}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      router.push("/change-password");
                    }}
                    className="cursor-pointer"
                  >
                    <Key className="mr-2 h-4 w-4" />
                    Passwort ändern
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      router.push("/account/notifications");
                    }}
                    className="cursor-pointer"
                  >
                    <Bell className="mr-2 h-4 w-4" />
                    Benachrichtigungen
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      handleLogout();
                    }}
                    disabled={isLoggingOut}
                    className="cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {isLoggingOut ? `${t("nav.logout")}...` : t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t bg-background">
            <div className="py-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.href}
                      variant={isActive(item) ? "default" : "ghost"}
                      className="w-full justify-start"
                      size="sm"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      router.push(item.href);
                    }}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
