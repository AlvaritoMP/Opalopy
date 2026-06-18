-- ============================================
-- Plantillas de tabla compartidas (procesos masivos)
-- Visibles para todos los usuarios de Opalopy
-- ============================================

CREATE TABLE IF NOT EXISTS public.bulk_table_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    layout JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    app_name TEXT NOT NULL
);

COMMENT ON TABLE public.bulk_table_templates IS
'Plantillas de columnas para tablas de procesos masivos, compartidas entre usuarios de la app.';

COMMENT ON COLUMN public.bulk_table_templates.layout IS
'JSON: columns, columnOrder, hiddenColumns, pinnedColumns, columnWidths';

CREATE INDEX IF NOT EXISTS idx_bulk_table_templates_app_created
ON public.bulk_table_templates (app_name, created_at DESC);

ALTER TABLE public.bulk_table_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bulk_table_templates_public_select_opalo_ats ON public.bulk_table_templates;
DROP POLICY IF EXISTS bulk_table_templates_public_insert_opalo_ats ON public.bulk_table_templates;
DROP POLICY IF EXISTS bulk_table_templates_public_update_opalo_ats ON public.bulk_table_templates;
DROP POLICY IF EXISTS bulk_table_templates_public_delete_opalo_ats ON public.bulk_table_templates;

CREATE POLICY bulk_table_templates_public_select_opalo_ats
ON public.bulk_table_templates AS PERMISSIVE FOR SELECT TO public
USING (app_name = 'Opalopy');

CREATE POLICY bulk_table_templates_public_insert_opalo_ats
ON public.bulk_table_templates AS PERMISSIVE FOR INSERT TO public
WITH CHECK (app_name = 'Opalopy');

CREATE POLICY bulk_table_templates_public_update_opalo_ats
ON public.bulk_table_templates AS PERMISSIVE FOR UPDATE TO public
USING (app_name = 'Opalopy') WITH CHECK (app_name = 'Opalopy');

CREATE POLICY bulk_table_templates_public_delete_opalo_ats
ON public.bulk_table_templates AS PERMISSIVE FOR DELETE TO public
USING (app_name = 'Opalopy');

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bulk_table_templates TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
