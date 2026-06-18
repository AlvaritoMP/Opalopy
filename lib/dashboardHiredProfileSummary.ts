import type { Process } from '../types';
import type { ContactAttempt } from './contactTracking';
import type { DashboardHiredContext, DashboardHiredEntry } from './dashboardHiredComparison';
import type { InterviewSchedulingCycleRow, InterviewSchedulingLogRow } from './api/interviewScheduling';
import { resolveCandidateAgeForProcess, resolveCandidateHomonymField, buildLegacyColumnIdToName } from './bulkTableColumns';
import { resolveCandidateRecordCreatedAt } from './contactologyAnalytics';
import { isChannelVolumeAttempt } from './contactDashboardStats';
import { CONTACT_CHANNELS, type ContactAttemptChannel } from './contactChannelConfig';
import {
    classifyRegistrationTimeBand,
    REGISTRATION_TIME_BAND_SHORT,
    type RegistrationTimeBand,
} from './registrationCreationStats';
import {
    registrationOriginInputFromBulkCandidate,
    resolveRegistrationOrigin,
    REGISTRATION_ORIGIN_LABELS,
} from './candidateRegistrationOrigin';
import { normalizeDistrictLabel } from './limaDistrictMap';
import { resolveHireAcceptedDate } from './dashboardEfficiencyMetrics';

export interface HiredProfileIndicator {
    id: string;
    group: 'demografia' | 'origen' | 'proceso' | 'tiempos' | 'contacto' | 'citas';
    label: string;
    value: string;
    detail?: string;
}

export interface HiredProfileSummary {
    totalHired: number;
    indicators: HiredProfileIndicator[];
}

type BulkExtras = {
    bulkColumnValues?: Record<string, unknown>;
    age?: number;
    source?: string;
    province?: string;
    district?: string;
};

function modeLabel(counts: Map<string, number>): { label: string; count: number; pct: number } | null {
    let best: { label: string; count: number } | null = null;
    for (const [label, count] of counts) {
        if (!best || count > best.count) best = { label, count };
    }
    if (!best || best.count === 0) return null;
    const total = [...counts.values()].reduce((s, n) => s + n, 0);
    return {
        label: best.label,
        count: best.count,
        pct: total > 0 ? Math.round((best.count / total) * 1000) / 10 : 0,
    };
}

function msToReadable(ms: number): string {
    if (ms < 0 || Number.isNaN(ms)) return 'N/D';
    const hours = ms / (1000 * 60 * 60);
    if (hours < 1) return `${Math.round(ms / (1000 * 60))} min`;
    if (hours < 48) return `${Math.round(hours * 10) / 10} h`;
    return `${Math.round((hours / 24) * 10) / 10} d`;
}

function avgMs(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((s, n) => s + n, 0) / values.length;
}

function ageBracket(age: number | null | undefined): string {
    if (age == null) return 'Sin dato';
    if (age < 20) return '<20';
    if (age <= 29) return '20-29';
    if (age <= 39) return '30-39';
    if (age <= 49) return '40-49';
    return '50+';
}

function translateSource(source: string): string {
    switch (source.toLowerCase()) {
        case 'linkedin': return 'LinkedIn';
        case 'referral': return 'Referido';
        case 'website': return 'Sitio web';
        case 'other': return 'Otro';
        default: return source;
    }
}

function firstContactAt(attempts: ContactAttempt[], candidateId: string): string | undefined {
    let best: string | undefined;
    let bestTs = Infinity;
    const channels = Object.keys(CONTACT_CHANNELS) as ContactAttemptChannel[];
    for (const a of attempts) {
        if (a.candidateId !== candidateId) continue;
        if (!channels.some(ch => isChannelVolumeAttempt(a, ch))) continue;
        const ts = new Date(a.createdAt).getTime();
        if (Number.isNaN(ts) || ts >= bestTs) continue;
        bestTs = ts;
        best = a.createdAt;
    }
    return best;
}

function resolveAge(entry: DashboardHiredEntry, process: Process | undefined, extras?: BulkExtras): number | null {
    const enrichedRow = {
        ...(entry.candidate.bulkColumnValues || {}),
        ...(extras?.bulkColumnValues || {}),
    };
    return (
        resolveCandidateAgeForProcess(
            {
                id: entry.candidate.id,
                age: extras?.age ?? entry.candidate.age,
                bulkColumnValues: Object.keys(enrichedRow).length > 0 ? enrichedRow : undefined,
            },
            process,
            Object.keys(enrichedRow).length > 0 ? { [entry.candidate.id]: enrichedRow } : {}
        ) ?? null
    );
}

function resolveDistrict(entry: DashboardHiredEntry, process: Process | undefined, extras?: BulkExtras): string {
    const customColumns = process?.bulkConfig?.customColumns ?? [];
    const legacy = buildLegacyColumnIdToName(process?.bulkConfig, customColumns);
    const enrichedRow = {
        ...(entry.candidate.bulkColumnValues || {}),
        ...(extras?.bulkColumnValues || {}),
    };
    const homonym = {
        id: entry.candidate.id,
        district: extras?.district ?? entry.candidate.district,
        bulkColumnValues: Object.keys(enrichedRow).length > 0 ? enrichedRow : undefined,
    };
    const columnValues = Object.keys(enrichedRow).length > 0 ? { [entry.candidate.id]: enrichedRow } : {};
    const raw = resolveCandidateHomonymField(homonym, 'district', customColumns, columnValues, legacy);
    return normalizeDistrictLabel(raw != null && raw !== '' ? String(raw) : '') || 'Sin distrito';
}

function resolveSource(entry: DashboardHiredEntry, process: Process | undefined, extras?: BulkExtras): string {
    const customColumns = process?.bulkConfig?.customColumns ?? [];
    const legacy = buildLegacyColumnIdToName(process?.bulkConfig, customColumns);
    const enrichedRow = {
        ...(entry.candidate.bulkColumnValues || {}),
        ...(extras?.bulkColumnValues || {}),
    };
    const homonym = {
        id: entry.candidate.id,
        source: extras?.source ?? entry.candidate.source,
        bulkColumnValues: Object.keys(enrichedRow).length > 0 ? enrichedRow : undefined,
    };
    const columnValues = Object.keys(enrichedRow).length > 0 ? { [entry.candidate.id]: enrichedRow } : {};
    const raw = resolveCandidateHomonymField(homonym, 'source', customColumns, columnValues, legacy);
    return translateSource(raw != null && raw !== '' ? String(raw) : 'Otro');
}

export function computeHiredProfileSummary(
    hiredCtx: DashboardHiredContext,
    processMap: Map<string, Process>,
    bulkExtrasById: Record<string, BulkExtras>,
    contactAttempts: ContactAttempt[],
    schedulingLogs: InterviewSchedulingLogRow[],
    schedulingCycles: InterviewSchedulingCycleRow[]
): HiredProfileSummary {
    const entries = hiredCtx.entries;
    if (entries.length === 0) {
        return { totalHired: 0, indicators: [] };
    }

    const sourceCounts = new Map<string, number>();
    const districtCounts = new Map<string, number>();
    const ageBracketCounts = new Map<string, number>();
    const processCounts = new Map<string, number>();
    const originCounts = new Map<string, number>();
    const timeBandCounts = new Map<string, number>();

    const ages: number[] = [];
    const regToHireMs: number[] = [];
    const regToContactMs: number[] = [];
    const scheduleToHireMs: number[] = [];

    const firstScheduleByCandidate = new Map<string, string>();
    for (const log of schedulingLogs) {
        if (log.action !== 'scheduled' && log.action !== 'rescheduled') continue;
        const existing = firstScheduleByCandidate.get(log.candidateId);
        if (!existing || log.createdAt < existing) {
            firstScheduleByCandidate.set(log.candidateId, log.createdAt);
        }
    }

    for (const entry of entries) {
        const c = entry.candidate;
        const process = processMap.get(c.processId);
        const extras = bulkExtrasById[c.id];

        const source = resolveSource(entry, process, extras);
        sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);

        const district = resolveDistrict(entry, process, extras);
        districtCounts.set(district, (districtCounts.get(district) || 0) + 1);

        const age = resolveAge(entry, process, extras);
        const bracket = ageBracket(age);
        ageBracketCounts.set(bracket, (ageBracketCounts.get(bracket) || 0) + 1);
        if (age != null) ages.push(age);

        const processTitle = process?.title?.trim() || 'Sin proceso';
        processCounts.set(processTitle, (processCounts.get(processTitle) || 0) + 1);

        const { origin } = resolveRegistrationOrigin(registrationOriginInputFromBulkCandidate(c));
        const originLabel = origin ? REGISTRATION_ORIGIN_LABELS[origin] : 'Sin dato';
        originCounts.set(originLabel, (originCounts.get(originLabel) || 0) + 1);

        const createdAt = resolveCandidateRecordCreatedAt(c);
        if (createdAt) {
            const band = classifyRegistrationTimeBand(createdAt);
            const bandLabel = band ? REGISTRATION_TIME_BAND_SHORT[band] : 'Sin dato';
            timeBandCounts.set(bandLabel, (timeBandCounts.get(bandLabel) || 0) + 1);
        } else {
            timeBandCounts.set('Sin dato', (timeBandCounts.get('Sin dato') || 0) + 1);
        }

        const hireIso = resolveHireAcceptedDate(c, process) || entry.hireDateIso;
        const hireTs = new Date(hireIso).getTime();
        if (createdAt && !Number.isNaN(hireTs)) {
            const regTs = new Date(createdAt).getTime();
            if (!Number.isNaN(regTs) && hireTs >= regTs) regToHireMs.push(hireTs - regTs);
        }

        const contactAt = firstContactAt(contactAttempts, c.id);
        if (createdAt && contactAt) {
            const regTs = new Date(createdAt).getTime();
            const contactTs = new Date(contactAt).getTime();
            if (!Number.isNaN(regTs) && !Number.isNaN(contactTs) && contactTs >= regTs) {
                regToContactMs.push(contactTs - regTs);
            }
        }

        const firstSchedule = firstScheduleByCandidate.get(c.id);
        if (firstSchedule && !Number.isNaN(hireTs)) {
            const schTs = new Date(firstSchedule).getTime();
            if (!Number.isNaN(schTs) && hireTs >= schTs) scheduleToHireMs.push(hireTs - schTs);
        }
    }

    const attendedCount = entries.filter(e =>
        schedulingCycles.some(c => c.candidateId === e.candidate.id && c.status === 'attended')
    ).length;

    const indicators: HiredProfileIndicator[] = [];
    const total = entries.length;

    const topAge = modeLabel(ageBracketCounts);
    if (topAge) {
        indicators.push({
            id: 'age-bracket',
            group: 'demografia',
            label: 'Rango de edad más frecuente',
            value: topAge.label,
            detail: `${topAge.count} de ${total} (${topAge.pct}%)`,
        });
    }

    if (ages.length > 0) {
        const avgAge = Math.round((ages.reduce((s, n) => s + n, 0) / ages.length) * 10) / 10;
        indicators.push({
            id: 'age-avg',
            group: 'demografia',
            label: 'Edad promedio',
            value: `${avgAge} años`,
            detail: `Sobre ${ages.length} contratado${ages.length !== 1 ? 's' : ''} con edad`,
        });
    }

    const topDistrict = modeLabel(districtCounts);
    if (topDistrict) {
        indicators.push({
            id: 'district',
            group: 'demografia',
            label: 'Distrito más frecuente',
            value: topDistrict.label,
            detail: `${topDistrict.count} de ${total} (${topDistrict.pct}%)`,
        });
    }

    const topSource = modeLabel(sourceCounts);
    if (topSource) {
        indicators.push({
            id: 'source',
            group: 'origen',
            label: 'Fuente de postulación',
            value: topSource.label,
            detail: `${topSource.count} de ${total} (${topSource.pct}%)`,
        });
    }

    const topOrigin = modeLabel(originCounts);
    if (topOrigin) {
        indicators.push({
            id: 'registration-origin',
            group: 'origen',
            label: 'Origen del registro',
            value: topOrigin.label,
            detail: `${topOrigin.count} de ${total} (${topOrigin.pct}%)`,
        });
    }

    const topBand = modeLabel(timeBandCounts);
    if (topBand) {
        indicators.push({
            id: 'time-band',
            group: 'origen',
            label: 'Franja horaria de alta',
            value: topBand.label,
            detail: `${topBand.count} de ${total} (${topBand.pct}%) · hora Lima`,
        });
    }

    const topProcess = modeLabel(processCounts);
    if (topProcess) {
        indicators.push({
            id: 'process',
            group: 'proceso',
            label: 'Proceso / puesto',
            value: topProcess.label,
            detail: `${topProcess.count} de ${total} (${topProcess.pct}%)`,
        });
    }

    const avgRegContact = avgMs(regToContactMs);
    if (avgRegContact != null) {
        indicators.push({
            id: 'time-first-contact',
            group: 'tiempos',
            label: 'Tiempo al 1.er contacto',
            value: msToReadable(avgRegContact),
            detail: `Promedio desde alta hasta 1.er intento (efectivo o fallido) · ${regToContactMs.length} casos`,
        });
    }

    const avgRegHire = avgMs(regToHireMs);
    if (avgRegHire != null) {
        indicators.push({
            id: 'time-reg-hire',
            group: 'tiempos',
            label: 'Registro → contratación',
            value: msToReadable(avgRegHire),
            detail: `${regToHireMs.length} contratado${regToHireMs.length !== 1 ? 's' : ''} con fechas`,
        });
    }

    const avgSchHire = avgMs(scheduleToHireMs);
    if (avgSchHire != null) {
        indicators.push({
            id: 'time-schedule-hire',
            group: 'citas',
            label: 'Agenda → contratación',
            value: msToReadable(avgSchHire),
            detail: `${scheduleToHireMs.length} con agenda previa`,
        });
    }

    indicators.push({
        id: 'attended',
        group: 'citas',
        label: 'Asistieron a cita',
        value: `${attendedCount} de ${total}`,
        detail:
            total > 0
                ? `${Math.round((attendedCount / total) * 1000) / 10}% de los contratados`
                : undefined,
    });

    return { totalHired: total, indicators };
}

export const HIRED_PROFILE_GROUP_LABELS: Record<HiredProfileIndicator['group'], string> = {
    demografia: 'Perfil demográfico',
    origen: 'Origen y alta',
    proceso: 'Proceso',
    tiempos: 'Tiempos de contacto',
    contacto: 'Contactología',
    citas: 'Citas y cierre',
};
