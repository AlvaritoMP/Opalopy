import type { BulkProcessConfig, Candidate, CustomColumn } from '../types';
import {
    buildLegacyColumnIdToName,
    enrichBulkColumnValuesForStorage,
    hasBulkCellValue,
    normalizeColumnNameKey,
    resolveBulkColumnValuesFromRow,
    resolveColumnValueFromRow,
} from './bulkTableColumns';

export type BulkCandidateTransferMode = 'move' | 'duplicate';

/** Remapea valores de columnas personalizadas por nombre de columna al proceso destino. */
export function remapBulkColumnValuesBetweenProcesses(
    sourceValues: Record<string, unknown>,
    sourceColumns: CustomColumn[],
    sourceConfig: BulkProcessConfig | undefined,
    targetColumns: CustomColumn[]
): Record<string, unknown> {
    if (targetColumns.length === 0) return {};

    const legacy = buildLegacyColumnIdToName(sourceConfig, sourceColumns);
    const targetByName = new Map(
        targetColumns.map(c => [normalizeColumnNameKey(c.name), c])
    );
    const result: Record<string, unknown> = {};

    for (const col of sourceColumns) {
        const val = resolveColumnValueFromRow(sourceValues, col, legacy);
        if (!hasBulkCellValue(val)) continue;
        const target = targetByName.get(normalizeColumnNameKey(col.name));
        if (target) result[target.id] = val;
    }

    for (const [key, raw] of Object.entries(sourceValues)) {
        if (!hasBulkCellValue(raw)) continue;
        const col = sourceColumns.find(c => c.id === key);
        if (col) continue;
        const label = legacy[key] || key;
        const target = targetByName.get(normalizeColumnNameKey(label));
        if (target && result[target.id] === undefined) {
            result[target.id] = raw;
        }
    }

    return enrichBulkColumnValuesForStorage(result, targetColumns);
}

export function extractBulkColumnValuesFromRow(
    row: Record<string, unknown>,
    sourceColumns: CustomColumn[],
    sourceConfig?: BulkProcessConfig
): Record<string, unknown> {
    const legacy = buildLegacyColumnIdToName(sourceConfig, sourceColumns);
    const fromJson = (row.bulk_column_values as Record<string, unknown>) || {};
    const result: Record<string, unknown> = { ...fromJson };
    for (const col of sourceColumns) {
        const val = resolveColumnValueFromRow(fromJson, col, legacy);
        if (hasBulkCellValue(val)) {
            result[col.id] = val;
        }
    }
    return result;
}

export function buildDuplicateCandidatePayload(
    row: Record<string, unknown>,
    targetProcessId: string,
    targetStageId: string,
    rowIndex: number
): Omit<Candidate, 'id' | 'history'> {
    const name = String(row.name || '').trim() || 'Sin nombre';
    const dni = (row.dni as string) || undefined;
    const phone = (row.phone as string) || undefined;
    const rawEmail = (row.email as string) || undefined;

    let email = rawEmail?.trim() || '';
    if (!email || !email.includes('@')) {
        const slug = (dni || phone || `${rowIndex + 1}`).replace(/\W/g, '').slice(0, 24);
        email = `sin-email-${slug}-${Date.now()}@bulk.local`;
    }

    return {
        name,
        email,
        phone,
        phone2: (row.phone2 as string) || undefined,
        processId: targetProcessId,
        stageId: targetStageId,
        description: (row.description as string) || undefined,
        attachments: [],
        source: (row.source as string) || undefined,
        salaryExpectation: (row.salary_expectation as string) || undefined,
        agreedSalary: (row.agreed_salary as string) || undefined,
        age: row.age != null ? Number(row.age) : undefined,
        dni,
        linkedinUrl: (row.linkedin_url as string) || undefined,
        address: (row.address as string) || undefined,
        province: (row.province as string) || undefined,
        district: (row.district as string) || undefined,
        discarded: false,
        archived: false,
        registrationOrigin: 'masivo',
    };
}
