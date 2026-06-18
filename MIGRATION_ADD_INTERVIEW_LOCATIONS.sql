-- ============================================
-- MIGRACIÓN: Sedes de entrevista para rutas en transporte público
-- ============================================
--
-- Guarda en app_settings los puntos de destino configurables
-- para generar enlaces de ruta en procesos normales.
--
-- INSTRUCCIONES:
-- 1. Supabase → SQL Editor
-- 2. Ejecutar este script completo
-- ============================================

ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS interview_locations JSONB;

COMMENT ON COLUMN app_settings.interview_locations IS
'Array JSON de sedes de entrevista: [{ "id": "...", "name": "...", "address": "..." }] para rutas en Google Maps.';

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'app_settings'
  AND column_name = 'interview_locations';
