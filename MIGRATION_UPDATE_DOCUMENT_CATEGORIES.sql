-- Actualizar document_categories existentes basándose en su process_id
UPDATE document_categories dc
SET app_name = p.app_name
FROM processes p
WHERE dc.process_id = p.id 
  AND dc.app_name IS NULL
  AND p.app_name IS NOT NULL
LIMIT 1000;

