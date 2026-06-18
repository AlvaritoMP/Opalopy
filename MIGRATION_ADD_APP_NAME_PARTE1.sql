-- ============================================
-- MIGRACIÓN PARTE 1: Agregar columnas app_name (Solo estructura)
-- ============================================
-- Ejecuta esta parte primero. Es rápida y solo agrega las columnas.
-- Si alguna columna ya existe, no causará error gracias a IF NOT EXISTS

-- 1. Agregar columna app_name a la tabla users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Opalopy';

-- 2. Agregar columna app_name a la tabla processes
ALTER TABLE processes 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Opalopy';

-- 3. Agregar columna app_name a la tabla candidates
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Opalopy';

-- 4. Agregar columna app_name a stages
ALTER TABLE stages 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- 5. Agregar columna app_name a document_categories
ALTER TABLE document_categories 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- 6. Agregar columna app_name a attachments
ALTER TABLE attachments 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- 7. Agregar columna app_name a candidate_history
ALTER TABLE candidate_history 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- 8. Agregar columna app_name a post_its
ALTER TABLE post_its 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- 9. Agregar columna app_name a comments
ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- 10. Agregar columna app_name a interview_events
ALTER TABLE interview_events 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- 11. Agregar columna app_name a form_integrations
ALTER TABLE form_integrations 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Opalopy';

-- 12. Agregar columna app_name a app_settings
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Opalopy';

-- Verificar que las columnas se crearon
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name IN ('users', 'processes', 'candidates', 'stages', 'document_categories', 
                      'attachments', 'candidate_history', 'post_its', 'comments', 
                      'interview_events', 'form_integrations', 'app_settings')
  AND column_name = 'app_name'
ORDER BY table_name;

