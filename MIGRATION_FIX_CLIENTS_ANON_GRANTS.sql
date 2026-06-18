-- =============================================================================
-- Fix DEFINITIVO: clientes (tabla `clients`) — 401 / permission denied en REST
--
-- Causas frecuentes (Supabase):
-- 1) Sin GRANT para `anon` / `authenticated` (Data API exige privilegios explícitos.
--    En proyectos nuevos los defaults automáticos pueden estar revocados.)
-- 2) RLS activo pero políticas solo para `anon`; las peticiones con JWT usan `authenticated`.
-- 3) Políticas con rol equivocado; `TO public` cubre ambos roles.
--
-- Ejecutar TODO este script en Supabase → SQL Editor (una vez).
-- Si falla en "tabla no existe", ejecutar antes MIGRATION_ADD_CLIENTS.sql
-- =============================================================================

-- Comprobar que la tabla existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'clients'
    ) THEN
        RAISE EXCEPTION 'No existe public.clients. Ejecute antes MIGRATION_ADD_CLIENTS.sql';
    END IF;
END $$;

-- Uso del esquema (por si en algún entorno faltara)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Privilegios de tabla (incl. service_role por si usáis scripts con esa clave)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clients TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clients TO service_role;

-- Políticas permisivas para TODOS los roles — equivalente a cubrir anon + authenticated
-- (coexisten con las políticas "TO anon" de la migración original)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients'
          AND policyname = 'clients_public_select_opalo_ats'
    ) THEN
        CREATE POLICY "clients_public_select_opalo_ats"
        ON public.clients AS PERMISSIVE FOR SELECT TO public
        USING (app_name = 'Opalopy');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients'
          AND policyname = 'clients_public_insert_opalo_ats'
    ) THEN
        CREATE POLICY "clients_public_insert_opalo_ats"
        ON public.clients AS PERMISSIVE FOR INSERT TO public
        WITH CHECK (app_name = 'Opalopy');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients'
          AND policyname = 'clients_public_update_opalo_ats'
    ) THEN
        CREATE POLICY "clients_public_update_opalo_ats"
        ON public.clients AS PERMISSIVE FOR UPDATE TO public
        USING (app_name = 'Opalopy')
        WITH CHECK (app_name = 'Opalopy');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients'
          AND policyname = 'clients_public_delete_opalo_ats'
    ) THEN
        CREATE POLICY "clients_public_delete_opalo_ats"
        ON public.clients AS PERMISSIVE FOR DELETE TO public
        USING (app_name = 'Opalopy');
    END IF;
END $$;

-- Refrescar caché de PostgREST (esquema / permisos)
NOTIFY pgrst, 'reload schema';

-- Comprobar grants (opcional: revisar resultado en el propio editor)
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public' AND table_name = 'clients'
-- ORDER BY grantee, privilege_type;
