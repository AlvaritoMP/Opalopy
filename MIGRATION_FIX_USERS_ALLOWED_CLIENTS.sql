-- Columna allowed_client_ids + recarga de esquema PostgREST
-- Sin esto, crear usuarios desde la app puede fallar (PGRST204) o guardarse mal.
-- Ejecutar en Supabase → SQL Editor

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS allowed_client_ids UUID[] DEFAULT NULL;

COMMENT ON COLUMN public.users.allowed_client_ids IS
    'Clientes permitidos para el usuario. NULL = sin restricción por cliente.';

-- Si un usuario apareció al crearlo y desapareció al refrescar, corregir su app_name:
-- UPDATE public.users SET app_name = 'Opalo ATS' WHERE email = 'correo@ejemplo.com';

NOTIFY pgrst, 'reload schema';
