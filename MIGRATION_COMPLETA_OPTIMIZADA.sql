-- ============================================
-- MIGRACIÓN COMPLETA OPTIMIZADA: Multi-Tenant
-- ============================================
-- Este script agrega el campo app_name a todas las tablas
-- Optimizado para ejecutarse en un solo proceso
-- IMPORTANTE: Ejecuta en Supabase SQL Editor

BEGIN;

-- ============================================
-- PARTE 1: Agregar columnas (SIN DEFAULT para evitar timeout)
-- ============================================

-- Tablas principales (con DEFAULT para nuevos registros)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS app_name TEXT;

ALTER TABLE processes 
ADD COLUMN IF NOT EXISTS app_name TEXT;

ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- Tablas relacionadas (sin DEFAULT, se actualizarán después)
ALTER TABLE stages 
ADD COLUMN IF NOT EXISTS app_name TEXT;

ALTER TABLE document_categories 
ADD COLUMN IF NOT EXISTS app_name TEXT;

ALTER TABLE attachments 
ADD COLUMN IF NOT EXISTS app_name TEXT;

ALTER TABLE candidate_history 
ADD COLUMN IF NOT EXISTS app_name TEXT;

ALTER TABLE post_its 
ADD COLUMN IF NOT EXISTS app_name TEXT;

ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS app_name TEXT;

ALTER TABLE interview_events 
ADD COLUMN IF NOT EXISTS app_name TEXT;

ALTER TABLE form_integrations 
ADD COLUMN IF NOT EXISTS app_name TEXT;

ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- ============================================
-- PARTE 2: Actualizar valores por defecto en tablas principales
-- ============================================

-- Actualizar users (en lotes si es necesario)
UPDATE users 
SET app_name = 'Opalopy' 
WHERE app_name IS NULL;

-- Actualizar processes
UPDATE processes 
SET app_name = 'Opalopy' 
WHERE app_name IS NULL;

-- Actualizar candidates
UPDATE candidates 
SET app_name = 'Opalopy' 
WHERE app_name IS NULL;

-- Actualizar form_integrations
UPDATE form_integrations 
SET app_name = 'Opalopy' 
WHERE app_name IS NULL;

-- Actualizar app_settings
UPDATE app_settings 
SET app_name = 'Opalopy' 
WHERE app_name IS NULL;

-- ============================================
-- PARTE 3: Actualizar tablas relacionadas basándose en relaciones
-- ============================================

-- Actualizar stages basándose en process_id
UPDATE stages s
SET app_name = p.app_name
FROM processes p
WHERE s.process_id = p.id 
  AND s.app_name IS NULL
  AND p.app_name IS NOT NULL;

-- Actualizar document_categories basándose en process_id
UPDATE document_categories dc
SET app_name = p.app_name
FROM processes p
WHERE dc.process_id = p.id 
  AND dc.app_name IS NULL
  AND p.app_name IS NOT NULL;

-- Actualizar attachments basándose en process_id
UPDATE attachments a
SET app_name = p.app_name
FROM processes p
WHERE a.process_id = p.id 
  AND a.app_name IS NULL
  AND p.app_name IS NOT NULL
  AND a.candidate_id IS NULL;

-- Actualizar attachments basándose en candidate_id
UPDATE attachments a
SET app_name = c.app_name
FROM candidates c
WHERE a.candidate_id = c.id 
  AND a.app_name IS NULL
  AND c.app_name IS NOT NULL;

-- Para attachments sin relación, usar default
UPDATE attachments
SET app_name = 'Opalopy'
WHERE app_name IS NULL;

-- Actualizar candidate_history basándose en candidate_id
UPDATE candidate_history ch
SET app_name = c.app_name
FROM candidates c
WHERE ch.candidate_id = c.id 
  AND ch.app_name IS NULL
  AND c.app_name IS NOT NULL;

-- Actualizar post_its basándose en candidate_id
UPDATE post_its pi
SET app_name = c.app_name
FROM candidates c
WHERE pi.candidate_id = c.id 
  AND pi.app_name IS NULL
  AND c.app_name IS NOT NULL;

-- Actualizar comments basándose en candidate_id
UPDATE comments co
SET app_name = c.app_name
FROM candidates c
WHERE co.candidate_id = c.id 
  AND co.app_name IS NULL
  AND c.app_name IS NOT NULL;

-- Actualizar interview_events basándose en candidate_id
UPDATE interview_events ie
SET app_name = c.app_name
FROM candidates c
WHERE ie.candidate_id = c.id 
  AND ie.app_name IS NULL
  AND c.app_name IS NOT NULL;

-- ============================================
-- PARTE 4: Crear índices para mejorar rendimiento
-- ============================================

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

COMMIT;

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================

-- Verificar que todas las columnas se crearon
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('users', 'processes', 'candidates', 'stages', 'document_categories', 
                      'attachments', 'candidate_history', 'post_its', 'comments', 
                      'interview_events', 'form_integrations', 'app_settings')
  AND column_name = 'app_name'
ORDER BY table_name;

-- Verificar distribución de datos
SELECT 
    'users' as tabla,
    app_name,
    COUNT(*) as total
FROM users
GROUP BY app_name
UNION ALL
SELECT 'processes', app_name, COUNT(*) FROM processes GROUP BY app_name
UNION ALL
SELECT 'candidates', app_name, COUNT(*) FROM candidates GROUP BY app_name
ORDER BY tabla, app_name;

