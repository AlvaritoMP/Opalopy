-- ============================================
-- MIGRACIÓN: Agregar columnas province y district
-- ============================================
-- 
-- Este script agrega las columnas province y district a la tabla candidates
-- para habilitar la funcionalidad de ubicaciones UBIGEO (provincia y distrito).
--
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en Supabase (https://supabase.com)
-- 2. Abre el SQL Editor
-- 3. Copia y pega este script completo
-- 4. Ejecuta el script (botón "Run")
--
-- ============================================

-- Agregar columnas a la tabla candidates
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS district TEXT;

-- Comentarios descriptivos para las columnas
COMMENT ON COLUMN candidates.province IS 'Provincia del candidato según datos UBIGEO (ej: LIMA, AREQUIPA, CUSCO)';
COMMENT ON COLUMN candidates.district IS 'Distrito del candidato según datos UBIGEO (ej: MIRAFLORES, YANAHUARA, CUSCO). Puede quedar en blanco.';

-- Verificar que las columnas se crearon correctamente
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'candidates' 
  AND column_name IN ('province', 'district')
ORDER BY column_name;

