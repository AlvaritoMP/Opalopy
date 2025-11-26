-- ============================================
-- MIGRACIÓN COMPLETA: Todas las columnas nuevas para candidates
-- ============================================
-- 
-- Este script agrega TODAS las columnas nuevas a la tabla candidates
-- que se han agregado en las últimas actualizaciones:
-- - agreed_salary: Salario acordado con el candidato
-- - agreed_salary_in_words: Salario acordado en letras (generado automáticamente)
-- - province: Provincia del candidato (UBIGEO)
-- - district: Distrito del candidato (UBIGEO)
-- - critical_stage_reviewed_at: Fecha de revisión en etapa crítica
--
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en Supabase (https://supabase.com)
-- 2. Abre el SQL Editor
-- 3. Copia y pega este script completo
-- 4. Ejecuta el script (botón "Run")
--
-- NOTA: Este script es seguro de ejecutar múltiples veces gracias a "IF NOT EXISTS"
-- ============================================

-- Agregar todas las columnas nuevas a la tabla candidates
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS agreed_salary TEXT,
ADD COLUMN IF NOT EXISTS agreed_salary_in_words TEXT,
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS district TEXT,
ADD COLUMN IF NOT EXISTS critical_stage_reviewed_at TIMESTAMPTZ;

-- Comentarios descriptivos para las columnas
COMMENT ON COLUMN candidates.agreed_salary IS 'Salario acordado con el candidato. Puede incluir símbolos de moneda y formateo.';
COMMENT ON COLUMN candidates.agreed_salary_in_words IS 'Salario acordado transcrito en letras (formato peruano: "Dos mil quinientos y 00/100 soles"). Se genera automáticamente cuando se guarda o actualiza el campo agreed_salary. Disponible para uso en plantillas de cartas y formularios con la variable {{Salarioacordadoletras}}.';
COMMENT ON COLUMN candidates.province IS 'Provincia del candidato según datos UBIGEO (ej: LIMA, AREQUIPA, CUSCO)';
COMMENT ON COLUMN candidates.district IS 'Distrito del candidato según datos UBIGEO (ej: MIRAFLORES, YANAHUARA, CUSCO). Puede quedar en blanco.';
COMMENT ON COLUMN candidates.critical_stage_reviewed_at IS 'Fecha en que un usuario revisó el candidato mientras estaba en una etapa crítica. Cuando es NULL, indica que el candidato en etapa crítica no ha sido revisado aún y debe mostrarse una alerta. Se resetea a NULL cuando el candidato se mueve a una nueva etapa crítica.';

-- Verificar que todas las columnas se crearon correctamente
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'candidates' 
  AND column_name IN ('agreed_salary', 'agreed_salary_in_words', 'province', 'district', 'critical_stage_reviewed_at')
ORDER BY column_name;

-- Mostrar mensaje de éxito
DO $$
BEGIN
    RAISE NOTICE '✅ Migración completada. Todas las columnas nuevas han sido agregadas a la tabla candidates.';
END $$;

