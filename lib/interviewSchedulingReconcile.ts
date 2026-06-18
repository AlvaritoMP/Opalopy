import type { Process } from '../types';
import type {
    InterviewSchedulingCycleRow,
    InterviewSchedulingLogRow,
} from './api/interviewScheduling';
import type { InterviewSchedulingPeriod } from './interviewSchedulingStats';
import { formatDateKeyLima, getContactPeriodRange } from './contactDashboardStats';
import {
    buildLegacyForProcess,
    parseYesNoAttendance,
    resolveCandidateDashboardSemanticField,
    resolveCandidateInterviewAttendance,
    resolveCandidateInterviewDateIso,
} from './dashboardSemanticFields';

export interface BulkSchedulingCandidateRow {
    id: string;
    processId: string;
    bulkColumnValues?: Record<string, unknown>;
    nextInterviewAt?: string;
    nextInterviewerId?: string;
}

function candidateHasSchedulingLog(
    logs: InterviewSchedulingLogRow[],
    candidateId: string,
    actions: Array<'scheduled' | 'rescheduled'> = ['scheduled', 'rescheduled']
): boolean {
    return logs.some(l => l.candidateId === candidateId && actions.includes(l.action as 'scheduled' | 'rescheduled'));
}

function candidateHasAttendedCycle(cycles: InterviewSchedulingCycleRow[], candidateId: string): boolean {
    return cycles.some(c => c.candidateId === candidateId && c.status === 'attended');
}

function resolveInterviewAnchorDate(
    candidate: BulkSchedulingCandidateRow,
    process: Process | undefined
): string | undefined {
    const customColumns = process?.bulkConfig?.customColumns ?? [];
    const legacy = buildLegacyForProcess(process?.bulkConfig, customColumns);
    const columnValues = candidate.bulkColumnValues
        ? { [candidate.id]: candidate.bulkColumnValues }
        : {};

    const fromColumn = resolveCandidateInterviewDateIso(
        candidate,
        customColumns,
        columnValues,
        legacy
    );
    if (fromColumn) return fromColumn;
    if (candidate.nextInterviewAt) {
        const d = new Date(candidate.nextInterviewAt);
        if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    return undefined;
}

function isDateInPeriod(iso: string, startKey: string, endKey: string): boolean {
    const key = formatDateKeyLima(iso);
    return Boolean(key && key >= startKey && key <= endKey);
}

/**
 * Completa ciclos y logs de agendamiento con columnas personalizadas clasificadas
 * (asistencia «Sí», fecha de cita) y con la columna Próxima entrevista del proceso masivo.
 */
export function reconcileInterviewSchedulingFromBulkCandidates(
    logs: InterviewSchedulingLogRow[],
    cycles: InterviewSchedulingCycleRow[],
    candidates: BulkSchedulingCandidateRow[],
    processMap: Map<string, Process>,
    period: InterviewSchedulingPeriod
): { logs: InterviewSchedulingLogRow[]; cycles: InterviewSchedulingCycleRow[] } {
    const { startKey, endKey } = getContactPeriodRange(period);
    const outLogs = [...logs];
    const outCycles = [...cycles];
    const seenScheduled = new Set(
        logs
            .filter(l => l.action === 'scheduled' || l.action === 'rescheduled')
            .map(l => l.candidateId)
    );
    const seenAttended = new Set(cycles.filter(c => c.status === 'attended').map(c => c.candidateId));

    for (const candidate of candidates) {
        const process = processMap.get(candidate.processId);
        const customColumns = process?.bulkConfig?.customColumns ?? [];
        const legacy = buildLegacyForProcess(process?.bulkConfig, customColumns);
        const columnValues = candidate.bulkColumnValues
            ? { [candidate.id]: candidate.bulkColumnValues }
            : {};

        const attendance = resolveCandidateInterviewAttendance(
            candidate,
            customColumns,
            columnValues,
            legacy
        );

        const anchorDate = resolveInterviewAnchorDate(candidate, process);
        const anchorInPeriod = anchorDate ? isDateInPeriod(anchorDate, startKey, endKey) : false;

        const hasInterviewSignal =
            Boolean(candidate.nextInterviewAt) ||
            Boolean(anchorDate) ||
            attendance === true;

        if (!hasInterviewSignal) continue;

        if (
            !seenScheduled.has(candidate.id) &&
            !candidateHasSchedulingLog(outLogs, candidate.id) &&
            (anchorInPeriod || (candidate.nextInterviewAt && isDateInPeriod(candidate.nextInterviewAt, startKey, endKey)))
        ) {
            const when = anchorDate || candidate.nextInterviewAt!;
            const cycleId = `reconcile-cycle-${candidate.id}`;
            outLogs.push({
                id: `reconcile-log-${candidate.id}-scheduled`,
                cycleId,
                candidateId: candidate.id,
                processId: candidate.processId,
                action: 'scheduled',
                interviewerId: candidate.nextInterviewerId,
                startTime: when,
                createdAt: when,
            });
            if (!outCycles.some(c => c.id === cycleId)) {
                outCycles.push({
                    id: cycleId,
                    candidateId: candidate.id,
                    processId: candidate.processId,
                    status: attendance === true ? 'attended' : 'open',
                    primaryInterviewerId: candidate.nextInterviewerId,
                    actionCount: 1,
                    rescheduleCount: 0,
                    openedAt: when,
                    attendedAt: attendance === true ? when : undefined,
                    closedAt: attendance === true ? when : undefined,
                });
            }
            seenScheduled.add(candidate.id);
            if (attendance === true) seenAttended.add(candidate.id);
        }

        if (
            attendance === true &&
            !seenAttended.has(candidate.id) &&
            !candidateHasAttendedCycle(outCycles, candidate.id)
        ) {
            const when =
                anchorDate ||
                candidate.nextInterviewAt ||
                `${endKey}T12:00:00-05:00`;

            const hasExplicitDate = Boolean(anchorDate || candidate.nextInterviewAt);
            if (hasExplicitDate && !isDateInPeriod(when, startKey, endKey)) continue;

            outCycles.push({
                id: `reconcile-attended-${candidate.id}`,
                candidateId: candidate.id,
                processId: candidate.processId,
                status: 'attended',
                primaryInterviewerId: candidate.nextInterviewerId,
                actionCount: 1,
                rescheduleCount: 0,
                openedAt: when,
                attendedAt: when,
                closedAt: when,
            });
            seenAttended.add(candidate.id);

            if (!outLogs.some(l => l.candidateId === candidate.id && l.action === 'attended')) {
                outLogs.push({
                    id: `reconcile-log-${candidate.id}-attended`,
                    cycleId: `reconcile-attended-${candidate.id}`,
                    candidateId: candidate.id,
                    processId: candidate.processId,
                    action: 'attended',
                    interviewerId: candidate.nextInterviewerId,
                    startTime: when,
                    createdAt: when,
                });
            }
        }
    }

    return { logs: outLogs, cycles: outCycles };
}

/** Exportado para pruebas / uso en importaciones */
export { parseYesNoAttendance, resolveCandidateDashboardSemanticField };
