-- Agregar columna allowed_client_ids a la tabla users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS allowed_client_ids UUID[] DEFAULT NULL;

COMMENT ON COLUMN users.allowed_client_ids IS 'Array de IDs de clientes a los que tiene acceso el usuario. Si es NULL o vacío, tiene acceso a todos si su rol lo permite.';
