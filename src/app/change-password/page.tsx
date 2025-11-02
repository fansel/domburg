"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Prüfe ob Nutzer eingeloggt ist
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/check");
        const data = await res.json();
        
        if (!data.authenticated) {
          router.push("/auth/login");
          return;
        }
        
        setIsChecking(false);
      } catch (error) {
        router.push("/auth/login");
      }
    }
    
    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast({
        title: "Fehler",
        description: "Das Passwort muss mindestens 8 Zeichen lang sein",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Fehler",
        description: "Die Passwörter stimmen nicht überein",
        variant: "destructive",
      });
      return;
    }

    if (currentPassword === newPassword) {
      toast({
        title: "Fehler",
        description: "Das neue Passwort muss sich vom aktuellen Passwort unterscheiden",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Erfolg",
          description: "Passwort wurde erfolgreich geändert",
        });
        setTimeout(() => {
          router.push("/admin/bookings");
        }, 1500);
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: data.error || "Fehler beim Ändern des Passworts",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">Lade...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Passwort ändern</CardTitle>
          <CardDescription>
            Bitte ändern Sie Ihr Passwort
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-lg border-2 border-yellow-600 bg-yellow-50 dark:bg-yellow-950 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>Wichtig:</strong> Aus Sicherheitsgründen müssen Sie Ihr Passwort ändern, bevor Sie fortfahren können.
              </div>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Neues Passwort</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Mindestens 8 Zeichen"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Passwort wiederholen"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Ändere..." : "Passwort ändern"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

