"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, CalendarDays, User, Calendar, ShieldCheck, Euro, MessageSquare } from "lucide-react";
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
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

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

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-1">
              <Link href="/admin/bookings">
                <Button 
                  variant={pathname?.startsWith("/admin/bookings") ? "default" : "ghost"} 
                  size="sm"
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {t("nav.requests")}
                </Button>
              </Link>
              <Link href="/admin/calendar">
                <Button 
                  variant={pathname === "/admin/calendar" ? "default" : "ghost"} 
                  size="sm"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {t("nav.calendar")}
                </Button>
              </Link>
              <Link href="/admin/pricing">
                <Button 
                  variant={pathname === "/admin/pricing" ? "default" : "ghost"} 
                  size="sm"
                >
                  <Euro className="mr-2 h-4 w-4" />
                  {t("nav.pricing")}
                </Button>
              </Link>
              <Link href="/admin/chats">
                <Button 
                  variant={pathname === "/admin/chats" ? "default" : "ghost"} 
                  size="sm"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Chats
                </Button>
              </Link>
              <Link href="/admin/settings">
                <Button 
                  variant={pathname === "/admin/settings" ? "default" : "ghost"} 
                  size="sm"
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {t("nav.settings")}
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <User className="mr-2 h-4 w-4" />
                  {user.name || user.email}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.name || "Administrator"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">{t("admin.dashboard")}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {isLoggingOut ? `${t("nav.logout")}...` : t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}

