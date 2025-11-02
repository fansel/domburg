import { Resend } from 'resend';
import { devMailStore } from './dev-mail';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface SendMagicLinkEmailParams {
  to: string;
  token: string;
  name?: string;
}

export async function sendMagicLinkEmail({ to, token, name }: SendMagicLinkEmailParams) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const magicLink = `${appUrl}/auth/verify?token=${token}`;
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Hollandhaus';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 30px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #2563eb;
            margin: 0;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 600;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
          .link {
            word-break: break-all;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${appName}</h1>
          </div>
          <div class="content">
            <h2>Hallo${name ? ` ${name}` : ''}</h2>
            <p>Sie haben einen Magic Link zum Einloggen angefordert.</p>
            <p>Klicken Sie auf den Button unten, um sich anzumelden:</p>
            <div style="text-align: center;">
              <a href="${magicLink}" class="button">Jetzt anmelden</a>
            </div>
            <p style="margin-top: 30px;">Oder kopieren Sie diesen Link in Ihren Browser:</p>
            <p class="link">${magicLink}</p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Dieser Link ist 15 Minuten gültig und kann nur einmal verwendet werden.
            </p>
            <p style="color: #666; font-size: 14px;">
              Wenn Sie diese E-Mail nicht angefordert haben, können Sie sie ignorieren.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${appName}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
Hallo${name ? ` ${name}` : ''}!

Sie haben einen Magic Link zum Einloggen angefordert.

Klicken Sie auf diesen Link, um sich anzumelden:
${magicLink}

Dieser Link ist 15 Minuten gültig und kann nur einmal verwendet werden.

Wenn Sie diese E-Mail nicht angefordert haben, können Sie sie ignorieren.

© ${new Date().getFullYear()} ${appName}
  `;

  // Wenn Resend konfiguriert ist, verwende es
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'noreply@hollandhaus.local',
        to,
        subject: `Ihr Magic Link für ${appName}`,
        html: htmlContent,
        text: textContent,
      });

      if (error) {
        console.error('Error sending email via Resend:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error sending email:', error);
      return { success: false, error };
    }
  }

  // Fallback: Speichere in Dev-Mail-Store (wenn kein Resend)
  devMailStore.add({
    to,
    subject: `Ihr Magic Link für ${appName}`,
    html: htmlContent,
    text: textContent,
  });

  return { success: true, devMode: true };
}

interface SendBookingNotificationParams {
  to: string;
  bookingId: string;
  startDate: Date;
  endDate: Date;
  guestName: string;
}

interface SendBookingConfirmationParams {
  to: string;
  bookingCode: string;
  guestName?: string;
  startDate: Date;
  endDate: Date;
  numberOfGuests: number;
  message?: string;
}

export async function sendBookingConfirmationToGuest({
  to,
  bookingCode,
  guestName,
  startDate,
  endDate,
  numberOfGuests,
  message,
}: SendBookingConfirmationParams) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const statusUrl = `${appUrl}/booking/status`;
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Hollandhaus';

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 30px;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
          }
          .booking-code {
            background-color: #f0f0f0;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
            border: 2px solid #2563eb;
          }
          .booking-code-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 8px;
          }
          .booking-code-value {
            font-size: 28px;
            font-weight: bold;
            font-family: monospace;
            color: #2563eb;
          }
          .button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 600;
          }
          .details {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .details-row {
            display: flex;
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          .details-row:last-child {
            border-bottom: none;
          }
          .details-label {
            font-weight: 600;
            width: 150px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h1 style="color: #2563eb; margin-top: 0;">Buchungsanfrage erhalten</h1>
            
            <p>Hallo${guestName ? ` ${guestName}` : ''},</p>
            
            <p>vielen Dank für Ihre Buchungsanfrage für das ${appName}!</p>
            
            <p><strong>Ihre Anfrage wurde erfolgreich übermittelt.</strong></p>

            <div class="booking-code">
              <div class="booking-code-label">Ihre Buchungsnummer:</div>
              <div class="booking-code-value">${bookingCode}</div>
              <p style="font-size: 12px; color: #666; margin-top: 10px;">
                Bitte notieren Sie sich diese Nummer für Ihre Unterlagen
              </p>
            </div>

            <div class="details">
              <h3 style="margin-top: 0;">Buchungsdetails:</h3>
              <div class="details-row">
                <div class="details-label">Zeitraum:</div>
                <div>${formatDate(startDate)} - ${formatDate(endDate)}</div>
              </div>
              <div class="details-row">
                <div class="details-label">Gäste:</div>
                <div>${numberOfGuests} ${numberOfGuests === 1 ? 'Person' : 'Personen'}</div>
              </div>
              ${message ? `
              <div class="details-row">
                <div class="details-label">Nachricht:</div>
                <div>${message}</div>
              </div>
              ` : ''}
            </div>

            <h3>Nächste Schritte:</h3>
            <ol style="line-height: 2;">
              <li>Wir prüfen Ihre Anfrage</li>
              <li>Sie erhalten eine E-Mail mit der Bestätigung oder Ablehnung</li>
              <li>Bei Fragen können Sie jederzeit den Status prüfen</li>
            </ol>

            <div style="text-align: center;">
              <a href="${statusUrl}" class="button">Buchungsstatus prüfen</a>
            </div>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Um den Status Ihrer Buchung zu prüfen, benötigen Sie Ihre Buchungsnummer und E-Mail-Adresse.
            </p>
          </div>
          
          <div class="footer">
            <p>${appName}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `Buchungsanfrage erhalten

Hallo${guestName ? ` ${guestName}` : ''},

vielen Dank für Ihre Buchungsanfrage für das ${appName}!

Ihre Buchungsnummer: ${bookingCode}
Bitte notieren Sie sich diese Nummer für Ihre Unterlagen.

Buchungsdetails:
- Zeitraum: ${formatDate(startDate)} - ${formatDate(endDate)}
- Gäste: ${numberOfGuests} ${numberOfGuests === 1 ? 'Person' : 'Personen'}
${message ? `- Nachricht: ${message}` : ''}

Nächste Schritte:
1. Wir prüfen Ihre Anfrage
2. Sie erhalten eine E-Mail mit der Bestätigung oder Ablehnung
3. Bei Fragen können Sie jederzeit den Status prüfen

Buchungsstatus prüfen: ${statusUrl}

${appName}
`;

  if (resend) {
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'noreply@hollandhaus.local',
        to,
        subject: `Ihre Buchungsanfrage ${bookingCode} - ${appName}`,
        html: htmlContent,
        text: textContent,
      });
    } catch (error) {
      console.error('Error sending booking confirmation:', error);
    }
  } else {
    // Kein Resend konfiguriert -> Dev-Mail-Store
    devMailStore.add({
      to,
      subject: `Ihre Buchungsanfrage ${bookingCode} - ${appName}`,
      html: htmlContent,
      text: textContent,
    });
  }
}

export async function sendBookingApprovalToGuest({
  to,
  bookingCode,
  guestName,
  startDate,
  endDate,
  numberOfGuests,
}: {
  to: string;
  bookingCode: string;
  guestName?: string;
  startDate: Date;
  endDate: Date;
  numberOfGuests: number;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const statusUrl = `${appUrl}/booking/status`;
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Hollandhaus';

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 30px;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
          }
          .success-badge {
            background-color: #10b981;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            display: inline-block;
            font-weight: 600;
            margin: 20px 0;
          }
          .details {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .details-row {
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          .details-row:last-child {
            border-bottom: none;
          }
          .details-label {
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h1 style="color: #10b981; margin-top: 0;">Buchung bestätigt</h1>
            
            <p>Hallo${guestName ? ` ${guestName}` : ''},</p>
            
            <div class="success-badge">Ihre Buchung wurde genehmigt</div>
            
            <p>Wir freuen uns, Ihnen mitteilen zu können, dass Ihre Buchungsanfrage für das ${appName} <strong>genehmigt wurde</strong>!</p>

            <div class="details">
              <h3>Buchungsdetails:</h3>
              <div class="details-row">
                <div class="details-label">Buchungsnummer</div>
                <div>${bookingCode}</div>
              </div>
              <div class="details-row">
                <div class="details-label">Zeitraum</div>
                <div>${formatDate(startDate)} - ${formatDate(endDate)}</div>
              </div>
              <div class="details-row">
                <div class="details-label">Gäste</div>
                <div>${numberOfGuests} ${numberOfGuests === 1 ? 'Person' : 'Personen'}</div>
              </div>
            </div>

            <h3>Nächste Schritte:</h3>
            <ol style="line-height: 2;">
              <li>Notieren Sie sich Ihre Buchungsnummer für Ihre Unterlagen</li>
              <li>Weitere Informationen zu Anreise und Ausstattung folgen separat</li>
              <li>Bei Fragen stehen wir Ihnen gerne zur Verfügung</li>
            </ol>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Wir freuen uns auf Ihren Besuch!
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `Buchung bestätigt

Hallo${guestName ? ` ${guestName}` : ''},

Wir freuen uns, Ihnen mitteilen zu können, dass Ihre Buchungsanfrage für das ${appName} genehmigt wurde!

Buchungsdetails:
- Buchungsnummer: ${bookingCode}
- Zeitraum: ${formatDate(startDate)} - ${formatDate(endDate)}
- Gäste: ${numberOfGuests} ${numberOfGuests === 1 ? 'Person' : 'Personen'}

Nächste Schritte:
1. Notieren Sie sich Ihre Buchungsnummer für Ihre Unterlagen
2. Weitere Informationen zu Anreise und Ausstattung folgen separat
3. Bei Fragen stehen wir Ihnen gerne zur Verfügung

Wir freuen uns auf Ihren Besuch!

${appName}
`;

  if (resend) {
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'noreply@hollandhaus.local',
        to,
        subject: `Buchung bestätigt ${bookingCode} - ${appName}`,
        html: htmlContent,
        text: textContent,
      });
    } catch (error) {
      console.error('Error sending booking approval:', error);
    }
  } else {
    devMailStore.add({
      to,
      subject: `Buchung bestätigt ${bookingCode} - ${appName}`,
      html: htmlContent,
      text: textContent,
    });
  }
}

export async function sendBookingRejectionToGuest({
  to,
  bookingCode,
  guestName,
  startDate,
  endDate,
  reason,
}: {
  to: string;
  bookingCode: string;
  guestName?: string;
  startDate: Date;
  endDate: Date;
  reason: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Hollandhaus';

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 30px;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
          }
          .details {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h1 style="color: #333; margin-top: 0;">Buchungsanfrage</h1>
            
            <p>Hallo${guestName ? ` ${guestName}` : ''},</p>
            
            <p>Vielen Dank für Ihre Buchungsanfrage für das ${appName}.</p>
            
            <p>Leider müssen wir Ihnen mitteilen, dass wir Ihre Anfrage für den gewünschten Zeitraum nicht bestätigen können.</p>

            <div class="details">
              <h3>Details:</h3>
              <p><strong>Buchungsnummer:</strong> ${bookingCode}</p>
              <p><strong>Zeitraum:</strong> ${formatDate(startDate)} - ${formatDate(endDate)}</p>
              <p><strong>Grund:</strong> ${reason}</p>
            </div>

            <p>Gerne können Sie eine neue Anfrage für einen anderen Zeitraum stellen.</p>
            
            <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Mit freundlichen Grüßen<br>
              ${appName}
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `Buchungsanfrage

Hallo${guestName ? ` ${guestName}` : ''},

Vielen Dank für Ihre Buchungsanfrage für das ${appName}.

Leider müssen wir Ihnen mitteilen, dass wir Ihre Anfrage für den gewünschten Zeitraum nicht bestätigen können.

Details:
- Buchungsnummer: ${bookingCode}
- Zeitraum: ${formatDate(startDate)} - ${formatDate(endDate)}
- Grund: ${reason}

Gerne können Sie eine neue Anfrage für einen anderen Zeitraum stellen.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
${appName}
`;

  if (resend) {
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'noreply@hollandhaus.local',
        to,
        subject: `Buchungsanfrage ${bookingCode} - ${appName}`,
        html: htmlContent,
        text: textContent,
      });
    } catch (error) {
      console.error('Error sending booking rejection:', error);
    }
  } else {
    devMailStore.add({
      to,
      subject: `Buchungsanfrage ${bookingCode} - ${appName}`,
      html: htmlContent,
      text: textContent,
    });
  }
}

export async function sendMessageNotificationToGuest({
  to,
  bookingCode,
  guestName,
  message,
  senderName,
}: {
  to: string;
  bookingCode: string;
  guestName?: string;
  message: string;
  senderName: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const statusUrl = `${appUrl}/booking/status`;
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Hollandhaus';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 30px;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
          }
          .message-box {
            background-color: #f0f0f0;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #2563eb;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h1 style="color: #2563eb; margin-top: 0;">Neue Nachricht zu Ihrer Buchung</h1>
            
            <p>Hallo${guestName ? ` ${guestName}` : ''},</p>
            
            <p>Sie haben eine neue Nachricht zu Ihrer Buchung <strong>${bookingCode}</strong> erhalten:</p>

            <div class="message-box">
              <p style="margin: 0;"><strong>Von:</strong> ${senderName}</p>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;">
              <p style="margin: 0; white-space: pre-wrap;">${message}</p>
            </div>

            <div style="text-align: center;">
              <a href="${statusUrl}" class="button">Buchungsstatus anzeigen</a>
            </div>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Um zu antworten oder weitere Details zu sehen, besuchen Sie die Buchungsstatus-Seite mit Ihrer Buchungsnummer und E-Mail-Adresse.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `Neue Nachricht zu Ihrer Buchung

Hallo${guestName ? ` ${guestName}` : ''},

Sie haben eine neue Nachricht zu Ihrer Buchung ${bookingCode} erhalten:

Von: ${senderName}
---
${message}
---

Buchungsstatus anzeigen: ${statusUrl}

Um zu antworten oder weitere Details zu sehen, besuchen Sie die Buchungsstatus-Seite mit Ihrer Buchungsnummer und E-Mail-Adresse.

${appName}
`;

  // Reply-To Email mit Buchungscode für direkte Antworten
  const replyToEmail = process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM || 'noreply@domburg.local';

  if (resend) {
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'noreply@hollandhaus.local',
        to,
        replyTo: replyToEmail,
        subject: `Neue Nachricht zu Buchung ${bookingCode} - ${appName}`,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Booking-Code': bookingCode,
        },
      });
    } catch (error) {
      console.error('Error sending message notification:', error);
    }
  } else {
    devMailStore.add({
      to,
      subject: `Neue Nachricht zu Buchung ${bookingCode} - ${appName}`,
      html: htmlContent,
      text: textContent,
    });
  }
  
  console.log(`💬 Nachricht gesendet an ${to} für Buchung ${bookingCode}`);
  console.log(`📧 Gast kann direkt auf ${replyToEmail} antworten`);
}

export async function sendBookingNotificationToAdmin({
  to,
  bookingId,
  startDate,
  endDate,
  guestName,
}: SendBookingNotificationParams) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const bookingUrl = `${appUrl}/admin/bookings/${bookingId}`;
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Hollandhaus';

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Neue Buchungsanfrage</h2>
        <p><strong>Gast:</strong> ${guestName}</p>
        <p><strong>Zeitraum:</strong> ${formatDate(startDate)} - ${formatDate(endDate)}</p>
        <p><a href="${bookingUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">Buchung ansehen</a></p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">${appName}</p>
      </body>
    </html>
  `;

  const textContent = `Neue Buchungsanfrage

Gast: ${guestName}
Zeitraum: ${formatDate(startDate)} - ${formatDate(endDate)}

Link: ${bookingUrl}`;

  if (resend) {
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'noreply@hollandhaus.local',
        to,
        subject: `Neue Buchungsanfrage von ${guestName}`,
        html: htmlContent,
        text: textContent,
      });
    } catch (error) {
      console.error('Error sending booking notification:', error);
    }
  } else {
    // Kein Resend konfiguriert -> Dev-Mail-Store
    devMailStore.add({
      to,
      subject: `Neue Buchungsanfrage von ${guestName}`,
      html: htmlContent,
      text: textContent,
    });
  }
}

