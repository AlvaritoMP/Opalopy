import type { ContactAttempt } from './contactTracking';
import type { ContactAttemptChannel, ChannelContactSummary } from './contactChannelConfig';
import { CONTACT_CHANNELS } from './contactChannelConfig';
import {
    addDaysToDateKey,
    formatDateKeyLima,
    isChannelVolumeAttempt,
    isEffectiveContactAttemptForChannel,
} from './contactDashboardStats';

export interface ContactSummaryCandidate {
    id: string;
    processId: string;
    contactPhone?: ChannelContactSummary;
    contactWhatsapp?: ChannelContactSummary;
    contactEmail?: ChannelContactSummary;
}

function summaryForChannel(
    candidate: ContactSummaryCandidate,
    channel: ContactAttemptChannel
): ChannelContactSummary | undefined {
    if (channel === 'call') return candidate.contactPhone;
    if (channel === 'whatsapp') return candidate.contactWhatsapp;
    return candidate.contactEmail;
}

function syntheticAttempt(
    candidate: ContactSummaryCandidate,
    channel: ContactAttemptChannel,
    summary: ChannelContactSummary,
    attemptNumber: number,
    createdAt: string,
    userName?: string
): ContactAttempt {
    return {
        id: `reconcile-${candidate.id}-${channel}-${attemptNumber}-${createdAt}`,
        candidateId: candidate.id,
        processId: candidate.processId,
        userName: userName || summary.lastUserName,
        channel,
        outcome: channel === 'email' ? 'no_response' : channel === 'whatsapp' ? 'no_response' : 'no_answer',
        attemptNumber,
        statusAfter: summary.status === 'interesado' ? 'en_intento' : summary.status,
        createdAt,
    };
}

function volumeAttemptsForCandidate(
    attempts: ContactAttempt[],
    candidateId: string,
    channel: ContactAttemptChannel
): ContactAttempt[] {
    return attempts.filter(
        a => a.candidateId === candidateId && isChannelVolumeAttempt(a, channel)
    );
}

function isGenericActorName(name?: string): boolean {
    const t = name?.trim();
    return !t || t === 'Usuario' || t === 'Sin consultor' || t === 'usuario';
}

function dateKeyToLimaNoonIso(key: string): string {
    const [y, m, d] = key.split('-').map(Number);
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00-05:00`;
}

/** Reparte intentos sintéticos en días distintos hacia atrás desde la última fecha conocida. */
function spreadSyntheticAttemptDates(
    lastAttemptAt: string,
    count: number,
    existingVolume: ContactAttempt[]
): string[] {
    const existingKeys = [
        ...new Set(
            existingVolume
                .map(a => formatDateKeyLima(a.createdAt))
                .filter(Boolean)
        ),
    ].sort();

    const dates: string[] = existingKeys.map(dateKeyToLimaNoonIso);
    const anchorKey = formatDateKeyLima(lastAttemptAt) || existingKeys[existingKeys.length - 1];
    if (!anchorKey) return dates.slice(0, count);

    let cursor = anchorKey;
    while (dates.length < count) {
        const prevKey = addDaysToDateKey(cursor, -1);
        if (!dates.some(d => formatDateKeyLima(d) === prevKey)) {
            dates.unshift(dateKeyToLimaNoonIso(prevKey));
        }
        if (prevKey === cursor) break;
        cursor = prevKey;
    }

    while (dates.length < count) {
        dates.push(dateKeyToLimaNoonIso(anchorKey));
    }

    return dates.slice(-count);
}

export function mergeContactAttemptsDedupe(attempts: ContactAttempt[]): ContactAttempt[] {
    const byId = new Map<string, ContactAttempt>();
    for (const attempt of attempts) {
        byId.set(attempt.id, attempt);
    }
    return [...byId.values()];
}

export function backfillContactAttemptProcessIds(
    attempts: ContactAttempt[],
    processByCandidate: Map<string, string>
): ContactAttempt[] {
    return attempts.map(attempt => ({
        ...attempt,
        processId: attempt.processId || processByCandidate.get(attempt.candidateId) || attempt.processId,
    }));
}

/**
 * Si el historial no guardó user_name pero la tabla sí tiene lastUserName,
 * atribuye el intento al consultor visible en la columna de contacto.
 */
export function attributeContactAttemptsFromSummaries(
    attempts: ContactAttempt[],
    candidates: ContactSummaryCandidate[]
): ContactAttempt[] {
    const byCandidate = new Map(candidates.map(c => [c.id, c]));

    return attempts.map(attempt => {
        if (attempt.userId && !isGenericActorName(attempt.userName)) return attempt;

        const candidate = byCandidate.get(attempt.candidateId);
        if (!candidate) return attempt;

        const channel = attempt.channel as ContactAttemptChannel;
        if (!CONTACT_CHANNELS[channel]) return attempt;

        const summary = summaryForChannel(candidate, channel);
        const tableUser = summary?.lastUserName?.trim();
        if (!tableUser) return attempt;

        if (!isGenericActorName(attempt.userName)) {
            return attempt;
        }

        return { ...attempt, userName: tableUser };
    });
}

/**
 * Completa el historial cuando faltan intentos respecto a attempt_count en la tabla.
 * Reparte intentos sintéticos en días distintos (p. ej. 03/06 y 04/06).
 */
export function reconcileContactAttemptsWithSummaries(
    attempts: ContactAttempt[],
    candidates: ContactSummaryCandidate[]
): ContactAttempt[] {
    if (candidates.length === 0) return attempts;

    const result = [...attempts];
    const channels = Object.keys(CONTACT_CHANNELS) as ContactAttemptChannel[];

    for (const candidate of candidates) {
        for (const channel of channels) {
            const summary = summaryForChannel(candidate, channel);
            const attemptCount = summary?.attemptCount ?? 0;
            if (attemptCount <= 0 || !summary?.lastAttemptAt) continue;

            const volumeRows = volumeAttemptsForCandidate(result, candidate.id, channel);
            const deficit = attemptCount - volumeRows.length;
            if (deficit <= 0) continue;

            const tableUser = summary.lastUserName?.trim();
            const spreadDates = spreadSyntheticAttemptDates(
                summary.lastAttemptAt,
                attemptCount,
                volumeRows
            ).slice(-deficit);

            for (let i = 0; i < deficit; i++) {
                result.push(
                    syntheticAttempt(
                        candidate,
                        channel,
                        summary,
                        volumeRows.length + i + 1,
                        spreadDates[i] ?? summary.lastAttemptAt,
                        tableUser
                    )
                );
            }
        }
    }

    return result;
}

/**
 * Genera intentos de volumen desde la tabla masiva cuando no hay filas en el historial
 * pero sí attempt_count (p. ej. inserts fallidos en candidate_contact_attempts).
 */
export function synthesizeVolumeAttemptsFromSummaries(
    attempts: ContactAttempt[],
    candidates: ContactSummaryCandidate[]
): ContactAttempt[] {
    const result = [...attempts];
    const channels = Object.keys(CONTACT_CHANNELS) as ContactAttemptChannel[];

    for (const candidate of candidates) {
        for (const channel of channels) {
            const summary = summaryForChannel(candidate, channel);
            if (!summary?.lastAttemptAt) continue;
            if ((summary.attemptCount ?? 0) <= 0) continue;

            const existing = volumeAttemptsForCandidate(result, candidate.id, channel);
            if (existing.length > 0) continue;

            const tableUser = summary.lastUserName?.trim();
            const spreadDates = spreadSyntheticAttemptDates(
                summary.lastAttemptAt,
                summary.attemptCount,
                existing
            );

            for (let n = 1; n <= summary.attemptCount; n++) {
                result.push(
                    syntheticAttempt(
                        candidate,
                        channel,
                        summary,
                        n,
                        spreadDates[n - 1] ?? summary.lastAttemptAt,
                        tableUser
                    )
                );
            }
        }
    }

    return result;
}

/**
 * Genera un cambio a «interesado» cuando la tabla masiva ya lo muestra pero falta en el historial.
 */
export function synthesizeInteresadoAttemptsFromSummaries(
    attempts: ContactAttempt[],
    candidates: ContactSummaryCandidate[]
): ContactAttempt[] {
    const result = [...attempts];
    const channels = Object.keys(CONTACT_CHANNELS) as ContactAttemptChannel[];

    for (const candidate of candidates) {
        for (const channel of channels) {
            const summary = summaryForChannel(candidate, channel);
            if (summary?.status !== 'interesado' || !summary.lastAttemptAt) continue;

            const hasEffective = result.some(
                a =>
                    a.candidateId === candidate.id &&
                    isEffectiveContactAttemptForChannel(a, channel)
            );
            if (hasEffective) continue;

            result.push({
                id: `reconcile-interesado-${candidate.id}-${channel}-${summary.lastAttemptAt}`,
                candidateId: candidate.id,
                processId: candidate.processId,
                userName: summary.lastUserName,
                channel,
                outcome: 'status_change',
                attemptNumber: Math.max(summary.attemptCount ?? 0, 1),
                statusAfter: 'interesado',
                createdAt: summary.lastAttemptAt,
            });
        }
    }

    return result;
}
