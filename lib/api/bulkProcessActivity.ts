import { supabase } from '../supabase';
import { APP_NAME } from '../appConfig';

export type BulkActivityActionType =
    | 'cell_edit'
    | 'stage_change'
    | 'bulk_stage_change'
    | 'bulk_discard'
    | 'bulk_archive'
    | 'bulk_approve'
    | 'candidate_delete'
    | 'import'
    | 'config_change'
    | 'cell_meta'
    | 'paste'
    | 'contact_attempt'
    | 'contact_status'
    | 'contact_reset'
    | 'add_row'
    | 'opsflow_send'
    | 'candidate_transfer';

export interface BulkProcessActivityEntry {
    id: string;
    processId: string;
    candidateId?: string;
    candidateName?: string;
    userId?: string;
    userName?: string;
    actionType: BulkActivityActionType;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    details?: Record<string, unknown>;
    createdAt: string;
}

export interface LogBulkActivityInput {
    processId: string;
    actionType: BulkActivityActionType;
    candidateId?: string;
    candidateName?: string;
    userId?: string;
    userName?: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    details?: Record<string, unknown>;
}

const MAX_VALUE_LEN = 500;

function truncate(value: string | undefined | null): string | null {
    if (value == null) return null;
    const s = String(value);
    return s.length > MAX_VALUE_LEN ? `${s.slice(0, MAX_VALUE_LEN)}…` : s;
}

function mapRow(row: Record<string, unknown>): BulkProcessActivityEntry {
    return {
        id: row.id as string,
        processId: row.process_id as string,
        candidateId: (row.candidate_id as string) || undefined,
        candidateName: (row.candidate_name as string) || undefined,
        userId: (row.user_id as string) || undefined,
        userName: (row.user_name as string) || undefined,
        actionType: row.action_type as BulkActivityActionType,
        fieldName: (row.field_name as string) || undefined,
        oldValue: (row.old_value as string) || undefined,
        newValue: (row.new_value as string) || undefined,
        details: (row.details as Record<string, unknown>) || undefined,
        createdAt: row.created_at as string,
    };
}

function isFkViolation(error: { message?: string; code?: string } | null): boolean {
    if (!error) return false;
    return error.code === '23503';
}

export const bulkProcessActivityApi = {
    async log(input: LogBulkActivityInput): Promise<void> {
        const baseRow = {
            process_id: input.processId,
            candidate_id: input.candidateId || null,
            candidate_name: input.candidateName || null,
            user_id: input.userId || null,
            user_name: input.userName || null,
            action_type: input.actionType,
            field_name: input.fieldName || null,
            old_value: truncate(input.oldValue),
            new_value: truncate(input.newValue),
            details: input.details || {},
            app_name: APP_NAME,
        };

        let { error } = await supabase.from('bulk_process_activity_log').insert(baseRow);

        // FK inválida (409): IDs obsoletos tras restore o usuario no en public.users
        if (error && isFkViolation(error)) {
            ({ error } = await supabase.from('bulk_process_activity_log').insert({
                ...baseRow,
                candidate_id: null,
                user_id: null,
            }));
        }

        if (error) {
            console.warn('No se pudo registrar actividad del proceso masivo:', error.message);
        }
    },

    async getByProcess(processId: string, limit = 200): Promise<BulkProcessActivityEntry[]> {
        const { data, error } = await supabase
            .from('bulk_process_activity_log')
            .select('*')
            .eq('process_id', processId)
            .eq('app_name', APP_NAME)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data || []).map(mapRow);
    },

    async getByCandidate(candidateId: string, limit = 300): Promise<BulkProcessActivityEntry[]> {
        const { data, error } = await supabase
            .from('bulk_process_activity_log')
            .select('*')
            .eq('candidate_id', candidateId)
            .eq('app_name', APP_NAME)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data || []).map(mapRow);
    },

    /** Intentos de contacto registrados en el log masivo (fechas reales por candidato). */
    async getContactActivityForProcesses(processIds: string[]): Promise<BulkProcessActivityEntry[]> {
        if (processIds.length === 0) return [];

        const all: BulkProcessActivityEntry[] = [];
        for (const processId of processIds) {
            const { data, error } = await supabase
                .from('bulk_process_activity_log')
                .select('*')
                .eq('process_id', processId)
                .eq('app_name', APP_NAME)
                .in('action_type', ['contact_attempt', 'contact_status'])
                .order('created_at', { ascending: true })
                .limit(5000);

            if (error) throw error;
            all.push(...(data || []).map(mapRow));
        }
        return all;
    },
};
