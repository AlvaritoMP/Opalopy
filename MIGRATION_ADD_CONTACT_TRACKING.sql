-- ============================================
-- MIGRACIÓN: Seguimiento de contacto (semáforo) en procesos masivos
-- ============================================
-- Estados en candidates + historial de intentos en candidate_contact_attempts
--
-- INSTRUCCIONES:
-- 1. Supabase → SQL Editor
-- 2. Ejecutar este script
-- 3. Ejecutar RLS para candidate_contact_attempts (ver RLS_NUEVA_TABLA_TEMPLATE.sql)
-- ============================================

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS contact_status TEXT NOT NULL DEFAULT 'por_contactar',
ADD COLUMN IF NOT EXISTS contact_attempt_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS contact_last_attempt_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS contact_last_user_id UUID,
ADD COLUMN IF NOT EXISTS contact_last_user_name TEXT;

COMMENT ON COLUMN candidates.contact_status IS
'Semáforo de contacto: por_contactar | en_intento | interesado | no_interesado | inubicable';

COMMENT ON COLUMN candidates.contact_attempt_count IS
'Número acumulado de intentos de contacto (llamadas, WhatsApp, etc.)';

CREATE INDEX IF NOT EXISTS idx_candidates_contact_status
ON candidates (process_id, contact_status)
WHERE contact_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_contact_last_attempt
ON candidates (contact_last_attempt_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS candidate_contact_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name TEXT,
    channel TEXT NOT NULL CHECK (channel IN ('call', 'whatsapp')),
    outcome TEXT NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status_after TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    app_name TEXT NOT NULL
);

COMMENT ON TABLE candidate_contact_attempts IS
'Historial cronológico de intentos de contacto por candidato (llamadas, WhatsApp).';

CREATE INDEX IF NOT EXISTS idx_contact_attempts_candidate_created
ON candidate_contact_attempts (candidate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_attempts_process_created
ON candidate_contact_attempts (process_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_attempts_app_name
ON candidate_contact_attempts (app_name);

-- RLS (Opalo ATS + Opalopy) — ejecutar tras crear la tabla:
/*
ALTER TABLE public.candidate_contact_attempts ENABLE ROW LEVEL SECURITY;
-- Copiar políticas desde RLS_NUEVA_TABLA_TEMPLATE.sql reemplazando __TABLA__
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.candidate_contact_attempts TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
*/

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'candidates'
  AND column_name LIKE 'contact_%'
ORDER BY column_name;
