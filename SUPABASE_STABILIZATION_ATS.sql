-- ============================================================
-- Estabilizacion Supabase ATS Alfa Oro
-- Proyecto esperado por la app: afhiiplxqtodqxvmswor
--
-- Ejecutar en Supabase SQL Editor del proyecto ATS correcto.
-- No ejecutar este archivo completo si el SQL Editor marca timeout:
-- corre cada bloque por separado, especialmente los CREATE INDEX.
-- ============================================================

-- 1) Confirmar que estas consultas corren en el proyecto correcto.
select
  current_database() as database_name,
  current_setting('statement_timeout') as statement_timeout,
  current_setting('lock_timeout') as lock_timeout;

-- 2) Verificar que las columnas app_name existen donde la app las usa.
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

-- 3) Detectar sesiones activas, esperas de locks y consultas largas.
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

-- 4) Indices que atacan directamente los endpoints con 522/524/504.
-- Importante:
-- - CREATE INDEX CONCURRENTLY reduce bloqueo de escrituras.
-- - Debe ejecutarse fuera de una transaccion explicita.
-- - Si hay timeout, ejecuta un indice por vez.

create index concurrently if not exists idx_processes_app_bulk_created
  on public.processes (app_name, is_bulk_process, created_at desc);

create index concurrently if not exists idx_candidates_app_archived_discarded_created
  on public.candidates (app_name, archived, discarded, created_at desc);

create index concurrently if not exists idx_candidates_app_process_archived_discarded_created
  on public.candidates (app_name, process_id, archived, discarded, created_at desc);

create index concurrently if not exists idx_candidates_app_stage_created
  on public.candidates (app_name, stage_id, created_at desc);

create index concurrently if not exists idx_stages_app_process_order
  on public.stages (app_name, process_id, order_index);

create index concurrently if not exists idx_document_categories_app_process
  on public.document_categories (app_name, process_id);

create index concurrently if not exists idx_attachments_app_process_candidate_uploaded
  on public.attachments (app_name, process_id, candidate_id, uploaded_at desc);

create index concurrently if not exists idx_attachments_app_candidate_comment_uploaded
  on public.attachments (app_name, candidate_id, comment_id, uploaded_at desc);

create index concurrently if not exists idx_candidate_history_app_candidate_moved
  on public.candidate_history (app_name, candidate_id, moved_at);

create index concurrently if not exists idx_post_its_app_candidate_created
  on public.post_its (app_name, candidate_id, created_at desc);

create index concurrently if not exists idx_comments_app_candidate_created
  on public.comments (app_name, candidate_id, created_at desc);

create index concurrently if not exists idx_interview_events_app_candidate_start
  on public.interview_events (app_name, candidate_id, start_time);

create index concurrently if not exists idx_form_integrations_app_created
  on public.form_integrations (app_name, created_at desc);

create index concurrently if not exists idx_form_integrations_app_webhook
  on public.form_integrations (app_name, webhook_url);

create index concurrently if not exists idx_app_settings_app_name
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
-- No se corrigen automaticamente porque podrian bloquear la app.
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

-- 7) Auditar funciones SECURITY DEFINER expuestas a anon/authenticated.
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

-- Remediacion tipo para funciones SECURITY DEFINER sensibles:
-- revoke execute on function public.nombre_funcion(argumentos) from anon;
-- revoke execute on function public.nombre_funcion(argumentos) from authenticated;
-- grant execute on function public.nombre_funcion(argumentos) to service_role;

-- Remediacion tipo para search_path mutable:
-- alter function public.nombre_funcion(argumentos) set search_path = public, pg_temp;
