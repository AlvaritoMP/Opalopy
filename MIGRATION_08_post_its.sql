-- Agregar columna app_name a la tabla post_its
ALTER TABLE post_its 
ADD COLUMN IF NOT EXISTS app_name TEXT;

