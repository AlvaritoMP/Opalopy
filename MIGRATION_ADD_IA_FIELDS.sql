-- ============================================
-- MIGRACIÓN: Agregar campos de IA a candidates
-- ============================================
-- 
-- Este script agrega los campos metadata_ia y score_ia
-- a la tabla candidates para la funcionalidad de Procesos Masivos.
--
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en Supabase (https://supabase.com)
-- 2. Abre el SQL Editor
-- 3. Copia y pega este script completo
-- 4. Ejecuta el script (botón "Run")
--
-- NOTA: Este script es seguro de ejecutar múltiples veces gracias a "IF NOT EXISTS"
-- ============================================

-- Agregar campos de IA
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS metadata_ia TEXT,
ADD COLUMN IF NOT EXISTS score_ia NUMERIC(5, 2);

-- Comentarios descriptivos para las columnas
COMMENT ON COLUMN candidates.metadata_ia IS 'Resumen/metadata generado por IA (OpenAI) para el candidato. Se muestra en tooltip en la vista de Procesos Masivos.';
COMMENT ON COLUMN candidates.score_ia IS 'Score/puntuación generado por IA para el candidato. Valor numérico entre 0 y 100.';

-- Crear índice para búsquedas por score_ia (opcional, para ordenamiento rápido)
CREATE INDEX IF NOT EXISTS idx_candidates_score_ia ON candidates(score_ia DESC) WHERE score_ia IS NOT NULL;

-- Verificar que las columnas se crearon correctamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'candidates' 
  AND column_name IN ('metadata_ia', 'score_ia');
