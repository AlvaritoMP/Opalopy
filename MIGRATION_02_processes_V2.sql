-- Agregar columna app_name a la tabla processes (SIN DEFAULT)
ALTER TABLE processes 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- UPDATE processes SET app_name = 'Opalopy' WHERE app_name IS NULL;

