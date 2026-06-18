import { supabase } from '../supabase';
import { APP_NAME } from '../appConfig';
import {
    inferRegistrationOrigin,
    isCandidateRegistrationOrigin,
    type CandidateRegistrationOrigin,
    type RegistrationOriginInput,
} from '../candidateRegistrationOrigin';
import { isMissingColumnError } from '../supabaseColumnErrors';

export interface BackfillRegistrationOriginResult {
    updated: number;
    skipped: number;
}

/**
 * Persiste registration_origin inferido para candidatos del proceso que aún tienen NULL.
 * Usa historial add_row y señales de email / postulaciones.
 */
export async function backfillRegistrationOriginsForProcess(
    processId: string
): Promise<BackfillRegistrationOriginResult> {
    let updated = 0;
    let skipped = 0;

    const manualRowIds = new Set<string>();
    try {
        const { data: activityRows, error: actErr } = await supabase
            .from('bulk_process_activity_log')
            .select('candidate_id')
            .eq('process_id', processId)
            .eq('app_name', APP_NAME)
            .eq('action_type', 'add_row');

        if (!actErr) {
            for (const row of activityRows || []) {
                if (row.candidate_id) manualRowIds.add(row.candidate_id as string);
            }
        }
    } catch {
        /* tabla de actividad opcional */
    }

    const pageSize = 400;
    for (let page = 0; page < 100; page++) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
            .from('candidates')
            .select(
                'id, email, application_count, first_application_at, created_by, registration_origin'
            )
            .eq('process_id', processId)
            .eq('app_name', APP_NAME)
            .eq('archived', false)
            .eq('discarded', false)
            .is('registration_origin', null)
            .range(from, to);

        if (error) {
            if (isMissingColumnError(error)) return { updated: 0, skipped: 0 };
            throw error;
        }

        const rows = data || [];
        if (rows.length === 0) break;

        for (const row of rows) {
            const input: RegistrationOriginInput = {
                email: row.email as string,
                applicationCount:
                    row.application_count != null ? Number(row.application_count) : undefined,
                firstApplicationAt: (row.first_application_at as string) || undefined,
                createdBy: (row.created_by as string) || undefined,
                addedViaManualRow: manualRowIds.has(row.id as string),
            };

            const origin = inferRegistrationOrigin(input);
            if (!origin) {
                skipped += 1;
                continue;
            }

            const { error: updErr } = await supabase
                .from('candidates')
                .update({ registration_origin: origin })
                .eq('id', row.id)
                .eq('app_name', APP_NAME)
                .is('registration_origin', null);

            if (!updErr) updated += 1;
            else skipped += 1;
        }

        if (rows.length < pageSize) break;
    }

    return { updated, skipped };
}

export function resolveStoredOrInferredOrigin(
    input: RegistrationOriginInput
): CandidateRegistrationOrigin | undefined {
    if (isCandidateRegistrationOrigin(input.registrationOrigin)) {
        return input.registrationOrigin;
    }
    return inferRegistrationOrigin(input);
}
