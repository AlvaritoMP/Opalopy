import { Candidate, Process } from '../types';

export function getLastStageId(process?: Process): string | undefined {
    if (!process?.stages?.length) return undefined;
    return process.stages[process.stages.length - 1].id;
}

function getLatestStageHistoryDate(candidate: Candidate, stageId: string): string | undefined {
    if (!candidate.history?.length) return undefined;
    const entries = candidate.history
        .filter(h => h.stageId === stageId)
        .sort((a, b) => new Date(b.movedAt).getTime() - new Date(a.movedAt).getTime());
    return entries[0]?.movedAt;
}

/** Fecha de publicación del proceso (Time to Hire). */
export function resolveProcessPublishedDate(process?: Process): string | undefined {
    const date = process?.publishedDate || process?.startDate;
    return date?.trim() ? date : undefined;
}

/** Fecha de contratación / aceptación de oferta del candidato. */
export function resolveHireAcceptedDate(candidate: Candidate, process?: Process): string | undefined {
    if (candidate.offerAcceptedDate?.trim()) return candidate.offerAcceptedDate;
    if (candidate.hireDate?.trim()) return candidate.hireDate;

    const lastStageId = getLastStageId(process);
    if (lastStageId && candidate.stageId === lastStageId) {
        return getLatestStageHistoryDate(candidate, lastStageId);
    }
    return undefined;
}

/** Fecha de inicio de postulación (Tasa de finalización). */
export function resolveApplicationStartedDate(candidate: Candidate): string | undefined {
    if (candidate.applicationStartedDate?.trim()) return candidate.applicationStartedDate;
    if (!candidate.history?.length) return undefined;
    const sorted = [...candidate.history].sort(
        (a, b) => new Date(a.movedAt).getTime() - new Date(b.movedAt).getTime()
    );
    return sorted[0]?.movedAt;
}

/** Fecha de postulación completada (Tasa de finalización). */
export function resolveApplicationCompletedDate(candidate: Candidate, process?: Process): string | undefined {
    if (candidate.applicationCompletedDate?.trim()) return candidate.applicationCompletedDate;

    const lastStageId = getLastStageId(process);
    if (lastStageId && candidate.stageId === lastStageId) {
        return getLatestStageHistoryDate(candidate, lastStageId);
    }
    return undefined;
}

export function isHiredCandidateForMetrics(candidate: Candidate, process?: Process): boolean {
    const lastStageId = getLastStageId(process);
    if (!lastStageId || candidate.stageId !== lastStageId || candidate.discarded) return false;
    return Boolean(resolveHireAcceptedDate(candidate, process));
}
