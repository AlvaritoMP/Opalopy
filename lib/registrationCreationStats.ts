const LIMA_TZ = 'America/Lima';

export type RegistrationTimeBand = 'morning' | 'afternoon' | 'evening' | 'overnight';

export const REGISTRATION_TIME_BAND_LABELS: Record<RegistrationTimeBand, string> = {
    morning: '8:30 a.m. – 3:00 p.m.',
    afternoon: '3:00 p.m. – 6:00 p.m.',
    evening: '6:00 p.m. – 12:00 a.m.',
    overnight: '12:00 a.m. – 8:30 a.m.',
};

export const REGISTRATION_TIME_BAND_SHORT: Record<RegistrationTimeBand, string> = {
    morning: 'Mañana (8:30–15:00)',
    afternoon: 'Tarde (15:00–18:00)',
    evening: 'Noche (18:00–00:00)',
    overnight: 'Madrugada (00:00–8:30)',
};

export interface RegistrationCreationCandidateInput {
    id: string;
    createdAt?: string;
    firstApplicationAt?: string;
    applicationStartedDate?: string;
    registrationOrigin?: 'formulario' | 'manual' | 'masivo';
    applicationCount?: number;
}

export interface RegistrationCreationStats {
    totalWithTimestamp: number;
    formSubmissionCount: number;
    atsManualCount: number;
    /** Solo postulaciones Tally/formulario con first_application_at y created_at */
    avgFormToRecordMinutes: number | null;
    avgFormToRecordLabel: string;
    formToRecordSampleCount: number;
    formToRecordDescription: string;
    avgIntervalBetweenRecordsMinutes: number | null;
    avgIntervalBetweenRecordsLabel: string;
    timeBandDistribution: {
        band: RegistrationTimeBand;
        label: string;
        formCount: number;
        manualCount: number;
        count: number;
        formPct: number;
        manualPct: number;
        pct: number;
    }[];
    peakTimeBand: { band: RegistrationTimeBand; label: string; count: number } | null;
    peakFormTimeBand: { band: RegistrationTimeBand; label: string; count: number } | null;
}

/** Timestamp usado para franjas horarias y tiempos entre altas. */
export function resolveRecordCreatedAt(candidate: RegistrationCreationCandidateInput): string | undefined {
    return (
        candidate.createdAt ||
        candidate.firstApplicationAt ||
        candidate.applicationStartedDate ||
        undefined
    );
}

function isFormSubmission(candidate: RegistrationCreationCandidateInput): boolean {
    if (candidate.registrationOrigin === 'formulario') return true;
    if (candidate.registrationOrigin === 'manual' || candidate.registrationOrigin === 'masivo') return false;
    if (candidate.firstApplicationAt && (candidate.applicationCount ?? 0) > 0) return true;
    return false;
}

/** Altas por reclutadores en el ATS (fila manual, Excel, importación masiva, etc.). */
function isAtsManualRegistration(candidate: RegistrationCreationCandidateInput): boolean {
    return !isFormSubmission(candidate);
}

function getLimaHourMinute(iso: string): { hour: number; minute: number } | null {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
        timeZone: LIMA_TZ,
    }).formatToParts(d);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '', 10);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return { hour, minute };
}

/** Clasifica la hora de creación del registro en franjas operativas (hora Lima). */
export function classifyRegistrationTimeBand(iso: string): RegistrationTimeBand | null {
    const hm = getLimaHourMinute(iso);
    if (!hm) return null;
    const minutes = hm.hour * 60 + hm.minute;
    const morningStart = 8 * 60 + 30;
    const afternoonStart = 15 * 60;
    const eveningStart = 18 * 60;

    if (minutes >= morningStart && minutes < afternoonStart) return 'morning';
    if (minutes >= afternoonStart && minutes < eveningStart) return 'afternoon';
    if (minutes >= eveningStart) return 'evening';
    return 'overnight';
}

function msToReadableDuration(ms: number): string {
    if (ms < 0 || Number.isNaN(ms)) return 'N/D';
    const minutes = ms / (1000 * 60);
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = minutes / 60;
    if (hours < 48) return `${Math.round(hours * 10) / 10} h`;
    return `${Math.round((hours / 24) * 10) / 10} d`;
}

export function computeRegistrationCreationStats(
    candidates: RegistrationCreationCandidateInput[]
): RegistrationCreationStats {
    const withCreatedAt = candidates
        .map(c => ({ c, createdAt: resolveRecordCreatedAt(c) }))
        .filter(
            (row): row is { c: RegistrationCreationCandidateInput; createdAt: string } =>
                !!row.createdAt && !Number.isNaN(new Date(row.createdAt).getTime())
        );

    const bandCounts: Record<RegistrationTimeBand, number> = {
        morning: 0,
        afternoon: 0,
        evening: 0,
        overnight: 0,
    };
    const formBandCounts: Record<RegistrationTimeBand, number> = {
        morning: 0,
        afternoon: 0,
        evening: 0,
        overnight: 0,
    };
    const manualBandCounts: Record<RegistrationTimeBand, number> = {
        morning: 0,
        afternoon: 0,
        evening: 0,
        overnight: 0,
    };

    for (const { c, createdAt } of withCreatedAt) {
        const band = classifyRegistrationTimeBand(createdAt);
        if (!band) continue;
        bandCounts[band] += 1;
        if (isFormSubmission(c)) formBandCounts[band] += 1;
        else if (isAtsManualRegistration(c)) manualBandCounts[band] += 1;
    }

    const totalWithTimestamp = withCreatedAt.length;
    const formSubmissionCount = withCreatedAt.filter(({ c }) => isFormSubmission(c)).length;
    const atsManualCount = withCreatedAt.filter(({ c }) => isAtsManualRegistration(c)).length;

    const timeBandDistribution = (Object.keys(bandCounts) as RegistrationTimeBand[]).map(band => ({
        band,
        label: REGISTRATION_TIME_BAND_SHORT[band],
        formCount: formBandCounts[band],
        manualCount: manualBandCounts[band],
        count: bandCounts[band],
        formPct:
            formSubmissionCount > 0
                ? Math.round((formBandCounts[band] / formSubmissionCount) * 1000) / 10
                : 0,
        manualPct:
            atsManualCount > 0
                ? Math.round((manualBandCounts[band] / atsManualCount) * 1000) / 10
                : 0,
        pct:
            totalWithTimestamp > 0
                ? Math.round((bandCounts[band] / totalWithTimestamp) * 1000) / 10
                : 0,
    }));

    let peakTimeBand: RegistrationCreationStats['peakTimeBand'] = null;
    let peakFormTimeBand: RegistrationCreationStats['peakFormTimeBand'] = null;
    for (const row of timeBandDistribution) {
        if (row.count > 0 && (!peakTimeBand || row.count > peakTimeBand.count)) {
            peakTimeBand = { band: row.band, label: row.label, count: row.count };
        }
        if (row.formCount > 0 && (!peakFormTimeBand || row.formCount > peakFormTimeBand.count)) {
            peakFormTimeBand = { band: row.band, label: row.label, count: row.formCount };
        }
    }

    const formCandidates = withCreatedAt.filter(({ c }) => isFormSubmission(c));

    const formLagMs: number[] = [];
    for (const { c, createdAt } of formCandidates) {
        if (!c.firstApplicationAt) continue;
        const formTs = new Date(c.firstApplicationAt).getTime();
        const createdTs = new Date(createdAt).getTime();
        if (Number.isNaN(formTs) || Number.isNaN(createdTs) || createdTs < formTs) continue;
        formLagMs.push(createdTs - formTs);
    }

    const avgFormToRecordMs =
        formLagMs.length > 0 ? formLagMs.reduce((s, n) => s + n, 0) / formLagMs.length : null;

    let formToRecordDescription: string;
    if (formSubmissionCount === 0) {
        formToRecordDescription =
            'No hay postulaciones por formulario (Tally) en el filtro. Altas manuales o masivas no tienen este dato.';
    } else if (formLagMs.length === 0) {
        formToRecordDescription =
            'Hay postulaciones por formulario, pero falta first_application_at o created_at para calcular la latencia.';
    } else {
        formToRecordDescription =
            'Tiempo entre la primera postulación Tally (first_application_at) y el alta en sistema (created_at).';
    }

    const sortedCreated = withCreatedAt
        .map(({ createdAt }) => new Date(createdAt).getTime())
        .filter(ts => !Number.isNaN(ts))
        .sort((a, b) => a - b);

    const intervalMs: number[] = [];
    for (let i = 1; i < sortedCreated.length; i++) {
        intervalMs.push(sortedCreated[i] - sortedCreated[i - 1]);
    }

    const avgIntervalMs =
        intervalMs.length > 0 ? intervalMs.reduce((s, n) => s + n, 0) / intervalMs.length : null;

    return {
        totalWithTimestamp,
        formSubmissionCount,
        atsManualCount,
        avgFormToRecordMinutes: avgFormToRecordMs
            ? Math.round(avgFormToRecordMs / (1000 * 60))
            : null,
        avgFormToRecordLabel: avgFormToRecordMs ? msToReadableDuration(avgFormToRecordMs) : 'N/D',
        formToRecordSampleCount: formLagMs.length,
        formToRecordDescription,
        avgIntervalBetweenRecordsMinutes: avgIntervalMs
            ? Math.round(avgIntervalMs / (1000 * 60))
            : null,
        avgIntervalBetweenRecordsLabel: avgIntervalMs ? msToReadableDuration(avgIntervalMs) : 'N/D',
        timeBandDistribution,
        peakTimeBand,
        peakFormTimeBand,
    };
}
