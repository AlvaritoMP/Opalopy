-- Actualizar valores por defecto para registros existentes
-- Ejecuta esto DESPUÉS de agregar todas las columnas
-- Ejecuta cada UPDATE por separado si hay problemas de timeout

-- Actualizar users (ejecuta por separado si hay muchos registros)
UPDATE users 
SET app_name = 'Opalopy' 
WHERE app_name IS NULL
LIMIT 10000;

-- Actualizar processes
UPDATE processes 
SET app_name = 'Opalopy' 
WHERE app_name IS NULL
LIMIT 10000;

-- Actualizar candidates
UPDATE candidates 
SET app_name = 'Opalopy' 
WHERE app_name IS NULL
LIMIT 10000;

-- Actualizar form_integrations
UPDATE form_integrations 
SET app_name = 'Opalopy' 
WHERE app_name IS NULL
LIMIT 10000;

-- Actualizar app_settings
UPDATE app_settings 
SET app_name = 'Opalopy' 
WHERE app_name IS NULL
LIMIT 10000;

