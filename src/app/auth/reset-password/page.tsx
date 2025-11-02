"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, CheckCircle2, XCircle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

function ResetPasswordPageContent() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"loading" | "success" | "error" | "form">("loading");
  const [message, setMessage] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage(t("auth.noTokenFound"));
    } else {
      setStatus("form");
    }
  }, [searchParams, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast({
        title: t("errors.general"),
        description: t("validation.minLength", { count: 8 }),
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: t("errors.general"),
        description: t("auth.passwordsDoNotMatch"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const token = searchParams.get("token");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(t("auth.passwordResetSuccess"));
        toast({
          title: t("auth.success"),
          description: t("auth.passwordReset"),
        });
        // Sofort zur Login-Seite weiterleiten
          router.push("/auth/login");
      } else {
        setStatus("error");
        setMessage(data.error || t("auth.passwordResetError"));
        toast({
          variant: "destructive",
          title: t("errors.general"),
          description: data.error || t("auth.passwordResetError"),
        });
      }
    } catch (error) {
      setStatus("error");
      setMessage(t("errors.general"));
      toast({
        variant: "destructive",
        title: t("errors.general"),
        description: t("errors.general"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <LanguageSwitcher />
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="pb-4">
          <div className="flex flex-col items-center text-center">
          {status === "loading" && (
            <>
              <div className="flex items-center justify-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              </div>
            </>
          )}
          {status === "success" && (
            <>
              <div className="flex items-center justify-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary">
                  <Check className="h-8 w-8" />
                </div>
              </div>
              <CardTitle className="text-center">{t("auth.success")}</CardTitle>
              <CardDescription className="text-center">{message}</CardDescription>
            </>
          )}
          {status === "error" && (
            <>
              <div className="flex items-center justify-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive">
                  <XCircle className="h-8 w-8" />
                </div>
              </div>
              <CardTitle className="text-center">{t("errors.general")}</CardTitle>
              <CardDescription className="text-center">{message}</CardDescription>
            </>
          )}
          {status === "form" && (
            <>
              <div className="flex items-center justify-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary">
                  <Lock className="h-8 w-8" />
                </div>
              </div>
              <CardTitle className="text-2xl text-center">{t("auth.resetPassword")}</CardTitle>
              <CardDescription className="text-center">
                {t("auth.enterNewPassword")}
              </CardDescription>
            </>
          )}
          </div>
        </CardHeader>
        {status === "form" && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.newPassword")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t("validation.minLength", { count: 8 })}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t("auth.repeatPassword")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("auth.resetting")}
                  </>
                ) : (
                  <>{t("auth.resetPassword")}</>
                )}
              </Button>
            </form>
          </CardContent>
        )}
        {status === "error" && (
          <CardContent>
            <Button
              className="w-full"
              onClick={() => router.push("/auth/login")}
            >
              {t("auth.backToLogin")}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            </div>
            <CardTitle>Lade...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <ResetPasswordPageContent />
    </Suspense>
  );
}

