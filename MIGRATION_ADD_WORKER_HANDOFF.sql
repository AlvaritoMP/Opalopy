-- ============================================
-- MIGRACIÓN: Canal de envío ATS → OpsFlow (paquetes de trabajadores)
-- ============================================
-- Tablas de integración entre Opalopy y OpsFlow.
-- Solo Opalopy crea envíos; OpsFlow consume y actualiza estados.
--
-- INSTRUCCIONES:
-- 1. Supabase → SQL Editor
-- 2. Ejecutar este script
-- 3. Ejecutar MIGRATION_ADD_WORKER_HANDOFF_RLS.sql
-- ============================================

CREATE TABLE IF NOT EXISTS worker_handoff_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_app TEXT NOT NULL DEFAULT 'Opalopy',
    target_app TEXT NOT NULL DEFAULT 'OpsFlow',
    status TEXT NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent', 'received', 'processing', 'completed', 'rejected', 'partially_completed')),
    worker_count INTEGER NOT NULL DEFAULT 0,
    sender_note TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_name TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    receiver_note TEXT,
    payload_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE worker_handoff_packages IS
'Paquetes de datos enviados desde Opalopy hacia OpsFlow (canal entre áreas).';

COMMENT ON COLUMN worker_handoff_packages.source_app IS 'Siempre Opalopy para envíos desde selección.';
COMMENT ON COLUMN worker_handoff_packages.target_app IS 'Siempre OpsFlow para esta integración.';
COMMENT ON COLUMN worker_handoff_packages.status IS 'sent | received | processing | completed | rejected | partially_completed';

CREATE INDEX IF NOT EXISTS idx_worker_handoff_packages_source_sent
ON worker_handoff_packages (source_app, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_worker_handoff_packages_target_status
ON worker_handoff_packages (target_app, status, sent_at DESC);

CREATE TABLE IF NOT EXISTS worker_handoff_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES worker_handoff_packages(id) ON DELETE CASCADE,
    source_candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
    source_process_id UUID REFERENCES processes(id) ON DELETE SET NULL,
    worker_name TEXT NOT NULL,
    worker_snapshot JSONB NOT NULL,
    item_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (item_status IN ('pending', 'accepted', 'rejected', 'assigned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE worker_handoff_items IS
'Trabajadores incluidos en un paquete ATS → OpsFlow (snapshot congelado al enviar).';

CREATE INDEX IF NOT EXISTS idx_worker_handoff_items_package
ON worker_handoff_items (package_id);

CREATE INDEX IF NOT EXISTS idx_worker_handoff_items_candidate
ON worker_handoff_items (source_candidate_id);

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('worker_handoff_packages', 'worker_handoff_items')
ORDER BY table_name;
