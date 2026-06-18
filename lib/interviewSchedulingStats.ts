import type { InterviewSchedulingLogRow, InterviewSchedulingCycleRow } from './api/interviewScheduling';
import type { DashboardHiredContext } from './dashboardHiredComparison';
import {
    formatDateKeyLima,
    formatDayLabelFromKey,
    formatMonthKeyLima,
    getContactPeriodRange,
    iterDateKeys,
    type ContactConsultantPeriod,
} from './contactDashboardStats';

export type InterviewSchedulingPeriod = ContactConsultantPeriod;

export interface InterviewSchedulingDashboardStats {
    periodLabel: string;
    totalSchedulingActions: number;
    totalReschedules: number;
    totalAttended: number;
    openCycles: number;
    avgActionsUntilAttendance: number | null;
    topScheduler: { userName: string; count: number } | null;
    topInterviewer: { userName: string; count: number } | null;
    schedulerRankings: { name: string; agendas: number; reagendas: number }[];
    interviewerRankings: { name: string; agendas: number; reagendas: number }[];
    /** Evolución diaria (o mensual en vista anual) de agendas, asistencias y contratados */
    dailyTrend: SchedulingDailyTrendPoint[];
    /** Embudo y tiempos promedio en días */
    funnel: SchedulingFunnelStats;
}

export interface SchedulingDailyTrendPoint {
    key: string;
    label: string;
    agendas: number;
    asistencias: number;
    contratados: number;
}

export interface SchedulingFunnelStats {
    uniqueScheduled: number;
    uniqueAttended: number;
    uniqueHiredAmongScheduled: number;
    uniqueHiredAmongAttended: number;
    attendanceRatePct: number | null;
    hireRateFromAttendedPct: number | null;
    hireRateFromScheduledPct: number | null;
    avgDaysScheduleToAttendance: number | null;
    avgDaysAttendanceToHire: number | null;
    avgDaysScheduleToHire: number | null;
}

function resolveUserName(
    userId: string | undefined,
    userName: string | undefined,
    users: Array<{ id: string; name?: string; email?: string }>
): string {
    if (userName?.trim()) return userName.trim();
    if (!userId) return 'Sin asignar';
    const u = users.find(x => x.id === userId);
    if (u?.name?.trim()) return u.name.trim();
    if (u?.email?.trim()) return u.email.split('@')[0];
    return 'Usuario';
}

function formatMonthLabelFromKey(key: string): string {
    const date = new Date(`${key}-01T12:00:00-05:00`);
    return date.toLocaleDateString('es-PE', { month: 'short', timeZone: 'America/Lima' });
}

function buildTimelineBuckets(
    period: InterviewSchedulingPeriod
): { key: string; label: string }[] {
    const { startKey, endKey } = getContactPeriodRange(period);

    if (period === 'year') {
        const { startKey, endKey } = getContactPeriodRange(period);
        const y = parseInt(startKey.slice(0, 4), 10);
        const endMonth = parseInt(endKey.slice(5, 7), 10);
        const buckets: { key: string; label: string }[] = [];
        for (let m = 1; m <= endMonth; m++) {
            const key = `${y}-${String(m).padStart(2, '0')}`;
            buckets.push({ key, label: formatMonthLabelFromKey(key) });
        }
        return buckets;
    }

    return iterDateKeys(startKey, endKey).map(key => ({
        key,
        label: formatDayLabelFromKey(key),
    }));
}

function msToDays(ms: number): number {
    return Math.round((ms / (1000 * 60 * 60 * 24)) * 10) / 10;
}

function avgDays(deltas: number[]): number | null {
    if (deltas.length === 0) return null;
    return msToDays(deltas.reduce((s, n) => s + n, 0) / deltas.length);
}

function computeSchedulingFunnel(
    logs: InterviewSchedulingLogRow[],
    cycles: InterviewSchedulingCycleRow[],
    hiredCtx: DashboardHiredContext | undefined,
    candidateIdsInScope?: Set<string>
): SchedulingFunnelStats {
    const schedulingLogs = logs.filter(
        l =>
            (l.action === 'scheduled' || l.action === 'rescheduled') &&
            (!candidateIdsInScope || candidateIdsInScope.has(l.candidateId))
    );

    const attendedCycles = cycles.filter(
        c =>
            c.status === 'attended' &&
            c.attendedAt &&
            (!candidateIdsInScope || candidateIdsInScope.has(c.candidateId))
    );

    const scheduledIds = new Set(schedulingLogs.map(l => l.candidateId));
    const attendedIds = new Set(attendedCycles.map(c => c.candidateId));
    const hiredIds = hiredCtx?.idSet ?? new Set<string>();

    const uniqueScheduled = scheduledIds.size;
    const uniqueAttended = attendedIds.size;
    const uniqueHiredAmongScheduled = [...scheduledIds].filter(id => hiredIds.has(id)).length;
    const uniqueHiredAmongAttended = [...attendedIds].filter(id => hiredIds.has(id)).length;

    const firstScheduleByCandidate = new Map<string, string>();
    for (const log of schedulingLogs) {
        const existing = firstScheduleByCandidate.get(log.candidateId);
        if (!existing || log.createdAt < existing) {
            firstScheduleByCandidate.set(log.candidateId, log.createdAt);
        }
    }

    const scheduleToAttendanceMs: number[] = [];
    for (const cycle of attendedCycles) {
        if (!cycle.attendedAt) continue;
        const firstSchedule = firstScheduleByCandidate.get(cycle.candidateId);
        if (!firstSchedule) continue;
        const start = new Date(firstSchedule).getTime();
        const end = new Date(cycle.attendedAt).getTime();
        if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
            scheduleToAttendanceMs.push(end - start);
        }
    }

    const attendanceToHireMs: number[] = [];
    const scheduleToHireMs: number[] = [];
    if (hiredCtx) {
        for (const entry of hiredCtx.entries) {
            const hireTs = new Date(entry.hireDateIso).getTime();
            if (Number.isNaN(hireTs)) continue;

            const cycle = attendedCycles.find(c => c.candidateId === entry.candidate.id);
            if (cycle?.attendedAt) {
                const attTs = new Date(cycle.attendedAt).getTime();
                if (!Number.isNaN(attTs) && hireTs >= attTs) {
                    attendanceToHireMs.push(hireTs - attTs);
                }
            }

            const firstSchedule = firstScheduleByCandidate.get(entry.candidate.id);
            if (firstSchedule) {
                const schTs = new Date(firstSchedule).getTime();
                if (!Number.isNaN(schTs) && hireTs >= schTs) {
                    scheduleToHireMs.push(hireTs - schTs);
                }
            }
        }
    }

    return {
        uniqueScheduled,
        uniqueAttended,
        uniqueHiredAmongScheduled,
        uniqueHiredAmongAttended,
        attendanceRatePct:
            uniqueScheduled > 0
                ? Math.round((uniqueAttended / uniqueScheduled) * 1000) / 10
                : null,
        hireRateFromAttendedPct:
            uniqueAttended > 0
                ? Math.round((uniqueHiredAmongAttended / uniqueAttended) * 1000) / 10
                : null,
        hireRateFromScheduledPct:
            uniqueScheduled > 0
                ? Math.round((uniqueHiredAmongScheduled / uniqueScheduled) * 1000) / 10
                : null,
        avgDaysScheduleToAttendance: avgDays(scheduleToAttendanceMs),
        avgDaysAttendanceToHire: avgDays(attendanceToHireMs),
        avgDaysScheduleToHire: avgDays(scheduleToHireMs),
    };
}

function computeDailyTrend(
    logs: InterviewSchedulingLogRow[],
    cycles: InterviewSchedulingCycleRow[],
    hiredCtx: DashboardHiredContext | undefined,
    period: InterviewSchedulingPeriod,
    candidateIdsInScope?: Set<string>
): SchedulingDailyTrendPoint[] {
    const { startKey, endKey } = getContactPeriodRange(period);
    const buckets = buildTimelineBuckets(period);
    const isMonthly = period === 'year';

    const agendaByKey = new Map<string, number>();
    const attendanceByKey = new Map<string, number>();
    const hiredByKey = new Map<string, number>();

    for (const bucket of buckets) {
        agendaByKey.set(bucket.key, 0);
        attendanceByKey.set(bucket.key, 0);
        hiredByKey.set(bucket.key, 0);
    }

    for (const log of logs) {
        if (log.action !== 'scheduled' && log.action !== 'rescheduled') continue;
        if (candidateIdsInScope && !candidateIdsInScope.has(log.candidateId)) continue;
        const key = isMonthly
            ? formatMonthKeyLima(log.createdAt)
            : formatDateKeyLima(log.createdAt);
        if (!key || key < startKey || key > endKey) continue;
        if (agendaByKey.has(key)) {
            agendaByKey.set(key, (agendaByKey.get(key) || 0) + 1);
        }
    }

    for (const cycle of cycles) {
        if (cycle.status !== 'attended' || !cycle.attendedAt) continue;
        if (candidateIdsInScope && !candidateIdsInScope.has(cycle.candidateId)) continue;
        const key = isMonthly
            ? formatMonthKeyLima(cycle.attendedAt)
            : formatDateKeyLima(cycle.attendedAt);
        if (!key || key < startKey || key > endKey) continue;
        if (attendanceByKey.has(key)) {
            attendanceByKey.set(key, (attendanceByKey.get(key) || 0) + 1);
        }
    }

    if (hiredCtx) {
        for (const entry of hiredCtx.entries) {
            const key = isMonthly ? entry.hireMonthKey : entry.hireDateKey;
            if (!key || key < startKey || key > endKey) continue;
            if (hiredByKey.has(key)) {
                hiredByKey.set(key, (hiredByKey.get(key) || 0) + 1);
            }
        }
    }

    return buckets.map(bucket => ({
        key: bucket.key,
        label: bucket.label,
        agendas: agendaByKey.get(bucket.key) || 0,
        asistencias: attendanceByKey.get(bucket.key) || 0,
        contratados: hiredByKey.get(bucket.key) || 0,
    }));
}

export function computeInterviewSchedulingStats(
    logs: InterviewSchedulingLogRow[],
    cycles: InterviewSchedulingCycleRow[],
    period: InterviewSchedulingPeriod,
    users: Array<{ id: string; name?: string; email?: string }> = [],
    candidateIdsInScope?: Set<string>,
    hiredCtx?: DashboardHiredContext
): InterviewSchedulingDashboardStats {
    const { startKey, endKey, label: periodLabel } = getContactPeriodRange(period);

    const scopedLogs = logs.filter(l => {
        const key = formatDateKeyLima(l.createdAt);
        if (!key || key < startKey || key > endKey) return false;
        if (candidateIdsInScope && !candidateIdsInScope.has(l.candidateId)) return false;
        return l.action === 'scheduled' || l.action === 'rescheduled';
    });

    const scopedCycles = cycles.filter(c => {
        const ref = c.attendedAt || c.openedAt;
        const key = formatDateKeyLima(ref);
        if (!key || key < startKey || key > endKey) return false;
        if (candidateIdsInScope && !candidateIdsInScope.has(c.candidateId)) return false;
        return true;
    });

    const attendedCycles = scopedCycles.filter(c => c.status === 'attended');
    const openCycles = scopedCycles.filter(c => c.status === 'open').length;

    const schedulerCounts = new Map<string, number>();
    const schedulerReschedules = new Map<string, number>();
    const interviewerCounts = new Map<string, number>();
    const interviewerReschedules = new Map<string, number>();

    for (const log of scopedLogs) {
        const schedulerName = resolveUserName(log.performedBy, log.performedByName, users);
        schedulerCounts.set(schedulerName, (schedulerCounts.get(schedulerName) || 0) + 1);
        if (log.action === 'rescheduled') {
            schedulerReschedules.set(
                schedulerName,
                (schedulerReschedules.get(schedulerName) || 0) + 1
            );
        }

        const interviewerName = resolveUserName(log.interviewerId, undefined, users);
        interviewerCounts.set(interviewerName, (interviewerCounts.get(interviewerName) || 0) + 1);
        if (log.action === 'rescheduled') {
            interviewerReschedules.set(
                interviewerName,
                (interviewerReschedules.get(interviewerName) || 0) + 1
            );
        }
    }

    const buildRankings = (
        counts: Map<string, number>,
        reschedules: Map<string, number>
    ) => {
        const names = new Set([...counts.keys(), ...reschedules.keys()]);
        return Array.from(names)
            .map(name => ({
                name,
                agendas: counts.get(name) || 0,
                reagendas: reschedules.get(name) || 0,
            }))
            .filter(r => r.agendas > 0)
            .sort((a, b) => b.agendas - a.agendas);
    };

    const schedulerRankings = buildRankings(schedulerCounts, schedulerReschedules);
    const interviewerRankings = buildRankings(interviewerCounts, interviewerReschedules);

    const totalReschedules = scopedLogs.filter(l => l.action === 'rescheduled').length;
    const totalSchedulingActions = scopedLogs.length;

    const actionSums = attendedCycles
        .map(c => c.actionCount)
        .filter(n => n > 0);
    const avgActionsUntilAttendance =
        actionSums.length > 0
            ? Math.round((actionSums.reduce((s, n) => s + n, 0) / actionSums.length) * 10) / 10
            : null;

    const dailyTrend = computeDailyTrend(logs, cycles, hiredCtx, period, candidateIdsInScope);
    const funnel = computeSchedulingFunnel(logs, cycles, hiredCtx, candidateIdsInScope);

    return {
        periodLabel,
        totalSchedulingActions,
        totalReschedules,
        totalAttended: attendedCycles.length,
        openCycles,
        avgActionsUntilAttendance,
        topScheduler: schedulerRankings[0]
            ? { userName: schedulerRankings[0].name, count: schedulerRankings[0].agendas }
            : null,
        topInterviewer: interviewerRankings[0]
            ? { userName: interviewerRankings[0].name, count: interviewerRankings[0].agendas }
            : null,
        schedulerRankings,
        interviewerRankings,
        dailyTrend,
        funnel,
    };
}
