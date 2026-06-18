-- Agregar columna app_name a la tabla form_integrations
ALTER TABLE form_integrations 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Opalopy';

