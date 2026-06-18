-- Agregar columna app_name a la tabla comments
ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS app_name TEXT;

