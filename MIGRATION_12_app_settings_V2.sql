-- Agregar columna app_name a la tabla app_settings (SIN DEFAULT)
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS app_name TEXT;

