-- ============================================
-- MIGRACIÓN: Agregar columnas a app_settings para fuentes, provincias y distritos
-- ============================================
-- 
-- Este script agrega las columnas necesarias a la tabla app_settings para:
-- - candidate_sources: Fuentes de candidatos personalizadas
-- - provinces: Provincias personalizadas
-- - districts: Distritos personalizados (organizados por provincia)
--
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en Supabase (https://supabase.com)
-- 2. Abre el SQL Editor
-- 3. Copia y pega este script completo
-- 4. Ejecuta el script (botón "Run")
--
-- NOTA: Este script es seguro de ejecutar múltiples veces gracias a "IF NOT EXISTS"
-- ============================================

-- Agregar columna candidate_sources (fuentes de candidatos)
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS candidate_sources JSONB;

-- Agregar columna provinces (provincias)
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS provinces JSONB;

-- Agregar columna districts (distritos, organizados por provincia)
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS districts JSONB;

-- Comentarios descriptivos para las columnas
COMMENT ON COLUMN app_settings.candidate_sources IS 'Array de strings con las fuentes de candidatos personalizadas (ej: ["LinkedIn", "Referencia", "Sitio web", "Otro"]).';
COMMENT ON COLUMN app_settings.provinces IS 'Array de strings con las provincias personalizadas disponibles para candidatos.';
COMMENT ON COLUMN app_settings.districts IS 'Objeto JSON con los distritos organizados por provincia (ej: {"LIMA": ["MIRAFLORES", "SAN ISIDRO"], "AREQUIPA": ["YANAHUARA"]}).';

-- Verificar que las columnas se crearon correctamente
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'app_settings' 
  AND column_name IN ('candidate_sources', 'provinces', 'districts')
ORDER BY column_name;

-- Mostrar mensaje de éxito
DO $$
BEGIN
    RAISE NOTICE '✅ Migración completada. Las columnas candidate_sources, provinces y districts han sido agregadas a la tabla app_settings.';
END $$;

