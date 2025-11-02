-- AlterTable: Füge mustChangePassword zum User Model hinzu (falls nicht vorhanden)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'User' AND column_name = 'mustChangePassword'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- CreateTable: Erstelle EmailLog Tabelle (falls nicht vorhanden)
CREATE TABLE IF NOT EXISTS "EmailLog" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT,
    "emailType" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "from" TEXT,
    "fromName" TEXT,
    "replyTo" TEXT,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "error" TEXT,
    "sentVia" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Indizes für EmailLog (falls nicht vorhanden)
CREATE INDEX IF NOT EXISTS "EmailLog_to_idx" ON "EmailLog"("to");
CREATE INDEX IF NOT EXISTS "EmailLog_templateKey_idx" ON "EmailLog"("templateKey");
CREATE INDEX IF NOT EXISTS "EmailLog_emailType_idx" ON "EmailLog"("emailType");
CREATE INDEX IF NOT EXISTS "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
