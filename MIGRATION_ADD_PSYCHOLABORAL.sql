-- ============================================
-- MIGRACIÓN: Informes psicolaborales
-- ============================================
-- Inventario global en app_settings y evaluación por candidato.

ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS psycholaboral_inventory JSONB DEFAULT NULL;

COMMENT ON COLUMN app_settings.psycholaboral_inventory IS
'Inventario de niveles intelectuales, rasgos de personalidad, sets de competencias y plantillas de conclusión para informes psicolaborales.';

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS psycholaboral_evaluation JSONB DEFAULT NULL;

COMMENT ON COLUMN candidates.psycholaboral_evaluation IS
'Evaluación psicolaboral del candidato: nivel intelectual, personalidad, competencias y conclusiones.';

CREATE INDEX IF NOT EXISTS idx_candidates_psycholaboral_evaluation
ON candidates USING GIN (psycholaboral_evaluation)
WHERE psycholaboral_evaluation IS NOT NULL;
