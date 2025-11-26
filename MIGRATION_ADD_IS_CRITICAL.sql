-- ============================================
-- MIGRACIÓN: Agregar columna is_critical a stages
-- ============================================
-- 
-- Este script agrega la columna is_critical a la tabla stages
-- para habilitar la funcionalidad de etapas críticas.
--
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en Supabase (https://supabase.com)
-- 2. Abre el SQL Editor
-- 3. Copia y pega este script completo
-- 4. Ejecuta el script (botón "Run")
--
-- ============================================

-- Agregar columna is_critical a la tabla stages
ALTER TABLE stages 
ADD COLUMN IF NOT EXISTS is_critical BOOLEAN DEFAULT FALSE;

-- Comentario descriptivo para la columna
COMMENT ON COLUMN stages.is_critical IS 'Indica si esta etapa es crítica y requiere atención. Cuando hay candidatos en etapas críticas, se mostrará una alerta en la lista de procesos.';

-- Verificar que la columna se creó correctamente
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'stages' 
  AND column_name = 'is_critical';

-- Opcional: Actualizar stages existentes para que todos sean no críticos por defecto
-- (Esto es solo por si acaso, ya que DEFAULT FALSE debería manejar esto)
UPDATE stages 
SET is_critical = FALSE 
WHERE is_critical IS NULL;

