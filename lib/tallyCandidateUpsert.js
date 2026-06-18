/**
 * Upsert Tally → candidato (Node / webhooks). Mantener alineado con lib/tallyCandidateUpsert.ts
 */

import {
    enrichBulkColumnValuesForStorage,
    hasBulkCellValue,
    isPlaceholderImportEmail,
    normalizeDniKey,
    collectPhoneMatchKeys,
    buildBulkPlaceholderEmail,
} from './bulkTableColumns.js';

function isMissingColumnError(error) {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        msg.includes('schema cache') ||
        msg.includes('could not find') ||
        msg.includes('application_count') ||
        msg.includes('first_application_at') ||
        (msg.includes('column') && msg.includes('does not exist'))
    );
}

const STANDARD_MERGE_KEYS = [
    'name', 'email', 'phone', 'phone2', 'description', 'source',
    'salary_expectation', 'dni', 'linkedin_url', 'address', 'province', 'district', 'age',
];

const MATCH_SELECT_WITH_APPLICATION =
    'id, name, email, phone, phone2, description, source, salary_expectation, dni, linkedin_url, address, province, district, age, bulk_column_values, application_count, first_application_at, created_at, stage_id, application_started_date';

const MATCH_SELECT_BASE =
    'id, name, email, phone, phone2, description, source, salary_expectation, dni, linkedin_url, address, province, district, age, bulk_column_values, created_at, stage_id, application_started_date';

function normalizeEmailKey(email) {
    return (email || '').trim().toLowerCase();
}

function isEmptyValue(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    return false;
}

function pickMergedValue(existing, incoming) {
    if (!isEmptyValue(existing)) return existing;
    if (!isEmptyValue(incoming)) return incoming;
    return existing;
}

function mergeBulkColumnValues(existing, incoming, customColumns) {
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

function findRowByPhoneMatch(rows, incomingKeys) {
    if (!incomingKeys.length) return undefined;
    return rows.find(row => {
        const rowKeys = collectPhoneMatchKeys(row.phone, row.phone2);
        return incomingKeys.some(key => rowKeys.includes(key));
    });
}

function ensureTallyCandidateEmail(candidate) {
    if (candidate.email?.trim()) return;
    candidate.email = buildBulkPlaceholderEmail({
        rowNumber: 0,
        name: candidate.name,
        dni: candidate.dni,
        phone: candidate.phone || candidate.phone2,
        suffix: 'tally',
    });
}

export function matchExistingCandidateRow(rows, incoming) {
    const dniKey = normalizeDniKey(incoming.dni);
    const emailKey = normalizeEmailKey(incoming.email);
    const incomingPhoneKeys = collectPhoneMatchKeys(incoming.phone, incoming.phone2);
    const hasRealEmail = emailKey && !isPlaceholderImportEmail(emailKey);

    if (dniKey) {
        const byDni = rows.find(r => normalizeDniKey(r.dni) === dniKey);
        if (byDni) return byDni;
    }
    if (hasRealEmail) {
        const byEmail = rows.find(
            r => normalizeEmailKey(r.email) === emailKey && !isPlaceholderImportEmail(r.email)
        );
        if (byEmail) return byEmail;
    }
    return findRowByPhoneMatch(rows, incomingPhoneKeys);
}

export async function findExistingCandidateInProcess(supabase, processId, appName, incoming) {
    const dniKey = normalizeDniKey(incoming.dni);
    const emailKey = normalizeEmailKey(incoming.email);
    const incomingPhoneKeys = collectPhoneMatchKeys(incoming.phone, incoming.phone2);
    if (!dniKey && !emailKey && incomingPhoneKeys.length === 0) return null;

    let lastError = null;
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
        return matchExistingCandidateRow(data, incoming) || null;
    }

    if (lastError) throw lastError;
    return null;
}

function buildMergeUpdatePayload(existing, incoming, customColumns, nowIso) {
    const update = {
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
        existing.bulk_column_values,
        incoming.bulk_column_values,
        customColumns
    );
    if (mergedBulk) update.bulk_column_values = mergedBulk;

    if (isEmptyValue(existing.application_started_date)) {
        update.application_started_date = nowIso;
    }
    update.application_completed_date = nowIso;

    return update;
}

export async function processTallyCandidateUpsert(supabase, params) {
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
        const updatePayload = buildMergeUpdatePayload(existing, candidateData, customColumns, nowIso);

        let updated = null;
        let updateError = null;

        ({ data: updated, error: updateError } = await supabase
            .from('candidates')
            .update(updatePayload)
            .eq('id', existing.id)
            .eq('app_name', appName)
            .select('id, application_count')
            .single());

        if (updateError && isMissingColumnError(updateError)) {
            const fallbackPayload = { ...updatePayload };
            delete fallbackPayload.application_count;
            delete fallbackPayload.first_application_at;
            ({ data: updated, error: updateError } = await supabase
                .from('candidates')
                .update(fallbackPayload)
                .eq('id', existing.id)
                .eq('app_name', appName)
                .select('id')
                .single());
        }

        if (updateError) throw updateError;

        const computedCount =
            updated.application_count != null
                ? Number(updated.application_count)
                : Math.max(1, Number(existing.application_count) || 1) + 1;

        await supabase.from('candidate_history').insert({
            candidate_id: existing.id,
            stage_id: existing.stage_id || stageId,
            moved_at: nowIso,
            moved_by: null,
            app_name: appName,
        });

        return {
            candidateId: updated.id,
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

    let created = null;
    let insertError = null;

    ({ data: created, error: insertError } = await supabase
        .from('candidates')
        .insert({
            ...baseInsert,
            first_application_at: nowIso,
            application_count: 1,
        })
        .select('id, application_count')
        .single());

    if (insertError && isMissingColumnError(insertError)) {
        ({ data: created, error: insertError } = await supabase
            .from('candidates')
            .insert(baseInsert)
            .select('id')
            .single());
    }

    if (insertError) throw insertError;

    if (bulkValues && Object.keys(bulkValues).length > 0) {
        const { error: bulkError } = await supabase
            .from('candidates')
            .update({ bulk_column_values: bulkValues })
            .eq('id', created.id);
        if (bulkError) console.warn('bulk_column_values no guardado:', bulkError.message);
    }

    await supabase.from('candidate_history').insert({
        candidate_id: created.id,
        stage_id: stageId,
        moved_at: nowIso,
        moved_by: null,
        app_name: appName,
    });

    return {
        candidateId: created.id,
        isReapplication: false,
        applicationCount: created.application_count != null ? Number(created.application_count) : 1,
    };
}
