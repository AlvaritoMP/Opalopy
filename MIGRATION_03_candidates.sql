-- Agregar columna app_name a la tabla candidates
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Opalopy';

