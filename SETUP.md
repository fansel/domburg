# 🚀 Schnellstart-Anleitung

## Schritt 1: Datenbank starten

```bash
npm run docker:up
```

Warten Sie, bis PostgreSQL vollständig gestartet ist (ca. 10 Sekunden).

## Schritt 2: Dependencies installieren

```bash
npm install
```

## Schritt 3: Datenbank initialisieren

```bash
npm run db:push
npm run db:seed
```

## Schritt 4: Entwicklungsserver starten

```bash
npm run dev
```

Die App ist nun unter [http://localhost:3000](http://localhost:3000) erreichbar!

## 📧 Test-Login (Development Mode)

### Option 1: Magic Link
1. Gehen Sie zu [http://localhost:3000](http://localhost:3000)
2. Klicken Sie auf "Magic Link"
3. Geben Sie eine E-Mail ein (z.B. `test@example.com`)
4. Klicken Sie auf "Magic Link senden"
5. **Schauen Sie in die Konsole!** Der Magic Link wird dort angezeigt (da kein E-Mail-Service konfiguriert ist)
6. Kopieren Sie den Link und öffnen Sie ihn im Browser

### Option 2: Gastcode
1. Gehen Sie zu [http://localhost:3000](http://localhost:3000)
2. Klicken Sie auf "Gastcode"
3. Geben Sie `domburg2024` ein
4. Klicken Sie auf "Mit Gastcode anmelden"

## 🔧 Optionale Konfiguration

### Google Calendar (für Produktionsumgebung)
Folgen Sie der detaillierten Anleitung in der [README.md](README.md#-google-calendar-setup)

### E-Mail-Service (Resend)
1. Erstellen Sie einen Account auf [resend.com](https://resend.com)
2. Generieren Sie einen API Key
3. Fügen Sie ihn zur `.env` hinzu:
   ```env
   RESEND_API_KEY=re_your_api_key_here
   EMAIL_FROM=noreply@yourdomain.com
   ```

## 🛠️ Nützliche Befehle

### Datenbank verwalten
```bash
# Prisma Studio öffnen (GUI für Datenbank)
npm run db:studio

# Datenbank zurücksetzen und neu seeden
npm run db:push
npm run db:seed
```

### Docker
```bash
# Logs anzeigen
npm run docker:logs

# Datenbank stoppen
npm run docker:down

# Datenbank neu starten
npm run docker:down && npm run docker:up
```

### pgAdmin öffnen
- URL: [http://localhost:5050](http://localhost:5050)
- Login: `admin@domburg.local` / `admin`
- Verbindung zur DB:
  - Host: `postgres` (innerhalb Docker) oder `localhost` (von außen)
  - Port: `5432`
  - Database: `domburg`
  - User: `domburg`
  - Password: `domburg_secret`

## 🎯 Erste Schritte nach dem Login

### Als Gast:
1. ✅ Dashboard ansehen
2. ✅ Neue Buchung erstellen
3. ✅ Kalender durchstöbern
4. ✅ Buchungsanfrage senden

### Als Admin:
1. ✅ Login mit einer Admin-E-Mail (in `.env` unter `ADMIN_EMAILS`)
2. ✅ Buchungen verwalten unter `/admin/bookings`
3. ✅ Preise ansehen unter `/admin/pricing`
4. ✅ Buchungen genehmigen/ablehnen

## ⚠️ Troubleshooting

### Datenbank-Verbindung schlägt fehl
```bash
# Docker Container neustarten
npm run docker:down
npm run docker:up

# Warten Sie 10 Sekunden, dann:
npm run db:push
```

### "Module not found" Fehler
```bash
rm -rf node_modules package-lock.json
npm install
```

### Prisma-Fehler
```bash
npm run db:generate
npm run db:push
```

### Port 3000 bereits belegt
```bash
# Ändern Sie den Port in package.json:
# "dev": "next dev -p 3001"
```

## 🎉 Fertig!

Ihr Buchungssystem ist einsatzbereit! 

Bei Fragen schauen Sie in die [README.md](README.md) für detaillierte Informationen.

