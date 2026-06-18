import type { BulkProcessConfig, CustomColumn, FieldMapping, Process } from '../types';
import {
    BASE_COLUMNS,
    enrichBulkColumnValuesForStorage,
    CUSTOM_COLUMN_HEADER_ALIASES,
    findCustomColumnByHeader,
    getColumnLabel,
    getTallyIntegrationMappingFields,
    mapImportHeader,
    normalizeBulkDateInput,
    normalizeColumnNameKey,
    normalizeTallyFieldMapping,
    parseCustomCellInput,
    type TallyMappingField,
} from './bulkTableColumns';
import { applyImportTextCaseToCandidate, normalizeImportTextCase } from './importTextCase';

export interface TallyWebhookProcessRow {
    id?: string;
    is_bulk_process?: boolean | number;
    isBulkProcess?: boolean;
    bulk_config?: BulkProcessConfig | string | null;
    bulkConfig?: BulkProcessConfig;
}

export interface TallyCandidateInsert {
    name: string;
    email: string;
    phone: string;
    phone2: string;
    description: string;
    source: string;
    salary_expectation: string;
    dni: string;
    linkedin_url: string;
    address: string;
    province: string;
    district: string;
    age: number | null;
    bulk_column_values?: Record<string, unknown>;
}

type TallyFieldRow = {
    key?: string;
    label?: string;
    type?: string;
    value?: unknown;
    options?: { id?: string; text?: string; label?: string }[];
};

const CHOICE_TYPES = new Set([
    'MULTIPLE_CHOICE',
    'DROPDOWN',
    'MULTIPLE_CHOICE_SELECT',
    'SELECT',
    'CHECKBOXES',
]);

export interface NormalizedWebhookProcess {
    isBulkProcess: boolean;
    bulkConfig?: BulkProcessConfig;
}

/** Referencia compacta sin espacios (p. ej. "Ap Paterno" → "appaterno") */
export function compactColumnRef(name: string): string {
    return normalizeColumnNameKey(name).replace(/\s+/g, '');
}

/** Normaliza fila de proceso desde Supabase (snake_case) */
export function normalizeWebhookProcess(
    row: TallyWebhookProcessRow | Process | null | undefined
): NormalizedWebhookProcess | null {
    if (!row) return null;
    const isBulk =
        (row as Process).isBulkProcess === true ||
        row.is_bulk_process === true ||
        row.is_bulk_process === 1;
    let bulkConfig = (row as Process).bulkConfig ?? row.bulk_config;
    if (typeof bulkConfig === 'string') {
        try {
            bulkConfig = JSON.parse(bulkConfig);
        } catch {
            bulkConfig = undefined;
        }
    }
    return {
        isBulkProcess: isBulk,
        bulkConfig: bulkConfig as BulkProcessConfig | undefined,
    };
}

/** Extrae texto legible de un campo Tally (resuelve IDs de opciones en choice fields) */
export function extractTallyFieldText(field: TallyFieldRow): string {
    const { value, type, options } = field;
    if (value === undefined || value === null) return '';

    if (type && CHOICE_TYPES.has(type) && options?.length) {
        if (Array.isArray(value)) {
            const texts = value
                .map((id) => {
                    const opt = options.find((o) => o.id === id);
                    return opt?.text || opt?.label || '';
                })
                .filter(Boolean);
            return texts.join(', ');
        }
        const opt = options.find((o) => o.id === value);
        if (opt?.text) return String(opt.text).trim();
        if (opt?.label) return String(opt.label).trim();
    }

    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
        return value.map((v) => extractTallyFieldText({ value: v, options })).filter(Boolean).join(', ');
    }
    if (typeof value === 'object') {
        const o = value as Record<string, unknown>;
        if (typeof o.text === 'string') return o.text.trim();
        if (typeof o.label === 'string') return o.label.trim();
    }
    return String(value).trim();
}

export interface TallyFieldsIndex {
    /** lookup por label/key exacto (lower) o normalizado */
    byRef: Record<string, string>;
    /** refs ya consumidos por otra columna ATS */
    usedRefs: Set<string>;
}

/** Índice de respuestas Tally con registro de uso para evitar duplicar un valor en varias columnas */
export function buildTallyFieldsIndex(tallyData: unknown): TallyFieldsIndex {
    const byRef: Record<string, string> = {};
    const tally = tallyData as { data?: { fields?: TallyFieldRow[] }; fields?: TallyFieldRow[] };
    const fieldsArray = Array.isArray(tally?.data?.fields)
        ? tally.data.fields
        : Array.isArray(tally?.fields)
          ? tally.fields
          : [];

    for (const field of fieldsArray) {
        const text = extractTallyFieldText(field);
        if (!text) continue;

        const key = (field.key || '').trim();
        const label = (field.label || '').trim();
        const refs = new Set<string>();

        if (key) {
            refs.add(key.toLowerCase());
            refs.add(normalizeColumnNameKey(key));
            refs.add(compactColumnRef(key));
        }
        if (label) {
            refs.add(label.toLowerCase());
            refs.add(normalizeColumnNameKey(label));
            refs.add(compactColumnRef(label));
        }

        for (const ref of refs) {
            if (!byRef[ref]) byRef[ref] = text;
        }
    }

    return { byRef, usedRefs: new Set() };
}

function markRefUsed(index: TallyFieldsIndex, ref: string): void {
    const r = ref.trim().toLowerCase();
    index.usedRefs.add(r);
    index.usedRefs.add(normalizeColumnNameKey(ref));
    index.usedRefs.add(compactColumnRef(ref));
}

function isRefUsed(index: TallyFieldsIndex, ref: string): boolean {
    return (
        index.usedRefs.has(ref.trim().toLowerCase()) ||
        index.usedRefs.has(normalizeColumnNameKey(ref)) ||
        index.usedRefs.has(compactColumnRef(ref))
    );
}

/** Busca valor por nombre/key configurado en el mapeo */
export function lookupTallyValue(index: TallyFieldsIndex, tallyFieldRef: string): string {
    const trimmed = tallyFieldRef.trim();
    if (!trimmed) return '';

    const candidates = [
        trimmed.toLowerCase(),
        normalizeColumnNameKey(trimmed),
        compactColumnRef(trimmed),
    ];

    for (const c of candidates) {
        if (index.byRef[c] !== undefined && index.byRef[c] !== '') {
            if (!isRefUsed(index, c)) {
                markRefUsed(index, trimmed);
                return index.byRef[c];
            }
        }
    }

    const normTarget = normalizeColumnNameKey(trimmed);
    for (const [k, v] of Object.entries(index.byRef)) {
        if (normalizeColumnNameKey(k) === normTarget && v !== '' && !isRefUsed(index, k)) {
            markRefUsed(index, trimmed);
            return v;
        }
    }
    return '';
}

export function parseIntegrationFieldMapping(integration: {
    field_mapping?: string | FieldMapping | null;
}): FieldMapping {
    if (!integration.field_mapping) return {};
    try {
        if (typeof integration.field_mapping === 'string') {
            return normalizeTallyFieldMapping(JSON.parse(integration.field_mapping));
        }
        if (typeof integration.field_mapping === 'object') {
            return normalizeTallyFieldMapping(integration.field_mapping as FieldMapping);
        }
    } catch {
        /* ignore */
    }
    return {};
}

/** Nombres Tally permitidos para auto-mapeo (solo esta columna, sin sinónimos globales) */
function autoMatchRefsForField(
    mappingKey: string,
    customColumns: CustomColumn[],
    isBulk: boolean
): string[] {
    if (mappingKey.startsWith('custom_')) {
        const colId = mappingKey.replace('custom_', '');
        const col = customColumns.find((c) => c.id === colId);
        if (!col) return [];
        const refs = new Set<string>([
            col.name,
            col.name.toLowerCase(),
            normalizeColumnNameKey(col.name),
            compactColumnRef(col.name),
        ]);
        const matched = findCustomColumnByHeader(col.name, customColumns);
        if (matched) refs.add(normalizeColumnNameKey(matched.name));
        const colNorm = normalizeColumnNameKey(col.name);
        for (const alias of CUSTOM_COLUMN_HEADER_ALIASES[colNorm] || []) {
            refs.add(alias);
            refs.add(alias.toLowerCase());
            refs.add(normalizeColumnNameKey(alias));
            refs.add(compactColumnRef(alias));
        }
        return [...refs];
    }

    const baseCol = BASE_COLUMNS.find((c) => c.importKey === mappingKey || c.id === mappingKey);
    if (baseCol) {
        const refs = new Set<string>([
            baseCol.importKey || mappingKey,
            baseCol.label,
            baseCol.label.toLowerCase(),
            normalizeColumnNameKey(baseCol.label),
        ]);
        return [...refs];
    }

    if (!isBulk) {
        const simpleAliases: Record<string, string[]> = {
            name: ['name', 'nombre', 'nombre_completo'],
            email: ['email', 'correo', 'e-mail'],
            phone: ['phone', 'telefono', 'teléfono'],
            source: ['source', 'fuente'],
            dni: ['dni', 'documento'],
            province: ['province', 'provincia'],
            district: ['district', 'distrito'],
            age: ['age', 'edad'],
        };
        return simpleAliases[mappingKey] || [mappingKey];
    }

    return [mappingKey];
}

function shouldRejectSourceAutoMatch(
    value: string,
    integration?: { form_name?: string; formName?: string },
    tallyData?: unknown
): boolean {
    const tally = tallyData as { data?: { formName?: string }; formName?: string } | undefined;
    const formNameFromPayload = tally?.data?.formName ?? tally?.formName;
    const names = [
        integration?.form_name,
        integration?.formName,
        formNameFromPayload,
    ].filter(Boolean) as string[];
    const normVal = normalizeColumnNameKey(value);
    return names.some((n) => normalizeColumnNameKey(n) === normVal);
}

function getMappedValue(
    mappingKey: string,
    index: TallyFieldsIndex,
    customMapping: FieldMapping,
    customColumns: CustomColumn[],
    isBulk: boolean,
    integration?: { field_mapping?: string | FieldMapping | null; form_name?: string; formName?: string },
    tallyData?: unknown
): string {
    if (customMapping[mappingKey]) {
        return lookupTallyValue(index, customMapping[mappingKey]);
    }

    for (const ref of autoMatchRefsForField(mappingKey, customColumns, isBulk)) {
        const v = lookupTallyValue(index, ref);
        if (!v) continue;
        if (mappingKey === 'source' && shouldRejectSourceAutoMatch(v, integration, tallyData)) {
            continue;
        }
        return v;
    }
    return '';
}

function parseValueForCustomColumn(raw: string, col: CustomColumn): unknown {
    if (!raw) return '';
    if (col.type === 'date') return normalizeBulkDateInput(raw);
    const parsed = parseCustomCellInput(raw, col);
    if (col.type === 'text' && typeof parsed === 'string' && parsed.trim()) {
        const mapped = mapImportHeader(col.name.toLowerCase());
        return normalizeImportTextCase(parsed, {
            columnType: col.type,
            selectOptions: col.options,
            field: mapped ?? undefined,
        });
    }
    if (col.type === 'select' && typeof parsed === 'string') {
        return normalizeImportTextCase(parsed, { columnType: col.type, selectOptions: col.options });
    }
    return parsed;
}

function assignStandardField(target: TallyCandidateInsert, key: string, value: string): void {
    if (!value) return;
    switch (key) {
        case 'name':
            target.name = value;
            break;
        case 'email':
            target.email = value;
            break;
        case 'phone':
            target.phone = value;
            break;
        case 'phone2':
            target.phone2 = value;
            break;
        case 'description':
            target.description = value;
            break;
        case 'source':
            target.source = value;
            break;
        case 'salary_expectation':
            target.salary_expectation = value;
            break;
        case 'dni':
            target.dni = value;
            break;
        case 'linkedin_url':
            target.linkedin_url = value;
            break;
        case 'address':
            target.address = value;
            break;
        case 'province':
            target.province = value;
            break;
        case 'district':
            target.district = value;
            break;
        case 'age': {
            const ageNum = parseInt(value, 10);
            if (!isNaN(ageNum)) target.age = ageNum;
            break;
        }
    }
}

function syncHomonymCustomColumns(
    bulkValues: Record<string, unknown>,
    customColumns: CustomColumn[],
    candidate: TallyCandidateInsert
): void {
    for (const col of customColumns) {
        if (bulkValues[col.id] !== undefined && bulkValues[col.id] !== '') continue;
        const mapped = mapImportHeader(col.name.toLowerCase());
        if (mapped === 'source' && candidate.source) bulkValues[col.id] = candidate.source;
        else if (mapped === 'province' && candidate.province) bulkValues[col.id] = candidate.province;
        else if (mapped === 'district' && candidate.district) bulkValues[col.id] = candidate.district;
    }
}

/**
 * Mapea payload Tally → fila candidates (+ bulk_column_values si es proceso masivo).
 */
export function buildTallyCandidateFromSubmission(
    tallyData: unknown,
    integration: { field_mapping?: string | FieldMapping | null; form_name?: string },
    processRow?: TallyWebhookProcessRow | Process | null
): TallyCandidateInsert {
    const process = normalizeWebhookProcess(processRow);
    const index = buildTallyFieldsIndex(tallyData);
    const customMapping = parseIntegrationFieldMapping(integration);
    const customColumns = process?.bulkConfig?.customColumns || [];
    const isBulk = !!process?.isBulkProcess;
    const mappingFields: TallyMappingField[] = getTallyIntegrationMappingFields(
        process
            ? ({
                  isBulkProcess: process.isBulkProcess,
                  bulkConfig: process.bulkConfig,
              } as Process)
            : undefined
    );

    const candidate: TallyCandidateInsert = {
        name: '',
        email: '',
        phone: '',
        phone2: '',
        description: '',
        source: '',
        salary_expectation: '',
        dni: '',
        linkedin_url: '',
        address: '',
        province: '',
        district: '',
        age: null,
    };

    const bulkRaw: Record<string, unknown> = {};

    for (const field of mappingFields) {
        const raw = getMappedValue(
            field.key,
            index,
            customMapping,
            customColumns,
            isBulk,
            integration,
            tallyData
        );
        if (!raw) continue;

        if (field.key.startsWith('custom_')) {
            const colId = field.key.replace('custom_', '');
            const col = customColumns.find((c) => c.id === colId);
            if (col) {
                bulkRaw[col.id] = parseValueForCustomColumn(raw, col);
            }
        } else {
            assignStandardField(candidate, field.key, raw);
        }
    }

    if (!candidate.source?.trim()) {
        candidate.source = 'Tally';
    }

    applyImportTextCaseToCandidate(candidate as Record<string, unknown>);

    if (isBulk && customColumns.length > 0) {
        syncHomonymCustomColumns(bulkRaw, customColumns, candidate);
        const enriched = enrichBulkColumnValuesForStorage(bulkRaw, customColumns);
        if (Object.keys(enriched).length > 0) {
            candidate.bulk_column_values = enriched;
        }
    }

    return candidate;
}

/** @deprecated Use buildTallyFieldsIndex */
export function buildTallyFieldsMap(tallyData: unknown): Record<string, string> {
    return buildTallyFieldsIndex(tallyData).byRef;
}
