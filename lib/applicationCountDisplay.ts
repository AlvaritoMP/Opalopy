/** Resuelve cuántas postulaciones por formulario tuvo el candidato. */
export function resolveApplicationCount(candidate: {
    applicationCount?: number | null;
    firstApplicationAt?: string | null;
    createdAt?: string | null;
}): number {
    const stored = Number(candidate.applicationCount);
    if (Number.isFinite(stored) && stored > 1) return stored;

    if (candidate.firstApplicationAt && candidate.createdAt) {
        const first = new Date(candidate.firstApplicationAt).getTime();
        const last = new Date(candidate.createdAt).getTime();
        if (Number.isFinite(first) && Number.isFinite(last) && last - first > 60_000) {
            return Math.max(2, Number.isFinite(stored) && stored > 0 ? stored : 2);
        }
    }

    return Number.isFinite(stored) && stored > 0 ? stored : 1;
}

/** Etiqueta visible para el número de postulación vía formulario */
export function getApplicationCountLabel(count?: number | null): string | null {
    const n = resolveApplicationCount({ applicationCount: count });
    if (n <= 1) return null;
    return `${n}ª postulación`;
}

export function getApplicationCountLabelFromCandidate(candidate: {
    applicationCount?: number | null;
    firstApplicationAt?: string | null;
    createdAt?: string | null;
}): string | null {
    const n = resolveApplicationCount(candidate);
    if (n <= 1) return null;
    return `${n}ª postulación`;
}

export function getApplicationCountPriorityClass(count?: number | null): string {
    const n = typeof count === 'number' ? count : resolveApplicationCount({ applicationCount: count });
    if (n >= 4) return 'bg-red-100 text-red-800 border-red-200';
    if (n >= 3) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (n >= 2) return 'bg-amber-100 text-amber-800 border-amber-200';
    return '';
}
