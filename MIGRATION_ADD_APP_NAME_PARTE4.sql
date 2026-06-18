-- ============================================
-- MIGRACIÓN PARTE 4: Crear índices
-- ============================================
-- Ejecuta esta parte al final, después de actualizar todos los datos
-- Los índices mejoran el rendimiento de las consultas filtradas por app_name

-- Crear índices para mejorar el rendimiento de las consultas filtradas por app_name
CREATE INDEX IF NOT EXISTS idx_users_app_name ON users(app_name);
CREATE INDEX IF NOT EXISTS idx_processes_app_name ON processes(app_name);
CREATE INDEX IF NOT EXISTS idx_candidates_app_name ON candidates(app_name);
CREATE INDEX IF NOT EXISTS idx_stages_app_name ON stages(app_name);
CREATE INDEX IF NOT EXISTS idx_document_categories_app_name ON document_categories(app_name);
CREATE INDEX IF NOT EXISTS idx_attachments_app_name ON attachments(app_name);
CREATE INDEX IF NOT EXISTS idx_candidate_history_app_name ON candidate_history(app_name);
CREATE INDEX IF NOT EXISTS idx_post_its_app_name ON post_its(app_name);
CREATE INDEX IF NOT EXISTS idx_comments_app_name ON comments(app_name);
CREATE INDEX IF NOT EXISTS idx_interview_events_app_name ON interview_events(app_name);
CREATE INDEX IF NOT EXISTS idx_form_integrations_app_name ON form_integrations(app_name);
CREATE INDEX IF NOT EXISTS idx_app_settings_app_name ON app_settings(app_name);

-- Verificar que los índices se crearon
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE indexname LIKE 'idx_%_app_name'
ORDER BY tablename;

