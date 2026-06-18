-- ============================================
-- MIGRACIÓN: Valores de columnas personalizadas en procesos masivos
-- ============================================
-- Persiste en BD los valores de celdas custom (experiencia, f. nac., etc.)
-- para que admin, recruiters y otros usuarios vean los mismos datos.
--
-- INSTRUCCIONES:
-- 1. Supabase → SQL Editor
-- 2. Ejecutar este script completo
-- ============================================

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS bulk_column_values JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN candidates.bulk_column_values IS
'Valores de columnas personalizadas de la tabla alta densidad (procesos masivos). Clave: column_id, valor: celda.';

CREATE INDEX IF NOT EXISTS idx_candidates_bulk_column_values
ON candidates USING GIN (bulk_column_values)
WHERE bulk_column_values IS NOT NULL AND bulk_column_values <> '{}'::jsonb;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'candidates'
  AND column_name = 'bulk_column_values';
