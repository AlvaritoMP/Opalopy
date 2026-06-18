-- Actualizar candidate_history (ejecuta cada bloque por separado si hay muchos datos)

-- candidate_history
UPDATE candidate_history ch
SET app_name = c.app_name
FROM candidates c
WHERE ch.candidate_id = c.id 
  AND ch.app_name IS NULL
  AND c.app_name IS NOT NULL
LIMIT 1000;

-- post_its (comenta este bloque y ejecuta por separado si es necesario)
-- UPDATE post_its pi
-- SET app_name = c.app_name
-- FROM candidates c
-- WHERE pi.candidate_id = c.id 
--   AND pi.app_name IS NULL
--   AND c.app_name IS NOT NULL
-- LIMIT 1000;

-- comments (comenta este bloque y ejecuta por separado si es necesario)
-- UPDATE comments co
-- SET app_name = c.app_name
-- FROM candidates c
-- WHERE co.candidate_id = c.id 
--   AND co.app_name IS NULL
--   AND c.app_name IS NOT NULL
-- LIMIT 1000;

-- interview_events (comenta este bloque y ejecuta por separado si es necesario)
-- UPDATE interview_events ie
-- SET app_name = c.app_name
-- FROM candidates c
-- WHERE ie.candidate_id = c.id 
--   AND ie.app_name IS NULL
--   AND c.app_name IS NOT NULL
-- LIMIT 1000;

