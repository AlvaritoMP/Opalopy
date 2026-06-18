-- Agregar columna app_name a la tabla document_categories
ALTER TABLE document_categories 
ADD COLUMN IF NOT EXISTS app_name TEXT;

