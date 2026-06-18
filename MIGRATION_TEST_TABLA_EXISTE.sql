-- Verificar si la tabla users existe (sin tocar información_schema)
SELECT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users'
) as users_exists;

