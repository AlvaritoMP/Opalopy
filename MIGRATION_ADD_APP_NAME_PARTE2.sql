-- ============================================
-- MIGRACIÓN PARTE 2: Actualizar datos existentes (Tablas principales)
-- ============================================
-- Ejecuta esta parte después de la Parte 1
-- Actualiza los datos existentes en lotes para evitar timeout

-- Actualizar stages existentes basándose en su process_id
-- Solo actualiza los que aún no tienen app_name
UPDATE stages s
SET app_name = p.app_name
FROM processes p
WHERE s.process_id = p.id 
  AND s.app_name IS NULL
  AND p.app_name IS NOT NULL;

-- Actualizar document_categories existentes basándose en su process_id
UPDATE document_categories dc
SET app_name = p.app_name
FROM processes p
WHERE dc.process_id = p.id 
  AND dc.app_name IS NULL
  AND p.app_name IS NOT NULL;

-- Actualizar attachments existentes basándose en process_id o candidate_id
-- Primero los que tienen process_id
UPDATE attachments a
SET app_name = p.app_name
FROM processes p
WHERE a.process_id = p.id 
  AND a.app_name IS NULL
  AND p.app_name IS NOT NULL
  AND a.candidate_id IS NULL;

-- Luego los que tienen candidate_id
UPDATE attachments a
SET app_name = c.app_name
FROM candidates c
WHERE a.candidate_id = c.id 
  AND a.app_name IS NULL
  AND c.app_name IS NOT NULL;

-- Para los attachments que no tienen ni process_id ni candidate_id, usar default
UPDATE attachments
SET app_name = 'Opalopy'
WHERE app_name IS NULL;

-- Verificar progreso
SELECT 
    'stages' as tabla,
    COUNT(*) FILTER (WHERE app_name IS NOT NULL) as con_app_name,
    COUNT(*) FILTER (WHERE app_name IS NULL) as sin_app_name
FROM stages
UNION ALL
SELECT 
    'document_categories',
    COUNT(*) FILTER (WHERE app_name IS NOT NULL),
    COUNT(*) FILTER (WHERE app_name IS NULL)
FROM document_categories
UNION ALL
SELECT 
    'attachments',
    COUNT(*) FILTER (WHERE app_name IS NOT NULL),
    COUNT(*) FILTER (WHERE app_name IS NULL)
FROM attachments;

