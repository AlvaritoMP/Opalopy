-- Migración: Agregar campo app_name para aislamiento multi-tenant
-- Esta migración permite que Opalo ATS y Opalopy compartan la misma base de datos
-- pero mantengan sus datos completamente separados

-- IMPORTANTE: Ejecuta este script en el SQL Editor de Supabase

-- 1. Agregar columna app_name a la tabla users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Opalopy';

-- 2. Agregar columna app_name a la tabla processes
ALTER TABLE processes 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Opalopy';

-- 3. Agregar columna app_name a la tabla candidates
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Opalopy';

-- 4. Agregar columna app_name a la tabla stages (a través de process_id)
-- Nota: stages no tiene app_name directo, se filtra por process_id
-- Pero podemos agregarlo para consistencia
ALTER TABLE stages 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- Actualizar stages existentes basándose en su process_id
UPDATE stages s
SET app_name = p.app_name
FROM processes p
WHERE s.process_id = p.id AND s.app_name IS NULL;

-- 5. Agregar columna app_name a document_categories
ALTER TABLE document_categories 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- Actualizar document_categories existentes basándose en su process_id
UPDATE document_categories dc
SET app_name = p.app_name
FROM processes p
WHERE dc.process_id = p.id AND dc.app_name IS NULL;

-- 6. Agregar columna app_name a attachments
ALTER TABLE attachments 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- Actualizar attachments existentes basándose en process_id o candidate_id
UPDATE attachments a
SET app_name = COALESCE(
    (SELECT p.app_name FROM processes p WHERE p.id = a.process_id),
    (SELECT c.app_name FROM candidates c WHERE c.id = a.candidate_id),
    'Opalopy'
)
WHERE a.app_name IS NULL;

-- 7. Agregar columna app_name a candidate_history
ALTER TABLE candidate_history 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- Actualizar candidate_history existentes basándose en candidate_id
UPDATE candidate_history ch
SET app_name = c.app_name
FROM candidates c
WHERE ch.candidate_id = c.id AND ch.app_name IS NULL;

-- 8. Agregar columna app_name a post_its
ALTER TABLE post_its 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- Actualizar post_its existentes basándose en candidate_id
UPDATE post_its pi
SET app_name = c.app_name
FROM candidates c
WHERE pi.candidate_id = c.id AND pi.app_name IS NULL;

-- 9. Agregar columna app_name a comments
ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- Actualizar comments existentes basándose en candidate_id
UPDATE comments co
SET app_name = c.app_name
FROM candidates c
WHERE co.candidate_id = c.id AND co.app_name IS NULL;

-- 10. Agregar columna app_name a interview_events
ALTER TABLE interview_events 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- Actualizar interview_events existentes basándose en candidate_id
UPDATE interview_events ie
SET app_name = c.app_name
FROM candidates c
WHERE ie.candidate_id = c.id AND ie.app_name IS NULL;

-- 11. Agregar columna app_name a form_integrations
ALTER TABLE form_integrations 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Opalopy';

-- 12. Agregar columna app_name a app_settings (opcional, puede ser compartido o separado)
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Opalopy';

-- Crear índices para mejorar el rendimiento de las consultas filtradas por app_name
CREATE INDEX IF NOT EXISTS idx_users_app_name ON users(app_name);
CREATE INDEX IF NOT EXISTS idx_processes_app_name ON processes(app_name);
CREATE INDEX IF NOT EXISTS idx_candidates_app_name ON candidates(app_name);
CREATE INDEX IF NOT EXISTS idx_stages_app_name ON stages(app_name);
CREATE INDEX IF NOT EXISTS idx_document_categories_app_name ON document_categories(app_name);
CREATE INDEX IF NOT EXISTS idx_attachments_app_name ON attachments(app_name);
CREATE INDEX IF NOT EXISTS idx_candidate_history_app_name ON candidate_history(app_name);
CREATE INDEX IF NOT EXISTS idx_post_its_app_name ON post_its(app_name);
CREATE INDEX IF NOT EXISTS idx_comments_app_name ON comments(app_name);
CREATE INDEX IF NOT EXISTS idx_interview_events_app_name ON interview_events(app_name);
CREATE INDEX IF NOT EXISTS idx_form_integrations_app_name ON form_integrations(app_name);
CREATE INDEX IF NOT EXISTS idx_app_settings_app_name ON app_settings(app_name);

-- Verificar que las columnas se crearon correctamente
SELECT 
    table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('users', 'processes', 'candidates', 'stages', 'document_categories', 
                      'attachments', 'candidate_history', 'post_its', 'comments', 
                      'interview_events', 'form_integrations', 'app_settings')
  AND column_name = 'app_name'
ORDER BY table_name;

