-- Contador de postulaciones por formulario (Tally) para el mismo candidato en un proceso

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS application_count INTEGER NOT NULL DEFAULT 1;

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS first_application_at TIMESTAMPTZ;

COMMENT ON COLUMN candidates.application_count IS
'Número de veces que el candidato envió el formulario de postulación en este proceso.';

COMMENT ON COLUMN candidates.first_application_at IS
'Fecha de la primera postulación; created_at refleja la última postulación tras reenvíos.';

UPDATE candidates
SET first_application_at = created_at
WHERE first_application_at IS NULL AND created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_application_count
ON candidates (process_id, application_count DESC)
WHERE application_count > 1;
