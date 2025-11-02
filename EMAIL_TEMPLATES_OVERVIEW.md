# E-Mail-Templates Übersicht

## Templates für Gäste

1. **booking_confirmation** (`booking_confirmation`)
   - **An:** Gast
   - **Bei:** Neue Buchungsanfrage wurde eingereicht
   - **Zweck:** Bestätigung der Anfrage mit Code
   - **Variablen:** guestName, bookingCode, startDate, endDate, numberOfGuests, totalPrice, statusUrl, guestCode

2. **booking_approved** (`booking_approved`)
   - **An:** Gast
   - **Bei:** Buchung wurde von Admin genehmigt
   - **Zweck:** Zusage der Buchung
   - **Variablen:** guestName, bookingCode, startDate, endDate, numberOfGuests, totalPrice, adminNotes, guestCode

3. **booking_rejected** (`booking_rejected`)
   - **An:** Gast
   - **Bei:** Buchung wurde von Admin abgelehnt
   - **Zweck:** Absage der Buchung mit Grund
   - **Variablen:** guestName, bookingCode, startDate, endDate, rejectionReason, guestCode

4. **new_message** (`new_message`)
   - **An:** Gast
   - **Bei:** Admin hat eine Nachricht an den Gast gesendet
   - **Zweck:** Benachrichtigung über neue Nachricht
   - **Variablen:** guestName, bookingCode, messageContent, senderName, replyUrl

## Templates für Admins

5. **admin_new_booking** (`admin_new_booking`)
   - **An:** Admin(s)
   - **Bei:** Neue Buchungsanfrage wurde eingereicht
   - **Zweck:** Benachrichtigung über neue Anfrage
   - **Variablen:** guestName, guestEmail, bookingCode, startDate, endDate, numberOfGuests, totalPrice, message, adminUrl, guestCode

6. **new_user** (`new_user`)
   - **An:** Neuer Admin-Benutzer
   - **Bei:** Neuer Admin-Account wurde erstellt
   - **Zweck:** Willkommens-E-Mail mit Zugangsdaten
   - **Variablen:** userName, username, password, loginUrl, mustChangePassword

7. **password_reset** (`password_reset`)
   - **An:** Admin
   - **Bei:** Passwort-Zurücksetzung angefordert
   - **Zweck:** Link zum Passwort zurücksetzen
   - **Variablen:** adminName, resetUrl, expiryMinutes

## Fehlende Templates (für künftige Benachrichtigungen an Admins)

- **admin_booking_approved** - Benachrichtigung wenn ein anderer Admin eine Buchung genehmigt
- **admin_booking_rejected** - Benachrichtigung wenn ein anderer Admin eine Buchung ablehnt
- **admin_new_message_from_guest** - Benachrichtigung wenn ein Gast eine Nachricht sendet

