import { supabase } from '../supabase';
import { APP_NAME } from '../appConfig';
import { isMissingTableError } from '../supabaseColumnErrors';
import type { InterviewEvent } from '../../types';

export type InterviewSchedulingAction = 'scheduled' | 'rescheduled' | 'cancelled' | 'attended';

export interface InterviewSchedulingLogRow {
    id: string;
    cycleId: string;
    candidateId: string;
    processId: string;
    interviewEventId?: string;
    action: InterviewSchedulingAction;
    performedBy?: string;
    performedByName?: string;
    interviewerId?: string;
    startTime?: string;
    endTime?: string;
    previousStartTime?: string;
    previousInterviewerId?: string;
    createdAt: string;
}

export interface InterviewSchedulingCycleRow {
    id: string;
    candidateId: string;
    processId: string;
    status: 'open' | 'attended' | 'cancelled';
    currentInterviewEventId?: string;
    primaryInterviewerId?: string;
    openedByUserId?: string;
    openedByUserName?: string;
    actionCount: number;
    rescheduleCount: number;
    openedAt: string;
    closedAt?: string;
    attendedAt?: string;
}

export interface SchedulingActorContext {
    userId?: string;
    userName?: string;
}

function toIso(d: Date | string | undefined): string | undefined {
    if (!d) return undefined;
    const date = d instanceof Date ? d : new Date(d);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function timesChanged(prevStart?: string, nextStart?: string, prevInterviewer?: string, nextInterviewer?: string): boolean {
    if (prevStart && nextStart && prevStart !== nextStart) return true;
    if (prevInterviewer && nextInterviewer && prevInterviewer !== nextInterviewer) return true;
    return false;
}

let trackingTablesAvailable: boolean | null = null;

function isMissingTrackingTableError(error: { message?: string; code?: string; status?: number } | null): boolean {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
        isMissingTableError(error) ||
        msg.includes('interview_scheduling')
    );
}

async function getCandidateProcessId(candidateId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('candidates')
        .select('process_id')
        .eq('id', candidateId)
        .eq('app_name', APP_NAME)
        .maybeSingle();
    if (error || !data?.process_id) return null;
    return data.process_id as string;
}

async function findOpenCycle(candidateId: string): Promise<InterviewSchedulingCycleRow | null> {
    const { data, error } = await supabase
        .from('interview_scheduling_cycles')
        .select('*')
        .eq('candidate_id', candidateId)
        .eq('app_name', APP_NAME)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        if (isMissingTrackingTableError(error)) {
            trackingTablesAvailable = false;
            return null;
        }
        throw error;
    }
    if (!data) return null;
    return mapCycle(data);
}

function mapCycle(row: Record<string, unknown>): InterviewSchedulingCycleRow {
    return {
        id: row.id as string,
        candidateId: row.candidate_id as string,
        processId: row.process_id as string,
        status: row.status as InterviewSchedulingCycleRow['status'],
        currentInterviewEventId: (row.current_interview_event_id as string) || undefined,
        primaryInterviewerId: (row.primary_interviewer_id as string) || undefined,
        openedByUserId: (row.opened_by_user_id as string) || undefined,
        openedByUserName: (row.opened_by_user_name as string) || undefined,
        actionCount: (row.action_count as number) || 1,
        rescheduleCount: (row.reschedule_count as number) || 0,
        openedAt: row.opened_at as string,
        closedAt: (row.closed_at as string) || undefined,
        attendedAt: (row.attended_at as string) || undefined,
    };
}

function mapLog(row: Record<string, unknown>): InterviewSchedulingLogRow {
    return {
        id: row.id as string,
        cycleId: row.cycle_id as string,
        candidateId: row.candidate_id as string,
        processId: row.process_id as string,
        interviewEventId: (row.interview_event_id as string) || undefined,
        action: row.action as InterviewSchedulingAction,
        performedBy: (row.performed_by as string) || undefined,
        performedByName: (row.performed_by_name as string) || undefined,
        interviewerId: (row.interviewer_id as string) || undefined,
        startTime: (row.start_time as string) || undefined,
        endTime: (row.end_time as string) || undefined,
        previousStartTime: (row.previous_start_time as string) || undefined,
        previousInterviewerId: (row.previous_interviewer_id as string) || undefined,
        createdAt: row.created_at as string,
    };
}

async function insertLog(params: {
    cycleId: string;
    candidateId: string;
    processId: string;
    action: InterviewSchedulingAction;
    actor?: SchedulingActorContext;
    interviewerId?: string;
    eventId?: string;
    start?: Date;
    end?: Date;
    previousStart?: Date;
    previousInterviewerId?: string;
}): Promise<void> {
    const { error } = await supabase.from('interview_scheduling_log').insert({
        cycle_id: params.cycleId,
        candidate_id: params.candidateId,
        process_id: params.processId,
        interview_event_id: params.eventId || null,
        action: params.action,
        performed_by: params.actor?.userId || null,
        performed_by_name: params.actor?.userName || null,
        interviewer_id: params.interviewerId || null,
        start_time: toIso(params.start),
        end_time: toIso(params.end),
        previous_start_time: toIso(params.previousStart),
        previous_interviewer_id: params.previousInterviewerId || null,
        app_name: APP_NAME,
    });
    if (error) throw error;
}

export const interviewSchedulingApi = {
    isEnabled(): boolean {
        return trackingTablesAvailable !== false;
    },

    async recordScheduled(
        event: Pick<InterviewEvent, 'id' | 'candidateId' | 'interviewerId' | 'start' | 'end'>,
        actor?: SchedulingActorContext,
        processId?: string
    ): Promise<void> {
        if (trackingTablesAvailable === false) return;
        try {
            const pid = processId || (await getCandidateProcessId(event.candidateId));
            if (!pid) return;

            const open = await findOpenCycle(event.candidateId);
            if (open) {
                const { error: updateError } = await supabase
                    .from('interview_scheduling_cycles')
                    .update({
                        current_interview_event_id: event.id,
                        primary_interviewer_id: event.interviewerId,
                        action_count: open.actionCount + 1,
                        reschedule_count: open.rescheduleCount + 1,
                    })
                    .eq('id', open.id)
                    .eq('app_name', APP_NAME);
                if (updateError) throw updateError;

                await insertLog({
                    cycleId: open.id,
                    candidateId: event.candidateId,
                    processId: pid,
                    action: 'rescheduled',
                    actor,
                    interviewerId: event.interviewerId,
                    eventId: event.id,
                    start: event.start instanceof Date ? event.start : new Date(event.start),
                    end: event.end instanceof Date ? event.end : new Date(event.end),
                });
                return;
            }

            const { data: cycle, error: cycleError } = await supabase
                .from('interview_scheduling_cycles')
                .insert({
                    candidate_id: event.candidateId,
                    process_id: pid,
                    app_name: APP_NAME,
                    status: 'open',
                    current_interview_event_id: event.id,
                    primary_interviewer_id: event.interviewerId,
                    opened_by_user_id: actor?.userId || null,
                    opened_by_user_name: actor?.userName || null,
                    action_count: 1,
                    reschedule_count: 0,
                })
                .select()
                .single();

            if (cycleError) throw cycleError;

            await insertLog({
                cycleId: cycle.id,
                candidateId: event.candidateId,
                processId: pid,
                action: 'scheduled',
                actor,
                interviewerId: event.interviewerId,
                eventId: event.id,
                start: event.start instanceof Date ? event.start : new Date(event.start),
                end: event.end instanceof Date ? event.end : new Date(event.end),
            });
            trackingTablesAvailable = true;
        } catch (err: unknown) {
            const e = err as { message?: string; code?: string };
            if (isMissingTrackingTableError(e)) {
                trackingTablesAvailable = false;
                console.warn('Seguimiento de agendas no disponible (ejecute la migración SQL).');
                return;
            }
            console.warn('Error registrando agenda:', e);
        }
    },

    async recordRescheduled(
        event: Pick<InterviewEvent, 'id' | 'candidateId' | 'interviewerId' | 'start' | 'end'>,
        actor?: SchedulingActorContext,
        previous?: Pick<InterviewEvent, 'id' | 'candidateId' | 'interviewerId' | 'start' | 'end'>,
        processId?: string
    ): Promise<void> {
        if (trackingTablesAvailable === false) return;
        try {
            const pid = processId || (await getCandidateProcessId(event.candidateId));
            if (!pid) return;

            const prevStart = toIso(previous?.start);
            const nextStart = toIso(event.start);
            const prevInterviewer = previous?.interviewerId;
            if (previous && !timesChanged(prevStart, nextStart, prevInterviewer, event.interviewerId)) {
                return;
            }

            let cycle = await findOpenCycle(event.candidateId);
            if (!cycle) {
                await this.recordScheduled(event, actor, pid);
                return;
            }

            const newRescheduleCount = cycle.rescheduleCount + 1;
            const newActionCount = cycle.actionCount + 1;

            const { error: updateError } = await supabase
                .from('interview_scheduling_cycles')
                .update({
                    current_interview_event_id: event.id,
                    primary_interviewer_id: event.interviewerId,
                    action_count: newActionCount,
                    reschedule_count: newRescheduleCount,
                })
                .eq('id', cycle.id)
                .eq('app_name', APP_NAME);

            if (updateError) throw updateError;

            await insertLog({
                cycleId: cycle.id,
                candidateId: event.candidateId,
                processId: pid,
                action: 'rescheduled',
                actor,
                interviewerId: event.interviewerId,
                eventId: event.id,
                start: event.start instanceof Date ? event.start : new Date(event.start),
                end: event.end instanceof Date ? event.end : new Date(event.end),
                previousStart: previous?.start
                    ? previous.start instanceof Date
                        ? previous.start
                        : new Date(previous.start)
                    : undefined,
                previousInterviewerId: previous?.interviewerId,
            });
            trackingTablesAvailable = true;
        } catch (err: unknown) {
            const e = err as { message?: string; code?: string };
            if (isMissingTrackingTableError(e)) {
                trackingTablesAvailable = false;
                return;
            }
            console.warn('Error registrando reagenda:', e);
        }
    },

    async recordCancelled(
        event: Pick<InterviewEvent, 'id' | 'candidateId' | 'interviewerId' | 'start' | 'end'>,
        actor?: SchedulingActorContext,
        processId?: string
    ): Promise<void> {
        if (trackingTablesAvailable === false) return;
        try {
            const pid = processId || (await getCandidateProcessId(event.candidateId));
            if (!pid) return;

            const cycle = await findOpenCycle(event.candidateId);
            if (!cycle) return;

            const now = new Date().toISOString();
            const { error: updateError } = await supabase
                .from('interview_scheduling_cycles')
                .update({
                    status: 'cancelled',
                    closed_at: now,
                    current_interview_event_id: null,
                })
                .eq('id', cycle.id)
                .eq('app_name', APP_NAME);

            if (updateError) throw updateError;

            await insertLog({
                cycleId: cycle.id,
                candidateId: event.candidateId,
                processId: pid,
                action: 'cancelled',
                actor,
                interviewerId: event.interviewerId,
                eventId: event.id,
                start: event.start instanceof Date ? event.start : new Date(event.start),
                end: event.end instanceof Date ? event.end : new Date(event.end),
            });
        } catch (err: unknown) {
            const e = err as { message?: string; code?: string };
            if (isMissingTrackingTableError(e)) {
                trackingTablesAvailable = false;
                return;
            }
            console.warn('Error registrando cancelación de agenda:', e);
        }
    },

    async markAttended(
        candidateId: string,
        actor?: SchedulingActorContext,
        processId?: string
    ): Promise<boolean> {
        if (trackingTablesAvailable === false) return false;
        try {
            const pid = processId || (await getCandidateProcessId(candidateId));
            if (!pid) return false;

            const cycle = await findOpenCycle(candidateId);
            if (!cycle) return false;

            const now = new Date().toISOString();
            const { error: updateError } = await supabase
                .from('interview_scheduling_cycles')
                .update({
                    status: 'attended',
                    attended_at: now,
                    closed_at: now,
                    attended_marked_by: actor?.userId || null,
                    attended_marked_by_name: actor?.userName || null,
                })
                .eq('id', cycle.id)
                .eq('app_name', APP_NAME);

            if (updateError) throw updateError;

            await insertLog({
                cycleId: cycle.id,
                candidateId,
                processId: pid,
                action: 'attended',
                actor,
                interviewerId: cycle.primaryInterviewerId,
                eventId: cycle.currentInterviewEventId,
            });
            return true;
        } catch (err: unknown) {
            const e = err as { message?: string; code?: string };
            if (isMissingTrackingTableError(e)) {
                trackingTablesAvailable = false;
                return false;
            }
            console.warn('Error marcando asistencia:', e);
            return false;
        }
    },

    async getOpenCycleForCandidate(candidateId: string): Promise<InterviewSchedulingCycleRow | null> {
        if (trackingTablesAvailable === false) return null;
        try {
            return await findOpenCycle(candidateId);
        } catch {
            return null;
        }
    },

    async getLogsForProcesses(
        processIds: string[],
        sinceIso?: string
    ): Promise<InterviewSchedulingLogRow[]> {
        if (!processIds.length || trackingTablesAvailable === false) return [];
        try {
            const pageSize = 1000;
            const all: InterviewSchedulingLogRow[] = [];

            for (let page = 0; page < 500; page++) {
                const from = page * pageSize;
                const to = from + pageSize - 1;

                let query = supabase
                    .from('interview_scheduling_log')
                    .select('*')
                    .eq('app_name', APP_NAME)
                    .in('process_id', processIds)
                    .order('created_at', { ascending: false })
                    .range(from, to);

                if (sinceIso) {
                    query = query.gte('created_at', sinceIso);
                }

                const { data, error } = await query;
                if (error) {
                    if (isMissingTrackingTableError(error)) {
                        trackingTablesAvailable = false;
                        return all;
                    }
                    throw error;
                }

                all.push(...(data || []).map(row => mapLog(row as Record<string, unknown>)));
                if (!data || data.length < pageSize) break;
            }

            trackingTablesAvailable = true;
            return all;
        } catch (err: unknown) {
            const e = err as { message?: string; code?: string; status?: number };
            if (isMissingTrackingTableError(e)) {
                trackingTablesAvailable = false;
                return [];
            }
            throw err;
        }
    },

    async getCyclesForProcesses(
        processIds: string[],
        sinceIso?: string
    ): Promise<InterviewSchedulingCycleRow[]> {
        if (!processIds.length || trackingTablesAvailable === false) return [];
        try {
            const pageSize = 1000;
            const all: InterviewSchedulingCycleRow[] = [];

            for (let page = 0; page < 500; page++) {
                const from = page * pageSize;
                const to = from + pageSize - 1;

                let query = supabase
                    .from('interview_scheduling_cycles')
                    .select('*')
                    .eq('app_name', APP_NAME)
                    .in('process_id', processIds)
                    .order('opened_at', { ascending: false })
                    .range(from, to);

                if (sinceIso) {
                    query = query.gte('opened_at', sinceIso);
                }

                const { data, error } = await query;
                if (error) {
                    if (isMissingTrackingTableError(error)) {
                        trackingTablesAvailable = false;
                        return all;
                    }
                    throw error;
                }

                all.push(...(data || []).map(row => mapCycle(row as Record<string, unknown>)));
                if (!data || data.length < pageSize) break;
            }

            trackingTablesAvailable = true;
            return all;
        } catch (err: unknown) {
            const e = err as { message?: string; code?: string; status?: number };
            if (isMissingTrackingTableError(e)) {
                trackingTablesAvailable = false;
                return [];
            }
            throw err;
        }
    },
};
