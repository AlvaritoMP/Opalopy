-- Agregar columna app_name a la tabla candidate_history
ALTER TABLE candidate_history 
ADD COLUMN IF NOT EXISTS app_name TEXT;

