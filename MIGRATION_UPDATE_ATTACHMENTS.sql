-- Actualizar attachments existentes (primero los que tienen process_id)
UPDATE attachments a
SET app_name = p.app_name
FROM processes p
WHERE a.process_id = p.id 
  AND a.app_name IS NULL
  AND p.app_name IS NOT NULL
  AND a.candidate_id IS NULL
LIMIT 1000;

-- Luego los que tienen candidate_id (ejecuta este bloque por separado)
-- UPDATE attachments a
-- SET app_name = c.app_name
-- FROM candidates c
-- WHERE a.candidate_id = c.id 
--   AND a.app_name IS NULL
--   AND c.app_name IS NOT NULL
-- LIMIT 1000;

-- Para los que no tienen ni process_id ni candidate_id
-- UPDATE attachments
-- SET app_name = 'Opalopy'
-- WHERE app_name IS NULL
-- LIMIT 1000;

