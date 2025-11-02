// Standard Email Templates mit Du-Form

export const emailTemplates = [
  {
    key: "new_user",
    name: "Neuer Benutzer Willkommens-E-Mail",
    subject: "Dein Zugang zum Hollandhaus Buchungssystem",
    description: "Willkommens-E-Mail für neue Admin-Benutzer mit Zugangsdaten",
    variables: ["userName", "username", "password", "loginUrl", "mustChangePassword"],
    bodyHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .button { 
        display: inline-block; 
        padding: 12px 24px; 
        background: #000; 
        color: #fff; 
        text-decoration: none; 
        border-radius: 5px;
        margin: 20px 0;
      }
      .credentials { 
        background: #f5f5f5; 
        padding: 15px; 
        border-radius: 5px; 
        margin: 20px 0;
        font-family: monospace;
      }
      .warning {
        background: #fff3cd;
        border-left: 4px solid #ffc107;
        padding: 15px;
        margin: 20px 0;
      }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Hallo {{userName}}!</h1>
      <p>Ein Zugang zum Hollandhaus Buchungssystem wurde für dich erstellt.</p>
      <p>Deine Zugangsdaten:</p>
      <div class="credentials">
        <p><strong>Username:</strong> {{username}}</p>
        <p><strong>Passwort:</strong> {{password}}</p>
      </div>
      {{#if mustChangePassword}}
      <div class="warning">
        <p><strong>Wichtig:</strong> Aus Sicherheitsgründen musst du dein Passwort beim ersten Login ändern.</p>
      </div>
      {{/if}}
      <p>Du kannst dich jetzt anmelden:</p>
      <a href="{{loginUrl}}" class="button">Jetzt anmelden</a>
      <p>Falls du Fragen hast, kannst du dich gerne bei uns melden.</p>
      <div class="footer">
        <p>Viele Grüße<br>Familie Waubke</p>
      </div>
    </div>
  </body>
</html>`,
    bodyText: `Hallo {{userName}}!

Ein Zugang zum Hollandhaus Buchungssystem wurde für dich erstellt.

Deine Zugangsdaten:
Username: {{username}}
Passwort: {{password}}

{{#if mustChangePassword}}
WICHTIG: Aus Sicherheitsgründen musst du dein Passwort beim ersten Login ändern.
{{/if}}

Du kannst dich jetzt anmelden unter:
{{loginUrl}}

Falls du Fragen hast, kannst du dich gerne bei uns melden.

Viele Grüße
Familie Waubke`,
  },
  {
    key: "password_reset",
    name: "Passwort-Zurücksetzen",
    subject: "Passwort zurücksetzen für Hollandhaus",
    description: "E-Mail zum Zurücksetzen des Admin-Passworts",
    variables: ["adminName", "resetUrl", "expiryMinutes"],
    bodyHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .button { 
        display: inline-block; 
        padding: 12px 24px; 
        background: #000; 
        color: #fff; 
        text-decoration: none; 
        border-radius: 5px;
        margin: 20px 0;
      }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Hallo {{adminName}}!</h1>
      <p>Du hast eine E-Mail zum Zurücksetzen deines Passworts für das Hollandhaus Buchungssystem angefordert.</p>
      <p>Klicke auf den Button unten, um ein neues Passwort festzulegen:</p>
      <a href="{{resetUrl}}" class="button">Passwort zurücksetzen</a>
      <p>Dieser Link ist {{expiryMinutes}} Minuten gültig.</p>
      <p>Falls du diese E-Mail nicht angefordert hast, kannst du sie einfach ignorieren.</p>
      <div class="footer">
        <p>Viele Grüße<br>Familie Waubke</p>
      </div>
    </div>
  </body>
</html>`,
    bodyText: `Hallo {{adminName}}!

Du hast eine E-Mail zum Zurücksetzen deines Passworts für das Ferienhaus-Buchungssystem angefordert.

Klicke auf den Link, um ein neues Passwort festzulegen:
{{resetUrl}}

Dieser Link ist {{expiryMinutes}} Minuten gültig.

Falls du diese E-Mail nicht angefordert hast, kannst du sie einfach ignorieren.

Viele Grüße
Familie Waubke`,
  },
  {
    key: "booking_confirmation",
    name: "Anfrage-Bestätigung (an Gast)",
    subject: "Deine Anfrage für unser Ferienhaus wurde empfangen",
    description: "Bestätigung für Gäste nach Anfrage-Einreichung",
    variables: ["guestName", "bookingCode", "startDate", "endDate", "numberOfGuests", "totalPrice", "statusUrl", "guestCode"],
    bodyHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .info-box { 
        background: #f5f5f5; 
        padding: 15px; 
        border-radius: 5px; 
        margin: 20px 0; 
      }
      .code { 
        font-size: 24px; 
        font-weight: bold; 
        color: #000; 
        background: #fff;
        padding: 10px;
        border-radius: 5px;
        display: inline-block;
        margin: 10px 0;
      }
      .button { 
        display: inline-block; 
        padding: 12px 24px; 
        background: #000; 
        color: #fff; 
        text-decoration: none; 
        border-radius: 5px;
        margin: 20px 0;
      }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Hallo {{guestName}}!</h1>
      <p>Vielen Dank für deine Anfrage für unser Ferienhaus. Wir freuen uns sehr!</p>
      
      <div class="info-box">
        <h3>Deine Anfrage-Details:</h3>
        <p><strong>Anfrage-Code:</strong></p>
        <div class="code">{{bookingCode}}</div>
        {{#if guestCode}}
        <p><strong>Verwendeter Zugangscode:</strong> {{guestCode}}</p>
        {{/if}}
        <p><strong>Zeitraum:</strong> {{startDate}} bis {{endDate}}</p>
        <p><strong>Gäste:</strong> {{numberOfGuests}}</p>
        <p><strong>Gesamtpreis:</strong> €{{totalPrice}}</p>
      </div>
      
      <p>Wir schauen uns deine Anfrage gleich an und melden uns schnellstmöglich zurück.</p>
      
      <p><strong>Wichtig:</strong> Bewahre deinen Anfrage-Code auf! Damit kannst du den Status jederzeit prüfen.</p>
      
      <a href="{{statusUrl}}" class="button">Anfrage-Status prüfen</a>
      
      <div class="footer">
        <p>Liebe Grüße<br>Familie Waubke</p>
      </div>
    </div>
  </body>
</html>`,
    bodyText: `Hallo {{guestName}}!

Vielen Dank für deine Anfrage für unser Ferienhaus. Wir freuen uns sehr!

DEINE ANFRAGE-DETAILS:
----------------------
Anfrage-Code: {{bookingCode}}
{{#if guestCode}}
Verwendeter Zugangscode: {{guestCode}}
{{/if}}
Zeitraum: {{startDate}} bis {{endDate}}
Gäste: {{numberOfGuests}}
Gesamtpreis: €{{totalPrice}}

Wir schauen uns deine Anfrage gleich an und melden uns schnellstmöglich zurück.

WICHTIG: Bewahre deinen Anfrage-Code auf! Damit kannst du den Status jederzeit prüfen.

Status prüfen: {{statusUrl}}

Liebe Grüße
Familie Waubke`,
  },
  {
    key: "booking_approved",
    name: "Anfrage genehmigt",
    subject: "Zusage für deine Anfrage",
    description: "Bestätigung wenn Admin die Anfrage genehmigt",
    variables: ["guestName", "bookingCode", "startDate", "endDate", "numberOfGuests", "totalPrice", "adminNotes", "guestCode"],
    bodyHtml: `
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
        margin: 20px 0; 
        text-align: center;
      }
      .info-box { 
        background: #f5f5f5; 
        padding: 15px; 
        border-radius: 5px; 
        margin: 20px 0; 
      }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Hallo {{guestName}}!</h1>
      
      <div class="success-box">
        <h2 style="color: #28a745; margin: 0;">Deine Anfrage wurde bestätigt!</h2>
      </div>
      
      <p>Wie schön! Wir freuen uns riesig auf deinen Besuch in unserem Ferienhaus.</p>
      
      <div class="info-box">
        <h3>Deine Buchungsdetails:</h3>
        <p><strong>Anfrage-Code:</strong> {{bookingCode}}</p>
        {{#if guestCode}}
        <p><strong>Verwendeter Zugangscode:</strong> {{guestCode}}</p>
        {{/if}}
        <p><strong>Zeitraum:</strong> {{startDate}} bis {{endDate}}</p>
        <p><strong>Gäste:</strong> {{numberOfGuests}}</p>
        <p><strong>Gesamtpreis:</strong> €{{totalPrice}}</p>
        {{#if adminNotes}}
        <p><strong>Nachricht von uns:</strong><br>{{adminNotes}}</p>
        {{/if}}
      </div>
      
      <p>Falls du noch Fragen hast, schreib uns einfach zurück - wir helfen gerne!</p>
      
      <div class="footer">
        <p>Wir freuen uns auf euch!<br>Liebe Grüße, Familie Waubke</p>
      </div>
    </div>
  </body>
</html>`,
    bodyText: `Hallo {{guestName}}!

DEINE ANFRAGE WURDE BESTÄTIGT!

Wie schön! Wir freuen uns riesig auf deinen Besuch in unserem Ferienhaus.

DEINE BUCHUNGSDETAILS:
----------------------
Anfrage-Code: {{bookingCode}}
{{#if guestCode}}
Verwendeter Zugangscode: {{guestCode}}
{{/if}}
Zeitraum: {{startDate}} bis {{endDate}}
Gäste: {{numberOfGuests}}
Gesamtpreis: €{{totalPrice}}

{{#if adminNotes}}
NACHRICHT VON UNS:
{{adminNotes}}
{{/if}}

Falls du noch Fragen hast, schreib uns einfach zurück - wir helfen gerne!

Wir freuen uns auf euch!
Liebe Grüße, Familie Waubke`,
  },
  {
    key: "booking_rejected",
    name: "Anfrage abgelehnt",
    subject: "Absage für deine Anfrage",
    description: "Benachrichtigung wenn Anfrage abgelehnt wird",
    variables: ["guestName", "bookingCode", "startDate", "endDate", "rejectionReason", "guestCode"],
    bodyHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .info-box { 
        background: #f5f5f5; 
        padding: 15px; 
        border-radius: 5px; 
        margin: 20px 0; 
      }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Hallo {{guestName}}!</h1>
      
      <p>Vielen Dank für deine Anfrage für unser Ferienhaus ({{startDate}} bis {{endDate}}).</p>
      
      <p>Schade, aber dieser Zeitraum ist leider schon vergeben.</p>
      
      {{#if rejectionReason}}
      <div class="info-box">
        <p><strong>Hinweis:</strong><br>{{rejectionReason}}</p>
      </div>
      {{/if}}
      
      <p>Hast du vielleicht einen anderen Zeitraum im Kopf? Schreib uns einfach zurück oder sende eine neue Anfrage - wir finden bestimmt was!</p>
      
      <div class="footer">
        <p>Liebe Grüße<br>Familie Waubke</p>
      </div>
    </div>
  </body>
</html>`,
    bodyText: `Hallo {{guestName}}!

Vielen Dank für deine Anfrage für unser Ferienhaus ({{startDate}} bis {{endDate}}).

Schade, aber dieser Zeitraum ist leider schon vergeben.

{{#if rejectionReason}}
HINWEIS:
{{rejectionReason}}
{{/if}}

Hast du vielleicht einen anderen Zeitraum im Kopf? Schreib uns einfach zurück oder sende eine neue Anfrage - wir finden bestimmt was!

Liebe Grüße
Familie Waubke`,
  },
  {
    key: "new_message",
    name: "Neue Nachricht",
    subject: "Neue Nachricht zu deiner Anfrage #{{bookingCode}}",
    description: "Benachrichtigung bei neuer Nachricht",
    variables: ["guestName", "bookingCode", "messageContent", "senderName", "replyUrl"],
    bodyHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .message-box { 
        background: #f5f5f5; 
        padding: 15px; 
        border-left: 4px solid #000;
        margin: 20px 0; 
      }
      .button { 
        display: inline-block; 
        padding: 12px 24px; 
        background: #000; 
        color: #fff; 
        text-decoration: none; 
        border-radius: 5px;
        margin: 20px 0;
      }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Hallo {{guestName}}!</h1>
      
      <p>Du hast eine neue Nachricht zu deiner Anfrage <strong>#{{bookingCode}}</strong> erhalten:</p>
      
      <div class="message-box">
        <p><strong>Von:</strong> {{senderName}}</p>
        <p>{{messageContent}}</p>
      </div>
      
      <p><strong>Tipp:</strong> Du kannst direkt auf diese E-Mail antworten!</p>
      
      <a href="{{replyUrl}}" class="button">Anfrage anzeigen</a>
      
      <div class="footer">
        <p>Liebe Grüße<br>Familie Waubke</p>
      </div>
    </div>
  </body>
</html>`,
    bodyText: `Hallo {{guestName}}!

Du hast eine neue Nachricht zu deiner Anfrage #{{bookingCode}} erhalten:

VON: {{senderName}}
-------------------
{{messageContent}}

TIPP: Du kannst direkt auf diese E-Mail antworten!

Anfrage anzeigen: {{replyUrl}}

Liebe Grüße
Familie Waubke`,
  },
  {
    key: "booking_cancelled",
    name: "Buchung storniert",
    subject: "Stornierung deiner Buchung #{{bookingCode}}",
    description: "Benachrichtigung wenn Buchung storniert wird",
    variables: ["guestName", "bookingCode", "startDate", "endDate", "cancellationReason", "guestCode"],
    bodyHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .info-box { 
        background: #fff3cd; 
        border-left: 4px solid #ffc107;
        padding: 15px; 
        border-radius: 5px; 
        margin: 20px 0; 
      }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Hallo {{guestName}}!</h1>
      
      <p>Leider müssen wir dir mitteilen, dass deine Buchung für {{startDate}} bis {{endDate}} storniert wurde.</p>
      
      <div class="info-box">
        <h3>Buchungsdetails:</h3>
        <p><strong>Buchungscode:</strong> {{bookingCode}}</p>
        {{#if guestCode}}
        <p><strong>Verwendeter Zugangscode:</strong> {{guestCode}}</p>
        {{/if}}
        <p><strong>Zeitraum:</strong> {{startDate}} bis {{endDate}}</p>
        
        {{#if cancellationReason}}
        <p><strong>Grund:</strong><br>{{cancellationReason}}</p>
        {{/if}}
      </div>
      
      <p>Falls du Fragen hast oder eine neue Buchung vornehmen möchtest, kannst du uns gerne kontaktieren.</p>
      
      <div class="footer">
        <p>Liebe Grüße<br>Familie Waubke</p>
      </div>
    </div>
  </body>
</html>`,
    bodyText: `Hallo {{guestName}}!

Leider müssen wir dir mitteilen, dass deine Buchung für {{startDate}} bis {{endDate}} storniert wurde.

BUCHUNGSDETAILS:
----------------
Buchungscode: {{bookingCode}}
{{#if guestCode}}
Verwendeter Zugangscode: {{guestCode}}
{{/if}}
Zeitraum: {{startDate}} bis {{endDate}}

{{#if cancellationReason}}
GRUND:
{{cancellationReason}}
{{/if}}

Falls du Fragen hast oder eine neue Buchung vornehmen möchtest, kannst du uns gerne kontaktieren.

Liebe Grüße
Familie Waubke`,
  },
  {
    key: "admin_new_booking",
    name: "Neue Anfrage (an Admin)",
    subject: "Neue Anfrage für unser Ferienhaus",
    description: "Benachrichtigung an Admins bei neuer Anfrage",
    variables: ["guestName", "guestEmail", "bookingCode", "startDate", "endDate", "numberOfGuests", "totalPrice", "message", "adminUrl", "guestCode"],
    bodyHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .info-box { 
        background: #fff3cd; 
        border: 2px solid #ffc107;
        padding: 15px; 
        border-radius: 5px; 
        margin: 20px 0; 
      }
      .button { 
        display: inline-block; 
        padding: 12px 24px; 
        background: #000; 
        color: #fff; 
        text-decoration: none; 
        border-radius: 5px;
        margin: 20px 0;
      }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Neue Anfrage eingegangen!</h1>
      
      <div class="info-box">
        <h3>Gast-Informationen:</h3>
        <p><strong>Name:</strong> {{guestName}}</p>
        <p><strong>E-Mail:</strong> {{guestEmail}}</p>
        <p><strong>Code:</strong> {{bookingCode}}</p>
        {{#if guestCode}}
        <p><strong>Verwendeter Zugangscode:</strong> {{guestCode}}</p>
        {{/if}}
        
        <h3>Anfrage-Details:</h3>
        <p><strong>Zeitraum:</strong> {{startDate}} bis {{endDate}}</p>
        <p><strong>Gäste:</strong> {{numberOfGuests}}</p>
        <p><strong>Gesamtpreis:</strong> €{{totalPrice}}</p>
        
        {{#if message}}
        <p><strong>Nachricht:</strong><br>{{message}}</p>
        {{/if}}
      </div>
      
      <a href="{{adminUrl}}" class="button">Anfrage prüfen</a>
    </div>
  </body>
</html>`,
    bodyText: `NEUE ANFRAGE EINGEGANGEN!

GAST-INFORMATIONEN:
-------------------
Name: {{guestName}}
E-Mail: {{guestEmail}}
Code: {{bookingCode}}
{{#if guestCode}}
Verwendeter Zugangscode: {{guestCode}}
{{/if}}

ANFRAGE-DETAILS:
----------------
Zeitraum: {{startDate}} bis {{endDate}}
Gäste: {{numberOfGuests}}
Gesamtpreis: €{{totalPrice}}

{{#if message}}
NACHRICHT:
{{message}}
{{/if}}

Anfrage prüfen: {{adminUrl}}`,
  },
  {
    key: "admin_booking_approved",
    name: "Buchung genehmigt (an Admin)",
    subject: "Buchung #{{bookingCode}} wurde genehmigt",
    description: "Benachrichtigung an Admins wenn eine Buchung von einem anderen Admin genehmigt wurde",
    variables: ["bookingCode", "guestName", "guestEmail", "startDate", "endDate", "approvedByName", "adminUrl"],
    bodyHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .info-box { 
        background: #d4edda; 
        border: 2px solid #28a745;
        padding: 15px; 
        border-radius: 5px; 
        margin: 20px 0; 
      }
      .button { 
        display: inline-block; 
        padding: 12px 24px; 
        background: #000; 
        color: #fff; 
        text-decoration: none; 
        border-radius: 5px;
        margin: 20px 0;
      }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Buchung wurde genehmigt</h1>
      
      <div class="info-box">
        <h3>Buchungsdetails:</h3>
        <p><strong>Buchungscode:</strong> {{bookingCode}}</p>
        <p><strong>Gast:</strong> {{guestName}} ({{guestEmail}})</p>
        <p><strong>Zeitraum:</strong> {{startDate}} bis {{endDate}}</p>
        <p><strong>Genehmigt von:</strong> {{approvedByName}}</p>
      </div>
      
      <a href="{{adminUrl}}" class="button">Buchung anzeigen</a>
      
      <div class="footer">
        <p>Viele Grüße<br>Hollandhaus Buchungssystem</p>
      </div>
    </div>
  </body>
</html>`,
    bodyText: `BUCHUNG WURDE GENEHMIGT

BUCHUNGSDETAILS:
----------------
Buchungscode: {{bookingCode}}
Gast: {{guestName}} ({{guestEmail}})
Zeitraum: {{startDate}} bis {{endDate}}
Genehmigt von: {{approvedByName}}

Buchung anzeigen: {{adminUrl}}

Viele Grüße
Hollandhaus Buchungssystem`,
  },
  {
    key: "admin_booking_rejected",
    name: "Buchung abgelehnt (an Admin)",
    subject: "Buchung #{{bookingCode}} wurde abgelehnt",
    description: "Benachrichtigung an Admins wenn eine Buchung von einem anderen Admin abgelehnt wurde",
    variables: ["bookingCode", "guestName", "guestEmail", "startDate", "endDate", "rejectedByName", "rejectionReason", "adminUrl"],
    bodyHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .info-box { 
        background: #f8d7da; 
        border: 2px solid #dc3545;
        padding: 15px; 
        border-radius: 5px; 
        margin: 20px 0; 
      }
      .button { 
        display: inline-block; 
        padding: 12px 24px; 
        background: #000; 
        color: #fff; 
        text-decoration: none; 
        border-radius: 5px;
        margin: 20px 0;
      }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Buchung wurde abgelehnt</h1>
      
      <div class="info-box">
        <h3>Buchungsdetails:</h3>
        <p><strong>Buchungscode:</strong> {{bookingCode}}</p>
        <p><strong>Gast:</strong> {{guestName}} ({{guestEmail}})</p>
        <p><strong>Zeitraum:</strong> {{startDate}} bis {{endDate}}</p>
        <p><strong>Abgelehnt von:</strong> {{rejectedByName}}</p>
        {{#if rejectionReason}}
        <p><strong>Grund:</strong><br>{{rejectionReason}}</p>
        {{/if}}
      </div>
      
      <a href="{{adminUrl}}" class="button">Buchung anzeigen</a>
      
      <div class="footer">
        <p>Viele Grüße<br>Hollandhaus Buchungssystem</p>
      </div>
    </div>
  </body>
</html>`,
    bodyText: `BUCHUNG WURDE ABGELEHNT

BUCHUNGSDETAILS:
----------------
Buchungscode: {{bookingCode}}
Gast: {{guestName}} ({{guestEmail}})
Zeitraum: {{startDate}} bis {{endDate}}
Abgelehnt von: {{rejectedByName}}

{{#if rejectionReason}}
GRUND:
{{rejectionReason}}
{{/if}}

Buchung anzeigen: {{adminUrl}}

Viele Grüße
Hollandhaus Buchungssystem`,
  },
  {
    key: "admin_new_message_from_guest",
    name: "Neue Nachricht vom Gast (an Admin)",
    subject: "Neue Nachricht von {{guestName}} zu Buchung #{{bookingCode}}",
    description: "Benachrichtigung an Admins wenn ein Gast eine Nachricht sendet",
    variables: ["bookingCode", "guestName", "guestEmail", "messageContent", "adminUrl"],
    bodyHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .message-box { 
        background: #f5f5f5; 
        padding: 15px; 
        border-left: 4px solid #000;
        margin: 20px 0; 
      }
      .button { 
        display: inline-block; 
        padding: 12px 24px; 
        background: #000; 
        color: #fff; 
        text-decoration: none; 
        border-radius: 5px;
        margin: 20px 0;
      }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Neue Nachricht erhalten</h1>
      
      <p>Du hast eine neue Nachricht zu Buchung <strong>#{{bookingCode}}</strong> erhalten:</p>
      
      <div class="message-box">
        <p><strong>Von:</strong> {{guestName}} ({{guestEmail}})</p>
        <p>{{messageContent}}</p>
      </div>
      
      <a href="{{adminUrl}}" class="button">Nachricht beantworten</a>
      
      <div class="footer">
        <p>Viele Grüße<br>Hollandhaus Buchungssystem</p>
      </div>
    </div>
  </body>
</html>`,
    bodyText: `NEUE NACHRICHT ERHALTEN

Du hast eine neue Nachricht zu Buchung #{{bookingCode}} erhalten:

VON: {{guestName}} ({{guestEmail}})
-------------------
{{messageContent}}

Nachricht beantworten: {{adminUrl}}

Viele Grüße
Hollandhaus Buchungssystem`,
  },
  {
    key: "admin_booking_cancelled",
    name: "Buchung storniert (an Admin)",
    subject: "Buchung #{{bookingCode}} wurde storniert",
    description: "Benachrichtigung an Admins wenn eine Buchung storniert wurde",
    variables: ["bookingCode", "guestName", "guestEmail", "startDate", "endDate", "cancelledByName", "cancellationReason", "adminUrl"],
    bodyHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .info-box { 
        background: #fff3cd; 
        border: 2px solid #ffc107;
        padding: 15px; 
        border-radius: 5px; 
        margin: 20px 0; 
      }
      .button { 
        display: inline-block; 
        padding: 12px 24px; 
        background: #000; 
        color: #fff; 
        text-decoration: none; 
        border-radius: 5px;
        margin: 20px 0;
      }
      .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Buchung wurde storniert</h1>
      
      <div class="info-box">
        <h3>Buchungsdetails:</h3>
        <p><strong>Buchungscode:</strong> {{bookingCode}}</p>
        <p><strong>Gast:</strong> {{guestName}} ({{guestEmail}})</p>
        <p><strong>Zeitraum:</strong> {{startDate}} bis {{endDate}}</p>
        <p><strong>Storniert von:</strong> {{cancelledByName}}</p>
        {{#if cancellationReason}}
        <p><strong>Grund:</strong><br>{{cancellationReason}}</p>
        {{/if}}
      </div>
      
      <a href="{{adminUrl}}" class="button">Buchung anzeigen</a>
      
      <div class="footer">
        <p>Viele Grüße<br>Hollandhaus Buchungssystem</p>
      </div>
    </div>
  </body>
</html>`,
    bodyText: `BUCHUNG WURDE STORNIERT

BUCHUNGSDETAILS:
----------------
Buchungscode: {{bookingCode}}
Gast: {{guestName}} ({{guestEmail}})
Zeitraum: {{startDate}} bis {{endDate}}
Storniert von: {{cancelledByName}}

{{#if cancellationReason}}
GRUND:
{{cancellationReason}}
{{/if}}

Buchung anzeigen: {{adminUrl}}

Viele Grüße
Hollandhaus Buchungssystem`,
  },
];

