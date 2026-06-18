import type { ContactAttempt } from './contactTracking';
import { CONTACT_OUTCOME_LABELS } from './contactTracking';
import type { ContactAttemptChannel, ChannelContactSummary } from './contactChannelConfig';
import { CONTACT_CHANNELS } from './contactChannelConfig';
import {
    addDaysToDateKey,
    filterAttemptsInDateRange,
    formatDateKeyLima,
    getContactPeriodRange,
    isChannelVolumeAttempt,
    isContactUndoAttempt,
    isCountableContactAction,
    isEffectiveContactAttempt,
    startOfWeekMondayLimaKey,
    type ContactConsultantPeriod,
} from './contactDashboardStats';

export interface ContactologyCandidateInput {
    id: string;
    processId: string;
    /** Fecha de alta del registro en sistema (cohorte semanal). */
    recordCreatedAt?: string;
}

export interface ContactSummaryForRatios {
    id: string;
    contactPhone?: ChannelContactSummary;
    contactWhatsapp?: ChannelContactSummary;
    contactEmail?: ChannelContactSummary;
}

/** El candidato respondió (contestó, interesado o no interesado). */
export function isCandidateResponseAttempt(
    attempt: Pick<ContactAttempt, 'outcome' | 'statusAfter' | 'notes'>
): boolean {
    if (attempt.outcome === 'answered' || attempt.outcome === 'interested' || attempt.outcome === 'not_interested') {
        return true;
    }
    if (attempt.outcome === 'status_change') {
        return attempt.statusAfter === 'interesado' || attempt.statusAfter === 'no_interesado';
    }
    return false;
}

export function isInterestedCandidateResponse(
    attempt: Pick<ContactAttempt, 'outcome' | 'statusAfter'>
): boolean {
    if (attempt.outcome === 'interested') return true;
    return attempt.outcome === 'status_change' && attempt.statusAfter === 'interesado';
}

export function isNotInterestedCandidateResponse(
    attempt: Pick<ContactAttempt, 'outcome' | 'statusAfter'>
): boolean {
    if (attempt.outcome === 'not_interested') return true;
    return attempt.outcome === 'status_change' && attempt.statusAfter === 'no_interesado';
}

function isAnyVolumeAttempt(attempt: ContactAttempt): boolean {
    const channels = Object.keys(CONTACT_CHANNELS) as ContactAttemptChannel[];
    return channels.some(ch => isChannelVolumeAttempt(attempt, ch));
}

function normalizeUserName(name?: string): string {
    const trimmed = name?.trim();
    return trimmed || 'Sin consultor';
}

function outcomeLabelForResponse(attempt: ContactAttempt): string {
    if (attempt.outcome === 'status_change' && attempt.statusAfter === 'interesado') {
        return 'Interesado (estado)';
    }
    if (attempt.outcome === 'status_change' && attempt.statusAfter === 'no_interesado') {
        return 'No interesado (estado)';
    }
    return CONTACT_OUTCOME_LABELS[attempt.outcome] ?? attempt.outcome;
}

function sortAttemptsChronologically(attempts: ContactAttempt[]): ContactAttempt[] {
    return [...attempts].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

function msToHours(ms: number): number {
    return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
}

function msToReadableDuration(ms: number): string {
    if (ms < 0 || Number.isNaN(ms)) return 'N/D';
    const hours = ms / (1000 * 60 * 60);
    if (hours < 1) {
        const mins = Math.round(ms / (1000 * 60));
        return `${mins} min`;
    }
    if (hours < 48) return `${Math.round(hours * 10) / 10} h`;
    const days = Math.round((hours / 24) * 10) / 10;
    return `${days} d`;
}

function parseDateKey(key: string): { y: number; m: number; d: number } {
    const [y, m, d] = key.split('-').map(Number);
    return { y, m, d };
}

function formatWeekRangeLabel(weekStartKey: string): string {
    const endKey = addDaysToDateKey(weekStartKey, 6);
    const start = parseDateKey(weekStartKey);
    const end = parseDateKey(endKey);
    const startDate = new Date(`${weekStartKey}T12:00:00-05:00`);
    const endDate = new Date(`${endKey}T12:00:00-05:00`);
    const startDay = startDate.toLocaleDateString('es-PE', { day: 'numeric', timeZone: 'America/Lima' });
    const endDay = endDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' });
    if (start.m === end.m) return `${startDay}–${end.d} ${endDate.toLocaleDateString('es-PE', { month: 'short', timeZone: 'America/Lima' })}`;
    return `${startDay} ${startDate.toLocaleDateString('es-PE', { month: 'short', timeZone: 'America/Lima' })} – ${endDay}`;
}

function formatDayLabelFromKey(key: string): string {
    const date = new Date(`${key}T12:00:00-05:00`);
    return date.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'America/Lima' });
}

function iterDateKeys(fromKey: string, toKey: string): string[] {
    const keys: string[] = [];
    let cursor = fromKey;
    while (cursor && cursor <= toKey) {
        keys.push(cursor);
        cursor = addDaysToDateKey(cursor, 1);
    }
    return keys;
}

function summaryForChannel(
    candidate: ContactSummaryForRatios,
    channel: ContactAttemptChannel
): ChannelContactSummary | undefined {
    if (channel === 'call') return candidate.contactPhone;
    if (channel === 'whatsapp') return candidate.contactWhatsapp;
    return candidate.contactEmail;
}

function buildFirstContactIndex(
    attempts: ContactAttempt[],
    candidateIdFilter?: Set<string>
): Map<string, { at: string; userName?: string }> {
    const firstByCandidate = new Map<string, { at: string; userName?: string }>();
    for (const attempt of attempts) {
        if (candidateIdFilter && !candidateIdFilter.has(attempt.candidateId)) continue;
        if (!isAnyVolumeAttempt(attempt)) continue;
        const ts = new Date(attempt.createdAt).getTime();
        if (Number.isNaN(ts)) continue;
        const existing = firstByCandidate.get(attempt.candidateId);
        if (!existing || ts < new Date(existing.at).getTime()) {
            firstByCandidate.set(attempt.candidateId, {
                at: attempt.createdAt,
                userName: attempt.userName,
            });
        }
    }
    return firstByCandidate;
}

export interface WeeklyFirstContactPoint {
    weekKey: string;
    label: string;
    avgHours: number | null;
    avgLabel: string;
    registrationCount: number;
    contactedCount: number;
    isComplete: boolean;
    isCurrent: boolean;
}

export interface CurrentWeekFirstContactDaily {
    dayKey: string;
    label: string;
    avgHours: number | null;
    avgLabel: string;
    registrationsCumulative: number;
    contactedCumulative: number;
}

export interface WeeklyFirstContactStats {
    currentWeekKey: string;
    currentWeekLabel: string;
    currentWeekAvgHours: number | null;
    currentWeekAvgLabel: string;
    currentWeekRegistrationCount: number;
    currentWeekContactedCount: number;
    currentWeekDailyTrend: CurrentWeekFirstContactDaily[];
    weeklyTrend: WeeklyFirstContactPoint[];
    fastestFirstContactConsultant: { userName: string; avgHours: number; sampleCount: number } | null;
}

const WEEKLY_TREND_WEEKS = 12;

/** Fecha de alta del registro — base para cohortes semanales. */
export function resolveCandidateRecordCreatedAt(candidate: {
    createdAt?: string;
    firstApplicationAt?: string;
    applicationStartedDate?: string;
    history?: { movedAt?: string }[];
}): string | undefined {
    return (
        candidate.createdAt ||
        candidate.firstApplicationAt ||
        candidate.applicationStartedDate ||
        candidate.history?.[0]?.movedAt ||
        undefined
    );
}

/** @deprecated usar resolveCandidateRecordCreatedAt */
export function resolveCandidateRegisteredAt(candidate: {
    firstApplicationAt?: string;
    createdAt?: string;
    history?: { movedAt?: string }[];
    applicationStartedDate?: string;
}): string | undefined {
    return resolveCandidateRecordCreatedAt(candidate);
}

export function computeWeeklyFirstContactStats(
    allAttempts: ContactAttempt[],
    candidates: ContactologyCandidateInput[],
    candidateIdFilter?: Set<string>,
    refDate = new Date()
): WeeklyFirstContactStats {
    const todayKey = formatDateKeyLima(refDate);
    const currentWeekKey = startOfWeekMondayLimaKey(refDate);
    const currentWeekEndKey = addDaysToDateKey(currentWeekKey, 6);

    const firstContactByCandidate = buildFirstContactIndex(allAttempts, candidateIdFilter);

    type CohortRow = { recordKey: string; deltaMs?: number; consultant?: string };
    const cohortByWeek = new Map<string, CohortRow[]>();

    for (const candidate of candidates) {
        if (candidateIdFilter && !candidateIdFilter.has(candidate.id)) continue;
        const recordCreatedAt = candidate.recordCreatedAt;
        if (!recordCreatedAt) continue;

        const recordKey = formatDateKeyLima(recordCreatedAt);
        if (!recordKey) continue;

        const weekKey = startOfWeekMondayLimaKey(new Date(recordCreatedAt));
        const first = firstContactByCandidate.get(candidate.id);

        let deltaMs: number | undefined;
        if (first) {
            const regTs = new Date(recordCreatedAt).getTime();
            const contactTs = new Date(first.at).getTime();
            if (!Number.isNaN(regTs) && !Number.isNaN(contactTs) && contactTs >= regTs) {
                deltaMs = contactTs - regTs;
            }
        }

        const row: CohortRow = {
            recordKey,
            deltaMs,
            consultant: first ? normalizeUserName(first.userName) : undefined,
        };

        const weekBucket = cohortByWeek.get(weekKey) || [];
        weekBucket.push(row);
        cohortByWeek.set(weekKey, weekBucket);
    }

    const weeklyTrend: WeeklyFirstContactPoint[] = [];
    for (let i = WEEKLY_TREND_WEEKS - 1; i >= 0; i--) {
        const weekKey = addDaysToDateKey(currentWeekKey, -7 * i);

        const rows = cohortByWeek.get(weekKey) || [];
        const deltas = rows.map(r => r.deltaMs).filter((d): d is number => d != null);
        const avgMs = deltas.length > 0 ? deltas.reduce((s, n) => s + n, 0) / deltas.length : null;
        const weekEndKey = addDaysToDateKey(weekKey, 6);

        weeklyTrend.push({
            weekKey,
            label: formatWeekRangeLabel(weekKey),
            avgHours: avgMs != null ? msToHours(avgMs) : null,
            avgLabel: avgMs != null ? msToReadableDuration(avgMs) : 'N/D',
            registrationCount: rows.length,
            contactedCount: deltas.length,
            isComplete: weekEndKey < todayKey,
            isCurrent: weekKey === currentWeekKey,
        });
    }

    const currentWeekRows = cohortByWeek.get(currentWeekKey) || [];
    const currentWeekDeltas = currentWeekRows.map(r => r.deltaMs).filter((d): d is number => d != null);
    const currentWeekAvgMs =
        currentWeekDeltas.length > 0
            ? currentWeekDeltas.reduce((s, n) => s + n, 0) / currentWeekDeltas.length
            : null;

    const currentWeekDailyTrend: CurrentWeekFirstContactDaily[] = [];
    const trendEndKey = todayKey < currentWeekEndKey ? todayKey : currentWeekEndKey;

    for (const dayKey of iterDateKeys(currentWeekKey, trendEndKey)) {
        const cumulativeRows = currentWeekRows.filter(r => r.recordKey <= dayKey);
        const cumulativeDeltas = cumulativeRows
            .map(r => r.deltaMs)
            .filter((d): d is number => d != null);
        const avgMs =
            cumulativeDeltas.length > 0
                ? cumulativeDeltas.reduce((s, n) => s + n, 0) / cumulativeDeltas.length
                : null;

        currentWeekDailyTrend.push({
            dayKey,
            label: formatDayLabelFromKey(dayKey),
            avgHours: avgMs != null ? msToHours(avgMs) : null,
            avgLabel: avgMs != null ? msToReadableDuration(avgMs) : 'N/D',
            registrationsCumulative: cumulativeRows.length,
            contactedCumulative: cumulativeDeltas.length,
        });
    }

    const consultantDeltas = new Map<string, number[]>();
    for (const row of currentWeekRows) {
        if (row.deltaMs == null || !row.consultant || row.consultant === 'Sin consultor') continue;
        const bucket = consultantDeltas.get(row.consultant) || [];
        bucket.push(row.deltaMs);
        consultantDeltas.set(row.consultant, bucket);
    }

    let fastestFirstContactConsultant: WeeklyFirstContactStats['fastestFirstContactConsultant'] = null;
    let fastestAvgMs: number | null = null;
    for (const [userName, deltas] of consultantDeltas) {
        const avg = deltas.reduce((s, n) => s + n, 0) / deltas.length;
        if (fastestAvgMs === null || avg < fastestAvgMs) {
            fastestAvgMs = avg;
            fastestFirstContactConsultant = {
                userName,
                avgHours: msToHours(avg),
                sampleCount: deltas.length,
            };
        }
    }

    return {
        currentWeekKey,
        currentWeekLabel: formatWeekRangeLabel(currentWeekKey),
        currentWeekAvgHours: currentWeekAvgMs != null ? msToHours(currentWeekAvgMs) : null,
        currentWeekAvgLabel: currentWeekAvgMs != null ? msToReadableDuration(currentWeekAvgMs) : 'N/D',
        currentWeekRegistrationCount: currentWeekRows.length,
        currentWeekContactedCount: currentWeekDeltas.length,
        currentWeekDailyTrend,
        weeklyTrend,
        fastestFirstContactConsultant,
    };
}

function computeInterestRatios(
    attempts: ContactAttempt[],
    summaries: ContactSummaryForRatios[],
    startKey: string,
    endKey: string,
    candidateIdFilter?: Set<string>
): {
    interestedResponseCount: number;
    notInterestedResponseCount: number;
    totalClassifiedResponses: number;
    interestedResponseRatio: number | null;
    notInterestedResponseRatio: number | null;
} {
    let interestedResponseCount = 0;
    let notInterestedResponseCount = 0;
    const countedInterested = new Set<string>();
    const countedNotInterested = new Set<string>();

    for (const attempt of filterAttemptsInDateRange(attempts, startKey, endKey)) {
        if (candidateIdFilter && !candidateIdFilter.has(attempt.candidateId)) continue;
        if (!isCountableContactAction(attempt) || isContactUndoAttempt(attempt)) continue;

        const channel = attempt.channel as ContactAttemptChannel;
        const dedupeBase = `${attempt.candidateId}:${channel}`;

        if (isEffectiveContactAttempt(attempt)) {
            if (!countedInterested.has(dedupeBase)) {
                countedInterested.add(dedupeBase);
                interestedResponseCount += 1;
            }
        } else if (isNotInterestedCandidateResponse(attempt)) {
            if (!countedNotInterested.has(dedupeBase)) {
                countedNotInterested.add(dedupeBase);
                notInterestedResponseCount += 1;
            }
        }
    }

    const channels = Object.keys(CONTACT_CHANNELS) as ContactAttemptChannel[];
    for (const candidate of summaries) {
        if (candidateIdFilter && !candidateIdFilter.has(candidate.id)) continue;
        for (const channel of channels) {
            const summary = summaryForChannel(candidate, channel);
            if (!summary?.lastAttemptAt) continue;
            const dateKey = formatDateKeyLima(summary.lastAttemptAt);
            if (!dateKey || dateKey < startKey || dateKey > endKey) continue;

            const dedupeBase = `${candidate.id}:${channel}`;
            if (summary.status === 'interesado' && !countedInterested.has(dedupeBase)) {
                countedInterested.add(dedupeBase);
                interestedResponseCount += 1;
            } else if (summary.status === 'no_interesado' && !countedNotInterested.has(dedupeBase)) {
                countedNotInterested.add(dedupeBase);
                notInterestedResponseCount += 1;
            }
        }
    }

    const totalClassifiedResponses = interestedResponseCount + notInterestedResponseCount;
    return {
        interestedResponseCount,
        notInterestedResponseCount,
        totalClassifiedResponses,
        interestedResponseRatio:
            totalClassifiedResponses > 0
                ? Math.round((interestedResponseCount / totalClassifiedResponses) * 1000) / 10
                : null,
        notInterestedResponseRatio:
            totalClassifiedResponses > 0
                ? Math.round((notInterestedResponseCount / totalClassifiedResponses) * 1000) / 10
                : null,
    };
}

export interface ContactologyAdvancedStats {
    periodLabel: string;
    effectiveCallOutcomeBreakdown: { name: string; count: number }[];
    attemptsUntilResponseDistribution: { name: string; count: number }[];
    avgAttemptsUntilResponse: number | null;
    avgAttemptsUntilEffectiveResponse: number | null;
    interestedResponseRatio: number | null;
    interestedResponseCount: number;
    notInterestedResponseRatio: number | null;
    notInterestedResponseCount: number;
    totalClassifiedResponses: number;
    candidatesWithResponse: number;
    candidatesWithAnyContact: number;
    weeklyFirstContact: WeeklyFirstContactStats;
}

export function computeContactologyAdvancedStats(
    attempts: ContactAttempt[],
    allAttemptsForFirstContact: ContactAttempt[],
    candidates: ContactologyCandidateInput[],
    summaries: ContactSummaryForRatios[],
    period: ContactConsultantPeriod = 'month',
    candidateIdFilter?: Set<string>
): ContactologyAdvancedStats {
    const { startKey, endKey, label: periodLabel } = getContactPeriodRange(period);
    const scopedAttempts = filterAttemptsInDateRange(attempts, startKey, endKey).filter(
        a => !candidateIdFilter || candidateIdFilter.has(a.candidateId)
    );

    const effectiveCallOutcomeBreakdownMap = new Map<string, number>();
    for (const attempt of scopedAttempts) {
        if (attempt.channel !== 'call') continue;
        if (!isCandidateResponseAttempt(attempt)) continue;
        const label = outcomeLabelForResponse(attempt);
        effectiveCallOutcomeBreakdownMap.set(label, (effectiveCallOutcomeBreakdownMap.get(label) || 0) + 1);
    }

    const attemptsByCandidate = new Map<string, ContactAttempt[]>();
    for (const attempt of scopedAttempts) {
        if (!isAnyVolumeAttempt(attempt)) continue;
        const list = attemptsByCandidate.get(attempt.candidateId) || [];
        list.push(attempt);
        attemptsByCandidate.set(attempt.candidateId, list);
    }

    const attemptsUntilResponseCounts: number[] = [];
    const attemptsUntilResponseDistributionMap = new Map<string, number>();
    let candidatesWithResponse = 0;
    let candidatesWithAnyContact = 0;

    for (const [, rawAttempts] of attemptsByCandidate) {
        const sorted = sortAttemptsChronologically(rawAttempts);
        if (sorted.length === 0) continue;
        candidatesWithAnyContact += 1;

        const firstResponseIdx = sorted.findIndex(a => isCandidateResponseAttempt(a));
        if (firstResponseIdx < 0) continue;

        candidatesWithResponse += 1;
        const attemptsUntil = firstResponseIdx + 1;
        attemptsUntilResponseCounts.push(attemptsUntil);
        const bucketKey = attemptsUntil >= 6 ? '6+' : String(attemptsUntil);
        attemptsUntilResponseDistributionMap.set(
            bucketKey,
            (attemptsUntilResponseDistributionMap.get(bucketKey) || 0) + 1
        );
    }

    const avgAttemptsUntilResponse =
        attemptsUntilResponseCounts.length > 0
            ? Math.round(
                  (attemptsUntilResponseCounts.reduce((s, n) => s + n, 0) /
                      attemptsUntilResponseCounts.length) *
                      10
              ) / 10
            : null;

    const ratios = computeInterestRatios(attempts, summaries, startKey, endKey, candidateIdFilter);

    const weeklyFirstContact = computeWeeklyFirstContactStats(
        allAttemptsForFirstContact,
        candidates,
        candidateIdFilter
    );

    const effectiveCallOutcomeBreakdown = [...effectiveCallOutcomeBreakdownMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    const attemptsUntilResponseDistribution = ['1', '2', '3', '4', '5', '6+']
        .filter(k => attemptsUntilResponseDistributionMap.has(k))
        .map(k => ({
            name: k === '1' ? '1 intento' : k === '6+' ? '6 o más' : `${k} intentos`,
            count: attemptsUntilResponseDistributionMap.get(k) || 0,
        }));

    return {
        periodLabel,
        effectiveCallOutcomeBreakdown,
        attemptsUntilResponseDistribution,
        avgAttemptsUntilResponse,
        avgAttemptsUntilEffectiveResponse: avgAttemptsUntilResponse,
        interestedResponseRatio: ratios.interestedResponseRatio,
        interestedResponseCount: ratios.interestedResponseCount,
        notInterestedResponseRatio: ratios.notInterestedResponseRatio,
        notInterestedResponseCount: ratios.notInterestedResponseCount,
        totalClassifiedResponses: ratios.totalClassifiedResponses,
        candidatesWithResponse,
        candidatesWithAnyContact,
        weeklyFirstContact,
    };
}
