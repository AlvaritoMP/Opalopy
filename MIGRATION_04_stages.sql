-- Agregar columna app_name a la tabla stages
ALTER TABLE stages 
ADD COLUMN IF NOT EXISTS app_name TEXT;

