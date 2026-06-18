-- Agregar columna app_name a la tabla processes
ALTER TABLE processes 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Opalopy';

