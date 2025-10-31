# 🏠 Domburg Ferienhaus - Buchungssystem

Ein modernes, sicheres Buchungs- und Verwaltungssystem für ein privates Ferienhaus in den Niederlanden.

## 🎯 Features

### Für Gäste
- ✉️ **Passwortlose Anmeldung** via Magic Link (E-Mail)
- 🔑 **Gastcode-Login** für schnellen Zugriff
- 📅 **Interaktiver Kalender** mit Verfügbarkeitsanzeige
- 🎫 **Buchungsanfragen** mit Zeitraum, Gästezahl und Nachricht
- 📊 **Dashboard** mit Übersicht aller eigenen Buchungen
- ❌ **Stornierung** von Buchungen

### Für Administratoren
- ✅ **Buchungsverwaltung** - Anfragen genehmigen/ablehnen
- 📆 **Google Calendar Integration** - Automatische Synchronisation
- 💰 **Flexible Preisverwaltung** - Saisons und Sonderpreise
- 📧 **E-Mail-Benachrichtigungen** für neue Buchungen
- 📝 **Activity Logs** für alle Aktionen
- 🔐 **Rollen-basierte Zugriffsrechte**

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router, Server Actions)
- **Sprache:** TypeScript
- **Styling:** TailwindCSS + shadcn/ui
- **ORM:** Prisma
- **Datenbank:** PostgreSQL (Docker)
- **Authentifizierung:** JWT-basiert mit Magic Links
- **E-Mail:** Resend (oder SMTP)
- **Kalender:** Google Calendar API

## 📦 Installation

### Voraussetzungen
- Node.js 18+
- Docker & Docker Compose
- Git

### 1. Repository klonen
```bash
git clone <your-repo-url>
cd domburg
```

### 2. Dependencies installieren
```bash
npm install
```

### 3. Umgebungsvariablen konfigurieren

Kopieren Sie `.env.example` und passen Sie die Werte an:

```bash
cp .env.example .env
```

Wichtige Variablen:
- `DATABASE_URL` - PostgreSQL Verbindungsstring
- `JWT_SECRET` - Geheimer Schlüssel für JWT (min. 32 Zeichen)
- `NEXTAUTH_SECRET` - Geheimer Schlüssel für NextAuth
- `RESEND_API_KEY` - API-Schlüssel für Resend (E-Mail)
- `GOOGLE_CALENDAR_ID` - Google Calendar ID
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Service Account E-Mail
- `GOOGLE_PRIVATE_KEY` - Service Account Private Key
- `ADMIN_EMAILS` - Komma-getrennte Liste von Admin-E-Mails

### 4. Datenbank starten
```bash
npm run docker:up
```

### 5. Prisma Migrationen ausführen
```bash
npm run db:push
```

### 6. Datenbank mit Beispieldaten füllen
```bash
npm run db:seed
```

### 7. Entwicklungsserver starten
```bash
npm run dev
```

Die App läuft nun auf [http://localhost:3000](http://localhost:3000)

## 🔐 Google Calendar Setup

1. **Google Cloud Console öffnen**
   - Gehen Sie zu [console.cloud.google.com](https://console.cloud.google.com)

2. **Neues Projekt erstellen**
   - Klicken Sie auf "Projekt erstellen"
   - Geben Sie einen Namen ein (z.B. "Domburg Booking")

3. **Google Calendar API aktivieren**
   - Navigieren Sie zu "APIs & Services" > "Library"
   - Suchen Sie nach "Google Calendar API"
   - Klicken Sie auf "Aktivieren"

4. **Service Account erstellen**
   - Gehen Sie zu "APIs & Services" > "Credentials"
   - Klicken Sie auf "Create Credentials" > "Service Account"
   - Geben Sie einen Namen ein (z.B. "Booking System")
   - Klicken Sie auf "Create and Continue"
   - Überspringen Sie die optionalen Schritte

5. **Service Account Key generieren**
   - Klicken Sie auf den erstellten Service Account
   - Gehen Sie zum Tab "Keys"
   - Klicken Sie auf "Add Key" > "Create new key"
   - Wählen Sie "JSON" und klicken Sie auf "Create"
   - Die Datei wird heruntergeladen

6. **Kalender erstellen und freigeben**
   - Öffnen Sie [calendar.google.com](https://calendar.google.com)
   - Erstellen Sie einen neuen Kalender für das Ferienhaus
   - Gehen Sie zu den Kalendereinstellungen
   - Unter "Mit bestimmten Personen teilen" fügen Sie die Service Account E-Mail hinzu
   - Geben Sie "Änderungen an Terminen vornehmen" Berechtigung

7. **Umgebungsvariablen setzen**
   - Kopieren Sie die Kalender-ID aus den Kalendereinstellungen
   - Extrahieren Sie aus der JSON-Datei:
     - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
     - `private_key` → `GOOGLE_PRIVATE_KEY`

## 📧 E-Mail Setup (Resend)

1. **Resend Account erstellen**
   - Gehen Sie zu [resend.com](https://resend.com)
   - Erstellen Sie ein kostenloses Konto

2. **Domain verifizieren** (optional, aber empfohlen)
   - Fügen Sie Ihre Domain hinzu
   - Folgen Sie den DNS-Setup-Anweisungen

3. **API Key generieren**
   - Gehen Sie zu "API Keys"
   - Erstellen Sie einen neuen Key
   - Kopieren Sie ihn in die `.env` Datei als `RESEND_API_KEY`

**Alternative: SMTP verwenden**

Wenn Sie SMTP statt Resend verwenden möchten, kommentieren Sie die Resend-Variablen aus und fügen Sie hinzu:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## 🎨 Development

### Prisma Studio öffnen
```bash
npm run db:studio
```
Öffnet eine GUI zur Verwaltung der Datenbank auf [http://localhost:5555](http://localhost:5555)

### pgAdmin öffnen
- URL: [http://localhost:5050](http://localhost:5050)
- E-Mail: `admin@domburg.local` (oder wie in `.env` konfiguriert)
- Passwort: `admin`

### Datenbank-Befehle
```bash
# Datenbank pushen (ohne Migration)
npm run db:push

# Migration erstellen
npm run db:migrate

# Prisma Client generieren
npm run db:generate

# Seed-Daten erneut laden
npm run db:seed
```

### Docker-Befehle
```bash
# Datenbank starten
npm run docker:up

# Datenbank stoppen
npm run docker:down

# Logs anzeigen
npm run docker:logs
```

## 🚀 Deployment

### Vercel (Frontend + Next.js)
1. Repository zu Vercel verbinden
2. Umgebungsvariablen konfigurieren
3. Build Command: `npm run build`
4. Deploy!

### Datenbank (z.B. Railway/Render)
1. PostgreSQL-Instanz erstellen
2. `DATABASE_URL` kopieren
3. In Vercel Environment Variables einfügen

## 📁 Projektstruktur

```
domburg/
├── prisma/
│   ├── schema.prisma          # Datenbankschema
│   └── seed.ts                # Seed-Daten
├── src/
│   ├── app/
│   │   ├── actions/           # Server Actions
│   │   ├── api/               # API Routes
│   │   ├── auth/              # Auth-Seiten
│   │   ├── admin/             # Admin-Seiten
│   │   ├── dashboard/         # Gast-Dashboard
│   │   └── book/              # Buchungsseite
│   ├── components/
│   │   ├── ui/                # shadcn/ui Komponenten
│   │   ├── booking-calendar.tsx
│   │   ├── booking-form.tsx
│   │   └── navbar.tsx
│   └── lib/
│       ├── auth.ts            # Authentifizierung
│       ├── email.ts           # E-Mail-Service
│       ├── google-calendar.ts # Google Calendar
│       ├── pricing.ts         # Preisberechnung
│       └── prisma.ts          # Prisma Client
├── docker-compose.yml         # Docker Setup
├── package.json
└── README.md
```

## 👤 Standard-Login

Nach dem Seeding sind folgende Benutzer verfügbar:

**Admin:**
- E-Mail: `admin@domburg.local`
- Login: Magic Link

**Test-Gast:**
- E-Mail: `gast@example.com`
- Login: Magic Link

**Gastcode:**
- Code: `domburg2024`

## 🔒 Sicherheit

- JWT-basierte Authentifizierung
- HTTP-only Cookies
- CSRF-Schutz durch Next.js
- Server-seitige Validierung
- Rollenbasierte Zugriffskontrolle
- Activity Logging für Audits

## 📝 Lizenz

Privates Projekt - Alle Rechte vorbehalten

## 🤝 Support

Bei Fragen oder Problemen öffnen Sie ein Issue im Repository.

---

Erstellt mit ❤️ für unvergessliche Urlaube in Domburg 🏖️

