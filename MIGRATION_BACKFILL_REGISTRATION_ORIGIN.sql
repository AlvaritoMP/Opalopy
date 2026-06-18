-- ============================================
-- BACKFILL: Origen de alta faltante o mal clasificado
-- ============================================
-- Ejecutar DESPUÉS de MIGRATION_ADD_REGISTRATION_ORIGIN.sql
-- Corrige NULL y reclasifica placeholders @import.opalo mal marcados como formulario
-- ============================================

-- 1. Corregir placeholders manual/import marcados erróneamente como formulario
UPDATE candidates
SET registration_origin = 'manual'
WHERE registration_origin = 'formulario'
  AND email ILIKE '%.manual@import.opalo';

UPDATE candidates
SET registration_origin = 'masivo'
WHERE registration_origin = 'formulario'
  AND email ILIKE '%.import@import.opalo'
  AND email NOT ILIKE '%tally@%';

UPDATE candidates
SET registration_origin = 'masivo'
WHERE registration_origin = 'formulario'
  AND email ILIKE 'sin-email.%@import.opalo'
  AND email NOT ILIKE '%.manual@%'
  AND email NOT ILIKE '%tally@%';

-- 2. Formulario (Tally / postulaciones)
UPDATE candidates
SET registration_origin = 'formulario'
WHERE registration_origin IS NULL
  AND (
    email ILIKE '%tally@import%'
    OR email ILIKE '%.tally@import.opalo'
    OR first_application_at IS NOT NULL
    OR (application_count IS NOT NULL AND application_count > 0)
  );

-- 3. Manual (fila añadida — historial de actividad)
UPDATE candidates c
SET registration_origin = 'manual'
FROM bulk_process_activity_log l
WHERE c.id = l.candidate_id
  AND c.registration_origin IS NULL
  AND l.action_type = 'add_row'
  AND l.app_name = c.app_name;

-- 4. Manual (email placeholder explícito)
UPDATE candidates
SET registration_origin = 'manual'
WHERE registration_origin IS NULL
  AND email ILIKE '%.manual@import.opalo';

-- 5. Carga masiva (import Excel / placeholder import)
UPDATE candidates
SET registration_origin = 'masivo'
WHERE registration_origin IS NULL
  AND (
    email ILIKE '%.import@import.opalo'
    OR (
      email ILIKE 'sin-email.%@import.opalo'
      AND email NOT ILIKE '%.manual@%'
      AND email NOT ILIKE '%tally@%'
    )
  );

-- 6. Resto con created_by (alta por reclutador, típico Excel sin placeholder)
UPDATE candidates
SET registration_origin = 'masivo'
WHERE registration_origin IS NULL
  AND created_by IS NOT NULL;

-- Resumen por proceso (opcional: filtrar por título del proceso)
SELECT
  p.title AS proceso,
  c.registration_origin,
  COUNT(*) AS total
FROM candidates c
JOIN processes p ON p.id = c.process_id
WHERE c.app_name = 'Opalopy'
  AND c.archived = false
  AND c.discarded = false
GROUP BY p.title, c.registration_origin
ORDER BY p.title, c.registration_origin;
