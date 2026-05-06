-- ============================================
-- MIGRACIÓN: Agregar configuración para Procesos Masivos
-- ============================================
-- 
-- Este script agrega campos de configuración a la tabla processes
-- para procesos masivos: killer questions, prompt de IA, score threshold, etc.
--
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en Supabase (https://supabase.com)
-- 2. Abre el SQL Editor
-- 3. Copia y pega este script completo
-- 4. Ejecuta el script (botón "Run")
--
-- NOTA: Este script es seguro de ejecutar múltiples veces gracias a "IF NOT EXISTS"
-- ============================================

-- Agregar campos de configuración para procesos masivos
ALTER TABLE processes 
ADD COLUMN IF NOT EXISTS bulk_config JSONB DEFAULT '{}'::jsonb;

-- Comentario descriptivo
COMMENT ON COLUMN processes.bulk_config IS 'Configuración específica para procesos masivos: killer questions, prompt de IA, score threshold, WhatsApp, etc.';

-- Crear índice GIN para búsquedas rápidas en JSONB
CREATE INDEX IF NOT EXISTS idx_processes_bulk_config ON processes USING GIN (bulk_config) WHERE is_bulk_process = true;

-- Verificar que la columna se creó correctamente
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'processes' 
  AND column_name = 'bulk_config';
