-- RLS para worker_handoff_* (ejecutar después de MIGRATION_ADD_WORKER_HANDOFF.sql)
-- Opalopy: crear y consultar sus envíos
-- OpsFlow: leer y actualizar paquetes dirigidos a OpsFlow

ALTER TABLE public.worker_handoff_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_handoff_items ENABLE ROW LEVEL SECURITY;

-- ---------- worker_handoff_packages — Opalopy ----------

DROP POLICY IF EXISTS "worker_handoff_packages_select_opalo_ats" ON public.worker_handoff_packages;
DROP POLICY IF EXISTS "worker_handoff_packages_insert_opalo_ats" ON public.worker_handoff_packages;
DROP POLICY IF EXISTS "worker_handoff_packages_update_opalo_ats" ON public.worker_handoff_packages;

CREATE POLICY "worker_handoff_packages_select_opalo_ats"
ON public.worker_handoff_packages AS PERMISSIVE FOR SELECT TO public
USING (source_app = 'Opalopy');

CREATE POLICY "worker_handoff_packages_insert_opalo_ats"
ON public.worker_handoff_packages AS PERMISSIVE FOR INSERT TO public
WITH CHECK (source_app = 'Opalopy' AND target_app = 'OpsFlow');

CREATE POLICY "worker_handoff_packages_update_opalo_ats"
ON public.worker_handoff_packages AS PERMISSIVE FOR UPDATE TO public
USING (source_app = 'Opalopy')
WITH CHECK (source_app = 'Opalopy');

-- ---------- worker_handoff_packages — OpsFlow ----------

DROP POLICY IF EXISTS "worker_handoff_packages_select_opsflow" ON public.worker_handoff_packages;
DROP POLICY IF EXISTS "worker_handoff_packages_update_opsflow" ON public.worker_handoff_packages;

CREATE POLICY "worker_handoff_packages_select_opsflow"
ON public.worker_handoff_packages AS PERMISSIVE FOR SELECT TO public
USING (
    target_app = 'OpsFlow'
    AND status IN ('sent', 'received', 'processing', 'completed', 'rejected', 'partially_completed')
);

CREATE POLICY "worker_handoff_packages_update_opsflow"
ON public.worker_handoff_packages AS PERMISSIVE FOR UPDATE TO public
USING (target_app = 'OpsFlow')
WITH CHECK (target_app = 'OpsFlow');

-- ---------- worker_handoff_items — Opalopy ----------

DROP POLICY IF EXISTS "worker_handoff_items_select_opalo_ats" ON public.worker_handoff_items;
DROP POLICY IF EXISTS "worker_handoff_items_insert_opalo_ats" ON public.worker_handoff_items;

CREATE POLICY "worker_handoff_items_select_opalo_ats"
ON public.worker_handoff_items AS PERMISSIVE FOR SELECT TO public
USING (
    EXISTS (
        SELECT 1 FROM public.worker_handoff_packages p
        WHERE p.id = package_id AND p.source_app = 'Opalopy'
    )
);

CREATE POLICY "worker_handoff_items_insert_opalo_ats"
ON public.worker_handoff_items AS PERMISSIVE FOR INSERT TO public
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.worker_handoff_packages p
        WHERE p.id = package_id AND p.source_app = 'Opalopy'
    )
);

-- ---------- worker_handoff_items — OpsFlow ----------

DROP POLICY IF EXISTS "worker_handoff_items_select_opsflow" ON public.worker_handoff_items;
DROP POLICY IF EXISTS "worker_handoff_items_update_opsflow" ON public.worker_handoff_items;

CREATE POLICY "worker_handoff_items_select_opsflow"
ON public.worker_handoff_items AS PERMISSIVE FOR SELECT TO public
USING (
    EXISTS (
        SELECT 1 FROM public.worker_handoff_packages p
        WHERE p.id = package_id AND p.target_app = 'OpsFlow'
    )
);

CREATE POLICY "worker_handoff_items_update_opsflow"
ON public.worker_handoff_items AS PERMISSIVE FOR UPDATE TO public
USING (
    EXISTS (
        SELECT 1 FROM public.worker_handoff_packages p
        WHERE p.id = package_id AND p.target_app = 'OpsFlow'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.worker_handoff_packages p
        WHERE p.id = package_id AND p.target_app = 'OpsFlow'
    )
);

GRANT SELECT, INSERT, UPDATE ON TABLE public.worker_handoff_packages TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.worker_handoff_items TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
