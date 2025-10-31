// Standard Email Templates mit Du-Form

export const emailTemplates = [
  {
    key: "magic_link",
    name: "Magic Link (Admin Login)",
    subject: "Dein Login-Link für Domburg",
    description: "Login-Email für Admins mit Magic Link",
    variables: ["adminName", "loginUrl", "expiryMinutes"],
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
      <p>Du hast einen Login-Link für das Domburg Buchungssystem angefordert.</p>
      <p>Klicke auf den Button unten, um dich anzumelden:</p>
      <a href="{{loginUrl}}" class="button">Jetzt anmelden</a>
      <p>Dieser Link ist {{expiryMinutes}} Minuten gültig.</p>
      <p>Falls du diese E-Mail nicht angefordert hast, kannst du sie einfach ignorieren.</p>
      <div class="footer">
        <p>Viele Grüße<br>Familie Waubke</p>
      </div>
    </div>
  </body>
</html>`,
    bodyText: `Hallo {{adminName}}!

Du hast einen Login-Link für das Ferienhaus-Buchungssystem angefordert.

Klicke auf den Link, um dich anzumelden:
{{loginUrl}}

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
    variables: ["guestName", "bookingCode", "startDate", "endDate", "numberOfGuests", "totalPrice", "statusUrl"],
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
      <p>Vielen Dank für deine Anfrage für unser Ferienhaus in Domburg. Wir freuen uns sehr!</p>
      
      <div class="info-box">
        <h3>Deine Anfrage-Details:</h3>
        <p><strong>Anfrage-Code:</strong></p>
        <div class="code">{{bookingCode}}</div>
        <p><strong>Zeitraum:</strong> {{startDate}} bis {{endDate}}</p>
        <p><strong>Gäste:</strong> {{numberOfGuests}}</p>
        <p><strong>Gesamtpreis:</strong> €{{totalPrice}}</p>
      </p>
      
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

Vielen Dank für deine Anfrage für unser Ferienhaus in Domburg. Wir freuen uns sehr!

DEINE ANFRAGE-DETAILS:
----------------------
Anfrage-Code: {{bookingCode}}
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
    variables: ["guestName", "bookingCode", "startDate", "endDate", "numberOfGuests", "totalPrice", "adminNotes"],
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
    variables: ["guestName", "bookingCode", "startDate", "endDate", "rejectionReason"],
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
    key: "admin_new_booking",
    name: "Neue Anfrage (an Admin)",
    subject: "Neue Anfrage für unser Ferienhaus",
    description: "Benachrichtigung an Admins bei neuer Anfrage",
    variables: ["guestName", "guestEmail", "bookingCode", "startDate", "endDate", "numberOfGuests", "totalPrice", "message", "adminUrl"],
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
];

