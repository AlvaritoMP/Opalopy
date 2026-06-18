-- ============================================================
-- Estabilizacion Supabase ATS Alfa Oro - version SQL Editor
-- Proyecto esperado por la app: afhiiplxqtodqxvmswor
--
-- Usa este archivo si Supabase muestra:
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block
--
-- Recomendacion: ejecutar cada CREATE INDEX de forma individual
-- o por bloques pequenos, en horario de menor trafico.
-- ============================================================

-- 1) Confirmar timeout y proyecto/base activa.
select
  current_database() as database_name,
  current_setting('statement_timeout') as statement_timeout,
  current_setting('lock_timeout') as lock_timeout;

-- 2) Verificar columnas app_name usadas por la app.
select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'app_settings',
    'attachments',
    'candidate_history',
    'candidates',
    'comments',
    'document_categories',
    'form_integrations',
    'interview_events',
    'post_its',
    'processes',
    'stages'
  )
  and column_name = 'app_name'
order by table_name;

-- 3) Revisar sesiones activas antes de crear indices.
select
  pid,
  usename,
  application_name,
  state,
  wait_event_type,
  wait_event,
  now() - query_start as runtime,
  left(query, 500) as query
from pg_stat_activity
where datname = current_database()
  and pid <> pg_backend_pid()
order by query_start nulls last;

-- 4) Indices para reducir timeouts.
-- Ejecuta uno por uno si el SQL Editor vuelve a cortar por timeout.

create index if not exists idx_processes_app_bulk_created
  on public.processes (app_name, is_bulk_process, created_at desc);

create index if not exists idx_candidates_app_archived_discarded_created
  on public.candidates (app_name, archived, discarded, created_at desc);

create index if not exists idx_candidates_app_process_archived_discarded_created
  on public.candidates (app_name, process_id, archived, discarded, created_at desc);

create index if not exists idx_candidates_app_stage_created
  on public.candidates (app_name, stage_id, created_at desc);

create index if not exists idx_stages_app_process_order
  on public.stages (app_name, process_id, order_index);

create index if not exists idx_document_categories_app_process
  on public.document_categories (app_name, process_id);

create index if not exists idx_attachments_app_process_candidate_uploaded
  on public.attachments (app_name, process_id, candidate_id, uploaded_at desc);

create index if not exists idx_attachments_app_candidate_comment_uploaded
  on public.attachments (app_name, candidate_id, comment_id, uploaded_at desc);

create index if not exists idx_candidate_history_app_candidate_moved
  on public.candidate_history (app_name, candidate_id, moved_at);

create index if not exists idx_post_its_app_candidate_created
  on public.post_its (app_name, candidate_id, created_at desc);

create index if not exists idx_comments_app_candidate_created
  on public.comments (app_name, candidate_id, created_at desc);

create index if not exists idx_interview_events_app_candidate_start
  on public.interview_events (app_name, candidate_id, start_time);

create index if not exists idx_form_integrations_app_created
  on public.form_integrations (app_name, created_at desc);

create index if not exists idx_form_integrations_app_webhook
  on public.form_integrations (app_name, webhook_url);

create index if not exists idx_app_settings_app_name
  on public.app_settings (app_name);

-- 5) Verificar indices creados.
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_processes_app_bulk_created',
    'idx_candidates_app_archived_discarded_created',
    'idx_candidates_app_process_archived_discarded_created',
    'idx_candidates_app_stage_created',
    'idx_stages_app_process_order',
    'idx_document_categories_app_process',
    'idx_attachments_app_process_candidate_uploaded',
    'idx_attachments_app_candidate_comment_uploaded',
    'idx_candidate_history_app_candidate_moved',
    'idx_post_its_app_candidate_created',
    'idx_comments_app_candidate_created',
    'idx_interview_events_app_candidate_start',
    'idx_form_integrations_app_created',
    'idx_form_integrations_app_webhook',
    'idx_app_settings_app_name'
  )
order by tablename, indexname;

-- 6) Auditar politicas RLS demasiado abiertas.
-- No corregir automaticamente aqui: puede bloquear la app.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    qual in ('true', '(true)')
    or with_check in ('true', '(true)')
  )
order by tablename, policyname;

-- 7) Auditar funciones SECURITY DEFINER expuestas.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as config,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
order by p.proname;
