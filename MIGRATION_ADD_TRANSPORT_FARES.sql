-- Tarifas editables de transporte público (estimación de costos de ruta)
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS transport_fares JSONB;

COMMENT ON COLUMN app_settings.transport_fares IS
'Tarifas aproximadas por tipo de transporte público en Lima Metropolitana, usadas al calcular costos de ruta en procesos masivos.';
