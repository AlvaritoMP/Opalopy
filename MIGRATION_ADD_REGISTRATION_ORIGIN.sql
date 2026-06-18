-- ============================================
-- MIGRACIÓN: Origen de alta del trabajador en proceso masivo
-- ============================================
-- Valores: formulario | manual | masivo
--
-- INSTRUCCIONES:
-- 1. Supabase → SQL Editor
-- 2. Ejecutar este script completo
-- ============================================

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS registration_origin TEXT;

ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_registration_origin_check;
ALTER TABLE candidates ADD CONSTRAINT candidates_registration_origin_check
    CHECK (registration_origin IS NULL OR registration_origin IN ('formulario', 'manual', 'masivo'));

COMMENT ON COLUMN candidates.registration_origin IS
'Origen de incorporación al proceso: formulario (Tally), manual (fila individual), masivo (import Excel/CSV).';

CREATE INDEX IF NOT EXISTS idx_candidates_registration_origin
ON candidates (registration_origin)
WHERE registration_origin IS NOT NULL;

-- Heurística inicial (solo Tally / postulaciones — no usar @import.opalo genérico)
UPDATE candidates
SET registration_origin = 'formulario'
WHERE registration_origin IS NULL
  AND (
    email ILIKE '%tally@import%'
    OR email ILIKE '%.tally@import.opalo'
    OR first_application_at IS NOT NULL
    OR (application_count IS NOT NULL AND application_count > 0)
  );

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'candidates'
  AND column_name = 'registration_origin';
