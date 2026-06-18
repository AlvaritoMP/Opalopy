-- Agregar columna app_name a la tabla interview_events
ALTER TABLE interview_events 
ADD COLUMN IF NOT EXISTS app_name TEXT;

