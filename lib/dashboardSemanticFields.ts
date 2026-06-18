import type { CustomColumn, DashboardSemanticField } from '../types';
import {
    buildLegacyColumnIdToName,
    getCandidateColumnRow,
    normalizeColumnNameKey,
    resolveColumnValueFromRow,
} from './bulkTableColumns';

const YES_ATTENDANCE = new Set([
    'si',
    'sí',
    'yes',
    'y',
    '1',
    'true',
    'asistio',
    'asistió',
    'asistencia',
    'presente',
    'attended',
    'confirmado',
    'confirmada',
]);

const NO_ATTENDANCE = new Set([
    'no',
    'n',
    '0',
    'false',
    'ausente',
    'no asistio',
    'no asistió',
    'absent',
    'falto',
    'faltó',
    'no asistencia',
]);

export function parseYesNoAttendance(raw: unknown): boolean | null {
    if (raw === true || raw === 1) return true;
    if (raw === false || raw === 0) return false;
    if (raw == null || raw === '') return null;

    const normalized = String(raw)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (YES_ATTENDANCE.has(normalized)) return true;
    if (NO_ATTENDANCE.has(normalized)) return false;
    if (normalized.startsWith('si ') || normalized === 'si/no') return true;
    return null;
}

function columnNameMatchesSemantic(col: CustomColumn, field: DashboardSemanticField): boolean {
    const norm = normalizeColumnNameKey(col.name);
    if (field === 'interview_attendance') {
        return (
            /asist(encia|io|ió|e)/.test(norm) ||
            norm.includes('presente') ||
            norm.includes('asistio') ||
            norm.includes('confirmo cita') ||
            norm.includes('confirmacion cita')
        );
    }
    if (field === 'interview_date') {
        return (
            /fecha.*(cita|entrevista)/.test(norm) ||
            /(cita|entrevista).*fecha/.test(norm) ||
            norm === 'fecha cita' ||
            norm === 'fecha entrevista' ||
            norm === 'cita' ||
            norm === 'entrevista'
        );
    }
    return false;
}

export function columnMatchesDashboardSemantic(
    col: CustomColumn,
    field: DashboardSemanticField
): boolean {
    if (col.dashboardSemanticField === field) return true;
    return columnNameMatchesSemantic(col, field);
}

export function resolveCandidateDashboardSemanticField(
    candidate: { id: string; bulkColumnValues?: Record<string, unknown> },
    field: DashboardSemanticField,
    customColumns: CustomColumn[],
    columnValues: Record<string, Record<string, unknown>> = {},
    legacyColumnIdToName: Record<string, string> = {}
): unknown {
    const row = getCandidateColumnRow(candidate, columnValues);

    for (const col of customColumns) {
        if (!columnMatchesDashboardSemantic(col, field)) continue;
        const resolved = resolveColumnValueFromRow(row, col, legacyColumnIdToName);
        if (resolved !== undefined && resolved !== '' && resolved !== null) return resolved;
        if (resolved === false) return false;
    }

    return undefined;
}

export function resolveCandidateInterviewAttendance(
    candidate: { id: string; bulkColumnValues?: Record<string, unknown> },
    customColumns: CustomColumn[],
    columnValues: Record<string, Record<string, unknown>> = {},
    legacyColumnIdToName: Record<string, string> = {}
): boolean | null {
    const raw = resolveCandidateDashboardSemanticField(
        candidate,
        'interview_attendance',
        customColumns,
        columnValues,
        legacyColumnIdToName
    );
    return parseYesNoAttendance(raw);
}

export function resolveCandidateInterviewDateIso(
    candidate: { id: string; bulkColumnValues?: Record<string, unknown> },
    customColumns: CustomColumn[],
    columnValues: Record<string, Record<string, unknown>> = {},
    legacyColumnIdToName: Record<string, string> = {}
): string | undefined {
    const raw = resolveCandidateDashboardSemanticField(
        candidate,
        'interview_date',
        customColumns,
        columnValues,
        legacyColumnIdToName
    );
    if (raw == null || raw === '') return undefined;
    if (typeof raw === 'string' || typeof raw === 'number') {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    return undefined;
}

export function buildLegacyForProcess(
    bulkConfig: { columnKeyAliases?: Record<string, string> } | undefined,
    customColumns: CustomColumn[]
): Record<string, string> {
    return buildLegacyColumnIdToName(bulkConfig, customColumns);
}
