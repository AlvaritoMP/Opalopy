-- Migración: Agregar campos para candidatos descartados
-- Ejecutar en Supabase SQL Editor

-- Agregar columnas para descartar candidatos
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS discarded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS discard_reason TEXT,
ADD COLUMN IF NOT EXISTS discarded_at TIMESTAMP WITH TIME ZONE;

-- Crear índice para búsquedas rápidas de candidatos descartados
CREATE INDEX IF NOT EXISTS idx_candidates_discarded ON candidates(discarded) WHERE discarded = TRUE;

-- Verificar que las columnas se crearon correctamente
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'candidates' 
  AND column_name IN ('discarded', 'discard_reason', 'discarded_at');

