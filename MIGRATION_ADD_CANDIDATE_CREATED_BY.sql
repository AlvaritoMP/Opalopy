-- Migración: agregar responsable/usuario creador a candidatos
-- Base compartida: no modifica datos existentes ni cambia app_name.

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS created_by TEXT;

COMMENT ON COLUMN candidates.created_by IS 'ID del usuario que creó o figura como creador/responsable inicial del candidato.';

CREATE INDEX IF NOT EXISTS idx_candidates_created_by
ON candidates(created_by)
WHERE created_by IS NOT NULL;
