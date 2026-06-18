/** Cómo se incorporó el trabajador al proceso masivo */
export type CandidateRegistrationOrigin = 'formulario' | 'manual' | 'masivo';

export const REGISTRATION_ORIGIN_COLUMN_ID = 'registrationOrigin';

export const REGISTRATION_ORIGIN_LABELS: Record<CandidateRegistrationOrigin, string> = {
    formulario: 'Formulario',
    manual: 'Manual',
    masivo: 'Carga masiva',
};

export const REGISTRATION_ORIGIN_BADGE_CLASS: Record<CandidateRegistrationOrigin, string> = {
    formulario: 'bg-violet-100 text-violet-800 border-violet-200',
    manual: 'bg-sky-100 text-sky-800 border-sky-200',
    masivo: 'bg-teal-100 text-teal-800 border-teal-200',
};

/** Origen inferido (registro anterior sin persistir en BD) */
export const REGISTRATION_ORIGIN_INFERRED_BADGE_CLASS: Record<CandidateRegistrationOrigin, string> = {
    formulario: 'bg-violet-50 text-violet-700 border-violet-200 border-dashed',
    manual: 'bg-sky-50 text-sky-700 border-sky-200 border-dashed',
    masivo: 'bg-teal-50 text-teal-700 border-teal-200 border-dashed',
};

export function isCandidateRegistrationOrigin(value: unknown): value is CandidateRegistrationOrigin {
    return value === 'formulario' || value === 'manual' || value === 'masivo';
}

export interface RegistrationOriginInput {
    registrationOrigin?: CandidateRegistrationOrigin | null;
    email?: string | null;
    applicationCount?: number | null;
    firstApplicationAt?: string | null;
    createdBy?: string | null;
    /** Registrado en bulk_process_activity_log como add_row */
    addedViaManualRow?: boolean;
}

export function isTallyFormEmail(email?: string | null): boolean {
    const e = (email || '').trim().toLowerCase();
    if (!e) return false;
    return e.includes('tally@import') || e.includes('.tally@import');
}

export function isManualPlaceholderEmail(email?: string | null): boolean {
    const e = (email || '').trim().toLowerCase();
    return e.includes('.manual@import');
}

export function isBulkImportPlaceholderEmail(email?: string | null): boolean {
    const e = (email || '').trim().toLowerCase();
    return e.includes('.import@import');
}

export function isGenericImportPlaceholderEmail(email?: string | null): boolean {
    const e = (email || '').trim().toLowerCase();
    if (!e.startsWith('sin-email.') || !e.endsWith('@import.opalo')) return false;
    return !isTallyFormEmail(e) && !isManualPlaceholderEmail(e);
}

/** Inferir origen cuando registration_origin es NULL (registros anteriores al campo). */
export function inferRegistrationOrigin(input: RegistrationOriginInput): CandidateRegistrationOrigin | undefined {
    if (isCandidateRegistrationOrigin(input.registrationOrigin)) {
        return input.registrationOrigin;
    }

    if (input.addedViaManualRow) return 'manual';

    const email = (input.email || '').trim().toLowerCase();

    if (isTallyFormEmail(email)) return 'formulario';
    if (isManualPlaceholderEmail(email)) return 'manual';
    if (isBulkImportPlaceholderEmail(email) || isGenericImportPlaceholderEmail(email)) return 'masivo';

    if (input.firstApplicationAt) return 'formulario';
    if (input.applicationCount != null && input.applicationCount > 0) return 'formulario';

    // Email real u otro caso: alta por reclutador (Excel o fila manual con email)
    if (input.createdBy) return 'masivo';

    return undefined;
}

export function resolveRegistrationOrigin(input: RegistrationOriginInput): {
    origin?: CandidateRegistrationOrigin;
    inferred: boolean;
} {
    if (isCandidateRegistrationOrigin(input.registrationOrigin)) {
        return { origin: input.registrationOrigin, inferred: false };
    }
    const inferred = inferRegistrationOrigin(input);
    return inferred ? { origin: inferred, inferred: true } : { origin: undefined, inferred: false };
}

export function formatRegistrationOrigin(
    origin?: CandidateRegistrationOrigin | null,
    inferred = false
): string {
    if (!origin) return '—';
    const label = REGISTRATION_ORIGIN_LABELS[origin] ?? origin;
    return inferred ? `${label}*` : label;
}

/** Inserta la columna en procesos con orden guardado que aún no la incluyen */
export function ensureRegistrationOriginColumnInOrder(order: string[]): string[] {
    if (order.includes(REGISTRATION_ORIGIN_COLUMN_ID)) return order;
    const sourceIdx = order.indexOf('source');
    if (sourceIdx >= 0) {
        const out = [...order];
        out.splice(sourceIdx + 1, 0, REGISTRATION_ORIGIN_COLUMN_ID);
        return out;
    }
    const createdIdx = order.indexOf('createdAt');
    if (createdIdx >= 0) {
        const out = [...order];
        out.splice(createdIdx, 0, REGISTRATION_ORIGIN_COLUMN_ID);
        return out;
    }
    return [...order, REGISTRATION_ORIGIN_COLUMN_ID];
}

export function registrationOriginInputFromBulkCandidate(c: {
    registrationOrigin?: CandidateRegistrationOrigin;
    email?: string;
    applicationCount?: number;
    firstApplicationAt?: string;
    createdBy?: string;
}): RegistrationOriginInput {
    return {
        registrationOrigin: c.registrationOrigin,
        email: c.email,
        applicationCount: c.applicationCount,
        firstApplicationAt: c.firstApplicationAt,
        createdBy: c.createdBy,
    };
}
