-- Migración: Agregar campo hired_candidate_ids para almacenar candidatos contratados al cerrar proceso
-- Ejecutar en Supabase SQL Editor

-- Agregar columna hired_candidate_ids a la tabla processes
ALTER TABLE processes 
ADD COLUMN IF NOT EXISTS hired_candidate_ids TEXT[] DEFAULT '{}';

-- Agregar columna closed_at para registrar fecha de cierre
ALTER TABLE processes 
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Agregar índice para búsquedas por candidatos contratados
CREATE INDEX IF NOT EXISTS idx_processes_hired_candidates ON processes USING GIN (hired_candidate_ids);

COMMENT ON COLUMN processes.hired_candidate_ids IS 'Array de IDs de candidatos contratados al cerrar el proceso';
COMMENT ON COLUMN processes.closed_at IS 'Fecha y hora en que se cerró el proceso';
