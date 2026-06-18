-- Agregar columna app_name a la tabla users (SIN DEFAULT para evitar timeout)
-- Esto es más rápido porque no actualiza registros existentes
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- Luego actualiza los valores existentes (ejecuta esto después si es necesario)
-- UPDATE users SET app_name = 'Opalopy' WHERE app_name IS NULL;

