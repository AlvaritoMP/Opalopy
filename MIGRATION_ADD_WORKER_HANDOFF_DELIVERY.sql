-- ============================================
-- MIGRACIÓN: Estado de entrega ATS → OpsFlow
-- ============================================
-- Ejecutar en Supabase compartida (Opalo ATS + Opalopy)
-- después de MIGRATION_ADD_WORKER_HANDOFF.sql
-- ============================================

ALTER TABLE worker_handoff_packages
ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'delivered', 'failed')),
ADD COLUMN IF NOT EXISTS opsflow_package_id UUID,
ADD COLUMN IF NOT EXISTS delivery_error TEXT,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

COMMENT ON COLUMN worker_handoff_packages.delivery_status IS
'pending = guardado local, entrega a OpsFlow en curso o pendiente; delivered = recibido por OpsFlow; failed = error al entregar';

CREATE INDEX IF NOT EXISTS idx_worker_handoff_packages_delivery_status
ON worker_handoff_packages (source_app, delivery_status, sent_at DESC);

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'worker_handoff_packages'
  AND column_name IN ('delivery_status', 'opsflow_package_id', 'delivery_error', 'delivered_at')
ORDER BY column_name;
