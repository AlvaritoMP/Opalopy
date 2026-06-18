-- RLS para candidate_contact_attempts (ejecutar después de MIGRATION_ADD_CONTACT_TRACKING.sql)

ALTER TABLE public.candidate_contact_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "candidate_contact_attempts_public_select_opalo_ats" ON public.candidate_contact_attempts;
DROP POLICY IF EXISTS "candidate_contact_attempts_public_insert_opalo_ats" ON public.candidate_contact_attempts;
DROP POLICY IF EXISTS "candidate_contact_attempts_public_update_opalo_ats" ON public.candidate_contact_attempts;
DROP POLICY IF EXISTS "candidate_contact_attempts_public_delete_opalo_ats" ON public.candidate_contact_attempts;

CREATE POLICY "candidate_contact_attempts_public_select_opalo_ats"
ON public.candidate_contact_attempts AS PERMISSIVE FOR SELECT TO public
USING (app_name = 'Opalopy');

CREATE POLICY "candidate_contact_attempts_public_insert_opalo_ats"
ON public.candidate_contact_attempts AS PERMISSIVE FOR INSERT TO public
WITH CHECK (app_name = 'Opalopy');

CREATE POLICY "candidate_contact_attempts_public_update_opalo_ats"
ON public.candidate_contact_attempts AS PERMISSIVE FOR UPDATE TO public
USING (app_name = 'Opalopy') WITH CHECK (app_name = 'Opalopy');

CREATE POLICY "candidate_contact_attempts_public_delete_opalo_ats"
ON public.candidate_contact_attempts AS PERMISSIVE FOR DELETE TO public
USING (app_name = 'Opalopy');

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.candidate_contact_attempts TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
