-- ============================================
-- MIGRACIÓN: Agregar columna color a stages
-- ============================================
--
-- Permite asignar un color a cada etapa del proceso
-- para diferenciarlas visualmente en la tabla de alta densidad.
--
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en Supabase (https://supabase.com)
-- 2. Abre el SQL Editor
-- 3. Copia y pega este script completo
-- 4. Ejecuta el script (botón "Run")
--
-- ============================================

ALTER TABLE stages
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT NULL;

COMMENT ON COLUMN stages.color IS 'Color de la etapa para identificación visual (blue, green, yellow, orange, red, purple, pink, cyan, indigo, slate).';

-- Recargar el esquema de PostgREST para que la API reconozca la columna nueva
NOTIFY pgrst, 'reload schema';

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'stages'
  AND column_name = 'color';
