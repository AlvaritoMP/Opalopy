-- ============================================
-- VERIFICACIÓN: Comprobar que la migración se completó correctamente
-- ============================================
-- Ejecuta este script después de todas las partes para verificar el estado

-- Verificar que todas las columnas app_name existen
SELECT 
    table_name,
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('users', 'processes', 'candidates', 'stages', 'document_categories', 
                      'attachments', 'candidate_history', 'post_its', 'comments', 
                      'interview_events', 'form_integrations', 'app_settings')
  AND column_name = 'app_name'
ORDER BY table_name;

-- Verificar distribución de datos por app_name
SELECT 
    'users' as tabla,
    app_name,
    COUNT(*) as total
FROM users
GROUP BY app_name
UNION ALL
SELECT 
    'processes',
    app_name,
    COUNT(*)
FROM processes
GROUP BY app_name
UNION ALL
SELECT 
    'candidates',
    app_name,
    COUNT(*)
FROM candidates
GROUP BY app_name
UNION ALL
SELECT 
    'stages',
    app_name,
    COUNT(*)
FROM stages
GROUP BY app_name
UNION ALL
SELECT 
    'document_categories',
    app_name,
    COUNT(*)
FROM document_categories
GROUP BY app_name
UNION ALL
SELECT 
    'attachments',
    app_name,
    COUNT(*)
FROM attachments
GROUP BY app_name
UNION ALL
SELECT 
    'candidate_history',
    app_name,
    COUNT(*)
FROM candidate_history
GROUP BY app_name
UNION ALL
SELECT 
    'post_its',
    app_name,
    COUNT(*)
FROM post_its
GROUP BY app_name
UNION ALL
SELECT 
    'comments',
    app_name,
    COUNT(*)
FROM comments
GROUP BY app_name
UNION ALL
SELECT 
    'interview_events',
    app_name,
    COUNT(*)
FROM interview_events
GROUP BY app_name
UNION ALL
SELECT 
    'form_integrations',
    app_name,
    COUNT(*)
FROM form_integrations
GROUP BY app_name
UNION ALL
SELECT 
    'app_settings',
    app_name,
    COUNT(*)
FROM app_settings
GROUP BY app_name
ORDER BY tabla, app_name;

-- Verificar si hay registros sin app_name (deberían ser 0 o muy pocos)
SELECT 
    'Registros sin app_name' as verificacion,
    (SELECT COUNT(*) FROM users WHERE app_name IS NULL) as users,
    (SELECT COUNT(*) FROM processes WHERE app_name IS NULL) as processes,
    (SELECT COUNT(*) FROM candidates WHERE app_name IS NULL) as candidates,
    (SELECT COUNT(*) FROM stages WHERE app_name IS NULL) as stages,
    (SELECT COUNT(*) FROM document_categories WHERE app_name IS NULL) as document_categories,
    (SELECT COUNT(*) FROM attachments WHERE app_name IS NULL) as attachments,
    (SELECT COUNT(*) FROM candidate_history WHERE app_name IS NULL) as candidate_history,
    (SELECT COUNT(*) FROM post_its WHERE app_name IS NULL) as post_its,
    (SELECT COUNT(*) FROM comments WHERE app_name IS NULL) as comments,
    (SELECT COUNT(*) FROM interview_events WHERE app_name IS NULL) as interview_events;

