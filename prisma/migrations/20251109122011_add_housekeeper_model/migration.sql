-- Prüfe ob Migration bereits ausgeführt wurde und markiere sie ggf. als ausgeführt
DO $$
DECLARE
    table_exists BOOLEAN;
    migration_exists BOOLEAN;
    required_columns_exist BOOLEAN;
BEGIN
    -- Prüfe ob Tabelle bereits existiert
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'Housekeeper'
    ) INTO table_exists;
    
    -- Prüfe ob Migration bereits als ausgeführt markiert ist
    SELECT EXISTS (
        SELECT 1 FROM "_prisma_migrations" 
        WHERE migration_name = '20251109122011_add_housekeeper_model'
    ) INTO migration_exists;
    
    -- Wenn Tabelle existiert, prüfe ob alle erforderlichen Spalten vorhanden sind
    IF table_exists THEN
        SELECT COUNT(*) = 6 INTO required_columns_exist
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = 'Housekeeper'
          AND column_name IN ('id', 'name', 'email', 'isActive', 'createdAt', 'updatedAt');
        
        -- Wenn Tabelle existiert mit korrekter Struktur, aber Migration nicht markiert ist
        IF required_columns_exist AND NOT migration_exists THEN
            INSERT INTO "_prisma_migrations" (
                id,
                migration_name,
                applied_steps_count,
                started_at,
                finished_at,
                checksum
            ) VALUES (
                gen_random_uuid(),
                '20251109122011_add_housekeeper_model',
                1,
                NOW(),
                NOW(),
                '0580d76a3805b63aad3ff64b6b3942fa6d96dbf807207ce2a99dcee2b0b88c41'
            );
            RAISE NOTICE 'Migration 20251109122011_add_housekeeper_model wurde als ausgeführt markiert (Tabelle existiert bereits mit korrekter Struktur)';
        ELSIF NOT required_columns_exist THEN
            RAISE WARNING 'Tabelle Housekeeper existiert, aber Struktur stimmt nicht überein. Migration wird versuchen, die Tabelle zu erstellen/aktualisieren.';
        END IF;
    END IF;
END $$;

-- CreateTable (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS "Housekeeper" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Housekeeper_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Housekeeper_email_key') THEN
CREATE UNIQUE INDEX "Housekeeper_email_key" ON "Housekeeper"("email");
    END IF;
END $$;

-- CreateIndex (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Housekeeper_email_idx') THEN
CREATE INDEX "Housekeeper_email_idx" ON "Housekeeper"("email");
    END IF;
END $$;

-- CreateIndex (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Housekeeper_isActive_idx') THEN
CREATE INDEX "Housekeeper_isActive_idx" ON "Housekeeper"("isActive");
    END IF;
END $$;

