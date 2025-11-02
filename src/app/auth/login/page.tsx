"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Home, User, Lock, Loader2, Mail } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

function LoginPageContent() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { t } = useTranslation();

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.mustChangePassword) {
          toast({
            title: t("auth.passwordChangeRequired"),
            description: t("auth.pleaseChangePassword"),
          });
          router.push("/change-password");
          router.refresh();
        } else {
        toast({
          title: t("auth.loginSuccess"),
          description: t("auth.welcomeBack"),
        });
        router.push("/admin/bookings");
        router.refresh();
        }
      } else {
        toast({
          variant: "destructive",
          title: t("errors.general"),
          description: data.error || t("auth.invalidCredentials"),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("errors.general"),
        description: t("errors.general"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail.trim()) {
      toast({
        variant: "destructive",
        title: t("errors.general"),
        description: t("auth.pleaseEnterEmailOrUsername"),
      });
      return;
    }

    setIsSendingReset(true);

    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: t("auth.emailSent"),
          description: t("auth.resetEmailDescription"),
        });
        setShowForgotPassword(false);
        setForgotPasswordEmail("");
      } else {
        toast({
          variant: "destructive",
          title: t("errors.general"),
          description: data.error || t("auth.emailSendError"),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("errors.general"),
        description: t("errors.general"),
      });
    } finally {
      setIsSendingReset(false);
    }
  };



  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <LanguageSwitcher />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border">
            <Home className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">{t("auth.login")}</CardTitle>
          <CardDescription>
            {t("admin.dashboard")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {t("auth.username")} {t("common.or")} {t("auth.email")}
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder={t("auth.username") + " " + t("common.or") + " " + t("auth.email")}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      {t("auth.password")}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </span>
                    ) : (
                      t("auth.login")
                    )}
                  </Button>
                  <div className="flex justify-center pt-2">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      {t("auth.forgotPassword")}
                    </Button>
                  </div>
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="link"
                className="text-sm"
                onClick={() => router.push("/")}
              >
                {t("auth.backToHome")}
                  </Button>
                  </div>
                </form>
        </CardContent>
      </Card>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t("auth.resetPassword")}
            </DialogTitle>
            <DialogDescription>
              {t("auth.resetPasswordDescription")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="resetEmail">{t("auth.email")} {t("common.or")} {t("auth.username")}</Label>
              <Input
                id="resetEmail"
                type="text"
                placeholder={t("auth.email") + " " + t("common.or") + " " + t("auth.username")}
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                required
                disabled={isSendingReset}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotPasswordEmail("");
                }}
                disabled={isSendingReset}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSendingReset}>
                {isSendingReset ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("email.sending")}
                  </>
                ) : (
                  t("auth.sendEmail")
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border">
              <Home className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Laden...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}

