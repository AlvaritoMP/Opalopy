import type { Candidate, Process } from '../types';
import { resolveHireAcceptedDate } from './dashboardEfficiencyMetrics';
import { resolveHiringStageId } from './hiringStageTracking';
import {
    classifyRegistrationTimeBand,
    type RegistrationTimeBand,
} from './registrationCreationStats';
import {
    formatDateKeyLima,
    formatMonthKeyLima,
    getContactPeriodRange,
    type ContactConsultantPeriod,
    type ContactDailyTrendSeries,
    type ContactHourlyDistribution,
} from './contactDashboardStats';

export const HIRED_METRIC_KEY = 'Contratados';
export const HIRED_METRIC_COLOR = '#059669';

const LIMA_TZ = 'America/Lima';

export interface DashboardHiredEntry {
    candidate: Candidate;
    hireDateIso: string;
    hireDateKey: string;
    hireMonthKey: string;
    timeBand: RegistrationTimeBand | null;
    hourLima: number;
}

export interface DashboardHiredContext {
    entries: DashboardHiredEntry[];
    idSet: Set<string>;
}

export function isDashboardHiredCandidate(
    candidate: Candidate,
    process: Process | undefined
): boolean {
    if (candidate.discarded) return false;
    const hiringStageId = resolveHiringStageId(process);
    if (!hiringStageId) return false;
    if (candidate.stageId === hiringStageId) return true;
    if (process?.hiredCandidateIds?.includes(candidate.id)) return true;
    return false;
}

function getHourInLima(iso: string): number {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return -1;
    const parts = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: LIMA_TZ,
    }).formatToParts(d);
    const hourPart = parts.find(p => p.type === 'hour');
    return hourPart ? parseInt(hourPart.value, 10) : d.getHours();
}

export function buildDashboardHiredContext(
    candidates: Candidate[],
    processMap: Map<string, Process>
): DashboardHiredContext {
    const entries: DashboardHiredEntry[] = [];

    for (const candidate of candidates) {
        const process = processMap.get(candidate.processId);
        if (!isDashboardHiredCandidate(candidate, process)) continue;

        const hireDateIso = resolveHireAcceptedDate(candidate, process);
        if (!hireDateIso?.trim()) continue;

        entries.push({
            candidate,
            hireDateIso,
            hireDateKey: formatDateKeyLima(hireDateIso),
            hireMonthKey: formatMonthKeyLima(hireDateIso),
            timeBand: classifyRegistrationTimeBand(hireDateIso),
            hourLima: getHourInLima(hireDateIso),
        });
    }

    return {
        entries,
        idSet: new Set(entries.map(e => e.candidate.id)),
    };
}

export function countHiredByBucket(
    ctx: DashboardHiredContext,
    bucketFn: (entry: DashboardHiredEntry) => string | undefined | null
): Map<string, number> {
    const out = new Map<string, number>();
    for (const entry of ctx.entries) {
        const key = bucketFn(entry);
        if (!key) continue;
        out.set(key, (out.get(key) || 0) + 1);
    }
    return out;
}

export function augmentNamedCountRows<T extends Record<string, unknown>>(
    rows: T[],
    nameKey: keyof T,
    hiredByName: Map<string, number>
): (T & { Contratados: number })[] {
    return rows.map(row => {
        const name = String(row[nameKey] ?? '');
        return {
            ...row,
            Contratados: hiredByName.get(name) || 0,
        };
    });
}

export function augmentValueRows(
    rows: { name: string; value: number }[],
    hiredByName: Map<string, number>
): { name: string; value: number; Contratados: number }[] {
    return rows.map(row => ({
        name: row.name,
        value: row.value,
        Contratados: hiredByName.get(row.name) || 0,
    }));
}

export function countHiredByTimeBand(ctx: DashboardHiredContext): Record<RegistrationTimeBand, number> {
    const out: Record<RegistrationTimeBand, number> = {
        morning: 0,
        afternoon: 0,
        evening: 0,
        overnight: 0,
    };
    for (const entry of ctx.entries) {
        if (entry.timeBand) out[entry.timeBand] += 1;
    }
    return out;
}

export function injectHiredIntoDailyTrendSeries(
    series: ContactDailyTrendSeries,
    ctx: DashboardHiredContext,
    period: ContactConsultantPeriod
): ContactDailyTrendSeries {
    const { startKey, endKey } = getContactPeriodRange(period);
    const keySelector =
        series.granularity === 'month'
            ? (e: DashboardHiredEntry) => e.hireMonthKey
            : (e: DashboardHiredEntry) => e.hireDateKey;

    const hiredInRange = ctx.entries.filter(e => {
        const key = keySelector(e);
        return key >= startKey && key <= endKey;
    });

    const data = series.data.map(row => ({
        ...row,
        [HIRED_METRIC_KEY]: hiredInRange.filter(e => keySelector(e) === row.key).length,
    }));

    const users = series.users.includes(HIRED_METRIC_KEY)
        ? series.users
        : [...series.users, HIRED_METRIC_KEY];

    return { ...series, data, users };
}

export function injectHiredIntoHourlyDistribution(
    series: ContactHourlyDistribution,
    ctx: DashboardHiredContext,
    period: ContactConsultantPeriod
): ContactHourlyDistribution & { data: Array<{ hour: number; label: string; count: number; hiredCount: number }> } {
    const { startKey, endKey } = getContactPeriodRange(period);
    const hiredInRange = ctx.entries.filter(
        e => e.hireDateKey >= startKey && e.hireDateKey <= endKey
    );

    const hiredByHour = new Array(24).fill(0);
    for (const entry of hiredInRange) {
        if (entry.hourLima >= 0 && entry.hourLima < 24) {
            hiredByHour[entry.hourLima] += 1;
        }
    }

    const data = series.data.map(row => ({
        ...row,
        hiredCount: hiredByHour[row.hour] || 0,
    }));

    return { ...series, data };
}

export function buildHiredDailyTrendForKeys(
    dateKeys: string[],
    ctx: DashboardHiredContext,
    keySelector: (e: DashboardHiredEntry) => string
): Record<string, number> {
    const out: Record<string, number> = {};
    for (const key of dateKeys) out[key] = 0;
    for (const entry of ctx.entries) {
        const key = keySelector(entry);
        if (key in out) out[key] += 1;
    }
    return out;
}

export function chartHasHiredData(rows: { Contratados?: number; hiredCount?: number }[]): boolean {
    return rows.some(r => (r.Contratados ?? 0) > 0 || (r.hiredCount ?? 0) > 0);
}

export const HIRED_CHART_HINT =
    'La serie «Contratados» (verde) muestra cuántos de cada categoría fueron contratados o, en gráficos por fecha/hora, el día u hora de contratación (America/Lima).';
