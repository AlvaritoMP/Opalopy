-- ============================================
-- Seguimiento de agendamiento y reagendamiento de entrevistas
-- ============================================
-- Ciclos por candidato (hasta asistencia o cancelación) + log de cada acción.

CREATE TABLE IF NOT EXISTS interview_scheduling_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    app_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'attended', 'cancelled')),
    current_interview_event_id UUID REFERENCES interview_events(id) ON DELETE SET NULL,
    primary_interviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    opened_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    opened_by_user_name TEXT,
    action_count INTEGER NOT NULL DEFAULT 1,
    reschedule_count INTEGER NOT NULL DEFAULT 0,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    attended_at TIMESTAMPTZ,
    attended_marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    attended_marked_by_name TEXT
);

COMMENT ON TABLE interview_scheduling_cycles IS
'Ciclo de agendamiento de un candidato hasta asistir a la cita o cancelar.';

CREATE INDEX IF NOT EXISTS idx_interview_scheduling_cycles_candidate
ON interview_scheduling_cycles (candidate_id, status);

CREATE INDEX IF NOT EXISTS idx_interview_scheduling_cycles_process
ON interview_scheduling_cycles (process_id, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_scheduling_cycles_app
ON interview_scheduling_cycles (app_name);

CREATE TABLE IF NOT EXISTS interview_scheduling_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES interview_scheduling_cycles(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    interview_event_id UUID REFERENCES interview_events(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('scheduled', 'rescheduled', 'cancelled', 'attended')),
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    performed_by_name TEXT,
    interviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    previous_start_time TIMESTAMPTZ,
    previous_interviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    app_name TEXT NOT NULL
);

COMMENT ON TABLE interview_scheduling_log IS
'Historial de cada agenda, reagenda, cancelación o marcación de asistencia.';

CREATE INDEX IF NOT EXISTS idx_interview_scheduling_log_cycle
ON interview_scheduling_log (cycle_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_interview_scheduling_log_process_created
ON interview_scheduling_log (process_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_scheduling_log_performer
ON interview_scheduling_log (performed_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_scheduling_log_interviewer
ON interview_scheduling_log (interviewer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_scheduling_log_app
ON interview_scheduling_log (app_name);
