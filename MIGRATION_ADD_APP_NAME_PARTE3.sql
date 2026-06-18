-- ============================================
-- MIGRACIÓN PARTE 3: Actualizar datos existentes (Tablas relacionadas con candidates)
-- ============================================
-- Ejecuta esta parte después de la Parte 2
-- Actualiza las tablas que dependen de candidates

-- Actualizar candidate_history existentes basándose en candidate_id
UPDATE candidate_history ch
SET app_name = c.app_name
FROM candidates c
WHERE ch.candidate_id = c.id 
  AND ch.app_name IS NULL
  AND c.app_name IS NOT NULL;

-- Actualizar post_its existentes basándose en candidate_id
UPDATE post_its pi
SET app_name = c.app_name
FROM candidates c
WHERE pi.candidate_id = c.id 
  AND pi.app_name IS NULL
  AND c.app_name IS NOT NULL;

-- Actualizar comments existentes basándose en candidate_id
UPDATE comments co
SET app_name = c.app_name
FROM candidates c
WHERE co.candidate_id = c.id 
  AND co.app_name IS NULL
  AND c.app_name IS NOT NULL;

-- Actualizar interview_events existentes basándose en candidate_id
UPDATE interview_events ie
SET app_name = c.app_name
FROM candidates c
WHERE ie.candidate_id = c.id 
  AND ie.app_name IS NULL
  AND c.app_name IS NOT NULL;

-- Verificar progreso
SELECT 
    'candidate_history' as tabla,
    COUNT(*) FILTER (WHERE app_name IS NOT NULL) as con_app_name,
    COUNT(*) FILTER (WHERE app_name IS NULL) as sin_app_name
FROM candidate_history
UNION ALL
SELECT 
    'post_its',
    COUNT(*) FILTER (WHERE app_name IS NOT NULL),
    COUNT(*) FILTER (WHERE app_name IS NULL)
FROM post_its
UNION ALL
SELECT 
    'comments',
    COUNT(*) FILTER (WHERE app_name IS NOT NULL),
    COUNT(*) FILTER (WHERE app_name IS NULL)
FROM comments
UNION ALL
SELECT 
    'interview_events',
    COUNT(*) FILTER (WHERE app_name IS NOT NULL),
    COUNT(*) FILTER (WHERE app_name IS NULL)
FROM interview_events;

