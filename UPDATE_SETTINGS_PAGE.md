# Settings Page Update - SMTP Enabled Flag

Um die Settings-Page mit dem `enabled` Flag zu aktualisieren, füge folgendes hinzu:

## In `/src/app/admin/settings/page.tsx`

### 1. Import hinzufügen (oben):
```typescript
import { getSmtpConfigWithEnabled } from "@/lib/update-smtp-settings-page";
```

### 2. Im Promise.all beim Laden der smtpSettings:

**VORHER:**
```typescript
const smtpConfig = {
  host: smtpSettings.find((s) => s.key === "SMTP_HOST")?.value || "",
  port: smtpSettings.find((s) => s.key === "SMTP_PORT")?.value || "587",
  user: smtpSettings.find((s) => s.key === "SMTP_USER")?.value || "",
  password: smtpSettings.find((s) => s.key === "SMTP_PASSWORD")?.value || "",
  fromEmail: smtpSettings.find((s) => s.key === "SMTP_FROM_EMAIL")?.value || "",
  fromName: smtpSettings.find((s) => s.key === "SMTP_FROM_NAME")?.value || "Familie Waubke",
};
```

**NACHHER:**
```typescript
const smtpConfig = getSmtpConfigWithEnabled(smtpSettings);
```

Das wars! 🎉

Diese Helper-Funktion fügt automatisch das `enabled: boolean` Feld hinzu.

