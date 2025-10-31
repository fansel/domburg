import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { host, port, user: smtpUser, password, fromEmail, fromName, testEmail } = await request.json();

    if (!host || !port || !smtpUser || !password) {
      return NextResponse.json(
        { success: false, error: "Bitte fülle alle SMTP-Felder aus" },
        { status: 400 }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransporter({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465, // true für Port 465, false für andere Ports
      auth: {
        user: smtpUser,
        pass: password,
      },
    });

    // Verify connection
    await transporter.verify();

    // Send test email
    await transporter.sendMail({
      from: `"${fromName || 'Familie Waubke'}" <${fromEmail || smtpUser}>`,
      to: testEmail,
      subject: "Test-E-Mail von deinem Ferienhaus-Buchungssystem",
      html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .success-box { 
        background: #d4edda; 
        border: 2px solid #28a745;
        padding: 20px; 
        border-radius: 5px; 
        text-align: center;
        margin: 20px 0;
      }
      .info-box { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>SMTP-Test erfolgreich! ✅</h1>
      
      <div class="success-box">
        <h2 style="color: #28a745; margin: 0;">Die E-Mail-Konfiguration funktioniert!</h2>
      </div>
      
      <p>Wenn du diese E-Mail erhältst, sind deine SMTP-Einstellungen korrekt konfiguriert.</p>
      
      <div class="info-box">
        <p><strong>Verbindungsdetails:</strong></p>
        <p>Server: ${host}:${port}</p>
        <p>Benutzer: ${smtpUser}</p>
        <p>Absender: ${fromName || 'Familie Waubke'} &lt;${fromEmail || smtpUser}&gt;</p>
      </div>
      
      <p>Du kannst die Einstellungen jetzt speichern und alle E-Mails werden über deinen SMTP-Server versendet.</p>
      
      <div class="footer">
        <p>Liebe Grüße<br>Dein Ferienhaus-Buchungssystem</p>
      </div>
    </div>
  </body>
</html>`,
      text: `SMTP-Test erfolgreich! ✅

Die E-Mail-Konfiguration funktioniert!

Wenn du diese E-Mail erhältst, sind deine SMTP-Einstellungen korrekt konfiguriert.

Verbindungsdetails:
Server: ${host}:${port}
Benutzer: ${smtpUser}
Absender: ${fromName || 'Familie Waubke'} <${fromEmail || smtpUser}>

Du kannst die Einstellungen jetzt speichern und alle E-Mails werden über deinen SMTP-Server versendet.

Liebe Grüße
Dein Ferienhaus-Buchungssystem`,
    });

    return NextResponse.json({
      success: true,
      message: "Test-E-Mail erfolgreich gesendet",
    });
  } catch (error: any) {
    console.error("SMTP test error:", error);
    
    let errorMessage = "Verbindung fehlgeschlagen";
    if (error.code === "EAUTH") {
      errorMessage = "Authentifizierung fehlgeschlagen. Prüfe Benutzername und Passwort.";
    } else if (error.code === "ECONNECTION" || error.code === "ETIMEDOUT") {
      errorMessage = "Verbindung zum Server fehlgeschlagen. Prüfe Host und Port.";
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

