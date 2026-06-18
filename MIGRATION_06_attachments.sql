-- Agregar columna app_name a la tabla attachments
ALTER TABLE attachments 
ADD COLUMN IF NOT EXISTS app_name TEXT;

