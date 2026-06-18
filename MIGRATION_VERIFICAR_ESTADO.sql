-- Verificar si la columna app_name ya existe en las tablas
-- Ejecuta esto primero para ver el estado actual

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

-- Si no devuelve resultados, ninguna tabla tiene la columna aún
-- Si devuelve resultados, algunas tablas ya tienen la columna

