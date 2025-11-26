-- ============================================
-- MIGRACIÓN: Agregar columna phone2 a candidates
-- ============================================
-- 
-- Este script agrega la columna phone2 (segundo teléfono) a la tabla candidates
--
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en Supabase (https://supabase.com)
-- 2. Abre el SQL Editor
-- 3. Copia y pega este script completo
-- 4. Ejecuta el script (botón "Run")
--
-- NOTA: Este script es seguro de ejecutar múltiples veces gracias a "IF NOT EXISTS"
-- ============================================

-- Agregar columna phone2 a la tabla candidates
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS phone2 TEXT;

-- Comentario descriptivo para la columna
COMMENT ON COLUMN candidates.phone2 IS 'Segundo número de teléfono del candidato. Campo opcional con las mismas funcionalidades que el teléfono principal (llamar, copiar, WhatsApp).';

-- Verificar que la columna se creó correctamente
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'candidates' 
  AND column_name = 'phone2';

-- Mostrar mensaje de éxito
DO $$
BEGIN
    RAISE NOTICE '✅ Migración completada. La columna phone2 ha sido agregada a la tabla candidates.';
END $$;

