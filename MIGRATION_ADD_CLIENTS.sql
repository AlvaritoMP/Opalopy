-- Crear tabla clients para gestionar clientes de procesos
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razon_social TEXT NOT NULL,
    ruc TEXT NOT NULL,
    app_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT clients_ruc_unique UNIQUE (ruc, app_name)
);

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_clients_app_name ON clients(app_name);
CREATE INDEX IF NOT EXISTS idx_clients_ruc ON clients(ruc);

-- Agregar columna client_id a la tabla processes
ALTER TABLE processes 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Crear índice para la relación con clientes
CREATE INDEX IF NOT EXISTS idx_processes_client_id ON processes(client_id);

-- Habilitar RLS en la tabla clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS para clients (similar a otras tablas)
-- Usar DO $$ BEGIN ... END $$ para verificar si las políticas ya existen antes de crearlas
DO $$
BEGIN
    -- Política para SELECT: permitir ver clientes de Opalopy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'clients' 
        AND policyname = 'Clients can read Opalopy data'
    ) THEN
        CREATE POLICY "Clients can read Opalopy data"
        ON public.clients FOR SELECT
        TO anon
        USING (app_name = 'Opalopy');
    END IF;

    -- Política para INSERT: permitir crear clientes de Opalopy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'clients' 
        AND policyname = 'Clients can insert Opalopy data'
    ) THEN
        CREATE POLICY "Clients can insert Opalopy data"
        ON public.clients FOR INSERT
        TO anon
        WITH CHECK (app_name = 'Opalopy');
    END IF;

    -- Política para UPDATE: permitir actualizar clientes de Opalopy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'clients' 
        AND policyname = 'Clients can update Opalopy data'
    ) THEN
        CREATE POLICY "Clients can update Opalopy data"
        ON public.clients FOR UPDATE
        TO anon
        USING (app_name = 'Opalopy')
        WITH CHECK (app_name = 'Opalopy');
    END IF;

    -- Política para DELETE: permitir eliminar clientes de Opalopy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'clients' 
        AND policyname = 'Clients can delete Opalopy data'
    ) THEN
        CREATE POLICY "Clients can delete Opalopy data"
        ON public.clients FOR DELETE
        TO anon
        USING (app_name = 'Opalopy');
    END IF;
END $$;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trigger_update_clients_updated_at'
          AND tgrelid = 'public.clients'::regclass
    ) THEN
        CREATE TRIGGER trigger_update_clients_updated_at
            BEFORE UPDATE ON clients
            FOR EACH ROW
            EXECUTE FUNCTION update_clients_updated_at();
    END IF;
END $$;
