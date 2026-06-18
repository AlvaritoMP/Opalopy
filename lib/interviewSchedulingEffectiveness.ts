import type { InterviewSchedulingLogRow, InterviewSchedulingCycleRow } from './api/interviewScheduling';
import { formatDateKeyLima, getContactPeriodRange, type ContactConsultantPeriod } from './contactDashboardStats';

export type SchedulingOutcomeKind = 'effective' | 'not_effective' | 'no_data';

export interface SchedulingEffectivenessTotals {
    effective: number;
    notEffective: number;
    noData: number;
    total: number;
    effectivePct: number | null;
    notEffectivePct: number | null;
    noDataPct: number | null;
}

export interface SchedulingEffectivenessByUserRow {
    name: string;
    effective: number;
    notEffective: number;
    noData: number;
    total: number;
    effectivePct: number | null;
}

export interface SchedulingEffectivenessStats {
    periodLabel: string;
    totals: SchedulingEffectivenessTotals;
    byScheduler: SchedulingEffectivenessByUserRow[];
    pieData: { name: string; value: number; kind: SchedulingOutcomeKind }[];
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

function classifySchedulingOutcome(
    candidateId: string,
    cycles: InterviewSchedulingCycleRow[]
): SchedulingOutcomeKind {
    const mine = cycles.filter(c => c.candidateId === candidateId);
    if (mine.length === 0) return 'no_data';
    if (mine.some(c => c.status === 'attended')) return 'effective';
    if (mine.some(c => c.status === 'open')) return 'no_data';
    if (mine.some(c => c.status === 'cancelled')) return 'not_effective';
    return 'no_data';
}

function pct(part: number, total: number): number | null {
    if (total === 0) return null;
    return Math.round((part / total) * 1000) / 10;
}

function buildTotals(counts: Record<SchedulingOutcomeKind, number>): SchedulingEffectivenessTotals {
    const effective = counts.effective;
    const notEffective = counts.not_effective;
    const noData = counts.no_data;
    const total = effective + notEffective + noData;
    return {
        effective,
        notEffective,
        noData,
        total,
        effectivePct: pct(effective, total),
        notEffectivePct: pct(notEffective, total),
        noDataPct: pct(noData, total),
    };
}

/**
 * Efectividad de agendas por candidato único agendado en el periodo.
 * Efectiva = asistió · No efectiva = cancelada/sin asistencia · Sin dato = ciclo abierto o sin resultado.
 */
export function computeSchedulingEffectiveness(
    logs: InterviewSchedulingLogRow[],
    cycles: InterviewSchedulingCycleRow[],
    period: ContactConsultantPeriod,
    users: Array<{ id: string; name?: string; email?: string }> = [],
    candidateIdsInScope?: Set<string>
): SchedulingEffectivenessStats {
    const { startKey, endKey, label: periodLabel } = getContactPeriodRange(period);

    const schedulingLogs = logs.filter(l => {
        if (l.action !== 'scheduled' && l.action !== 'rescheduled') return false;
        if (candidateIdsInScope && !candidateIdsInScope.has(l.candidateId)) return false;
        const key = formatDateKeyLima(l.createdAt);
        return Boolean(key && key >= startKey && key <= endKey);
    });

    const scopedCycles = cycles.filter(c => {
        if (candidateIdsInScope && !candidateIdsInScope.has(c.candidateId)) return false;
        return true;
    });

    const candidateIds = [...new Set(schedulingLogs.map(l => l.candidateId))];

    const firstSchedulerByCandidate = new Map<string, string>();
    const sortedLogs = [...schedulingLogs].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    for (const log of sortedLogs) {
        if (!firstSchedulerByCandidate.has(log.candidateId)) {
            firstSchedulerByCandidate.set(
                log.candidateId,
                resolveUserName(log.performedBy, log.performedByName, users)
            );
        }
    }

    const overallCounts: Record<SchedulingOutcomeKind, number> = {
        effective: 0,
        not_effective: 0,
        no_data: 0,
    };

    const byUserCounts = new Map<string, Record<SchedulingOutcomeKind, number>>();

    for (const candidateId of candidateIds) {
        const outcome = classifySchedulingOutcome(candidateId, scopedCycles);
        overallCounts[outcome] += 1;

        const scheduler = firstSchedulerByCandidate.get(candidateId) || 'Sin asignar';
        const bucket = byUserCounts.get(scheduler) || {
            effective: 0,
            not_effective: 0,
            no_data: 0,
        };
        bucket[outcome] += 1;
        byUserCounts.set(scheduler, bucket);
    }

    const totals = buildTotals(overallCounts);

    const byScheduler = [...byUserCounts.entries()]
        .map(([name, counts]) => {
            const total = counts.effective + counts.not_effective + counts.no_data;
            return {
                name,
                effective: counts.effective,
                notEffective: counts.not_effective,
                noData: counts.no_data,
                total,
                effectivePct: pct(counts.effective, total),
            };
        })
        .filter(r => r.total > 0)
        .sort((a, b) => b.total - a.total || (b.effectivePct ?? 0) - (a.effectivePct ?? 0));

    const pieData = [
        { name: 'Asistió (efectiva)', value: totals.effective, kind: 'effective' as const },
        { name: 'Sin asistencia', value: totals.notEffective, kind: 'not_effective' as const },
        { name: 'Sin resultado aún', value: totals.noData, kind: 'no_data' as const },
    ].filter(d => d.value > 0);

    return { periodLabel, totals, byScheduler, pieData };
}

export const SCHEDULING_OUTCOME_COLORS: Record<SchedulingOutcomeKind, string> = {
    effective: '#10b981',
    not_effective: '#ef4444',
    no_data: '#94a3b8',
};

export const SCHEDULING_OUTCOME_LABELS: Record<SchedulingOutcomeKind, string> = {
    effective: 'Asistió (efectiva)',
    not_effective: 'Sin asistencia',
    no_data: 'Sin resultado aún',
};
