-- Actualizar stages existentes basándose en su process_id
-- Solo actualiza los que aún no tienen app_name
UPDATE stages s
SET app_name = p.app_name
FROM processes p
WHERE s.process_id = p.id 
  AND s.app_name IS NULL
  AND p.app_name IS NOT NULL
LIMIT 1000;

-- Si hay más de 1000 registros, ejecuta este script varias veces
-- hasta que no haya más registros para actualizar

