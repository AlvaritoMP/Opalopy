import type { Candidate, Process, User } from '../types';
import { bulkCandidatesApi } from './api/bulkCandidates';
import { contactTrackingApi } from './api/contactTracking';
import { interviewSchedulingApi } from './api/interviewScheduling';
import {
    enrichBulkCandidateForDashboard,
    bulkDashboardFieldExtrasFromCandidate,
} from './dashboardCandidatePool';
import type { ContactSummaryCandidate } from './contactAttemptReconcile';
import {
    backfillContactAttemptProcessIds,
    mergeContactAttemptsDedupe,
} from './contactAttemptReconcile';
import {
    mapRawHiringMoves,
    resolveHiringStageId,
    type HiredStageActor,
} from './hiringStageTracking';
import type { BulkSchedulingCandidateRow } from './interviewSchedulingReconcile';
import type { ContactAttempt } from './contactTracking';
import { buildUserLookupForStats, type DashboardActorUser } from './dashboardActorNames';

export type BulkCandidateFieldExtras = {
    bulkColumnValues?: Record<string, unknown>;
    age?: number;
    source?: string;
    province?: string;
    district?: string;
};

export interface DashboardDataCache {
    loadedAt: string;
    bulkPoolCandidates: Candidate[];
    bulkCandidateFields: Record<string, BulkCandidateFieldExtras>;
    bulkContactSummaries: Record<string, ContactSummaryCandidate>;
    bulkSchedulingRows: BulkSchedulingCandidateRow[];
    bulkHiringActorsByProcess: Record<string, Record<string, HiredStageActor>>;
    contactAttempts: ContactAttempt[];
    schedulingLogs: Awaited<ReturnType<typeof interviewSchedulingApi.getLogsForProcesses>>;
    schedulingCycles: Awaited<ReturnType<typeof interviewSchedulingApi.getCyclesForProcesses>>;
}

export async function fetchDashboardData(
    processes: Process[],
    users: User[],
    currentUser: User | null
): Promise<DashboardDataCache> {
    const processMap = new Map(processes.map(p => [p.id, p]));
    const bulkProcessIds = processes.filter(p => p.isBulkProcess).map(p => p.id);
    const allProcessIds = processes.map(p => p.id);
    const statsUsers = buildUserLookupForStats(users, currentUser ?? undefined);

    const pool: Candidate[] = [];
    const fields: Record<string, BulkCandidateFieldExtras> = {};
    const summaries: Record<string, ContactSummaryCandidate> = {};
    const schedulingRows: BulkSchedulingCandidateRow[] = [];

    await Promise.all(
        bulkProcessIds.map(async processId => {
            try {
                const process = processMap.get(processId);
                const all = await bulkCandidatesApi.getAllCandidates(processId);
                const candidateIds = all.map(c => c.id);
                const [columnValuesMap, historyByCandidate] = await Promise.all([
                    bulkCandidatesApi.loadAllBulkColumnValues(processId),
                    bulkCandidatesApi.loadCandidateHistoryByIds(candidateIds),
                ]);
                for (const c of all) {
                    const columnRow = columnValuesMap[c.id] || {};
                    const withHistory = {
                        ...c,
                        history: historyByCandidate[c.id] ?? [],
                    };
                    const mapped = enrichBulkCandidateForDashboard(withHistory, process, columnRow);
                    pool.push(mapped);
                    fields[c.id] = bulkDashboardFieldExtrasFromCandidate(mapped);
                    summaries[c.id] = {
                        id: c.id,
                        processId: c.processId,
                        contactPhone: c.contactPhone,
                        contactWhatsapp: c.contactWhatsapp,
                        contactEmail: c.contactEmail,
                    };
                    schedulingRows.push({
                        id: c.id,
                        processId: c.processId,
                        bulkColumnValues: {
                            ...(c.bulkColumnValues || {}),
                            ...columnRow,
                        },
                        nextInterviewAt: c.nextInterviewAt,
                        nextInterviewerId: c.nextInterviewerId,
                    });
                }
            } catch {
                /* continuar con otros procesos */
            }
        })
    );

    const byProcess: Record<string, Record<string, HiredStageActor>> = {};
    await Promise.all(
        bulkProcessIds.map(async processId => {
            const process = processMap.get(processId);
            const hiringStageId = resolveHiringStageId(process);
            if (!hiringStageId) {
                byProcess[processId] = {};
                return;
            }
            try {
                const rows = await bulkCandidatesApi.getHiringStageActorsForProcess(
                    processId,
                    hiringStageId
                );
                byProcess[processId] = mapRawHiringMoves(rows, statsUsers);
            } catch {
                byProcess[processId] = {};
            }
        })
    );

    let contactAttempts: ContactAttempt[] = [];
    let schedulingLogs: DashboardDataCache['schedulingLogs'] = [];
    let schedulingCycles: DashboardDataCache['schedulingCycles'] = [];

    if (allProcessIds.length > 0) {
        const summaryList = Object.values(summaries);
        if (summaryList.length > 0) {
            try {
                await contactTrackingApi.syncSummariesToHistory(summaryList, bulkProcessIds);
            } catch {
                /* opcional */
            }
        }

        const bulkCandidateIds = pool.map(c => c.id);
        const candidateProcessIdMap = new Map<string, string>();
        for (const c of pool) candidateProcessIdMap.set(c.id, c.processId);

        try {
            const [byProcessAttempts, byCandidates, logs, cycles] = await Promise.all([
                contactTrackingApi.getAttemptsForProcesses(allProcessIds),
                bulkCandidateIds.length > 0
                    ? contactTrackingApi.getAttemptsForCandidateIds(bulkCandidateIds)
                    : Promise.resolve([]),
                interviewSchedulingApi.getLogsForProcesses(allProcessIds),
                interviewSchedulingApi.getCyclesForProcesses(allProcessIds),
            ]);
            contactAttempts = backfillContactAttemptProcessIds(
                mergeContactAttemptsDedupe([...byProcessAttempts, ...byCandidates]),
                candidateProcessIdMap
            );
            schedulingLogs = logs;
            schedulingCycles = cycles;
        } catch {
            contactAttempts = [];
            schedulingLogs = [];
            schedulingCycles = [];
        }
    }

    return {
        loadedAt: new Date().toISOString(),
        bulkPoolCandidates: pool,
        bulkCandidateFields: fields,
        bulkContactSummaries: summaries,
        bulkSchedulingRows: schedulingRows,
        bulkHiringActorsByProcess: byProcess,
        contactAttempts,
        schedulingLogs,
        schedulingCycles,
    };
}
