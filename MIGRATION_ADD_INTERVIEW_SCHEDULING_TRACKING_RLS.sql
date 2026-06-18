-- RLS para seguimiento de agendamiento (ejecutar tras MIGRATION_ADD_INTERVIEW_SCHEDULING_TRACKING.sql)

ALTER TABLE public.interview_scheduling_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_scheduling_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "interview_scheduling_cycles_public_select_opalo_ats" ON public.interview_scheduling_cycles;
DROP POLICY IF EXISTS "interview_scheduling_cycles_public_insert_opalo_ats" ON public.interview_scheduling_cycles;
DROP POLICY IF EXISTS "interview_scheduling_cycles_public_update_opalo_ats" ON public.interview_scheduling_cycles;
DROP POLICY IF EXISTS "interview_scheduling_cycles_public_delete_opalo_ats" ON public.interview_scheduling_cycles;

CREATE POLICY "interview_scheduling_cycles_public_select_opalo_ats"
ON public.interview_scheduling_cycles AS PERMISSIVE FOR SELECT TO public
USING (app_name = 'Opalopy');

CREATE POLICY "interview_scheduling_cycles_public_insert_opalo_ats"
ON public.interview_scheduling_cycles AS PERMISSIVE FOR INSERT TO public
WITH CHECK (app_name = 'Opalopy');

CREATE POLICY "interview_scheduling_cycles_public_update_opalo_ats"
ON public.interview_scheduling_cycles AS PERMISSIVE FOR UPDATE TO public
USING (app_name = 'Opalopy') WITH CHECK (app_name = 'Opalopy');

CREATE POLICY "interview_scheduling_cycles_public_delete_opalo_ats"
ON public.interview_scheduling_cycles AS PERMISSIVE FOR DELETE TO public
USING (app_name = 'Opalopy');

DROP POLICY IF EXISTS "interview_scheduling_log_public_select_opalo_ats" ON public.interview_scheduling_log;
DROP POLICY IF EXISTS "interview_scheduling_log_public_insert_opalo_ats" ON public.interview_scheduling_log;
DROP POLICY IF EXISTS "interview_scheduling_log_public_update_opalo_ats" ON public.interview_scheduling_log;
DROP POLICY IF EXISTS "interview_scheduling_log_public_delete_opalo_ats" ON public.interview_scheduling_log;

CREATE POLICY "interview_scheduling_log_public_select_opalo_ats"
ON public.interview_scheduling_log AS PERMISSIVE FOR SELECT TO public
USING (app_name = 'Opalopy');

CREATE POLICY "interview_scheduling_log_public_insert_opalo_ats"
ON public.interview_scheduling_log AS PERMISSIVE FOR INSERT TO public
WITH CHECK (app_name = 'Opalopy');

CREATE POLICY "interview_scheduling_log_public_update_opalo_ats"
ON public.interview_scheduling_log AS PERMISSIVE FOR UPDATE TO public
USING (app_name = 'Opalopy') WITH CHECK (app_name = 'Opalopy');

CREATE POLICY "interview_scheduling_log_public_delete_opalo_ats"
ON public.interview_scheduling_log AS PERMISSIVE FOR DELETE TO public
USING (app_name = 'Opalopy');

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.interview_scheduling_cycles TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.interview_scheduling_log TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
