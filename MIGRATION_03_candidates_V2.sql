-- Agregar columna app_name a la tabla candidates (SIN DEFAULT)
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- UPDATE candidates SET app_name = 'Opalopy' WHERE app_name IS NULL;

