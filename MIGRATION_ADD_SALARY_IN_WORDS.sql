-- ============================================
-- MIGRACIÓN: Agregar columna agreed_salary_in_words a candidates
-- ============================================
-- 
-- Este script agrega la columna agreed_salary_in_words a la tabla candidates
-- para almacenar el salario acordado transcrito en letras.
-- Este campo se genera automáticamente cuando se guarda o actualiza el salario acordado.
--
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en Supabase (https://supabase.com)
-- 2. Abre el SQL Editor
-- 3. Copia y pega este script completo
-- 4. Ejecuta el script (botón "Run")
--
-- NOTA: Este script es seguro de ejecutar múltiples veces gracias a "IF NOT EXISTS"
-- ============================================

-- Agregar columna agreed_salary_in_words a la tabla candidates
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS agreed_salary_in_words TEXT;

-- Comentario descriptivo para la columna
COMMENT ON COLUMN candidates.agreed_salary_in_words IS 'Salario acordado transcrito en letras (formato peruano: "Dos mil quinientos y 00/100 soles"). Se genera automáticamente cuando se guarda o actualiza el campo agreed_salary. Disponible para uso en plantillas de cartas y formularios con la variable {{Salarioacordadoletras}}.';

-- Verificar que la columna se creó correctamente
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'candidates' 
  AND column_name = 'agreed_salary_in_words';

-- Mostrar mensaje de éxito
DO $$
BEGIN
    RAISE NOTICE '✅ Migración completada. La columna agreed_salary_in_words ha sido agregada a la tabla candidates.';
END $$;

