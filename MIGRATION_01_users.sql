-- Agregar columna app_name a la tabla users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Opalopy';

