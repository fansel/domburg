-- Markiere die Housekeeper-Migration als ausgeführt, wenn die Tabelle bereits existiert
DO $$
BEGIN
    -- Prüfe ob die Tabelle existiert
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Housekeeper') THEN
        -- Prüfe ob die Migration bereits als ausgeführt markiert ist
        IF NOT EXISTS (
            SELECT 1 FROM "_prisma_migrations" 
            WHERE migration_name = '20251109122011_add_housekeeper_model'
        ) THEN
            -- Markiere die Migration als ausgeführt
            INSERT INTO "_prisma_migrations" (
                migration_name,
                applied_steps_count
            ) VALUES (
                '20251109122011_add_housekeeper_model',
                1
            );
            RAISE NOTICE 'Migration 20251109122011_add_housekeeper_model wurde als ausgeführt markiert';
        ELSE
            RAISE NOTICE 'Migration 20251109122011_add_housekeeper_model ist bereits als ausgeführt markiert';
        END IF;
    ELSE
        RAISE NOTICE 'Tabelle Housekeeper existiert nicht - Migration wird normal ausgeführt';
    END IF;
END $$;

