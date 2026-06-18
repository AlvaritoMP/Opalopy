import type { BulkCandidate } from './api/bulkCandidates';
import type { InterviewEvent } from '../types';

export interface CandidateInterviewSlot {
    start: string;
    interviewerId: string;
    eventId: string;
    isPast: boolean;
}

export function interviewEventToCandidateFields(
    event: Pick<InterviewEvent, 'id' | 'start' | 'interviewerId'>
): Pick<BulkCandidate, 'nextInterviewAt' | 'nextInterviewerId' | 'nextInterviewEventId'> {
    const start =
        event.start instanceof Date ? event.start : new Date(event.start);
    return {
        nextInterviewAt: start.toISOString(),
        nextInterviewerId: event.interviewerId,
        nextInterviewEventId: event.id,
    };
}

/** Próxima futura; si no hay, la más reciente (aunque ya haya pasado). */
export function pickInterviewForCandidateDisplay(
    slots: Array<{ start: string; interviewerId: string; eventId: string }>,
    now = Date.now()
): CandidateInterviewSlot | null {
    if (!slots.length) return null;

    const parsed = slots
        .map(s => ({ ...s, ms: new Date(s.start).getTime() }))
        .filter(s => !Number.isNaN(s.ms))
        .sort((a, b) => a.ms - b.ms);

    if (!parsed.length) return null;

    const future = parsed.filter(s => s.ms >= now);
    const pick = future.length ? future[0] : parsed[parsed.length - 1];

    return {
        start: pick.start,
        interviewerId: pick.interviewerId,
        eventId: pick.eventId,
        isPast: pick.ms < now,
    };
}

export function buildInterviewMapFromRows(
    rows: Array<{ id: string; candidate_id: string; start_time: string; interviewer_id: string }>
): Map<string, CandidateInterviewSlot> {
    const byCandidate = new Map<string, Array<{ start: string; interviewerId: string; eventId: string }>>();

    for (const row of rows) {
        const list = byCandidate.get(row.candidate_id) || [];
        list.push({
            start: row.start_time,
            interviewerId: row.interviewer_id,
            eventId: row.id,
        });
        byCandidate.set(row.candidate_id, list);
    }

    const result = new Map<string, CandidateInterviewSlot>();
    for (const [candidateId, slots] of byCandidate) {
        const pick = pickInterviewForCandidateDisplay(slots);
        if (pick) result.set(candidateId, pick);
    }
    return result;
}

function slotToCandidateFields(
    slot: CandidateInterviewSlot
): Pick<BulkCandidate, 'nextInterviewAt' | 'nextInterviewerId' | 'nextInterviewEventId'> {
    return {
        nextInterviewAt: slot.start,
        nextInterviewerId: slot.interviewerId,
        nextInterviewEventId: slot.eventId,
    };
}

/** Completa entrevistas desde interview_events cuando la query paginada no las trae. */
export function enrichCandidatesWithNextInterviews(
    candidates: BulkCandidate[],
    events: InterviewEvent[]
): BulkCandidate[] {
    if (events.length === 0) return candidates;

    const byCandidate = new Map<string, Array<{ start: string; interviewerId: string; eventId: string }>>();
    for (const ev of events) {
        const list = byCandidate.get(ev.candidateId) || [];
        list.push({
            start: ev.start instanceof Date ? ev.start.toISOString() : new Date(ev.start).toISOString(),
            interviewerId: ev.interviewerId,
            eventId: ev.id,
        });
        byCandidate.set(ev.candidateId, list);
    }

    return candidates.map(c => {
        const slots = byCandidate.get(c.id);
        if (!slots?.length) return c;

        const fromEvents = pickInterviewForCandidateDisplay(slots);
        if (!fromEvents) return c;

        if (!c.nextInterviewAt) {
            return { ...c, ...slotToCandidateFields(fromEvents) };
        }

        const dbPick = pickInterviewForCandidateDisplay([
            {
                start: c.nextInterviewAt,
                interviewerId: c.nextInterviewerId || '',
                eventId: c.nextInterviewEventId || '',
            },
        ]);

        if (!dbPick || dbPick.isPast) {
            return { ...c, ...slotToCandidateFields(fromEvents) };
        }

        const evMs = new Date(fromEvents.start).getTime();
        const dbMs = new Date(dbPick.start).getTime();
        if (evMs < dbMs) {
            return { ...c, ...slotToCandidateFields(fromEvents) };
        }

        return c;
    });
}

export function isInterviewInPast(iso?: string | null): boolean {
    if (!iso) return false;
    const ms = new Date(iso).getTime();
    return !Number.isNaN(ms) && ms < Date.now();
}
