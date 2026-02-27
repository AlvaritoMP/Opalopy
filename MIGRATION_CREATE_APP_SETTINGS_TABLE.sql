-- ============================================
-- MIGRACIÓN: Crear tabla app_settings si no existe
-- ============================================
-- 
-- Este script crea la tabla app_settings necesaria para almacenar
-- la configuración de cada aplicación (Opalopy y Opalo ATS)
--
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en Supabase (https://supabase.com)
-- 2. Abre el SQL Editor
-- 3. Copia y pega este script completo
-- 4. Ejecuta el script (botón "Run")
-- ============================================

-- Crear tabla app_settings si no existe
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000',
    app_name TEXT NOT NULL,
    database_config JSONB,
    file_storage_config JSONB,
    google_drive_config JSONB,
    currency_symbol TEXT DEFAULT '$',
    app_name_display TEXT,
    logo_url TEXT,
    powered_by_logo_url TEXT,
    custom_labels JSONB,
    dashboard_layout JSONB,
    templates JSONB,
    report_theme JSONB,
    candidate_sources JSONB,
    provinces JSONB,
    districts JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(id, app_name)
);

-- Crear índice para búsquedas por app_name
CREATE INDEX IF NOT EXISTS idx_app_settings_app_name ON app_settings(app_name);

-- Comentarios descriptivos
COMMENT ON TABLE app_settings IS 'Configuración de cada aplicación (Opalopy, Opalo ATS, etc.)';
COMMENT ON COLUMN app_settings.id IS 'ID único del registro de settings (mismo ID para todas las apps, diferenciadas por app_name)';
COMMENT ON COLUMN app_settings.app_name IS 'Nombre de la aplicación (Opalopy, Opalo ATS, etc.)';
COMMENT ON COLUMN app_settings.candidate_sources IS 'Array de strings con las fuentes de candidatos personalizadas (ej: ["LinkedIn", "Referencia", "Sitio web", "Otro"])';

-- Verificar que la tabla se creó correctamente
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'app_settings'
ORDER BY ordinal_position;
