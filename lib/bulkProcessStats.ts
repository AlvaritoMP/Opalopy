import { BulkCandidate } from './api/bulkCandidates';
import {
    CONTACT_STATUS_META,
    normalizeContactStatus,
} from './contactTracking';
import {
    CONTACT_COLUMN_IDS,
    getLatestContactActorFromCandidate,
    formatLatestContactActorDisplay,
} from './contactChannelConfig';
import {
    formatHiredStageActorDisplay,
    HiredStageActor,
} from './hiringStageTracking';
import {
    CustomColumn,
    BulkProcessConfig,
    BulkProcessStatChart,
    BulkStatChartType,
    BulkStatAxisConfig,
    BulkStatSeries,
    BulkStatSortBy,
    BulkStatDateGranularity,
    BulkStatSeriesMode,
    IdealProfileConfig,
    Process,
} from '../types';
import {
    getColumnLabel,
    resolveBulkTableCellValue,
    resolveStandardFieldValue,
    formatCustomCellDisplay,
    formatBulkDate,
    shouldApplyScoreAutoFilter,
} from './bulkTableColumns';
import { computeProfileMatch } from './bulkIdealProfileMatch';
import { extractRouteCostTotal } from './routeCostStorage';

export type BulkStatValueKind = 'categorical' | 'numeric' | 'date';

export interface BulkStatColumnOption {
    id: string;
    label: string;
    valueKind: BulkStatValueKind;
    suggestedChart: BulkStatChartType;
}

export interface BulkStatDatum {
    name: string;
    value: number;
    /** Timestamp para orden cronológico en agrupaciones de fecha */
    sortKey?: number;
}

/** Fila para gráficos con varias series (Recharts) */
export type BulkStatMergedRow = Record<string, string | number> & {
    name: string;
    _sortKey?: number;
};

export interface BulkStatResolvedSeries {
    id: string;
    columnId: string;
    label: string;
    color: string;
    dataKey: string;
}

export interface BulkStatContext {
    process?: Process;
    bulkConfig?: BulkProcessConfig;
    customColumns: CustomColumn[];
    columnValues: Record<string, Record<string, unknown>>;
    legacyColumnIdToName: Record<string, string>;
    hiringStageActors?: Record<string, HiredStageActor>;
    idealProfileConfig?: IdealProfileConfig | null;
}

const NON_CHARTABLE = new Set([
    'name',
    'email',
    'phone',
    'schedule',
    'nextInterview',
]);

const CHARTABLE_BASE = new Set([
    'stage',
    'source',
    'province',
    'district',
    'status',
    'scoreIa',
    'profileMatch',
    'createdAt',
    'dni',
    'contactPhone',
    'contactWhatsapp',
    'contactEmail',
    'contactLastUser',
    'hiredStageUser',
    ...CONTACT_COLUMN_IDS,
]);

const EMPTY_LABEL = 'Sin dato';
const OTHER_LABEL = 'Otros';
const MAX_CATEGORIES = 18;

function inferValueKind(columnId: string, customColumns: CustomColumn[]): BulkStatValueKind {
    if (columnId === 'scoreIa' || columnId === 'profileMatch') return 'numeric';
    if (columnId === 'createdAt') return 'date';
    if (columnId.startsWith('custom_')) {
        const col = customColumns.find(c => c.id === columnId.replace('custom_', ''));
        if (col?.type === 'number' || col?.type === 'route_cost') return 'numeric';
        if (col?.type === 'date') return 'date';
    }
    return 'categorical';
}

function suggestedChartFor(kind: BulkStatValueKind): BulkStatChartType {
    if (kind === 'date') return 'line';
    if (kind === 'numeric') return 'bar';
    return 'bar';
}

export function getBulkStatChartableColumns(
    customColumns: CustomColumn[],
    columnOrder: string[]
): BulkStatColumnOption[] {
    const options: BulkStatColumnOption[] = [];
    const seen = new Set<string>();

    for (const colId of columnOrder) {
        if (NON_CHARTABLE.has(colId) || seen.has(colId)) continue;

        if (colId.startsWith('custom_')) {
            const customId = colId.replace('custom_', '');
            const col = customColumns.find(c => c.id === customId);
            if (!col || col.type === 'route') continue;
            const valueKind = inferValueKind(colId, customColumns);
            options.push({
                id: colId,
                label: col.name,
                valueKind,
                suggestedChart: suggestedChartFor(valueKind),
            });
            seen.add(colId);
            continue;
        }

        if (CHARTABLE_BASE.has(colId)) {
            const valueKind = inferValueKind(colId, customColumns);
            options.push({
                id: colId,
                label: getColumnLabel(colId, customColumns),
                valueKind,
                suggestedChart: suggestedChartFor(valueKind),
            });
            seen.add(colId);
        }
    }

    for (const col of customColumns) {
        const colId = `custom_${col.id}`;
        if (seen.has(colId) || col.type === 'route') continue;
        const valueKind = inferValueKind(colId, customColumns);
        options.push({
            id: colId,
            label: col.name,
            valueKind,
            suggestedChart: suggestedChartFor(valueKind),
        });
    }

    return options;
}

function scoreStatusLabel(score: number | undefined, bulkConfig?: BulkProcessConfig): string {
    if (score === undefined || score === null) return EMPTY_LABEL;
    if (shouldApplyScoreAutoFilter(bulkConfig)) return 'Apto (filtro automático)';
    if (score >= 70) return 'Alto';
    if (score >= 50) return 'Medio';
    return 'Bajo';
}

function bucketScore(score: number, step = 10): string {
    const low = Math.floor(score / step) * step;
    const high = Math.min(low + step - 1, 100);
    return `${low}–${high}`;
}

function bucketNumeric(value: number, step: number): string {
    const low = Math.floor(value / step) * step;
    return `${low}–${low + step - 1}`;
}

function chooseNumericStep(min: number, max: number): number {
    const span = max - min;
    if (span <= 10) return 1;
    if (span <= 50) return 5;
    if (span <= 200) return 10;
    return Math.ceil(span / 10);
}

function formatMonthLabel(isoDate: string): string {
    try {
        const d = new Date(isoDate);
        if (Number.isNaN(d.getTime())) return isoDate;
        return d.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' });
    } catch {
        return isoDate;
    }
}

function startOfWeek(d: Date): Date {
    const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    return copy;
}

export function formatDateBucketLabel(
    d: Date,
    granularity: BulkStatDateGranularity
): { label: string; sortKey: number } {
    switch (granularity) {
        case 'day': {
            const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            return {
                label: start.toLocaleDateString('es-PE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                }),
                sortKey: start.getTime(),
            };
        }
        case 'week': {
            const start = startOfWeek(d);
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            return {
                label: `${start.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}`,
                sortKey: start.getTime(),
            };
        }
        case 'year': {
            const start = new Date(d.getFullYear(), 0, 1);
            return { label: String(d.getFullYear()), sortKey: start.getTime() };
        }
        case 'month':
        default: {
            const start = new Date(d.getFullYear(), d.getMonth(), 1);
            return {
                label: start.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' }),
                sortKey: start.getTime(),
            };
        }
    }
}

function resolveBulkStatDateRaw(
    candidate: BulkCandidate,
    columnId: string,
    ctx: BulkStatContext
): unknown {
    if (columnId === 'createdAt') return candidate.createdAt;
    if (columnId.startsWith('custom_')) {
        const customId = columnId.replace('custom_', '');
        return resolveBulkTableCellValue(
            candidate,
            customId,
            ctx.customColumns,
            ctx.columnValues,
            ctx.legacyColumnIdToName
        );
    }
    return null;
}

export function parseBulkStatDateValue(raw: unknown): Date | null {
    if (raw === undefined || raw === null || raw === '') return null;
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;

    if (typeof raw === 'number') {
        if (raw > 1e12) {
            const d = new Date(raw);
            return Number.isNaN(d.getTime()) ? null : d;
        }
        const formatted = formatBulkDate(raw);
        if (formatted) return parseBulkStatDateValue(formatted);
        return null;
    }

    const trimmed = String(raw).trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const d = new Date(trimmed);
        if (!Number.isNaN(d.getTime())) return d;
    }

    const dmy = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (dmy) {
        const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
        if (!Number.isNaN(d.getTime())) return d;
    }

    const formatted = formatBulkDate(trimmed);
    if (formatted) {
        const fromFormatted = formatted.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (fromFormatted) {
            const d = new Date(
                Number(fromFormatted[3]),
                Number(fromFormatted[2]) - 1,
                Number(fromFormatted[1])
            );
            if (!Number.isNaN(d.getTime())) return d;
        }
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return new Date(parsed);
    return null;
}

export function getDefaultDateGranularity(columnId: string): BulkStatDateGranularity {
    return columnId === 'createdAt' ? 'month' : 'day';
}

export function chartHasDateColumn(
    chart: BulkProcessStatChart,
    columnOptions: BulkStatColumnOption[]
): boolean {
    return getChartSeries(chart).some(s => {
        const col = columnOptions.find(c => c.id === s.columnId);
        return col?.valueKind === 'date';
    });
}

export function resolveChartDateGranularity(
    chart: BulkProcessStatChart,
    columnOptions: BulkStatColumnOption[]
): BulkStatDateGranularity | undefined {
    if (!chartHasDateColumn(chart, columnOptions)) return undefined;
    if (chart.dateGranularity) return chart.dateGranularity;
    const dateSeries = getChartSeries(chart).find(s => {
        const col = columnOptions.find(c => c.id === s.columnId);
        return col?.valueKind === 'date';
    });
    return getDefaultDateGranularity(dateSeries?.columnId ?? chart.columnId);
}

/** Etiqueta agrupable para gráficos (sin fechas/horas extensas en contacto). */
export function resolveBulkStatCellLabel(
    candidate: BulkCandidate,
    columnId: string,
    ctx: BulkStatContext
): string {
    const {
        process,
        bulkConfig,
        customColumns,
        columnValues,
        legacyColumnIdToName,
        hiringStageActors,
        idealProfileConfig,
    } = ctx;

    if (columnId === 'stage') {
        const stage = process?.stages.find(s => s.id === candidate.stageId);
        return stage?.name || EMPTY_LABEL;
    }
    if (columnId === 'status') {
        return scoreStatusLabel(candidate.scoreIa, bulkConfig);
    }
    if (columnId === 'scoreIa') {
        if (candidate.scoreIa === undefined || candidate.scoreIa === null) return EMPTY_LABEL;
        return bucketScore(candidate.scoreIa);
    }
    if (columnId === 'profileMatch') {
        if (!idealProfileConfig?.enabled) return 'Perfil ideal desactivado';
        const match = computeProfileMatch(
            candidate,
            idealProfileConfig,
            customColumns,
            columnValues,
            legacyColumnIdToName,
            bulkConfig
        );
        if (!match) return EMPTY_LABEL;
        return bucketScore(match.score);
    }
    if (columnId === 'source') {
        const v = resolveStandardFieldValue('source', candidate.id, candidate, columnValues, customColumns);
        return v.trim() || EMPTY_LABEL;
    }
    if (columnId === 'province') {
        const v = resolveStandardFieldValue('province', candidate.id, candidate, columnValues, customColumns);
        return v.trim() || EMPTY_LABEL;
    }
    if (columnId === 'district') {
        const v = resolveStandardFieldValue('district', candidate.id, candidate, columnValues, customColumns);
        return v.trim() || EMPTY_LABEL;
    }
    if (columnId === 'dni') {
        return candidate.dni?.trim() || EMPTY_LABEL;
    }
    if (columnId === 'createdAt') {
        if (!candidate.createdAt) return EMPTY_LABEL;
        return formatMonthLabel(candidate.createdAt);
    }
    if (columnId === 'contactPhone' || columnId === 'contactWhatsapp' || columnId === 'contactEmail') {
        const summary =
            columnId === 'contactPhone' ? candidate.contactPhone
            : columnId === 'contactWhatsapp' ? candidate.contactWhatsapp
            : candidate.contactEmail;
        if (!summary) return CONTACT_STATUS_META.por_contactar.label;
        const status = normalizeContactStatus(summary.status);
        return CONTACT_STATUS_META[status].label;
    }
    if (columnId === 'contactLastUser') {
        const actor = getLatestContactActorFromCandidate(candidate);
        const who = formatLatestContactActorDisplay(actor);
        return who === '-' ? EMPTY_LABEL : who;
    }
    if (columnId === 'hiredStageUser') {
        const actor = hiringStageActors?.[candidate.id];
        const who = formatHiredStageActorDisplay(actor);
        return who === '-' ? EMPTY_LABEL : who;
    }
    if (columnId.startsWith('custom_')) {
        const customId = columnId.replace('custom_', '');
        const col = customColumns.find(c => c.id === customId);
        if (!col) return EMPTY_LABEL;
        const raw = resolveBulkTableCellValue(
            candidate,
            customId,
            customColumns,
            columnValues,
            legacyColumnIdToName
        );
        const display = formatCustomCellDisplay(raw, col);
        if (display === '-' || !display.trim()) return EMPTY_LABEL;
        if (col.type === 'number' && typeof raw === 'number') {
            return bucketNumeric(raw, chooseNumericStep(raw, raw));
        }
        if (col.type === 'route_cost') {
            const total = extractRouteCostTotal(raw);
            if (total == null) return EMPTY_LABEL;
            return bucketNumeric(total, chooseNumericStep(total, total));
        }
        if (col.type === 'date') {
            const formatted = formatBulkDate(raw);
            return formatted || EMPTY_LABEL;
        }
        return display;
    }

    return EMPTY_LABEL;
}

function aggregateNumericLabels(values: number[]): Map<string, number> {
    const valid = values.filter(v => !Number.isNaN(v));
    if (valid.length === 0) return new Map([[EMPTY_LABEL, 0]]);

    const unique = new Set(valid.map(v => String(v)));
    if (unique.size <= 15) {
        const counts = new Map<string, number>();
        for (const v of valid) {
            const key = String(v);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return counts;
    }

    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const step = chooseNumericStep(min, max);
    const counts = new Map<string, number>();
    for (const v of valid) {
        const key = bucketNumeric(v, step);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

export function aggregateBulkStatData(
    candidates: BulkCandidate[],
    columnId: string,
    ctx: BulkStatContext,
    options?: { dateGranularity?: BulkStatDateGranularity }
): BulkStatDatum[] {
    if (candidates.length === 0) return [];

    const kind = inferValueKind(columnId, ctx.customColumns);

    if (kind === 'date') {
        const granularity = options?.dateGranularity ?? getDefaultDateGranularity(columnId);
        const counts = new Map<string, number>();
        const sortKeys = new Map<string, number>();
        let empty = 0;

        for (const candidate of candidates) {
            const raw = resolveBulkStatDateRaw(candidate, columnId, ctx);
            const parsed = parseBulkStatDateValue(raw);
            if (!parsed) {
                empty += 1;
                continue;
            }
            const { label, sortKey } = formatDateBucketLabel(parsed, granularity);
            counts.set(label, (counts.get(label) ?? 0) + 1);
            if (!sortKeys.has(label)) sortKeys.set(label, sortKey);
        }

        if (empty > 0) {
            counts.set(EMPTY_LABEL, (counts.get(EMPTY_LABEL) ?? 0) + empty);
            sortKeys.set(EMPTY_LABEL, -1);
        }

        return mapCountsToChronologicalData(counts, sortKeys);
    }

    if (kind === 'numeric' && columnId.startsWith('custom_')) {
        const customId = columnId.replace('custom_', '');
        const col = ctx.customColumns.find(c => c.id === customId);
        const nums: number[] = [];
        let empty = 0;
        for (const c of candidates) {
            const raw = resolveBulkTableCellValue(
                c,
                customId,
                ctx.customColumns,
                ctx.columnValues,
                ctx.legacyColumnIdToName
            );
            if (raw === undefined || raw === null || raw === '') {
                empty += 1;
                continue;
            }
            const n = typeof raw === 'number' ? raw : Number(raw);
            if (Number.isNaN(n)) {
                empty += 1;
            } else {
                nums.push(n);
            }
        }
        const counts = aggregateNumericLabels(nums);
        if (empty > 0) counts.set(EMPTY_LABEL, (counts.get(EMPTY_LABEL) ?? 0) + empty);
        return mapCountsToSortedData(counts);
    }

    const counts = new Map<string, number>();
    for (const candidate of candidates) {
        const label = resolveBulkStatCellLabel(candidate, columnId, ctx);
        counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return collapseTopCategories(counts, MAX_CATEGORIES);
}

function mapCountsToChronologicalData(
    counts: Map<string, number>,
    sortKeys: Map<string, number>
): BulkStatDatum[] {
    return [...counts.entries()]
        .map(([name, value]) => ({
            name,
            value,
            sortKey: sortKeys.get(name),
        }))
        .sort((a, b) => {
            const ka = a.sortKey ?? 0;
            const kb = b.sortKey ?? 0;
            if (ka !== kb) return ka - kb;
            return a.name.localeCompare(b.name, 'es');
        });
}

function mapCountsToSortedData(counts: Map<string, number>): BulkStatDatum[] {
    const entries = [...counts.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    return entries;
}

function collapseTopCategories(counts: Map<string, number>, max: number): BulkStatDatum[] {
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length <= max) {
        return sorted.map(([name, value]) => ({ name, value }));
    }

    const top = sorted.slice(0, max - 1);
    const rest = sorted.slice(max - 1).reduce((sum, [, v]) => sum + v, 0);
    const data: BulkStatDatum[] = top.map(([name, value]) => ({ name, value }));
    if (rest > 0) data.push({ name: OTHER_LABEL, value: rest });
    return data;
}

export function createDefaultStatChart(columnId: string, chartType?: BulkStatChartType): BulkProcessStatChart {
    const id = `stat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return {
        id,
        columnId,
        chartType: chartType ?? 'bar',
        series: [createDefaultStatSeries(id, columnId)],
        showGrid: true,
        showLegend: true,
        sortBy: 'auto',
    };
}

export function createDefaultStatSeries(chartId: string, columnId: string): BulkStatSeries {
    return {
        id: `${chartId}-s-${Math.random().toString(36).slice(2, 7)}`,
        columnId,
    };
}

/** Normaliza gráficos antiguos (solo columnId) a la lista de series */
export function getChartSeries(chart: BulkProcessStatChart): BulkStatSeries[] {
    if (chart.series && chart.series.length > 0) return chart.series;
    return [{ id: `${chart.id}-primary`, columnId: chart.columnId }];
}

export function resolveChartSeries(
    chart: BulkProcessStatChart,
    columnOptions: BulkStatColumnOption[],
    colorPalette: string[]
): BulkStatResolvedSeries[] {
    return getChartSeries(chart).map((s, i) => {
        const col = columnOptions.find(c => c.id === s.columnId);
        return {
            id: s.id,
            columnId: s.columnId,
            label: s.label?.trim() || col?.label || s.columnId,
            color: s.color || colorPalette[i % colorPalette.length],
            dataKey: `s_${s.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
        };
    });
}

function sortCategoryNames(
    names: string[],
    rowByName: Map<string, BulkStatMergedRow>,
    primaryDataKey: string,
    sortBy: BulkStatSortBy | undefined
): string[] {
    const mode = sortBy ?? 'auto';
    const unique = [...new Set(names)];

    const hasSortKeys = unique.some(n => {
        const sk = rowByName.get(n)?._sortKey;
        return sk !== undefined && sk >= 0;
    });
    if (hasSortKeys && (mode === 'auto' || mode === 'category')) {
        return unique.sort((a, b) => {
            const ka = rowByName.get(a)?._sortKey ?? -1;
            const kb = rowByName.get(b)?._sortKey ?? -1;
            if (ka !== kb) return ka - kb;
            return a.localeCompare(b, 'es');
        });
    }

    if (mode === 'category') {
        return unique.sort((a, b) => a.localeCompare(b, 'es'));
    }

    const sumValue = (name: string) => {
        const row = rowByName.get(name);
        if (!row) return 0;
        const v = row[primaryDataKey];
        return typeof v === 'number' ? v : 0;
    };

    if (mode === 'valueAsc') {
        return unique.sort((a, b) => sumValue(a) - sumValue(b) || a.localeCompare(b, 'es'));
    }
    if (mode === 'valueDesc') {
        return unique.sort((a, b) => sumValue(b) - sumValue(a) || a.localeCompare(b, 'es'));
    }

    // auto: fechas tipo "ene 2024" y rangos numéricos en orden natural si aplica
    const monthLike = unique.every(n => /^\w{3}\.?\s+\d{4}$/i.test(n.trim()));
    if (monthLike) {
        return unique.sort((a, b) => {
            const da = Date.parse(a.replace('.', ''));
            const db = Date.parse(b.replace('.', ''));
            if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
            return a.localeCompare(b, 'es');
        });
    }

    const rangeLike = unique.every(n => /^\d+–\d+$/.test(n.trim()));
    if (rangeLike) {
        return unique.sort((a, b) => {
            const lowA = parseInt(a.split('–')[0], 10);
            const lowB = parseInt(b.split('–')[0], 10);
            if (!Number.isNaN(lowA) && !Number.isNaN(lowB)) return lowA - lowB;
            return a.localeCompare(b, 'es');
        });
    }

    return unique.sort((a, b) => sumValue(b) - sumValue(a) || a.localeCompare(b, 'es'));
}

export interface BulkStatChartDataBundle {
    rows: BulkStatMergedRow[];
    series: BulkStatResolvedSeries[];
    crossTab: boolean;
    crossTabHint?: string;
}

function customColumnForStat(columnId: string, ctx: BulkStatContext): CustomColumn | undefined {
    if (!columnId.startsWith('custom_')) return undefined;
    const customId = columnId.replace('custom_', '');
    return ctx.customColumns.find(c => c.id === customId);
}

/** Etiqueta agrupada para cruce (fecha, numérico en rangos o categoría). */
function resolveCrossTabCellLabel(
    candidate: BulkCandidate,
    columnId: string,
    ctx: BulkStatContext,
    dateGranularity?: BulkStatDateGranularity
): { label: string; sortKey?: number } {
    const kind = inferValueKind(columnId, ctx.customColumns);
    if (kind === 'date') {
        const raw = resolveBulkStatDateRaw(candidate, columnId, ctx);
        const parsed = parseBulkStatDateValue(raw);
        if (!parsed) return { label: EMPTY_LABEL, sortKey: -1 };
        const gran = dateGranularity ?? getDefaultDateGranularity(columnId);
        const bucket = formatDateBucketLabel(parsed, gran);
        return { label: bucket.label, sortKey: bucket.sortKey };
    }
    return { label: resolveBulkStatCellLabel(candidate, columnId, ctx) };
}

/** Etiqueta de eje X en un cruce A × B. */
function resolveCrossTabPrimaryLabel(
    candidate: BulkCandidate,
    columnId: string,
    ctx: BulkStatContext,
    dateGranularity?: BulkStatDateGranularity
): { label: string; sortKey?: number } {
    return resolveCrossTabCellLabel(candidate, columnId, ctx, dateGranularity);
}

/** Valor de la columna B para contar «cuántos de A también cumplen B». */
function resolveCrossTabSecondaryLabel(
    candidate: BulkCandidate,
    columnId: string,
    ctx: BulkStatContext,
    dateGranularity?: BulkStatDateGranularity
): string {
    return resolveCrossTabCellLabel(candidate, columnId, ctx, dateGranularity).label;
}

/** Categorías ordenadas para una columna (respeta opciones predefinidas de select). */
function getOrderedCategoryLabels(
    candidates: BulkCandidate[],
    columnId: string,
    ctx: BulkStatContext,
    options?: { includeAllSelectOptions?: boolean }
): string[] {
    const col = customColumnForStat(columnId, ctx);

    if (columnId === 'stage' && ctx.process?.stages?.length) {
        const names = ctx.process.stages.map(s => s.name);
        const hasEmpty = candidates.some(
            c => resolveBulkStatCellLabel(c, columnId, ctx) === EMPTY_LABEL
        );
        return hasEmpty ? [...names, EMPTY_LABEL] : names;
    }

    if (col?.type === 'select' && col.options?.length) {
        const ordered = [...col.options];
        const seen = new Set<string>(ordered);
        let hasEmpty = false;
        for (const c of candidates) {
            const label = resolveBulkStatCellLabel(c, columnId, ctx);
            if (label === EMPTY_LABEL) {
                hasEmpty = true;
            } else if (!seen.has(label)) {
                ordered.push(label);
                seen.add(label);
            }
        }
        if (hasEmpty && !seen.has(EMPTY_LABEL)) ordered.push(EMPTY_LABEL);
        return ordered;
    }

    if (col?.type === 'checkbox') {
        const hasEmpty = candidates.some(
            c => resolveBulkStatCellLabel(c, columnId, ctx) === EMPTY_LABEL
        );
        return hasEmpty ? ['Sí', 'No', EMPTY_LABEL] : ['Sí', 'No'];
    }

    const counts = new Map<string, number>();
    for (const c of candidates) {
        const label = resolveBulkStatCellLabel(c, columnId, ctx);
        counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    let entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));

    if (options?.includeAllSelectOptions === false && entries.length > MAX_CATEGORIES) {
        const top = entries.slice(0, MAX_CATEGORIES - 1);
        const rest = entries.slice(MAX_CATEGORIES - 1).reduce((sum, [, v]) => sum + v, 0);
        entries = rest > 0 ? [...top, [OTHER_LABEL, rest] as [string, number]] : top;
    }

    return entries.map(([name]) => name);
}

function resolveCrossTabDateGranularity(
    columnId: string,
    ctx: BulkStatContext,
    chartGranularity?: BulkStatDateGranularity
): BulkStatDateGranularity | undefined {
    if (inferValueKind(columnId, ctx.customColumns) !== 'date') return undefined;
    return chartGranularity ?? getDefaultDateGranularity(columnId);
}

/** Etiquetas del eje para un cruce: cualquier tipo de columna → grupos contables. */
function getCrossTabAxisCategories(
    candidates: BulkCandidate[],
    columnId: string,
    ctx: BulkStatContext,
    dateGranularity?: BulkStatDateGranularity
): string[] {
    const col = customColumnForStat(columnId, ctx);

    if (columnId === 'stage' && ctx.process?.stages?.length) {
        return getOrderedCategoryLabels(candidates, columnId, ctx, { includeAllSelectOptions: true });
    }
    if (col?.type === 'select' && col.options?.length) {
        return getOrderedCategoryLabels(candidates, columnId, ctx, { includeAllSelectOptions: true });
    }
    if (col?.type === 'checkbox') {
        return getOrderedCategoryLabels(candidates, columnId, ctx);
    }

    const seen = new Map<string, number>();
    for (const c of candidates) {
        const { label, sortKey } = resolveCrossTabCellLabel(c, columnId, ctx, dateGranularity);
        if (!seen.has(label)) seen.set(label, sortKey ?? seen.size);
    }

    return [...seen.entries()]
        .sort((a, b) => {
            const aKey = a[1];
            const bKey = b[1];
            if (aKey >= 0 && bKey >= 0 && aKey !== bKey) return aKey - bKey;
            return a[0].localeCompare(b[0], 'es');
        })
        .map(([name]) => name);
}

/**
 * Cruce A × B: sin restricción por tipo de columna.
 * El eje Y siempre es cantidad de candidatos que cumplen A y B a la vez.
 */
export function canUseCrossTab(
    chart: BulkProcessStatChart,
    columnOptions: BulkStatColumnOption[]
): boolean {
    if (chart.chartType === 'pie') return false;
    const series = getChartSeries(chart);
    if (series.length < 2) return false;

    const primary = columnOptions.find(c => c.id === series[0].columnId);
    const secondary = columnOptions.find(c => c.id === series[1].columnId);
    if (!primary || !secondary) return false;

    return series[0].columnId !== series[1].columnId;
}

export function crossTabBlockedReason(
    chart: BulkProcessStatChart,
    columnOptions: BulkStatColumnOption[]
): string | undefined {
    if (chart.chartType === 'pie') return 'El gráfico circular no admite cruce de dos columnas.';
    const series = getChartSeries(chart);
    if (series.length < 2) return undefined;
    if (series[0].columnId === series[1].columnId) {
        return 'Elija dos columnas distintas: A (eje X) y B (valores que se cuentan en el eje Y).';
    }
    const primary = columnOptions.find(c => c.id === series[0].columnId);
    const secondary = columnOptions.find(c => c.id === series[1].columnId);
    if (!primary || !secondary) return 'Columna no disponible para graficar.';
    return undefined;
}

/** Modo efectivo al combinar series (por defecto: cruce si es posible). */
export function resolveSeriesMode(
    chart: BulkProcessStatChart,
    columnOptions: BulkStatColumnOption[]
): BulkStatSeriesMode {
    const series = getChartSeries(chart);
    if (series.length < 2 || chart.chartType === 'pie') return 'overlay';
    if (chart.seriesMode === 'overlay') return 'overlay';
    if (chart.seriesMode === 'crossTab') {
        return canUseCrossTab(chart, columnOptions) ? 'crossTab' : 'overlay';
    }
    return canUseCrossTab(chart, columnOptions) ? 'crossTab' : 'overlay';
}

/** @deprecated Use resolveSeriesMode + canUseCrossTab */
export function shouldUseCrossTabMerge(
    chart: BulkProcessStatChart,
    columnOptions: BulkStatColumnOption[]
): boolean {
    return resolveSeriesMode(chart, columnOptions) === 'crossTab';
}

function buildCrossTabChartData(
    candidates: BulkCandidate[],
    chart: BulkProcessStatChart,
    resolvedSeries: BulkStatResolvedSeries[],
    ctx: BulkStatContext,
    columnOptions: BulkStatColumnOption[],
    colorPalette: string[]
): BulkStatChartDataBundle {
    const primarySeries = resolvedSeries[0];
    const secondarySeries = resolvedSeries[1];
    const primaryColumnId = primarySeries.columnId;
    const secondaryColumnId = secondarySeries.columnId;
    const chartDateGranularity = resolveChartDateGranularity(chart, columnOptions);
    const primaryKind = inferValueKind(primaryColumnId, ctx.customColumns);
    const primaryGranularity = resolveCrossTabDateGranularity(
        primaryColumnId,
        ctx,
        chartDateGranularity
    );
    const secondaryGranularity = resolveCrossTabDateGranularity(
        secondaryColumnId,
        ctx,
        chartDateGranularity
    );

    const primaryCategories = getCrossTabAxisCategories(
        candidates,
        primaryColumnId,
        ctx,
        primaryGranularity
    );
    const secondaryCategories = getCrossTabAxisCategories(
        candidates,
        secondaryColumnId,
        ctx,
        secondaryGranularity
    );

    const crossSeries: BulkStatResolvedSeries[] = secondaryCategories.map((cat, i) => ({
        id: `${secondarySeries.id}_x_${i}`,
        columnId: secondaryColumnId,
        label: cat,
        color: colorPalette[i % colorPalette.length],
        dataKey: `x_${i}`,
    }));

    const counts = new Map<string, Map<string, number>>();
    const sortKeys = new Map<string, number>();

    for (const candidate of candidates) {
        const { label: primaryLabel, sortKey } = resolveCrossTabPrimaryLabel(
            candidate,
            primaryColumnId,
            ctx,
            primaryGranularity
        );
        const secondaryLabel = resolveCrossTabSecondaryLabel(
            candidate,
            secondaryColumnId,
            ctx,
            secondaryGranularity
        );

        if (!counts.has(primaryLabel)) counts.set(primaryLabel, new Map());
        const inner = counts.get(primaryLabel)!;
        inner.set(secondaryLabel, (inner.get(secondaryLabel) ?? 0) + 1);

        if (sortKey !== undefined && !sortKeys.has(primaryLabel)) {
            sortKeys.set(primaryLabel, sortKey);
        }
    }

    const primaryOrder = new Map<string, number>();
    primaryCategories.forEach((name, idx) => primaryOrder.set(name, idx));
    for (const name of counts.keys()) {
        if (!primaryOrder.has(name)) primaryOrder.set(name, primaryCategories.length + primaryOrder.size);
    }

    const rowByName = new Map<string, BulkStatMergedRow>();

    const ensureRow = (name: string): BulkStatMergedRow => {
        let row = rowByName.get(name);
        if (!row) {
            row = { name };
            crossSeries.forEach((s, i) => {
                row![s.dataKey] = 0;
            });
            if (sortKeys.has(name)) row._sortKey = sortKeys.get(name);
            rowByName.set(name, row);
        }
        return row;
    };

    for (const primaryName of primaryOrder.keys()) {
        ensureRow(primaryName);
    }

    for (const [primaryName, inner] of counts) {
        const row = ensureRow(primaryName);
        secondaryCategories.forEach((cat, i) => {
            row[crossSeries[i].dataKey] = inner.get(cat) ?? 0;
        });
    }

    let orderedNames: string[];
    if (primaryKind === 'date') {
        const primaryDataKey = crossSeries[0]?.dataKey ?? 'x_0';
        orderedNames = sortCategoryNames(
            [...rowByName.keys()],
            rowByName,
            primaryDataKey,
            chart.sortBy
        );
    } else if (chart.sortBy === 'valueDesc' || chart.sortBy === 'valueAsc') {
        const primaryDataKey = crossSeries[0]?.dataKey ?? 'x_0';
        orderedNames = sortCategoryNames(
            [...rowByName.keys()],
            rowByName,
            primaryDataKey,
            chart.sortBy
        );
    } else {
        const extras = [...rowByName.keys()].filter(n => !primaryOrder.has(n));
        extras.sort((a, b) => a.localeCompare(b, 'es'));
        orderedNames = [
            ...primaryCategories.filter(n => rowByName.has(n)),
            ...extras,
        ];
        for (const name of rowByName.keys()) {
            if (!orderedNames.includes(name)) orderedNames.push(name);
        }
    }

    const primaryCol = columnOptions.find(c => c.id === primaryColumnId);
    const secondaryCol = columnOptions.find(c => c.id === secondaryColumnId);
    const extraSeries = resolvedSeries.length > 2 ? resolvedSeries.length - 2 : 0;

    const aLabel = primaryCol?.label ?? primaryColumnId;
    const bLabel = secondaryCol?.label ?? secondaryColumnId;
    let crossTabHint =
        `Por cada valor de «${aLabel}» en el eje X, el eje Y muestra cuántos candidatos ` +
        `también cumplen cada valor de «${bLabel}» (mismo sentido que Speech × Asistencia).`;
    if (extraSeries > 0) {
        crossTabHint += ` Solo se cruza con la 2.ª serie (${extraSeries} serie(s) adicional(es) omitida(s)).`;
    }

    return {
        rows: orderedNames.map(name => rowByName.get(name)!),
        series: crossSeries,
        crossTab: true,
        crossTabHint,
    };
}

export function resolveBulkStatChartData(
    candidates: BulkCandidate[],
    chart: BulkProcessStatChart,
    columnOptions: BulkStatColumnOption[],
    colorPalette: string[],
    ctx: BulkStatContext
): BulkStatChartDataBundle {
    const baseResolved = resolveChartSeries(chart, columnOptions, colorPalette);

    if (resolveSeriesMode(chart, columnOptions) === 'crossTab') {
        return buildCrossTabChartData(candidates, chart, baseResolved, ctx, columnOptions, colorPalette);
    }

    return {
        rows: mergeBulkStatSeriesData(candidates, chart, baseResolved, ctx, columnOptions),
        series: baseResolved,
        crossTab: false,
    };
}

export function mergeBulkStatSeriesData(
    candidates: BulkCandidate[],
    chart: BulkProcessStatChart,
    resolvedSeries: BulkStatResolvedSeries[],
    ctx: BulkStatContext,
    columnOptions: BulkStatColumnOption[]
): BulkStatMergedRow[] {
    if (resolvedSeries.length === 0) return [];

    const dateGranularity = resolveChartDateGranularity(chart, columnOptions);
    const rowByName = new Map<string, BulkStatMergedRow>();
    const allNames = new Set<string>();

    for (const series of resolvedSeries) {
        const col = columnOptions.find(c => c.id === series.columnId);
        const granularity =
            col?.valueKind === 'date'
                ? (dateGranularity ?? getDefaultDateGranularity(series.columnId))
                : undefined;

        const aggregated = aggregateBulkStatData(candidates, series.columnId, ctx, {
            dateGranularity: granularity,
        });
        for (const { name, value, sortKey } of aggregated) {
            allNames.add(name);
            const existing = rowByName.get(name) ?? { name };
            existing[series.dataKey] = value;
            if (sortKey !== undefined && existing._sortKey === undefined) {
                existing._sortKey = sortKey;
            }
            rowByName.set(name, existing);
        }
    }

    for (const name of allNames) {
        const row = rowByName.get(name)!;
        for (const series of resolvedSeries) {
            if (row[series.dataKey] === undefined) row[series.dataKey] = 0;
        }
    }

    const primaryKey = resolvedSeries[0]?.dataKey ?? 'value';
    const orderedNames = sortCategoryNames([...allNames], rowByName, primaryKey, chart.sortBy);
    return orderedNames.map(name => rowByName.get(name)!);
}

export function computeNumericAxisDomain(
    data: BulkStatMergedRow[],
    dataKeys: string[],
    axis?: BulkStatAxisConfig
): [number | 'auto', number | 'auto'] | [number, number] {
    const scale = axis?.scale ?? 'auto';
    let maxVal = 0;
    let minVal = Infinity;

    for (const row of data) {
        for (const key of dataKeys) {
            const v = row[key];
            if (typeof v === 'number' && !Number.isNaN(v)) {
                maxVal = Math.max(maxVal, v);
                minVal = Math.min(minVal, v);
            }
        }
    }

    if (minVal === Infinity) minVal = 0;

    const hasMin = axis?.min !== undefined && axis.min !== null && !Number.isNaN(axis.min);
    const hasMax = axis?.max !== undefined && axis.max !== null && !Number.isNaN(axis.max);

    if (scale === 'log') {
        const safeMin = hasMin ? Math.max(1, axis!.min!) : Math.max(1, minVal || 1);
        const safeMax = hasMax ? Math.max(safeMin + 1, axis!.max!) : Math.max(safeMin + 1, maxVal || 10);
        return [safeMin, safeMax];
    }

    if (hasMin || hasMax) {
        const lo = hasMin ? axis!.min! : 0;
        const hi = hasMax ? axis!.max! : Math.max(maxVal, lo + 1);
        return [lo, hi];
    }

    return ['auto', 'auto'];
}

export function getStatChartTitle(
    chart: BulkProcessStatChart,
    columnOptions: BulkStatColumnOption[],
    options?: { crossTab?: boolean }
): string {
    if (chart.title?.trim()) return chart.title.trim();
    const series = getChartSeries(chart);
    if (series.length > 1 && options?.crossTab) {
        const prim = columnOptions.find(c => c.id === series[0].columnId);
        const sec = columnOptions.find(c => c.id === series[1].columnId);
        const p = series[0].label?.trim() || prim?.label || series[0].columnId;
        const s = series[1].label?.trim() || sec?.label || series[1].columnId;
        return `${p} × ${s}`;
    }
    if (series.length > 1) {
        const labels = series
            .map(s => {
                const col = columnOptions.find(c => c.id === s.columnId);
                return s.label?.trim() || col?.label || s.columnId;
            })
            .filter(Boolean);
        return labels.join(' · ');
    }
    const col = columnOptions.find(c => c.id === chart.columnId);
    return col?.label ?? chart.columnId;
}
