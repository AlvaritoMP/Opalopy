-- =============================================================================
-- Fix: mismo email en Opalo ATS y Opalopy (error 409 al crear usuario)
--
-- Antes: UNIQUE(email) → un solo registro por correo en toda la BD.
-- Después: UNIQUE(lower(email), app_name) → un registro por correo POR app.
--
-- Ejecutar TODO en Supabase → SQL Editor (una vez), luego crear el usuario de nuevo.
-- =============================================================================

-- 1) Quitar restricciones UNIQUE antiguas solo sobre email
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND t.relname = 'users'
          AND c.contype = 'u'
          AND pg_get_constraintdef(c.oid) ILIKE '%email%'
          AND pg_get_constraintdef(c.oid) NOT ILIKE '%app_name%'
    LOOP
        EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT IF EXISTS %I', r.conname);
        RAISE NOTICE 'Dropped constraint %', r.conname;
    END LOOP;
END $$;

-- 2) Quitar índices UNIQUE antiguos solo sobre email
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'users'
          AND indexdef ILIKE '%UNIQUE%'
          AND indexdef ILIKE '%email%'
          AND indexdef NOT ILIKE '%app_name%'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indexname);
        RAISE NOTICE 'Dropped index %', r.indexname;
    END LOOP;
END $$;

DROP INDEX IF EXISTS public.users_email_key;
DROP INDEX IF EXISTS public.idx_users_email_unique;
DROP INDEX IF EXISTS public.users_email_app_name_unique;

-- 3) Asegurar app_name en filas legacy (Opalopy u otras)
UPDATE public.users
SET app_name = 'Opalopy'
WHERE app_name IS NULL OR trim(app_name) = '';

-- 4) Unicidad por app + email (case-insensitive)
CREATE UNIQUE INDEX users_email_app_name_unique
    ON public.users (lower(trim(email)), app_name);

COMMENT ON INDEX public.users_email_app_name_unique IS
    'Un email puede existir en Opalo ATS y en Opalopy por separado';

NOTIFY pgrst, 'reload schema';

-- 5) Verificación: mismo email en dos apps debe ser posible
SELECT email, app_name, name, role
FROM public.users
WHERE lower(trim(email)) = lower(trim('operacionesrys2@opaloservicios.com'))
ORDER BY app_name;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'users'
  AND indexname = 'users_email_app_name_unique';
