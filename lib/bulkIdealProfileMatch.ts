import { BulkCandidate } from './api/bulkCandidates';
import {
    CustomColumn,
    IdealProfileConfig,
    IdealProfileCriterion,
    IdealProfileMatchMode,
    BulkProcessConfig,
} from '../types';
import {
    formatBulkDate,
    getColumnLabel,
    mapImportHeader,
    normalizeColumnNameKey,
    resolveBulkTableCellValue,
    resolveCandidateHomonymField,
    resolveStandardFieldValue,
    buildLegacyColumnIdToName,
    buildLegacyFromColumnOrder,
} from './bulkTableColumns';
import { CONTACT_COLUMN_IDS } from './contactChannelConfig';
import { extractRouteCostTotal } from './routeCostStorage';

/** Columnas base comparables (excluye acciones, contacto, identidad pura) */
export const IDEAL_PROFILE_BASE_FIELDS = [
    'dni',
    'email',
    'phone',
    'source',
    'province',
    'district',
] as const;

export type IdealProfileFieldType = CustomColumn['type'];

export interface IdealProfileFieldDef {
    fieldId: string;
    label: string;
    type: IdealProfileFieldType;
    options?: string[];
}

const NON_COMPARABLE = new Set([
    'name',
    'scoreIa',
    'status',
    'profileMatch',
    'createdAt',
    'nextInterview',
    'schedule',
    'stage',
    'contactLastUser',
    'hiredStageUser',
    ...CONTACT_COLUMN_IDS,
]);

export function getIdealProfileFieldType(
    fieldId: string,
    customColumns: CustomColumn[]
): IdealProfileFieldType {
    if (fieldId.startsWith('custom_')) {
        const col = customColumns.find(c => c.id === fieldId.replace('custom_', ''));
        if (col?.type === 'route_cost') return 'route_cost';
        return col?.type || 'text';
    }
    return 'text';
}

export function getIdealProfileAvailableFields(
    customColumns: CustomColumn[],
    columnOrder: string[]
): IdealProfileFieldDef[] {
    const fields: IdealProfileFieldDef[] = [];
    const seen = new Set<string>();

    for (const colId of columnOrder) {
        if (NON_COMPARABLE.has(colId) || seen.has(colId)) continue;

        if (colId.startsWith('custom_')) {
            const col = customColumns.find(c => c.id === colId.replace('custom_', ''));
            if (!col || col.type === 'route') continue;
            fields.push({
                fieldId: colId,
                label: col.name,
                type: col.type,
                options: col.options,
            });
            seen.add(colId);
            continue;
        }

        if ((IDEAL_PROFILE_BASE_FIELDS as readonly string[]).includes(colId)) {
            fields.push({
                fieldId: colId,
                label: getColumnLabel(colId, customColumns),
                type: 'text',
            });
            seen.add(colId);
        }
    }

    for (const colId of IDEAL_PROFILE_BASE_FIELDS) {
        if (seen.has(colId)) continue;
        fields.push({
            fieldId: colId,
            label: getColumnLabel(colId, customColumns),
            type: 'text',
        });
    }

    for (const col of customColumns) {
        if (col.type === 'route') continue;
        const fieldId = `custom_${col.id}`;
        if (seen.has(fieldId)) continue;
        fields.push({
            fieldId,
            label: col.name,
            type: col.type,
            options: col.options,
        });
    }

    return fields;
}

function normalizeText(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function parseNumber(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function defaultMatchMode(type: IdealProfileFieldType): IdealProfileMatchMode {
    if (type === 'route_cost') return 'maximum';
    if (type === 'number') return 'minimum';
    if (type === 'checkbox' || type === 'select' || type === 'date') return 'exact';
    return 'contains';
}

export function criterionHasIdealValue(criterion: IdealProfileCriterion): boolean {
    const v = criterion.idealValue;
    if (v === undefined || v === null) return false;
    if (typeof v === 'number' && !Number.isNaN(v)) return true;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'string' && v.trim() !== '') return true;
    return false;
}

export function criterionHasExcludeValue(criterion: IdealProfileCriterion): boolean {
    const v = criterion.excludeValue;
    if (v === undefined || v === null) return false;
    if (typeof v === 'number' && !Number.isNaN(v)) return true;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'string' && v.trim() !== '') return true;
    return false;
}

export function criterionHasConstraint(criterion: IdealProfileCriterion): boolean {
    return criterionHasIdealValue(criterion) || criterionHasExcludeValue(criterion);
}

/** Criterio activo si está marcado "Usar" o tiene valor ideal o de exclusión configurado. */
export function isActiveIdealProfileCriterion(criterion: IdealProfileCriterion): boolean {
    if (criterion.enabled === false) return false;
    if (criterion.enabled) return true;
    return criterionHasConstraint(criterion);
}

function resolveIdealProfileColumnByName(
    name: string | undefined,
    customColumns: CustomColumn[]
): string | null {
    if (!name) return null;
    const col = customColumns.find(
        c => normalizeColumnNameKey(c.name) === normalizeColumnNameKey(name)
    );
    return col ? `custom_${col.id}` : null;
}

function resolveLegacyNameForColumnId(
    columnId: string,
    legacyColumnIdToName: Record<string, string>,
    bulkConfig?: BulkProcessConfig,
    customColumns: CustomColumn[] = []
): string | undefined {
    return (
        legacyColumnIdToName[columnId] ||
        bulkConfig?.columnKeyAliases?.[columnId] ||
        buildLegacyFromColumnOrder(bulkConfig, customColumns)[columnId]
    );
}

export function remapIdealProfileFieldId(
    fieldId: string,
    customColumns: CustomColumn[],
    legacyColumnIdToName: Record<string, string> = {},
    bulkConfig?: BulkProcessConfig
): string {
    if (!fieldId) return fieldId;

    const remapBareColumnId = (bareId: string): string | null => {
        if (customColumns.some(c => c.id === bareId)) return `custom_${bareId}`;
        const byName = resolveIdealProfileColumnByName(
            resolveLegacyNameForColumnId(bareId, legacyColumnIdToName, bulkConfig, customColumns),
            customColumns
        );
        return byName;
    };

    if (fieldId.startsWith('custom_')) {
        const bare = fieldId.slice('custom_'.length);
        if (customColumns.some(c => c.id === bare)) return fieldId;
        return remapBareColumnId(bare) || fieldId;
    }

    if ((IDEAL_PROFILE_BASE_FIELDS as readonly string[]).includes(fieldId)) {
        return fieldId;
    }

    const asCustom = remapBareColumnId(fieldId);
    if (asCustom) return asCustom;

    const byLabel = resolveIdealProfileColumnByName(fieldId, customColumns);
    if (byLabel) return byLabel;

    return fieldId;
}

/** Remapea fieldId de criterios si quedaron IDs custom antiguos tras recrear columnas. */
export function normalizeIdealProfileConfig(
    config: IdealProfileConfig | undefined,
    customColumns: CustomColumn[] = [],
    bulkConfig?: BulkProcessConfig
): { config: IdealProfileConfig | undefined; needsPersist: boolean } {
    if (!config?.criteria?.length) return { config, needsPersist: false };

    const legacy = buildLegacyColumnIdToName(bulkConfig, customColumns);
    let needsPersist = false;
    const criteriaByFieldId = new Map<string, IdealProfileCriterion>();

    for (const criterion of config.criteria) {
        const fieldId = remapIdealProfileFieldId(
            criterion.fieldId,
            customColumns,
            legacy,
            bulkConfig
        );
        if (fieldId !== criterion.fieldId) needsPersist = true;

        const normalizedCriterion =
            fieldId === criterion.fieldId ? criterion : { ...criterion, fieldId };
        const existing = criteriaByFieldId.get(fieldId);
        if (
            !existing ||
            (criterionHasConstraint(normalizedCriterion) && !criterionHasConstraint(existing))
        ) {
            criteriaByFieldId.set(fieldId, normalizedCriterion);
        }
    }

    const criteria = [...criteriaByFieldId.values()];
    if (!needsPersist) return { config, needsPersist: false };
    return { config: { ...config, criteria }, needsPersist: true };
}

export function normalizeIdealProfileCriteria(criteria: IdealProfileCriterion[]): IdealProfileCriterion[] {
    return criteria.map(c => ({
        ...c,
        enabled: c.enabled === false ? false : isActiveIdealProfileCriterion(c),
    }));
}

export function getCandidateFieldValue(
    candidate: BulkCandidate,
    fieldId: string,
    customColumns: CustomColumn[],
    columnValues: Record<string, Record<string, unknown>>,
    legacyColumnIdToName: Record<string, string>,
    bulkConfig?: BulkProcessConfig
): unknown {
    if (fieldId.startsWith('custom_')) {
        let colId = fieldId.replace('custom_', '');
        if (!customColumns.some(c => c.id === colId)) {
            const mapped = remapIdealProfileFieldId(
                fieldId,
                customColumns,
                legacyColumnIdToName,
                bulkConfig
            );
            colId = mapped.replace('custom_', '');
        }
        const col = customColumns.find(c => c.id === colId);
        const resolved = resolveBulkTableCellValue(
            candidate,
            colId,
            customColumns,
            columnValues,
            legacyColumnIdToName
        );
        if (col?.type === 'route_cost') {
            const total = extractRouteCostTotal(resolved);
            return total ?? '';
        }
        return resolved;
    }

    if (fieldId === 'source' || fieldId === 'province' || fieldId === 'district') {
        const resolved = resolveStandardFieldValue(
            fieldId,
            candidate.id,
            candidate,
            columnValues as Record<string, Record<string, any>>,
            customColumns
        );
        if (resolved) return resolved;
    }

    if (fieldId === 'age') {
        const age = resolveCandidateHomonymField(
            candidate,
            'age',
            customColumns,
            columnValues,
            legacyColumnIdToName
        );
        if (age !== undefined && age !== null && age !== '') return age;
    }

    const direct = (candidate as Record<string, unknown>)[fieldId];
    if (direct !== undefined && direct !== null && direct !== '') return direct;

    for (const col of customColumns) {
        if (mapImportHeader(col.name.toLowerCase()) === fieldId) {
            const resolved = resolveBulkTableCellValue(
                candidate,
                col.id,
                customColumns,
                columnValues,
                legacyColumnIdToName
            );
            if (resolved !== undefined && resolved !== '') return resolved;
            if (resolved === false) return false;
        }
    }

    return '';
}

function scoreTextMatch(
    candidateVal: unknown,
    idealVal: unknown,
    mode: IdealProfileMatchMode
): number {
    const c = normalizeText(candidateVal);
    const i = normalizeText(idealVal);
    if (!i) return 100;
    if (!c) return 0;

    const idealParts = i.split(/[,;|/]+/).map(p => p.trim()).filter(Boolean);

    if (mode === 'exact') {
        if (idealParts.length > 1) {
            return idealParts.some(p => c === p) ? 100 : 0;
        }
        return c === i ? 100 : 0;
    }

    // contains: una sola coincidencia (o varias alternativas OR) = 100%
    if (idealParts.length > 1) {
        return idealParts.some(p => c.includes(p)) ? 100 : 0;
    }
    if (c.includes(i) || i.includes(c)) return 100;
    return 0;
}

function scoreTextExclude(candidateVal: unknown, excludeVal: unknown): number {
    const c = normalizeText(candidateVal);
    const e = normalizeText(excludeVal);
    if (!e) return 100;
    if (!c) return 100;

    const excludeParts = e.split(/[,;|/]+/).map(p => p.trim()).filter(Boolean);
    if (excludeParts.length > 1) {
        return excludeParts.some(p => c.includes(p)) ? 0 : 100;
    }
    if (c.includes(e) || e.includes(c)) return 0;
    return 100;
}

function scorePositiveCriterion(
    candidateVal: unknown,
    criterion: IdealProfileCriterion,
    fieldType: IdealProfileFieldType
): number {
    const mode = criterion.matchMode || defaultMatchMode(fieldType);

    if (fieldType === 'number' || fieldType === 'route_cost') {
        return scoreNumberMatch(candidateVal, criterion, mode);
    }
    if (fieldType === 'checkbox') {
        return scoreCheckboxMatch(candidateVal, criterion.idealValue);
    }
    if (fieldType === 'select') {
        return scoreSelectMatch(candidateVal, criterion.idealValue);
    }
    if (fieldType === 'date') {
        return scoreDateMatch(candidateVal, criterion, mode);
    }
    return scoreTextMatch(candidateVal, criterion.idealValue, mode);
}

function scoreExcludeCriterion(
    candidateVal: unknown,
    criterion: IdealProfileCriterion,
    fieldType: IdealProfileFieldType
): number {
    if (!criterionHasExcludeValue(criterion)) return 100;
    const exclude = criterion.excludeValue;

    if (fieldType === 'number' || fieldType === 'route_cost') {
        const c = parseNumber(candidateVal);
        if (c === null) return 100;
        const excludedParts = String(exclude)
            .split(/[,;|/]+/)
            .map(p => parseNumber(p.trim()))
            .filter((n): n is number => n !== null);
        if (excludedParts.length === 0) {
            const single = parseNumber(exclude);
            return single !== null && c === single ? 0 : 100;
        }
        return excludedParts.some(n => c === n) ? 0 : 100;
    }
    if (fieldType === 'checkbox') {
        const c = candidateVal === true || candidateVal === 'true' || candidateVal === '1';
        const ex = exclude === true || exclude === 'true' || exclude === '1';
        return c === ex ? 0 : 100;
    }
    if (fieldType === 'select') {
        return normalizeText(candidateVal) === normalizeText(exclude) ? 0 : 100;
    }
    if (fieldType === 'date') {
        const cStr = formatBulkDate(String(candidateVal ?? ''));
        const eStr = formatBulkDate(String(exclude ?? ''));
        if (!cStr) return 100;
        return normalizeText(cStr) === normalizeText(eStr) ? 0 : 100;
    }
    return scoreTextExclude(candidateVal, exclude);
}

function formatCriterionSummary(criterion: IdealProfileCriterion): string {
    const parts: string[] = [];
    if (criterionHasIdealValue(criterion)) {
        parts.push(String(criterion.idealValue ?? ''));
    }
    if (criterionHasExcludeValue(criterion)) {
        parts.push(`≠ ${criterion.excludeValue}`);
    }
    return parts.join(' · ') || '-';
}

function scoreNumberMatch(
    candidateVal: unknown,
    criterion: IdealProfileCriterion,
    mode: IdealProfileMatchMode
): number {
    const c = parseNumber(candidateVal);
    const ideal = parseNumber(criterion.idealValue);
    if (c === null) return 0;
    if (ideal === null && mode !== 'range') return 0;

    if (mode === 'exact') {
        return c === ideal ? 100 : Math.max(0, 100 - Math.abs(c - (ideal ?? 0)) * 10);
    }
    if (mode === 'minimum') {
        if (c >= (ideal ?? 0)) return 100;
        const diff = (ideal ?? 0) - c;
        return Math.max(0, Math.round(100 - diff * 15));
    }
    if (mode === 'maximum') {
        if (c <= (ideal ?? 0)) return 100;
        const diff = c - (ideal ?? 0);
        return Math.max(0, Math.round(100 - diff * 15));
    }
    if (mode === 'range') {
        const min = ideal ?? 0;
        const max = criterion.maxValue ?? min;
        if (c >= min && c <= max) return 100;
        if (c < min) return Math.max(0, Math.round(100 - (min - c) * 15));
        return Math.max(0, Math.round(100 - (c - max) * 15));
    }
    return c === ideal ? 100 : 0;
}

function scoreCheckboxMatch(candidateVal: unknown, idealVal: unknown): number {
    const c = candidateVal === true || candidateVal === 'true' || candidateVal === '1';
    const i = idealVal === true || idealVal === 'true' || idealVal === '1';
    return c === i ? 100 : 0;
}

function scoreSelectMatch(candidateVal: unknown, idealVal: unknown): number {
    return normalizeText(candidateVal) === normalizeText(idealVal) ? 100 : 0;
}

function scoreDateMatch(
    candidateVal: unknown,
    criterion: IdealProfileCriterion,
    mode: IdealProfileMatchMode
): number {
    const cStr = formatBulkDate(String(candidateVal ?? ''));
    const iStr = formatBulkDate(String(criterion.idealValue ?? ''));
    if (!cStr) return 0;
    if (mode === 'exact') return normalizeText(cStr) === normalizeText(iStr) ? 100 : 0;

    const toTs = (s: string) => {
        const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!m) return null;
        return new Date(`${m[3]}-${m[2]}-${m[1]}`).getTime();
    };
    const cTs = toTs(cStr);
    const minTs = toTs(iStr);
    const maxTs = criterion.maxValue != null ? toTs(formatBulkDate(String(criterion.maxValue))) : minTs;
    if (cTs === null || minTs === null) return 0;
    const max = maxTs ?? minTs;
    if (cTs >= minTs && cTs <= max) return 100;
    const diffDays = Math.abs(cTs - (cTs < minTs ? minTs : max)) / 86400000;
    return Math.max(0, Math.round(100 - diffDays * 5));
}

export function scoreCriterion(
    candidateVal: unknown,
    criterion: IdealProfileCriterion,
    fieldType: IdealProfileFieldType
): number {
    const parts: number[] = [];
    if (criterionHasIdealValue(criterion)) {
        parts.push(scorePositiveCriterion(candidateVal, criterion, fieldType));
    }
    if (criterionHasExcludeValue(criterion)) {
        parts.push(scoreExcludeCriterion(candidateVal, criterion, fieldType));
    }
    if (parts.length === 0) return 0;
    return Math.round(parts.reduce((sum, score) => sum + score, 0) / parts.length);
}

export interface ProfileMatchResult {
    score: number;
    fieldScores: { fieldId: string; label: string; score: number; candidateValue: string; idealValue: string }[];
}

export function computeProfileMatch(
    candidate: BulkCandidate,
    config: IdealProfileConfig | undefined,
    customColumns: CustomColumn[],
    columnValues: Record<string, Record<string, unknown>>,
    legacyColumnIdToName: Record<string, string>,
    bulkConfig?: BulkProcessConfig
): ProfileMatchResult | null {
    if (!config?.enabled || !config.criteria?.length) return null;

    const active = config.criteria.filter(isActiveIdealProfileCriterion);
    if (active.length === 0) return null;

    let totalWeight = 0;
    let weightedSum = 0;
    const fieldScores: ProfileMatchResult['fieldScores'] = [];

    for (const criterion of active) {
        const weight = criterion.weight ?? 1;
        const fieldId = remapIdealProfileFieldId(
            criterion.fieldId,
            customColumns,
            legacyColumnIdToName,
            bulkConfig
        );
        const fieldType = getIdealProfileFieldType(fieldId, customColumns);
        const candidateVal = getCandidateFieldValue(
            candidate,
            fieldId,
            customColumns,
            columnValues,
            legacyColumnIdToName,
            bulkConfig
        );
        const score = scoreCriterion(candidateVal, criterion, fieldType);
        totalWeight += weight;
        weightedSum += score * weight;
        fieldScores.push({
            fieldId,
            label: getColumnLabel(fieldId, customColumns),
            score,
            candidateValue: String(candidateVal ?? ''),
            idealValue: formatCriterionSummary(criterion),
        });
    }

    const finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    return { score: finalScore, fieldScores };
}

export function getProfileMatchThresholds(config?: IdealProfileConfig): {
    green: number;
    yellow: number;
} {
    return {
        green: config?.greenThreshold ?? 80,
        yellow: config?.yellowThreshold ?? 50,
    };
}

export function getIdealProfileActiveFieldIds(
    config?: IdealProfileConfig,
    customColumns: CustomColumn[] = [],
    bulkConfig?: BulkProcessConfig
): Set<string> {
    if (!config?.enabled) return new Set();
    const legacy = buildLegacyColumnIdToName(bulkConfig, customColumns);
    return new Set(
        (config.criteria || [])
            .filter(isActiveIdealProfileCriterion)
            .map(c => remapIdealProfileFieldId(c.fieldId, customColumns, legacy, bulkConfig))
    );
}

export function getProfileMatchColorClass(
    score: number,
    config?: IdealProfileConfig
): string {
    const { green, yellow } = getProfileMatchThresholds(config);
    if (score >= green) return 'text-green-700 bg-green-100';
    if (score >= yellow) return 'text-yellow-800 bg-yellow-100';
    return 'text-red-700 bg-red-100';
}

/** Color continuo verde→rojo según porcentaje (0–100) */
export function getProfileMatchGradientStyle(score: number): { backgroundColor: string; color: string } {
    const clamped = Math.max(0, Math.min(100, score));
    const hue = Math.round((clamped / 100) * 120);
    return {
        backgroundColor: `hsl(${hue}, 72%, 90%)`,
        color: `hsl(${hue}, 65%, 28%)`,
    };
}

export interface ProfileMatchSummary {
    totalCandidates: number;
    averageScore: number;
    greenCount: number;
    yellowCount: number;
    redCount: number;
    fieldAverages: { fieldId: string; label: string; averageScore: number }[];
}

export function computeProfileMatchSummary(
    candidates: BulkCandidate[],
    config: IdealProfileConfig | undefined,
    customColumns: CustomColumn[],
    columnValues: Record<string, Record<string, unknown>>,
    legacyColumnIdToName: Record<string, string>,
    bulkConfig?: BulkProcessConfig
): ProfileMatchSummary | null {
    if (!config?.enabled) return null;

    const scores: number[] = [];
    const fieldScoreMap = new Map<string, { label: string; sum: number; count: number }>();
    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;
    const { green, yellow } = getProfileMatchThresholds(config);

    for (const candidate of candidates) {
        const result = computeProfileMatch(
            candidate,
            config,
            customColumns,
            columnValues,
            legacyColumnIdToName,
            bulkConfig
        );
        if (!result) continue;
        scores.push(result.score);
        if (result.score >= green) greenCount++;
        else if (result.score >= yellow) yellowCount++;
        else redCount++;

        for (const fs of result.fieldScores) {
            const prev = fieldScoreMap.get(fs.fieldId) || { label: fs.label, sum: 0, count: 0 };
            prev.sum += fs.score;
            prev.count += 1;
            fieldScoreMap.set(fs.fieldId, prev);
        }
    }

    if (scores.length === 0) {
        return {
            totalCandidates: candidates.length,
            averageScore: 0,
            greenCount: 0,
            yellowCount: 0,
            redCount: 0,
            fieldAverages: [],
        };
    }

    return {
        totalCandidates: candidates.length,
        averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        greenCount,
        yellowCount,
        redCount,
        fieldAverages: [...fieldScoreMap.entries()].map(([fieldId, v]) => ({
            fieldId,
            label: v.label,
            averageScore: Math.round(v.sum / v.count),
        })),
    };
}

/** Parsea una fila TSV/CSV pegada para importar valores del perfil ideal */
export function parseIdealProfileImport(
    text: string,
    availableFields: IdealProfileFieldDef[]
): Partial<Record<string, string>> {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return {};

    const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => normalizeColumnNameKey(h));
    const values = lines[1].split(sep).map(v => v.trim());
    const out: Partial<Record<string, string>> = {};

    const labelToField = new Map<string, string>();
    for (const f of availableFields) {
        labelToField.set(normalizeColumnNameKey(f.label), f.fieldId);
        labelToField.set(normalizeColumnNameKey(f.fieldId), f.fieldId);
    }

    headers.forEach((header, i) => {
        const fieldId = labelToField.get(header);
        if (fieldId && values[i] !== undefined) {
            out[fieldId] = values[i];
        }
    });

    return out;
}

export function buildIdealProfileImportTemplate(
    fields: IdealProfileFieldDef[],
    enabledCriteria: IdealProfileCriterion[]
): string {
    const active = enabledCriteria.filter(isActiveIdealProfileCriterion);
    const headers = active.map(c => {
        const f = fields.find(x => x.fieldId === c.fieldId);
        return f?.label || c.fieldId;
    });
    const values = active.map(c => String(c.idealValue ?? ''));
    return `${headers.join('\t')}\n${values.join('\t')}`;
}
