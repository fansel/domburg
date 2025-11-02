# 🚀 Quick Start: Production Deployment

## Einfache Anleitung in 4 Schritten

### 1️⃣ Projekt auf Server kopieren
```bash
ssh user@your-server
cd /opt
git clone <your-repo-url> domburg
cd domburg
```

### 2️⃣ Umgebungsvariablen erstellen
```bash
cp .env.example .env.production
nano .env.production
```

**Mindestens anpassen:**
- `POSTGRES_PASSWORD` - Starkes Passwort
- `JWT_SECRET` - Generieren mit: `openssl rand -base64 32`

**Optional:**
- `NEXT_PUBLIC_APP_URL` - Fallback-URL (kann später im Admin-Panel gesetzt werden)
- `ADMIN_EMAILS` - Nur für initiales Setup (komma-getrennte Liste)

**E-Mail-Konfiguration:**
- Wird im Admin-Panel unter **Settings > E-Mail** konfiguriert (SMTP-Einstellungen)
- Nicht als ENV-Variablen nötig

### 3️⃣ Docker Compose starten (Production)
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 4️⃣ Datenbank-Migrationen ausführen
```bash
sleep 10  # Warten bis DB bereit ist
docker-compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
```

**Fertig!** ✅ Die App läuft im Production-Modus auf Port 3000.

---

## Nützliche Befehle

```bash
# Status prüfen
docker-compose -f docker-compose.prod.yml ps

# Logs anzeigen
docker-compose -f docker-compose.prod.yml logs -f app

# Container stoppen
docker-compose -f docker-compose.prod.yml down

# Container neu starten
docker-compose -f docker-compose.prod.yml restart app

# Nach Update: Neu bauen
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## ⚠️ Wichtig

- Verwendet `docker-compose.prod.yml` (NICHT `docker-compose.yml` für Dev)
- Läuft automatisch im **Production-Modus** (NODE_ENV=production)
- Kein Dev-Modus - das Dockerfile baut eine Production-Version

