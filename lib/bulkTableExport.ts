import { BulkCandidate } from './api/bulkCandidates';
import { CONTACT_STATUS_META, getContactBadgeLabel } from './contactTracking';
import {
    getLatestContactActorFromCandidate,
    formatLatestContactActorDisplay,
} from './contactChannelConfig';
import {
    formatHiredStageActorDisplay,
    type HiredStageActor,
} from './hiringStageTracking';
import { BulkProcessConfig, CustomColumn, Process } from '../types';
import {
    formatCustomCellDisplay,
    getDisplayEmail,
    isPlaceholderImportEmail,
    mapImportHeader,
    resolveStandardFieldValue,
    shouldApplyScoreAutoFilter,
} from './bulkTableColumns';
import { formatRegistrationOrigin, resolveRegistrationOrigin, registrationOriginInputFromBulkCandidate } from './candidateRegistrationOrigin';
import { buildRouteColumnLink } from './transitRouteLinks';
import { extractRouteCostTotal } from './routeCostStorage';

export type BulkExportScope = 'current_view' | 'full_process' | 'selected';

/** Escapa campo para TSV/CSV cuando hay tabuladores o saltos de línea */
export function escapeDelimitedField(value: string, delimiter: string): string {
    const needsQuote =
        value.includes(delimiter) || value.includes('\t') || value.includes('\n') || value.includes('\r') || value.includes('"');
    if (!needsQuote) return value;
    return `"${value.replace(/"/g, '""')}"`;
}

function getCustomStoredValue(
    candidateId: string,
    columnId: string,
    candidate: BulkCandidate | undefined,
    columnValues: Record<string, Record<string, unknown>>,
    customColumns: CustomColumn[]
): unknown {
    const stored = columnValues[candidateId]?.[columnId];
    if (stored !== undefined && stored !== '') return stored;
    if (stored === false) return false;
    const col = customColumns.find(c => c.id === columnId);
    if (col && candidate) {
        const mapped = mapImportHeader(col.name.toLowerCase());
        if (mapped === 'age' && candidate.age != null) return candidate.age;
        if (mapped === 'source' && candidate.source) return candidate.source;
        if (mapped === 'province' && candidate.province) return candidate.province;
        if (mapped === 'district' && candidate.district) return candidate.district;
    }
    return '';
}

export function getBulkExportCellValue(
    colId: string,
    candidate: BulkCandidate,
    opts: {
        columnValues: Record<string, Record<string, unknown>>;
        customColumns: CustomColumn[];
        process?: Process;
        bulkConfig?: BulkProcessConfig;
        hiringStageActors?: Record<string, HiredStageActor>;
    }
): string {
    const { columnValues, customColumns, process, bulkConfig, hiringStageActors } = opts;
    const stages = process?.stages ?? [];

    if (colId === 'name') return candidate.name || '';
    if (colId === 'dni') return candidate.dni || '';
    if (colId === 'email') {
        const em = getDisplayEmail(candidate.email);
        return em || '';
    }
    if (colId === 'scoreIa') {
        return candidate.scoreIa !== undefined && candidate.scoreIa !== null ? String(candidate.scoreIa) : '';
    }
    if (colId === 'status') {
        if (candidate.scoreIa === undefined || candidate.scoreIa === null) return '';
        if (shouldApplyScoreAutoFilter(bulkConfig)) return 'Apto (filtro automático)';
        if (candidate.scoreIa >= 70) return 'Alto';
        if (candidate.scoreIa >= 50) return 'Medio';
        return 'Bajo';
    }
    if (colId === 'phone') return candidate.phone || '';
    if (colId === 'source') {
        return resolveStandardFieldValue('source', candidate.id, candidate, columnValues, customColumns) || '';
    }
    if (colId === 'registrationOrigin') {
        const { origin, inferred } = resolveRegistrationOrigin(
            registrationOriginInputFromBulkCandidate(candidate)
        );
        return formatRegistrationOrigin(origin, inferred);
    }
    if (colId === 'province') {
        return resolveStandardFieldValue('province', candidate.id, candidate, columnValues, customColumns) || '';
    }
    if (colId === 'district') {
        return resolveStandardFieldValue('district', candidate.id, candidate, columnValues, customColumns) || '';
    }
    if (colId === 'createdAt') {
        if (!candidate.createdAt) return '';
        try {
            return new Date(candidate.createdAt).toLocaleString('es-PE');
        } catch {
            return candidate.createdAt;
        }
    }
    if (colId === 'contactPhone' || colId === 'contactWhatsapp' || colId === 'contactEmail') {
        const ch =
            colId === 'contactPhone' ? candidate.contactPhone
            : colId === 'contactWhatsapp' ? candidate.contactWhatsapp
            : candidate.contactEmail;
        if (!ch) return '';
        const label = getContactBadgeLabel(ch.status, ch.attemptCount);
        const when = ch.lastAttemptAt
            ? new Date(ch.lastAttemptAt).toLocaleString('es-PE')
            : '';
        const who = ch.lastUserName ? ` · ${ch.lastUserName}` : '';
        return `${CONTACT_STATUS_META[ch.status].label}: ${label}${when ? ` · ${when}` : ''}${who}`;
    }
    if (colId === 'contactLastUser') {
        const actor = getLatestContactActorFromCandidate(candidate);
        if (!actor) return '';
        const who = formatLatestContactActorDisplay(actor);
        if (who === '-') return '';
        const when = actor.lastAttemptAt
            ? new Date(actor.lastAttemptAt).toLocaleString('es-PE')
            : '';
        const ch = actor.channelLabel ? `${actor.channelLabel} · ` : '';
        return `${ch}${who}${when ? ` · ${when}` : ''}`;
    }
    if (colId === 'hiredStageUser') {
        const actor = hiringStageActors?.[candidate.id];
        if (!actor) return '';
        const who = formatHiredStageActorDisplay(actor);
        if (who === '-') return '';
        const when = actor.movedAt ? new Date(actor.movedAt).toLocaleString('es-PE') : '';
        return when ? `${who} · ${when}` : who;
    }
    if (colId === 'nextInterview') {
        if (!candidate.nextInterviewAt) return '';
        try {
            return new Date(candidate.nextInterviewAt).toLocaleString('es-PE', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return candidate.nextInterviewAt;
        }
    }
    if (colId === 'schedule') {
        return '';
    }
    if (colId === 'stage') {
        const st = stages.find(s => s.id === candidate.stageId);
        return st?.name || candidate.stageId || '';
    }
    if (colId.startsWith('custom_')) {
        const cid = colId.replace('custom_', '');
        const col = customColumns.find(c => c.id === cid);
        if (!col) return '';
        if (col.type === 'route') {
            return buildRouteColumnLink(candidate, col, customColumns, columnValues) || '';
        }
        if (col.type === 'route_cost') {
            const raw = getCustomStoredValue(candidate.id, cid, candidate, columnValues, customColumns);
            const total = extractRouteCostTotal(raw);
            return total != null ? total.toFixed(2) : '';
        }
        const raw = getCustomStoredValue(candidate.id, cid, candidate, columnValues, customColumns);
        return formatCustomCellDisplay(raw, col);
    }
    return '';
}

type BulkExportCellOpts = {
    columnValues: Record<string, Record<string, unknown>>;
    customColumns: CustomColumn[];
    process?: Process;
    bulkConfig?: BulkProcessConfig;
    hiringStageActors?: Record<string, HiredStageActor>;
};

export type BulkSelectionCell = { candidateId: string; colId: string };

/** Construye texto TSV desde celdas seleccionadas (compatible con Excel / WhatsApp). */
export function buildBulkSelectionClipboardText(
    cells: BulkSelectionCell[],
    displayCandidates: BulkCandidate[],
    visibleColumns: string[],
    opts: BulkExportCellOpts
): string {
    if (cells.length === 0) return '';

    const sorted = [...cells].sort((a, b) => {
        const ra = displayCandidates.findIndex(c => c.id === a.candidateId);
        const rb = displayCandidates.findIndex(c => c.id === b.candidateId);
        if (ra !== rb) return ra - rb;
        return visibleColumns.indexOf(a.colId) - visibleColumns.indexOf(b.colId);
    });

    const rowIndices = sorted.map(c => displayCandidates.findIndex(cand => cand.id === c.candidateId));
    const colIndices = sorted.map(c => visibleColumns.indexOf(c.colId));
    const minR = Math.min(...rowIndices);
    const maxR = Math.max(...rowIndices);
    const minC = Math.min(...colIndices);
    const maxC = Math.max(...colIndices);

    const selectedSet = new Set(sorted.map(c => `${c.candidateId}::${c.colId}`));
    const lines: string[] = [];

    for (let r = minR; r <= maxR; r++) {
        const candidate = displayCandidates[r];
        if (!candidate) continue;
        const rowCells: string[] = [];
        for (let c = minC; c <= maxC; c++) {
            const colId = visibleColumns[c];
            const key = `${candidate.id}::${colId}`;
            if (!selectedSet.has(key) || !colId) {
                rowCells.push('');
                continue;
            }
            const value = getBulkExportCellValue(colId, candidate, opts);
            rowCells.push(escapeDelimitedField(value, '\t'));
        }
        lines.push(rowCells.join('\t'));
    }

    return lines.join('\n');
}

export function buildBulkTableExportDocument(
    columnIds: string[],
    candidates: BulkCandidate[],
    headerLabels: string[],
    opts: {
        columnValues: Record<string, Record<string, unknown>>;
        customColumns: CustomColumn[];
        process?: Process;
        bulkConfig?: BulkProcessConfig;
        delimiter?: '\t' | ';';
        hiringStageActors?: Record<string, HiredStageActor>;
    }
): string {
    const delimiter = opts.delimiter ?? '\t';
    const rows: string[] = [];
    rows.push(headerLabels.map(h => escapeDelimitedField(h, delimiter)).join(delimiter));
    for (const cand of candidates) {
        const line = columnIds
            .map(colId =>
                escapeDelimitedField(
                    getBulkExportCellValue(colId, cand, {
                        columnValues: opts.columnValues,
                        customColumns: opts.customColumns,
                        process: opts.process,
                        bulkConfig: opts.bulkConfig,
                        hiringStageActors: opts.hiringStageActors,
                    }),
                    delimiter
                )
            )
            .join(delimiter);
        rows.push(line);
    }
    return rows.join('\n');
}

/** Columnas que suelen omitirse en una “lista para cliente” (solo UI) */
export const CLIENT_EXPORT_EXCLUDE_COLUMN_IDS = ['contact', 'schedule'] as const;
