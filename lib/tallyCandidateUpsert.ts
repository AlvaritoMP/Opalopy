import type { SupabaseClient } from '@supabase/supabase-js';
import type { CustomColumn } from './types';
import type { TallyCandidateInsert } from './tallyWebhookMapping';
import {
    enrichBulkColumnValuesForStorage,
    hasBulkCellValue,
    isPlaceholderImportEmail,
    normalizeDniKey,
    collectPhoneMatchKeys,
    buildBulkPlaceholderEmail,
} from './bulkTableColumns';
import { isMissingColumnError } from './supabaseColumnErrors';

export interface TallyUpsertResult {
    candidateId: string;
    isReapplication: boolean;
    applicationCount: number;
}

type CandidateRow = Record<string, unknown>;

const MATCH_SELECT_WITH_APPLICATION =
    'id, name, email, phone, phone2, description, source, salary_expectation, dni, linkedin_url, address, province, district, age, bulk_column_values, application_count, first_application_at, created_at, stage_id, application_started_date';

const MATCH_SELECT_BASE =
    'id, name, email, phone, phone2, description, source, salary_expectation, dni, linkedin_url, address, province, district, age, bulk_column_values, created_at, stage_id, application_started_date';

function normalizeEmailKey(email?: string | null): string {
    return (email || '').trim().toLowerCase();
}

function findRowByPhoneMatch(rows: CandidateRow[], incomingKeys: string[]): CandidateRow | undefined {
    if (incomingKeys.length === 0) return undefined;
    return rows.find(row => {
        const rowKeys = collectPhoneMatchKeys(row.phone as string, row.phone2 as string);
        return incomingKeys.some(key => rowKeys.includes(key));
    });
}

function ensureTallyCandidateEmail(candidate: TallyCandidateInsert): void {
    if (candidate.email?.trim()) return;
    candidate.email = buildBulkPlaceholderEmail({
        rowNumber: 0,
        name: candidate.name,
        dni: candidate.dni,
        phone: candidate.phone || candidate.phone2,
        suffix: 'tally',
    });
}

const STANDARD_MERGE_KEYS = [
    'name',
    'email',
    'phone',
    'phone2',
    'description',
    'source',
    'salary_expectation',
    'dni',
    'linkedin_url',
    'address',
    'province',
    'district',
    'age',
] as const;

function isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    return false;
}

function pickMergedValue(existing: unknown, incoming: unknown): unknown {
    if (!isEmptyValue(existing)) return existing;
    if (!isEmptyValue(incoming)) return incoming;
    return existing;
}

function mergeBulkColumnValues(
    existing: Record<string, unknown> | null | undefined,
    incoming: Record<string, unknown> | undefined,
    customColumns: CustomColumn[]
): Record<string, unknown> | undefined {
    if (!incoming || Object.keys(incoming).length === 0) return existing || undefined;

    const base = { ...(existing || {}) };
    const enrichedIncoming = enrichBulkColumnValuesForStorage(incoming, customColumns);

    for (const [key, value] of Object.entries(enrichedIncoming)) {
        if (!hasBulkCellValue(base[key]) && hasBulkCellValue(value)) {
            base[key] = value;
        }
    }

    return Object.keys(base).length > 0 ? base : undefined;
}

export function matchExistingCandidateRow(
    rows: CandidateRow[],
    incoming: Pick<TallyCandidateInsert, 'dni' | 'email' | 'phone' | 'phone2'>
): CandidateRow | undefined {
    const dniKey = normalizeDniKey(incoming.dni);
    const emailKey = normalizeEmailKey(incoming.email);
    const incomingPhoneKeys = collectPhoneMatchKeys(incoming.phone, incoming.phone2);
    const hasRealEmail = emailKey && !isPlaceholderImportEmail(emailKey);

    if (dniKey) {
        const byDni = rows.find(r => normalizeDniKey(r.dni as string) === dniKey);
        if (byDni) return byDni;
    }
    if (hasRealEmail) {
        const byEmail = rows.find(
            r => normalizeEmailKey(r.email as string) === emailKey && !isPlaceholderImportEmail(r.email as string)
        );
        if (byEmail) return byEmail;
    }
    const byPhone = findRowByPhoneMatch(rows, incomingPhoneKeys);
    if (byPhone) return byPhone;
    return undefined;
}

export async function findExistingCandidateInProcess(
    supabase: SupabaseClient,
    processId: string,
    appName: string,
    incoming: Pick<TallyCandidateInsert, 'dni' | 'email' | 'phone' | 'phone2'>
): Promise<CandidateRow | null> {
    const dniKey = normalizeDniKey(incoming.dni);
    const emailKey = normalizeEmailKey(incoming.email);
    const incomingPhoneKeys = collectPhoneMatchKeys(incoming.phone, incoming.phone2);

    if (!dniKey && !emailKey && incomingPhoneKeys.length === 0) return null;

    let lastError: { message?: string; code?: string } | null = null;
    for (const selectFields of [MATCH_SELECT_WITH_APPLICATION, MATCH_SELECT_BASE]) {
        const { data, error } = await supabase
            .from('candidates')
            .select(selectFields)
            .eq('process_id', processId)
            .eq('app_name', appName)
            .eq('archived', false);

        if (error) {
            lastError = error;
            if (isMissingColumnError(error)) continue;
            throw error;
        }
        if (!data?.length) return null;
        return matchExistingCandidateRow(data as CandidateRow[], incoming) || null;
    }

    if (lastError) throw lastError;
    return null;
}

function buildMergeUpdatePayload(
    existing: CandidateRow,
    incoming: TallyCandidateInsert,
    customColumns: CustomColumn[],
    nowIso: string
): Record<string, unknown> {
    const update: Record<string, unknown> = {
        created_at: nowIso,
        application_count: Math.max(1, Number(existing.application_count) || 1) + 1,
    };

    if (!existing.first_application_at && existing.created_at) {
        update.first_application_at = existing.created_at;
    }

    for (const key of STANDARD_MERGE_KEYS) {
        const merged = pickMergedValue(existing[key], incoming[key]);
        if (merged !== undefined && merged !== existing[key]) {
            update[key] = merged;
        }
    }

    const mergedBulk = mergeBulkColumnValues(
        existing.bulk_column_values as Record<string, unknown> | undefined,
        incoming.bulk_column_values,
        customColumns
    );
    if (mergedBulk) {
        update.bulk_column_values = mergedBulk;
    }

    if (isEmptyValue(existing.application_started_date)) {
        update.application_started_date = nowIso;
    }
    update.application_completed_date = nowIso;

    return update;
}

export async function processTallyCandidateUpsert(
    supabase: SupabaseClient,
    params: {
        processId: string;
        appName: string;
        stageId: string;
        candidateData: TallyCandidateInsert;
        customColumns?: CustomColumn[];
    }
): Promise<TallyUpsertResult> {
    const { processId, appName, stageId, candidateData } = params;
    const customColumns = params.customColumns || [];
    const nowIso = new Date().toISOString();

    ensureTallyCandidateEmail(candidateData);

    const existing = await findExistingCandidateInProcess(
        supabase,
        processId,
        appName,
        candidateData
    );

    if (existing?.id) {
        const updatePayload = buildMergeUpdatePayload(
            existing,
            candidateData,
            customColumns,
            nowIso
        );

        const applyUpdate = async (payload: Record<string, unknown>, selectFields: string) =>
            supabase
                .from('candidates')
                .update(payload)
                .eq('id', existing.id)
                .eq('app_name', appName)
                .select(selectFields)
                .single();

        let updated: { id: string; application_count?: number } | null = null;
        let { data, error: updateError } = await applyUpdate(updatePayload, 'id, application_count');

        if (updateError && isMissingColumnError(updateError)) {
            const fallbackPayload = { ...updatePayload };
            delete fallbackPayload.application_count;
            delete fallbackPayload.first_application_at;
            ({ data, error: updateError } = await applyUpdate(fallbackPayload, 'id'));
        }

        if (updateError) throw updateError;
        updated = data as { id: string; application_count?: number };

        const computedCount =
            updated.application_count != null
                ? Number(updated.application_count)
                : Math.max(1, Number(existing.application_count) || 1) + 1;

        await supabase.from('candidate_history').insert({
            candidate_id: existing.id,
            stage_id: (existing.stage_id as string) || stageId,
            moved_at: nowIso,
            moved_by: null,
            app_name: appName,
        });

        return {
            candidateId: updated.id as string,
            isReapplication: true,
            applicationCount: computedCount,
        };
    }

    const bulkValues = candidateData.bulk_column_values;
    const insertPayload = { ...candidateData };
    delete insertPayload.bulk_column_values;

    const baseInsert = {
        ...insertPayload,
        created_at: nowIso,
        application_started_date: nowIso,
        application_completed_date: nowIso,
    };

    let created: { id: string; application_count?: number } | null = null;
    let insertError: { message?: string; code?: string } | null = null;

    ({ data: created, error: insertError } = await supabase
        .from('candidates')
        .insert({
            ...baseInsert,
            first_application_at: nowIso,
            application_count: 1,
            registration_origin: 'formulario',
        })
        .select('id, application_count')
        .single());

    if (insertError && isMissingColumnError(insertError)) {
        ({ data: created, error: insertError } = await supabase
            .from('candidates')
            .insert({
                ...baseInsert,
                registration_origin: 'formulario',
            })
            .select('id')
            .single());
    }

    if (insertError && isMissingColumnError(insertError)) {
        ({ data: created, error: insertError } = await supabase
            .from('candidates')
            .insert(baseInsert)
            .select('id')
            .single());
    }

    if (insertError) throw insertError;
    if (!created) throw new Error('No se pudo crear el candidato');

    if (bulkValues && Object.keys(bulkValues).length > 0) {
        const { error: bulkError } = await supabase
            .from('candidates')
            .update({ bulk_column_values: bulkValues })
            .eq('id', created.id);
        if (bulkError) {
            console.warn('bulk_column_values no guardado:', bulkError.message);
        }
    }

    await supabase.from('candidate_history').insert({
        candidate_id: created.id,
        stage_id: stageId,
        moved_at: nowIso,
        moved_by: null,
        app_name: appName,
    });

    return {
        candidateId: created.id as string,
        isReapplication: false,
        applicationCount: created.application_count != null ? Number(created.application_count) : 1,
    };
}
