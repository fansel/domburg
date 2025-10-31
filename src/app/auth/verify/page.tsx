"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { verifyMagicLink } from "./actions";

export default function VerifyPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Kein Token gefunden.");
      return;
    }

    handleVerify(token);
  }, [searchParams]);

  const handleVerify = async (token: string) => {
    try {
      // Server Action aufrufen (diese leitet automatisch weiter bei Erfolg)
      await verifyMagicLink(token);
      // Wenn wir hier ankommen, war es erfolgreich und die Weiterleitung passiert
      setStatus("success");
      setMessage("Erfolgreich angemeldet!");
    } catch (error: any) {
      // Fehler von Server Action
      setStatus("error");
      setMessage(error?.message || "Der Magic Link ist ungültig oder abgelaufen.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <CardTitle>Verifizierung läuft...</CardTitle>
              <CardDescription>Bitte warten Sie einen Moment.</CardDescription>
            </>
          )}
          {status === "success" && (
            <>
              <div className="mx-auto mb-4">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle className="text-green-700">Erfolgreich!</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
          {status === "error" && (
            <>
              <div className="mx-auto mb-4">
                <XCircle className="h-12 w-12 text-red-500" />
              </div>
              <CardTitle className="text-red-700">Fehler</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
        </CardHeader>
        {status === "error" && (
          <CardContent>
            <Button
              className="w-full"
              onClick={() => window.location.href = "/auth/login"}
            >
              Zurück zum Login
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
