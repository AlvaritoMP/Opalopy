-- Migración: Agregar columna field_mapping a form_integrations
-- Ejecutar en Supabase SQL Editor

-- Agregar columna field_mapping para almacenar el mapeo personalizado de campos
ALTER TABLE form_integrations 
ADD COLUMN IF NOT EXISTS field_mapping JSONB;

COMMENT ON COLUMN form_integrations.field_mapping IS 'Mapeo personalizado de campos: campo de Tally -> campo del candidato. Formato JSON: {"campo_tally": "campo_candidato"}';
