-- ============================================
-- MIGRACIÓN: Agregar campo de última interacción por WhatsApp
-- ============================================
-- Este script agrega el campo last_whatsapp_interaction_at a la tabla candidates
-- para rastrear cuándo fue la última vez que se interactuó con un candidato vía WhatsApp
--
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en Supabase (https://supabase.com)
-- 2. Abre el SQL Editor
-- 3. Copia y pega este script completo
-- 4. Ejecuta el script (botón "Run")
--
-- NOTA: Este script es seguro de ejecutar múltiples veces gracias a "IF NOT EXISTS"
-- ============================================

-- Agregar columna para rastrear última interacción por WhatsApp
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS last_whatsapp_interaction_at TIMESTAMPTZ;

-- Comentario descriptivo para la columna
COMMENT ON COLUMN candidates.last_whatsapp_interaction_at IS 'Fecha y hora de la última interacción con el candidato vía WhatsApp. Se actualiza automáticamente cuando se hace clic en el botón de WhatsApp en la vista de procesos masivos.';

-- Crear índice para mejorar consultas de ordenamiento por última interacción
CREATE INDEX IF NOT EXISTS idx_candidates_last_whatsapp_interaction 
ON candidates(last_whatsapp_interaction_at DESC NULLS LAST);

-- Verificar que la columna se creó correctamente
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'candidates' 
AND column_name = 'last_whatsapp_interaction_at';
