import { supabase } from './supabase';
import { APP_NAME } from './appConfig';
import type { ContactAttempt } from './contactTracking';
import type { BulkProcessActivityEntry } from './api/bulkProcessActivity';
import {
    CONTACT_CHANNELS,
    type ChannelContactSummary,
    type ContactAttemptChannel,
} from './contactChannelConfig';
import { addDaysToDateKey, formatDateKeyLima, isChannelVolumeAttempt, isEffectiveContactAttemptForChannel } from './contactDashboardStats';
import type { ContactSummaryCandidate } from './contactAttemptReconcile';

const FIELD_TO_CHANNEL: Record<string, ContactAttemptChannel> = {
    Llamadas: 'call',
    WhatsApp: 'whatsapp',
    Correo: 'email',
};

function dateKeyToLimaNoonIso(key: string): string {
    const [y, m, d] = key.split('-').map(Number);
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00-05:00`;
}

function spreadAttemptDates(
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

function summaryForChannel(
    candidate: ContactSummaryCandidate,
    channel: ContactAttemptChannel
): ChannelContactSummary | undefined {
    if (channel === 'call') return candidate.contactPhone;
    if (channel === 'whatsapp') return candidate.contactWhatsapp;
    return candidate.contactEmail;
}

function defaultOutcome(channel: ContactAttemptChannel): ContactAttempt['outcome'] {
    if (channel === 'email') return 'no_response';
    if (channel === 'whatsapp') return 'no_response';
    return 'no_answer';
}

function activityTimestampsForChannel(
    entries: BulkProcessActivityEntry[] | undefined,
    channel: ContactAttemptChannel
): string[] {
    if (!entries?.length) return [];
    const label = CONTACT_CHANNELS[channel].shortLabel;
    return entries
        .filter(
            e =>
                e.actionType === 'contact_attempt' &&
                (e.fieldName === label || FIELD_TO_CHANNEL[e.fieldName || ''] === channel)
        )
        .map(e => e.createdAt)
        .filter(Boolean)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}

function resolveInsertDates(
    summary: ChannelContactSummary,
    channel: ContactAttemptChannel,
    existingVolume: ContactAttempt[],
    activityEntries: BulkProcessActivityEntry[] | undefined,
    targetCount: number
): string[] {
    const activityForChannel = activityTimestampsForChannel(activityEntries, channel);

    if (activityForChannel.length >= targetCount) {
        return activityForChannel.slice(0, targetCount);
    }

    const spread = spreadAttemptDates(
        summary.lastAttemptAt || activityForChannel[activityForChannel.length - 1] || new Date().toISOString(),
        targetCount,
        existingVolume
    );

    if (activityForChannel.length === 0) return spread;

    const merged = [...activityForChannel];
    for (const date of spread) {
        if (merged.length >= targetCount) break;
        const key = formatDateKeyLima(date);
        if (!merged.some(d => formatDateKeyLima(d) === key)) merged.push(date);
    }

    while (merged.length < targetCount) {
        merged.push(spread[merged.length] ?? spread[spread.length - 1]);
    }

    return merged.slice(0, targetCount);
}

export interface SyncContactHistoryResult {
    inserted: number;
    patched: number;
}

/**
 * Escribe en candidate_contact_attempts los intentos que ya figuran en candidates.contact_*_*
 * (y opcionalmente en bulk_process_activity_log) pero faltan en el historial.
 */
export async function syncContactHistoryForCandidates(
    candidates: ContactSummaryCandidate[],
    existingAttempts: ContactAttempt[],
    activityByCandidate: Map<string, BulkProcessActivityEntry[]> = new Map()
): Promise<SyncContactHistoryResult> {
    if (candidates.length === 0) return { inserted: 0, patched: 0 };

    const attemptsByKey = new Map<string, ContactAttempt[]>();
    for (const attempt of existingAttempts) {
        const key = `${attempt.candidateId}:${attempt.channel}`;
        const bucket = attemptsByKey.get(key) || [];
        bucket.push(attempt);
        attemptsByKey.set(key, bucket);
    }

    let inserted = 0;
    let patched = 0;
    const channels = Object.keys(CONTACT_CHANNELS) as ContactAttemptChannel[];

    for (const candidate of candidates) {
        for (const channel of channels) {
            const summary = summaryForChannel(candidate, channel);
            if (!summary?.lastAttemptAt) continue;

            const key = `${candidate.id}:${channel}`;
            const allRows = (attemptsByKey.get(key) || []).sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            const volumeRows = allRows.filter(a => isChannelVolumeAttempt(a, channel));

            for (const row of allRows) {
                const needsProcess = !row.processId || row.processId !== candidate.processId;
                const needsUser =
                    !row.userName?.trim() &&
                    summary.lastUserName?.trim();
                if (!needsProcess && !needsUser) continue;

                const { error } = await supabase
                    .from('candidate_contact_attempts')
                    .update({
                        ...(needsProcess ? { process_id: candidate.processId } : {}),
                        ...(needsUser ? { user_name: summary.lastUserName!.trim() } : {}),
                    })
                    .eq('id', row.id)
                    .eq('app_name', APP_NAME);

                if (!error) patched += 1;
            }

            const targetCount = summary.attemptCount ?? 0;
            const deficit = targetCount - volumeRows.length;
            if (deficit > 0) {
                const activity = activityByCandidate.get(candidate.id);
                const fullDates = resolveInsertDates(
                    summary,
                    channel,
                    volumeRows,
                    activity,
                    targetCount
                );
                const insertDates = fullDates.slice(volumeRows.length);

                for (let i = 0; i < deficit; i++) {
                    const attemptNumber = volumeRows.length + i + 1;
                    const createdAt =
                        insertDates[i] ||
                        summary.lastAttemptAt ||
                        new Date().toISOString();

                    const { error } = await supabase.from('candidate_contact_attempts').insert({
                        candidate_id: candidate.id,
                        process_id: candidate.processId,
                        user_id: null,
                        user_name: summary.lastUserName?.trim() || null,
                        channel,
                        outcome: defaultOutcome(channel),
                        attempt_number: attemptNumber,
                        status_after: summary.status,
                        notes: JSON.stringify({ sync: 'summary_backfill', source: 'contactHistorySync' }),
                        created_at: createdAt,
                        app_name: APP_NAME,
                    });

                    if (!error) inserted += 1;
                }
            }

            if (
                summary.status === 'interesado' &&
                !allRows.some(a => isEffectiveContactAttemptForChannel(a, channel))
            ) {
                const activity = activityByCandidate.get(candidate.id);
                const label = CONTACT_CHANNELS[channel].shortLabel;
                const statusActivity = activity
                    ?.filter(
                        e =>
                            e.actionType === 'contact_status' &&
                            (e.fieldName === label || FIELD_TO_CHANNEL[e.fieldName || ''] === channel) &&
                            e.newValue?.toLowerCase().includes('interes')
                    )
                    .map(e => e.createdAt)
                    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

                const { error } = await supabase.from('candidate_contact_attempts').insert({
                    candidate_id: candidate.id,
                    process_id: candidate.processId,
                    user_id: null,
                    user_name: summary.lastUserName?.trim() || null,
                    channel,
                    outcome: 'status_change',
                    attempt_number: Math.max(targetCount, volumeRows.length, 1),
                    status_after: 'interesado',
                    notes: JSON.stringify({ sync: 'interesado_backfill', source: 'contactHistorySync' }),
                    created_at: statusActivity || summary.lastAttemptAt,
                    app_name: APP_NAME,
                });

                if (!error) inserted += 1;
            }
        }
    }

    return { inserted, patched };
}
