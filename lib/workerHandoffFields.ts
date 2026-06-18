import { Candidate, Process, WorkerSnapshot, WorkerSnapshotIdentity } from '../types';
import { APP_NAME } from './appConfig';

export const SNAPSHOT_VERSION = 1;
export const TARGET_APP = 'OpsFlow';

const OPSFLOW_FIELD_PREFS_KEY = 'opsflow-handoff-field-selection';

export interface WorkerHandoffFieldDef {
    key: string;
    label: string;
}

export interface WorkerHandoffFieldGroup {
    id: string;
    label: string;
    fields: WorkerHandoffFieldDef[];
}

export const WORKER_HANDOFF_FIELD_GROUPS: WorkerHandoffFieldGroup[] = [
    {
        id: 'identity',
        label: 'Identidad',
        fields: [
            { key: 'fullName', label: 'Nombre completo' },
            { key: 'dni', label: 'DNI' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Teléfono' },
            { key: 'phone2', label: 'Teléfono 2' },
        ],
    },
    {
        id: 'candidate',
        label: 'Datos del candidato',
        fields: [
            { key: 'address', label: 'Dirección' },
            { key: 'province', label: 'Provincia' },
            { key: 'district', label: 'Distrito' },
            { key: 'age', label: 'Edad' },
            { key: 'linkedinUrl', label: 'LinkedIn' },
            { key: 'source', label: 'Fuente' },
            { key: 'agreedSalary', label: 'Salario acordado' },
            { key: 'agreedSalaryInWords', label: 'Salario en letras' },
            { key: 'hireDate', label: 'Fecha de contratación' },
            { key: 'salaryExpectation', label: 'Expectativa salarial' },
            { key: 'offerAcceptedDate', label: 'Fecha aceptación oferta' },
            { key: 'applicationStartedDate', label: 'Inicio postulación' },
            { key: 'applicationCompletedDate', label: 'Fin postulación' },
        ],
    },
    {
        id: 'process',
        label: 'Datos del proceso',
        fields: [
            { key: 'processTitle', label: 'Título del proceso' },
            { key: 'serviceOrderCode', label: 'Código orden de servicio' },
            { key: 'clientName', label: 'Cliente' },
            { key: 'processDescription', label: 'Descripción del proceso' },
            { key: 'stageName', label: 'Etapa actual' },
        ],
    },
    {
        id: 'evaluation',
        label: 'Evaluación',
        fields: [
            { key: 'psycholaboralSuitability', label: 'Idoneidad psicolaboral' },
            { key: 'scoreIa', label: 'Score IA' },
        ],
    },
];

export const ALL_WORKER_HANDOFF_FIELD_KEYS = WORKER_HANDOFF_FIELD_GROUPS.flatMap(
    group => group.fields.map(field => field.key)
);

export function getDefaultWorkerHandoffFieldKeys(): string[] {
    return [...ALL_WORKER_HANDOFF_FIELD_KEYS];
}

export function loadSavedWorkerHandoffFieldKeys(): string[] {
    try {
        const raw = localStorage.getItem(OPSFLOW_FIELD_PREFS_KEY);
        if (!raw) return getDefaultWorkerHandoffFieldKeys();
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return getDefaultWorkerHandoffFieldKeys();
        const valid = parsed.filter(
            (key): key is string => typeof key === 'string' && ALL_WORKER_HANDOFF_FIELD_KEYS.includes(key)
        );
        if (valid.length === 0) return getDefaultWorkerHandoffFieldKeys();
        if (!valid.includes('fullName') && !valid.includes('dni')) {
            valid.unshift('fullName');
        }
        return valid;
    } catch {
        return getDefaultWorkerHandoffFieldKeys();
    }
}

export function saveWorkerHandoffFieldKeys(keys: string[]): void {
    try {
        localStorage.setItem(OPSFLOW_FIELD_PREFS_KEY, JSON.stringify(keys));
    } catch {
        // ignore quota / private mode
    }
}

function hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'number') return !Number.isNaN(value);
    if (typeof value === 'boolean') return true;
    return false;
}

function asString(value: unknown): string | undefined {
    if (!hasValue(value)) return undefined;
    return String(value).trim();
}

type FieldExtractor = (ctx: { candidate: Candidate; process?: Process }) => unknown;

const FIELD_CATALOG: Record<string, FieldExtractor> = {
    address: ({ candidate }) => candidate.address,
    province: ({ candidate }) => candidate.province,
    district: ({ candidate }) => candidate.district,
    age: ({ candidate }) => candidate.age,
    linkedinUrl: ({ candidate }) => candidate.linkedinUrl,
    source: ({ candidate }) => candidate.source,
    agreedSalary: ({ candidate }) => candidate.agreedSalary,
    agreedSalaryInWords: ({ candidate }) => candidate.agreedSalaryInWords,
    hireDate: ({ candidate }) => candidate.hireDate,
    salaryExpectation: ({ candidate }) => candidate.salaryExpectation,
    offerAcceptedDate: ({ candidate }) => candidate.offerAcceptedDate,
    applicationStartedDate: ({ candidate }) => candidate.applicationStartedDate,
    applicationCompletedDate: ({ candidate }) => candidate.applicationCompletedDate,
    processTitle: ({ process }) => process?.title,
    serviceOrderCode: ({ process }) => process?.serviceOrderCode,
    clientName: ({ process }) => process?.client?.razonSocial,
    processDescription: ({ process }) => process?.description,
    stageName: ({ candidate, process }) =>
        process?.stages.find(stage => stage.id === candidate.stageId)?.name,
    psycholaboralSuitability: ({ candidate }) =>
        candidate.psycholaboralEvaluation?.suitabilityStatus,
    scoreIa: ({ candidate }) => candidate.scoreIa,
};

const IDENTITY_EXTRACTORS: Record<string, (candidate: Candidate) => unknown> = {
    fullName: candidate => candidate.name,
    dni: candidate => candidate.dni,
    email: candidate => candidate.email,
    phone: candidate => candidate.phone,
    phone2: candidate => candidate.phone2,
};

function normalizeIncludedFields(includedFields?: Iterable<string>): Set<string> {
    if (!includedFields) return new Set(ALL_WORKER_HANDOFF_FIELD_KEYS);
    const set = new Set(includedFields);
    return set.size > 0 ? set : new Set(ALL_WORKER_HANDOFF_FIELD_KEYS);
}

function shouldInclude(key: string, included: Set<string>): boolean {
    return included.has(key);
}

export function validateFieldSelection(includedFields: Set<string>): string | null {
    if (includedFields.size === 0) {
        return 'Selecciona al menos un campo para enviar.';
    }
    if (!includedFields.has('fullName') && !includedFields.has('dni')) {
        return 'Debes incluir al menos nombre o DNI para identificar al trabajador.';
    }
    return null;
}

export function fieldHasDataForCandidate(
    fieldKey: string,
    candidate: Candidate,
    process?: Process
): boolean {
    if (fieldKey in IDENTITY_EXTRACTORS) {
        return hasValue(IDENTITY_EXTRACTORS[fieldKey](candidate));
    }
    const extract = FIELD_CATALOG[fieldKey];
    if (!extract) return false;
    return hasValue(extract({ candidate, process }));
}

export function countCandidatesWithFieldData(
    fieldKey: string,
    candidates: Candidate[],
    processById: Map<string, Process>
): number {
    let count = 0;
    for (const candidate of candidates) {
        const process = processById.get(candidate.processId);
        if (fieldHasDataForCandidate(fieldKey, candidate, process)) count++;
    }
    return count;
}

export interface BuildWorkerSnapshotOptions {
    includedFields?: Iterable<string>;
}

export function buildWorkerSnapshot(
    candidate: Candidate,
    process?: Process,
    options?: BuildWorkerSnapshotOptions
): WorkerSnapshot {
    const included = normalizeIncludedFields(options?.includedFields);
    const identity: WorkerSnapshotIdentity = {};
    const includedFieldKeys: string[] = [];

    for (const [key, extract] of Object.entries(IDENTITY_EXTRACTORS)) {
        if (!shouldInclude(key, included)) continue;
        const raw = extract(candidate);
        const text = asString(raw);
        if (key === 'fullName' && text) identity.fullName = text;
        if (key === 'dni' && text) identity.dni = text;
        if (key === 'email' && text) identity.email = text;
        if (key === 'phone' && text) identity.phone = text;
        if (key === 'phone2' && text) identity.phone2 = text;
        if (hasValue(raw)) includedFieldKeys.push(key);
    }

    const fields: Record<string, string | number | boolean> = {};
    const ctx = { candidate, process };

    for (const [key, extract] of Object.entries(FIELD_CATALOG)) {
        if (!shouldInclude(key, included)) continue;
        const raw = extract(ctx);
        if (!hasValue(raw)) continue;

        if (typeof raw === 'number') {
            fields[key] = raw;
        } else if (typeof raw === 'boolean') {
            fields[key] = raw;
        } else {
            const text = asString(raw);
            if (text) fields[key] = text;
        }
        includedFieldKeys.push(key);
    }

    return {
        identity,
        fields,
        meta: {
            sourceCandidateId: candidate.id,
            sourceProcessId: candidate.processId,
            sourceApp: APP_NAME,
            snapshotVersion: SNAPSHOT_VERSION,
            includedFieldKeys,
            capturedAt: new Date().toISOString(),
        },
    };
}

export function getWorkerDisplayName(snapshot: WorkerSnapshot): string {
    return snapshot.identity.fullName || snapshot.identity.dni || 'Sin nombre';
}

export function validateSnapshotForSend(snapshot: WorkerSnapshot): string | null {
    if (snapshot.identity.fullName || snapshot.identity.dni) return null;
    return 'El candidato debe tener al menos nombre o DNI (entre los campos seleccionados).';
}

export const ACTIVE_PACKAGE_STATUSES = ['sent', 'received', 'processing'] as const;

export const PACKAGE_STATUS_LABELS: Record<string, string> = {
    sent: 'Enviado',
    received: 'Recibido',
    processing: 'En proceso',
    completed: 'Completado',
    rejected: 'Rechazado',
    partially_completed: 'Parcialmente completado',
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
    pending: 'Entregando…',
    delivered: 'Entregado a OpsFlow',
    failed: 'Error de entrega',
};
