-- ============================================
-- MIGRACIÓN: Reserva / lock de contactología en procesos masivos
-- ============================================
-- upload: 30 min tras alta manual o masiva (quien subió el registro)
-- success: tras contacto exitoso (quien logró el contacto)
--
-- INSTRUCCIONES:
-- 1. Supabase → SQL Editor
-- 2. Ejecutar este script completo
-- ============================================

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS contact_lock_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contact_lock_user_name TEXT,
ADD COLUMN IF NOT EXISTS contact_lock_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS contact_lock_reason TEXT;

ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_contact_lock_reason_check;
ALTER TABLE candidates ADD CONSTRAINT candidates_contact_lock_reason_check
    CHECK (contact_lock_reason IS NULL OR contact_lock_reason IN ('upload', 'success'));

COMMENT ON COLUMN candidates.contact_lock_user_id IS
'Usuario con reserva activa sobre columnas de contacto (teléfono, WhatsApp, correo).';
COMMENT ON COLUMN candidates.contact_lock_until IS
'Fin de la reserva; tras esta hora otros usuarios pueden contactar.';
COMMENT ON COLUMN candidates.contact_lock_reason IS
'upload = alta manual/masiva (30 min); success = contacto exitoso.';

CREATE INDEX IF NOT EXISTS idx_candidates_contact_lock_until
ON candidates (contact_lock_until DESC NULLS LAST)
WHERE contact_lock_until IS NOT NULL;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'candidates'
  AND column_name IN ('created_by', 'contact_lock_user_id', 'contact_lock_until', 'contact_lock_reason')
ORDER BY column_name;
