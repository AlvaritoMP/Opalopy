-- =============================================================================
-- Fix DEFINITIVO: usuarios (tabla `users`) — INSERT falla / usuarios no persisten
--
-- Síntoma en la app: el usuario aparece al crearlo pero desaparece al recargar.
-- Causa típica: el INSERT en Supabase falla (RLS o GRANT) y la app guarda
-- un usuario temporal solo en memoria (id tipo user-173...).
--
-- Ejecutar TODO este script en Supabase → SQL Editor (una vez).
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
    ) THEN
        RAISE EXCEPTION 'No existe public.users.';
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO service_role;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users'
          AND policyname = 'users_public_select_opalo_ats'
    ) THEN
        CREATE POLICY "users_public_select_opalo_ats"
        ON public.users AS PERMISSIVE FOR SELECT TO public
        USING (app_name = 'Opalopy');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users'
          AND policyname = 'users_public_insert_opalo_ats'
    ) THEN
        CREATE POLICY "users_public_insert_opalo_ats"
        ON public.users AS PERMISSIVE FOR INSERT TO public
        WITH CHECK (app_name = 'Opalopy');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users'
          AND policyname = 'users_public_update_opalo_ats'
    ) THEN
        CREATE POLICY "users_public_update_opalo_ats"
        ON public.users AS PERMISSIVE FOR UPDATE TO public
        USING (app_name = 'Opalopy')
        WITH CHECK (app_name = 'Opalopy');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users'
          AND policyname = 'users_public_delete_opalo_ats'
    ) THEN
        CREATE POLICY "users_public_delete_opalo_ats"
        ON public.users AS PERMISSIVE FOR DELETE TO public
        USING (app_name = 'Opalopy');
    END IF;
END $$;

-- Columna usada por el editor de usuarios (restricción por cliente)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS allowed_client_ids UUID[] DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
