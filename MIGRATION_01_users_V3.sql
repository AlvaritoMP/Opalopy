-- Versión V3: Verificar primero, luego agregar
-- Si la columna ya existe, no hace nada

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'app_name'
    ) THEN
        ALTER TABLE users ADD COLUMN app_name TEXT;
        RAISE NOTICE 'Columna app_name agregada a users';
    ELSE
        RAISE NOTICE 'Columna app_name ya existe en users';
    END IF;
END $$;

