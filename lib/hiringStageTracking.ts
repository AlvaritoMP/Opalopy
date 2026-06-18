import type { CandidateHistory, Process, User } from '../types';

export const HIRED_STAGE_USER_COLUMN_ID = 'hiredStageUser';

export interface HiredStageActor {
    userName: string;
    movedAt: string;
}

export interface HiringStageConsultantStats {
    totalHires: number;
    topConsultant: {
        userName: string;
        hires: number;
        sharePct: number;
    } | null;
    rankings: { name: string; ingresos: number; share: number }[];
}

type HistoryUserLookup = Pick<User, 'id' | 'name'> & Partial<Pick<User, 'email'>>;

const HIRED_STAGE_NAME_PATTERN = /contratad|hire|ingres|oferta.?acept/i;

export function getProcessLastStageId(process?: Pick<Process, 'stages'> | null): string | null {
    const stages = process?.stages;
    if (!stages?.length) return null;
    return stages[stages.length - 1].id;
}

/** Etapa que cuenta como contratación: por nombre (Contratado, etc.) o la última del pipeline. */
export function resolveHiringStageId(process?: Pick<Process, 'stages'> | null): string | null {
    const stages = process?.stages;
    if (!stages?.length) return null;
    const byName = stages.find(s => HIRED_STAGE_NAME_PATTERN.test(s.name.trim()));
    return byName?.id ?? stages[stages.length - 1].id;
}

export function resolveHistoryUserName(
    movedBy: string | null | undefined,
    users: HistoryUserLookup[] = []
): string {
    if (!movedBy || movedBy === 'System') return 'Sistema';
    const byId = users.find(u => u.id === movedBy);
    if (byId?.name?.trim()) return byId.name.trim();
    if (byId?.email?.trim()) {
        const local = byId.email.trim().split('@')[0];
        if (local) return local;
    }
    const isLikelyId = movedBy.length > 20 || movedBy.includes('-');
    if (isLikelyId) {
        const byName = users.find(u => u.name === movedBy);
        if (byName?.name?.trim()) return byName.name.trim();
        return 'Usuario';
    }
    return movedBy;
}

/** Último movimiento registrado hacia la etapa final del proceso. */
export function findMostRecentMoveToStage(
    history: CandidateHistory[] | undefined,
    stageId: string
): CandidateHistory | null {
    if (!history?.length || !stageId) return null;
    let best: CandidateHistory | null = null;
    let bestTs = -1;
    for (const entry of history) {
        if (entry.stageId !== stageId) continue;
        const ts = new Date(entry.movedAt).getTime();
        if (Number.isNaN(ts) || ts <= bestTs) continue;
        bestTs = ts;
        best = entry;
    }
    return best;
}

export function getHiredStageActorFromHistory(
    history: CandidateHistory[] | undefined,
    process: Pick<Process, 'stages'> | undefined,
    users: HistoryUserLookup[] = []
): HiredStageActor | null {
    const hiringStageId = resolveHiringStageId(process);
    if (!hiringStageId) return null;
    const move = findMostRecentMoveToStage(history, hiringStageId);
    if (!move) return null;
    return {
        userName: resolveHistoryUserName(move.movedBy, users),
        movedAt: move.movedAt,
    };
}

export function formatHiredStageActorDisplay(actor: HiredStageActor | null | undefined): string {
    if (!actor?.userName) return '-';
    return actor.userName;
}

export function formatHiredStageActorTooltip(actor: HiredStageActor | null | undefined): string | undefined {
    if (!actor?.movedAt) return undefined;
    const when = new Date(actor.movedAt);
    if (Number.isNaN(when.getTime())) return actor.userName;
    return `${actor.userName} · ${when.toLocaleString('es-PE')}`;
}

export function mapRawHiringMoves(
    rows: Array<{ candidate_id: string; moved_at: string; moved_by: string | null }>,
    users: HistoryUserLookup[] = []
): Record<string, HiredStageActor> {
    const out: Record<string, HiredStageActor> = {};
    for (const row of rows) {
        if (out[row.candidate_id]) continue;
        out[row.candidate_id] = {
            userName: resolveHistoryUserName(row.moved_by, users),
            movedAt: row.moved_at,
        };
    }
    return out;
}

export function computeHiringStageConsultantStats(
    candidates: Array<{
        id: string;
        processId: string;
        stageId?: string;
        discarded?: boolean;
        history?: CandidateHistory[];
    }>,
    processMap: Map<string, Process>,
    users: HistoryUserLookup[] = [],
    bulkHiringActorsByProcess: Record<string, Record<string, HiredStageActor>> = {}
): HiringStageConsultantStats {
    const counts = new Map<string, number>();

    for (const candidate of candidates) {
        const process = processMap.get(candidate.processId);
        const hiringStageId = resolveHiringStageId(process);
        if (!hiringStageId) continue;

        let actor = getHiredStageActorFromHistory(candidate.history, process, users);
        if (!actor) {
            actor = bulkHiringActorsByProcess[candidate.processId]?.[candidate.id] ?? null;
        }
        if (!actor && candidate.stageId === hiringStageId && !candidate.discarded) {
            actor = { userName: 'Sin consultor', movedAt: '' };
        }
        if (!actor) continue;
        counts.set(actor.userName, (counts.get(actor.userName) || 0) + 1);
    }

    const totalHires = [...counts.values()].reduce((sum, n) => sum + n, 0);
    const rankings = [...counts.entries()]
        .map(([name, ingresos]) => ({
            name,
            ingresos,
            share: totalHires > 0 ? Math.round((ingresos / totalHires) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.ingresos - a.ingresos);

    const top = rankings[0];
    return {
        totalHires,
        topConsultant: top
            ? {
                  userName: top.name,
                  hires: top.ingresos,
                  sharePct: top.share,
              }
            : null,
        rankings: rankings.slice(0, 8),
    };
}

/** Inserta la columna derivada después de Etapa si falta en el orden guardado. */
export function ensureHiredStageUserColumnInOrder(order: string[]): string[] {
    if (order.includes(HIRED_STAGE_USER_COLUMN_ID)) return order;
    const out = [...order];
    const stageIdx = out.indexOf('stage');
    if (stageIdx >= 0) {
        out.splice(stageIdx + 1, 0, HIRED_STAGE_USER_COLUMN_ID);
    } else {
        out.push(HIRED_STAGE_USER_COLUMN_ID);
    }
    return out;
}
