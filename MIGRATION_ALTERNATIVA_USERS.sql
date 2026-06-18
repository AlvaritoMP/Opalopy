-- Alternativa: Usar IF NOT EXISTS de forma más explícita
-- Si esto también da timeout, puede ser un problema de conexión o bloqueo

-- Primero verifica si existe
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'app_name';

-- Si no devuelve nada, entonces ejecuta esto:
-- ALTER TABLE users ADD COLUMN app_name TEXT;

