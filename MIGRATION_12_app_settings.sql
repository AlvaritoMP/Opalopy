-- Agregar columna app_name a la tabla app_settings
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Opalopy';

