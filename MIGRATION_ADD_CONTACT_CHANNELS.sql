-- ============================================
-- MIGRACIÓN: Seguimiento por canal (teléfono, WhatsApp, correo)
-- ============================================
-- Ejecutar DESPUÉS de MIGRATION_ADD_CONTACT_TRACKING.sql
-- ============================================

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS contact_phone_status TEXT NOT NULL DEFAULT 'por_contactar',
ADD COLUMN IF NOT EXISTS contact_phone_attempt_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS contact_phone_last_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS contact_phone_last_user_name TEXT,
ADD COLUMN IF NOT EXISTS contact_whatsapp_status TEXT NOT NULL DEFAULT 'por_contactar',
ADD COLUMN IF NOT EXISTS contact_whatsapp_attempt_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS contact_whatsapp_last_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS contact_whatsapp_last_user_name TEXT,
ADD COLUMN IF NOT EXISTS contact_email_status TEXT NOT NULL DEFAULT 'por_contactar',
ADD COLUMN IF NOT EXISTS contact_email_attempt_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS contact_email_last_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS contact_email_last_user_name TEXT;

-- Migrar datos legacy
UPDATE candidates SET
    contact_phone_status = COALESCE(contact_status, 'por_contactar'),
    contact_phone_attempt_count = COALESCE(contact_attempt_count, 0),
    contact_phone_last_at = contact_last_attempt_at,
    contact_phone_last_user_name = contact_last_user_name
WHERE contact_phone_last_at IS NULL AND (contact_last_attempt_at IS NOT NULL OR contact_attempt_count > 0);

UPDATE candidates SET
    contact_whatsapp_status = CASE
        WHEN last_whatsapp_interaction_at IS NOT NULL THEN 'en_intento'
        ELSE 'por_contactar'
    END,
    contact_whatsapp_attempt_count = CASE
        WHEN last_whatsapp_interaction_at IS NOT NULL THEN GREATEST(contact_whatsapp_attempt_count, 1)
        ELSE 0
    END,
    contact_whatsapp_last_at = last_whatsapp_interaction_at,
    contact_whatsapp_last_user_name = contact_last_user_name
WHERE last_whatsapp_interaction_at IS NOT NULL AND contact_whatsapp_last_at IS NULL;

-- Permitir canal email en historial
ALTER TABLE candidate_contact_attempts DROP CONSTRAINT IF EXISTS candidate_contact_attempts_channel_check;
ALTER TABLE candidate_contact_attempts ADD CONSTRAINT candidate_contact_attempts_channel_check
    CHECK (channel IN ('call', 'whatsapp', 'email'));

SELECT column_name FROM information_schema.columns
WHERE table_name = 'candidates' AND column_name LIKE 'contact_%'
ORDER BY column_name;
