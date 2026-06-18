import { supabase } from '../supabase';
import { APP_NAME } from '../appConfig';
import type { BulkProcessConfig } from '../../types';
import { candidatesApi } from './candidates';
import { bulkCandidatesApi } from './bulkCandidates';
import {
    buildDuplicateCandidatePayload,
    extractBulkColumnValuesFromRow,
    remapBulkColumnValuesBetweenProcesses,
    type BulkCandidateTransferMode,
} from '../bulkCandidateTransfer';
import { isMissingColumnError } from '../supabaseColumnErrors';

const TRANSFER_SELECT_VARIANTS = [
    'id, name, email, phone, phone2, dni, age, source, province, district, description, salary_expectation, agreed_salary, linkedin_url, address, score_ia, metadata_ia, stage_id, process_id, bulk_column_values, registration_origin',
    'id, name, email, phone, dni, age, source, province, district, description, score_ia, metadata_ia, stage_id, process_id, bulk_column_values',
    'id, name, email, phone, dni, age, source, province, district, stage_id, process_id',
];

export interface BulkCandidateTransferParams {
    candidateIds: string[];
    sourceProcessId: string;
    targetProcessId: string;
    targetStageId: string;
    mode: BulkCandidateTransferMode;
    sourceConfig?: BulkProcessConfig;
    targetConfig?: BulkProcessConfig;
    movedBy?: string;
    createdBy?: string;
    createdByName?: string;
    onProgress?: (done: number, total: number) => void;
}

export interface BulkCandidateTransferResult {
    success: number;
    failed: Array<{ candidateId: string; name: string; error: string }>;
    createdIds: string[];
}

async function loadTransferRows(candidateIds: string[]): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; offset < candidateIds.length; offset += 100) {
        const chunk = candidateIds.slice(offset, offset + 100);
        let chunkRows: Record<string, unknown>[] | null = null;
        for (const select of TRANSFER_SELECT_VARIANTS) {
            const { data, error } = await supabase
                .from('candidates')
                .select(select)
                .in('id', chunk)
                .eq('app_name', APP_NAME);
            if (!error && data) {
                chunkRows = data as Record<string, unknown>[];
                break;
            }
            if (error && !isMissingColumnError(error)) throw error;
        }
        if (!chunkRows) throw new Error('No se pudieron cargar los candidatos para trasladar');
        rows.push(...chunkRows);
    }
    return rows;
}

async function moveOneCandidate(
    row: Record<string, unknown>,
    params: BulkCandidateTransferParams
): Promise<void> {
    const id = row.id as string;
    const sourceColumns = params.sourceConfig?.customColumns || [];
    const targetColumns = params.targetConfig?.customColumns || [];
    const sourceValues = extractBulkColumnValuesFromRow(row, sourceColumns, params.sourceConfig);
    const remapped = remapBulkColumnValuesBetweenProcesses(
        sourceValues,
        sourceColumns,
        params.sourceConfig,
        targetColumns
    );

    const update: Record<string, unknown> = {
        process_id: params.targetProcessId,
        stage_id: params.targetStageId,
        discarded: false,
        archived: false,
        discarded_at: null,
        archived_at: null,
    };

    if (Object.keys(remapped).length > 0) {
        update.bulk_column_values = remapped;
    }

    const { error } = await supabase
        .from('candidates')
        .update(update)
        .eq('id', id)
        .eq('app_name', APP_NAME);

    if (error) {
        if (isMissingColumnError(error) && update.bulk_column_values) {
            delete update.bulk_column_values;
            const { error: retryError } = await supabase
                .from('candidates')
                .update(update)
                .eq('id', id)
                .eq('app_name', APP_NAME);
            if (retryError) throw retryError;
        } else {
            throw error;
        }
    }

    await supabase.from('candidate_history').insert({
        candidate_id: id,
        stage_id: params.targetStageId,
        moved_at: new Date().toISOString(),
        moved_by: params.movedBy || null,
        app_name: APP_NAME,
    });
}

async function duplicateOneCandidate(
    row: Record<string, unknown>,
    params: BulkCandidateTransferParams,
    rowIndex: number
): Promise<string> {
    const payload = buildDuplicateCandidatePayload(
        row,
        params.targetProcessId,
        params.targetStageId,
        rowIndex
    );

    const created = await candidatesApi.create(payload, params.createdBy, {
        createdByName: params.createdByName,
    });

    const sourceColumns = params.sourceConfig?.customColumns || [];
    const targetColumns = params.targetConfig?.customColumns || [];
    const sourceValues = extractBulkColumnValuesFromRow(row, sourceColumns, params.sourceConfig);
    const remapped = remapBulkColumnValuesBetweenProcesses(
        sourceValues,
        sourceColumns,
        params.sourceConfig,
        targetColumns
    );

    const patch: Record<string, unknown> = {};
    if (row.score_ia != null) patch.score_ia = row.score_ia;
    if (row.metadata_ia) patch.metadata_ia = row.metadata_ia;
    if (Object.keys(remapped).length > 0) {
        patch.bulk_column_values = remapped;
    }

    if (Object.keys(patch).length > 0) {
        const { error } = await supabase
            .from('candidates')
            .update(patch)
            .eq('id', created.id)
            .eq('app_name', APP_NAME);
        if (error && !(isMissingColumnError(error) && patch.bulk_column_values)) {
            console.warn('No se pudieron copiar algunos campos al duplicar:', error.message);
        } else if (error && patch.bulk_column_values) {
            delete patch.bulk_column_values;
            if (Object.keys(patch).length > 0) {
                await supabase.from('candidates').update(patch).eq('id', created.id);
            }
        }
    }

    if (Object.keys(remapped).length > 0) {
        await bulkCandidatesApi.patchBulkColumnValues(created.id, remapped, targetColumns, {
            replace: true,
        });
    }

    return created.id;
}

export async function transferBulkCandidates(
    params: BulkCandidateTransferParams
): Promise<BulkCandidateTransferResult> {
    const { candidateIds, mode } = params;
    if (candidateIds.length === 0) {
        return { success: 0, failed: [], createdIds: [] };
    }

    const rows = await loadTransferRows(candidateIds);
    const rowById = new Map(rows.map(r => [r.id as string, r]));
    const failed: BulkCandidateTransferResult['failed'] = [];
    const createdIds: string[] = [];
    let success = 0;
    let done = 0;

    for (let i = 0; i < candidateIds.length; i++) {
        const id = candidateIds[i];
        const row = rowById.get(id);
        const name = (row?.name as string) || id;
        if (!row) {
            failed.push({ candidateId: id, name, error: 'Candidato no encontrado' });
            done++;
            params.onProgress?.(done, candidateIds.length);
            continue;
        }

        try {
            if (mode === 'move') {
                await moveOneCandidate(row, params);
            } else {
                const newId = await duplicateOneCandidate(row, params, i);
                createdIds.push(newId);
            }
            success++;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            failed.push({ candidateId: id, name, error: message });
        }

        done++;
        params.onProgress?.(done, candidateIds.length);
    }

    return { success, failed, createdIds };
}
