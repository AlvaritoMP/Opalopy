-- ============================================
-- MIGRACIÓN: Agregar soporte para Procesos Masivos
-- ============================================
-- 
-- Este script agrega el campo is_bulk_process a la tabla processes
-- para diferenciar procesos masivos de procesos normales.
--
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en Supabase (https://supabase.com)
-- 2. Abre el SQL Editor
-- 3. Copia y pega este script completo
-- 4. Ejecuta el script (botón "Run")
--
-- NOTA: Este script es seguro de ejecutar múltiples veces gracias a "IF NOT EXISTS"
-- ============================================

-- Agregar campo is_bulk_process a la tabla processes
ALTER TABLE processes 
ADD COLUMN IF NOT EXISTS is_bulk_process BOOLEAN DEFAULT false;

-- Comentario descriptivo para la columna
COMMENT ON COLUMN processes.is_bulk_process IS 'Indica si este proceso es un proceso masivo. Los procesos masivos se gestionan en la sección "Procesos Masivos" y no aparecen en la vista normal de procesos.';

-- Crear índice para búsquedas rápidas de procesos masivos
CREATE INDEX IF NOT EXISTS idx_processes_is_bulk_process ON processes(is_bulk_process) WHERE is_bulk_process = true;

-- Verificar que la columna se creó correctamente
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'processes' 
  AND column_name = 'is_bulk_process';
