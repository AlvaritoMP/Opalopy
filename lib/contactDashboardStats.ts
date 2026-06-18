import type { ContactAttempt, ContactChannel } from './contactTracking';
import { CONTACT_CHANNELS, type ContactAttemptChannel } from './contactChannelConfig';

export type ContactConsultantPeriod = 'week' | 'month' | 'year';

export interface ContactChannelDashboardStats {
    totalActions: number;
    periodLabel: string;
    mostUsedChannel: {
        channel: ContactAttemptChannel;
        label: string;
        count: number;
        pct: number;
    } | null;
    mostEffectiveChannel: {
        channel: ContactAttemptChannel;
        label: string;
        effectiveCount: number;
        totalCount: number;
        rate: number;
    } | null;
    topCaller: {
        userName: string;
        callCount: number;
    } | null;
    topWhatsappUser: {
        userName: string;
        count: number;
    } | null;
    topEmailUser: {
        userName: string;
        count: number;
    } | null;
    topEffectiveCaller: {
        userName: string;
        effectiveCalls: number;
        totalCalls: number;
        rate: number;
    } | null;
    channelVolume: { name: string; total: number; effective: number; rate: number }[];
    callerRankings: { name: string; llamadas: number; efectivas: number; rate: number }[];
}

export interface ContactCallTrendPoint {
    key: string;
    label: string;
    [userName: string]: string | number;
}

export interface ContactDailyTrendSeries {
    data: ContactCallTrendPoint[];
    users: string[];
    granularity: 'day' | 'month';
    periodLabel: string;
    channel: ContactAttemptChannel;
    channelLabel: string;
    unitLabel: string;
    metric: ContactVolumeMetric;
    metricLabel: string;
}

export interface ContactHourlyPoint {
    hour: number;
    label: string;
    count: number;
}

export interface ContactHourlyDistribution {
    data: ContactHourlyPoint[];
    channel: ContactAttemptChannel;
    channelLabel: string;
    unitLabel: string;
    periodLabel: string;
    peakHour: { label: string; count: number } | null;
    metric: ContactVolumeMetric;
    metricLabel: string;
}

/** Variante de conteo para gráficos de contactología. */
export type ContactVolumeMetric = 'total' | 'failed' | 'effective';

export const CONTACT_VOLUME_METRIC_LABELS: Record<ContactVolumeMetric, string> = {
    total: 'Intentos',
    failed: 'Intentos fallidos',
    effective: 'Intentos efectivos',
};

/** @deprecated alias */
export type ContactCallTrendSeries = ContactDailyTrendSeries;

const PERIOD_LABELS: Record<ContactConsultantPeriod, string> = {
    week: 'Esta semana',
    month: 'Este mes',
    year: 'Este año',
};

/** Acciones que cuentan para volumen por canal (excluye reinicios). */
export function isCountableContactAction(attempt: Pick<ContactAttempt, 'outcome'>): boolean {
    return attempt.outcome !== 'reset_all';
}

/** Marca interés: botón «Interesado», outcome interested o cambio de estado a interesado. */
export function isEffectiveContactAttempt(
    attempt: Pick<ContactAttempt, 'outcome' | 'statusAfter'>
): boolean {
    if (attempt.outcome === 'interested') return true;
    return attempt.outcome === 'status_change' && attempt.statusAfter === 'interesado';
}

/** Intento efectivo en un canal (incluye marcar interesado desde menú de estado). */
export function isEffectiveContactAttemptForChannel(
    attempt: Pick<ContactAttempt, 'channel' | 'outcome' | 'statusAfter' | 'notes'>,
    channel: ContactAttemptChannel
): boolean {
    if (attempt.channel !== channel) return false;
    if (!isCountableContactAction(attempt)) return false;
    if (isContactUndoAttempt(attempt)) return false;
    if (isEffectiveContactAttempt(attempt)) {
        if (attempt.outcome === 'status_change') return true;
        return isChannelVolumeAttempt(attempt, channel);
    }
    return false;
}

/** Intento registrado sin interés (no contestó, sin respuesta, no interesado, etc.). */
export function isFailedContactVolumeAttempt(
    attempt: Pick<ContactAttempt, 'channel' | 'outcome' | 'statusAfter' | 'notes'>,
    channel: ContactAttemptChannel
): boolean {
    return isChannelVolumeAttempt(attempt, channel) && !isEffectiveContactAttempt(attempt);
}

/** Intentos que entran en el gráfico «Total» = fallidos ∪ efectivos (sin doble conteo). */
export function isTotalContactVolumeMetric(
    attempt: Pick<ContactAttempt, 'channel' | 'outcome' | 'statusAfter' | 'notes'>,
    channel: ContactAttemptChannel
): boolean {
    return (
        isFailedContactVolumeAttempt(attempt, channel) ||
        isEffectiveContactAttemptForChannel(attempt, channel)
    );
}

export function matchesContactVolumeMetric(
    attempt: ContactAttempt,
    channel: ContactAttemptChannel,
    metric: ContactVolumeMetric
): boolean {
    if (metric === 'effective') return isEffectiveContactAttemptForChannel(attempt, channel);
    if (metric === 'failed') return isFailedContactVolumeAttempt(attempt, channel);
    return isTotalContactVolumeMetric(attempt, channel);
}

const LIMA_TZ = 'America/Lima';
const LIMA_WEEKDAY: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
};

/** Fecha calendario YYYY-MM-DD en hora Perú (America/Lima). */
export function formatDateKeyLima(iso: string | Date): string {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: LIMA_TZ }).format(d);
}

function formatMonthKeyLima(iso: string | Date): string {
    const key = formatDateKeyLima(iso);
    return key ? key.slice(0, 7) : '';
}

export { formatMonthKeyLima };

function parseDateKey(key: string): { y: number; m: number; d: number } {
    const [y, m, d] = key.split('-').map(Number);
    return { y, m, d };
}

export function addDaysToDateKey(key: string, days: number): string {
    const { y, m, d } = parseDateKey(key);
    const base = new Date(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00-05:00`);
    base.setUTCDate(base.getUTCDate() + days);
    return formatDateKeyLima(base);
}

function weekdayIndexLima(refDate: Date): number {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: LIMA_TZ, weekday: 'short' }).format(refDate);
    return LIMA_WEEKDAY[wd] ?? 0;
}

export function startOfWeekMondayLimaKey(refDate = new Date()): string {
    const todayKey = formatDateKeyLima(refDate);
    return addDaysToDateKey(todayKey, -weekdayIndexLima(refDate));
}

export interface ContactPeriodRange {
    startKey: string;
    endKey: string;
    label: string;
}

export function getContactPeriodRange(
    period: ContactConsultantPeriod,
    refDate = new Date()
): ContactPeriodRange {
    const endKey = formatDateKeyLima(refDate);
    const { y, m } = parseDateKey(endKey);

    if (period === 'week') {
        return { startKey: startOfWeekMondayLimaKey(refDate), endKey, label: PERIOD_LABELS.week };
    }
    if (period === 'month') {
        return { startKey: `${y}-${String(m).padStart(2, '0')}-01`, endKey, label: PERIOD_LABELS.month };
    }
    return { startKey: `${y}-01-01`, endKey, label: PERIOD_LABELS.year };
}

export function filterAttemptsInDateRange(
    attempts: ContactAttempt[],
    startKey: string,
    endKey: string
): ContactAttempt[] {
    return attempts.filter(a => {
        const key = formatDateKeyLima(a.createdAt);
        return key && key >= startKey && key <= endKey;
    });
}

/** Deshacer última acción — no cuenta como contacto nuevo. */
export function isContactUndoAttempt(attempt: Pick<ContactAttempt, 'outcome' | 'notes'>): boolean {
    return attempt.outcome === 'status_change' && Boolean(attempt.notes?.includes('Deshacer'));
}

/**
 * Intento real registrado con botón de contacto (correo, WhatsApp, llamada).
 * Coincide con contact_*_attempt_count en la tabla masiva — excluye cambios de estado manual.
 */
export function isChannelVolumeAttempt(
    attempt: Pick<ContactAttempt, 'channel' | 'outcome' | 'notes'>,
    channel: ContactAttemptChannel
): boolean {
    if (attempt.channel !== channel) return false;
    if (!isCountableContactAction(attempt)) return false;
    if (isContactUndoAttempt(attempt)) return false;
    if (attempt.outcome === 'status_change') return false;
    return true;
}

/** Llamada registrada con botón de contacto (misma regla que la columna Llamadas). */
export function isRecordedCallAttempt(
    attempt: Pick<ContactAttempt, 'channel' | 'outcome' | 'notes'>
): boolean {
    return isChannelVolumeAttempt(attempt, 'call');
}

/** Interés registrado en columna Llamadas (botón o menú rápido «Interesado»). */
export function isEffectiveCallConsultantAttempt(
    attempt: Pick<ContactAttempt, 'channel' | 'outcome' | 'statusAfter'>
): boolean {
    return attempt.channel === 'call' && isEffectiveContactAttempt(attempt);
}

function accumulateCallConsultantStats(
    attempts: ContactAttempt[]
): Map<string, { total: number; effective: number }> {
    const callerTotals = new Map<string, { total: number; effective: number }>();

    for (const a of attempts) {
        if (a.channel !== 'call' || !isCountableContactAction(a)) continue;

        const name = normalizeUserName(a.userName);
        const bucket = callerTotals.get(name) || { total: 0, effective: 0 };

        if (isRecordedCallAttempt(a)) {
            bucket.total += 1;
        }
        if (isEffectiveCallConsultantAttempt(a)) {
            bucket.effective += 1;
        }

        callerTotals.set(name, bucket);
    }

    return callerTotals;
}

/** Cualquier acción en canal (incl. cambio de estado) — solo para reconciliación amplia. */
export function isRecordedChannelAttempt(
    attempt: Pick<ContactAttempt, 'channel' | 'outcome' | 'notes'>,
    channel: ContactAttemptChannel
): boolean {
    if (attempt.channel !== channel) return false;
    if (!isCountableContactAction(attempt)) return false;
    if (isContactUndoAttempt(attempt)) return false;
    return true;
}

function channelLabel(channel: ContactChannel): string {
    return CONTACT_CHANNELS[channel as ContactAttemptChannel]?.shortLabel ?? channel;
}

function normalizeUserName(name?: string): string {
    const trimmed = name?.trim();
    return trimmed || 'Sin consultor';
}

function formatMonthKeyFromParts(y: number, m: number): string {
    return `${y}-${String(m).padStart(2, '0')}`;
}

export function iterDateKeys(fromKey: string, toKey: string): string[] {
    const keys: string[] = [];
    let cursor = fromKey;
    while (cursor && cursor <= toKey) {
        keys.push(cursor);
        cursor = addDaysToDateKey(cursor, 1);
    }
    return keys;
}

export function formatDayLabelFromKey(key: string): string {
    const { y, m, d } = parseDateKey(key);
    const date = new Date(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00-05:00`);
    return date.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short', timeZone: LIMA_TZ });
}

function countTopConsultantByChannel(
    attempts: ContactAttempt[],
    channel: ContactAttemptChannel
): { userName: string; count: number } | null {
    const totals = new Map<string, number>();
    for (const a of attempts) {
        if (!isChannelVolumeAttempt(a, channel)) continue;
        const name = normalizeUserName(a.userName);
        totals.set(name, (totals.get(name) || 0) + 1);
    }
    let best: { userName: string; count: number } | null = null;
    for (const [userName, count] of totals) {
        if (!best || count > best.count) best = { userName, count };
    }
    return best;
}

export interface ContactChannelSummaryInput {
    id: string;
    processId: string;
    contactPhone?: { status: string; attemptCount?: number; lastAttemptAt?: string };
    contactWhatsapp?: { status: string; attemptCount?: number; lastAttemptAt?: string };
    contactEmail?: { status: string; attemptCount?: number; lastAttemptAt?: string };
}

function summaryForChannelInput(
    candidate: ContactChannelSummaryInput,
    channel: ContactAttemptChannel
) {
    if (channel === 'call') return candidate.contactPhone;
    if (channel === 'whatsapp') return candidate.contactWhatsapp;
    return candidate.contactEmail;
}

/** Suma interesados visibles en la tabla masiva que no tienen fila efectiva en el historial. */
function applyInterestedFromContactSummaries(
    channelTotals: Map<ContactAttemptChannel, { total: number; effective: number }>,
    summaries: ContactChannelSummaryInput[],
    startKey: string,
    endKey: string,
    scopedAttempts: ContactAttempt[]
): void {
    const channels = Object.keys(CONTACT_CHANNELS) as ContactAttemptChannel[];
    const alreadyCounted = new Set<string>();

    for (const attempt of scopedAttempts) {
        const ch = attempt.channel as ContactAttemptChannel;
        if (isEffectiveContactAttemptForChannel(attempt, ch)) {
            alreadyCounted.add(`${attempt.candidateId}:${ch}`);
        }
    }

    for (const candidate of summaries) {
        for (const channel of channels) {
            const summary = summaryForChannelInput(candidate, channel);
            if (summary?.status !== 'interesado' || !summary.lastAttemptAt) continue;

            const dateKey = formatDateKeyLima(summary.lastAttemptAt);
            if (!dateKey || dateKey < startKey || dateKey > endKey) continue;

            const dedupeKey = `${candidate.id}:${channel}`;
            if (alreadyCounted.has(dedupeKey)) continue;
            alreadyCounted.add(dedupeKey);

            const bucket = channelTotals.get(channel);
            if (bucket) {
                bucket.effective += 1;
                bucket.total += 1;
            }
        }
    }
}

export function computeContactDashboardStats(
    attempts: ContactAttempt[],
    period: ContactConsultantPeriod = 'month',
    contactSummaries: ContactChannelSummaryInput[] = []
): ContactChannelDashboardStats {
    const { startKey, endKey, label: periodLabel } = getContactPeriodRange(period);
    const scoped = filterAttemptsInDateRange(attempts, startKey, endKey);

    const channels = Object.keys(CONTACT_CHANNELS) as ContactAttemptChannel[];

    const channelTotals = new Map<ContactAttemptChannel, { total: number; effective: number }>();
    for (const ch of channels) {
        channelTotals.set(ch, { total: 0, effective: 0 });
    }

    for (const a of scoped) {
        const ch = a.channel as ContactAttemptChannel;
        if (!CONTACT_CHANNELS[ch]) continue;
        const bucket = channelTotals.get(ch);
        if (!bucket) continue;

        if (isEffectiveContactAttemptForChannel(a, ch)) {
            bucket.effective += 1;
        }
        if (isTotalContactVolumeMetric(a, ch)) {
            bucket.total += 1;
        }
    }

    applyInterestedFromContactSummaries(channelTotals, contactSummaries, startKey, endKey, scoped);

    const totalActions = [...channelTotals.values()].reduce((sum, b) => sum + b.total, 0);

    let mostUsedChannel: ContactChannelDashboardStats['mostUsedChannel'] = null;
    let maxVolume = 0;
    for (const [channel, { total }] of channelTotals) {
        if (total > maxVolume) {
            maxVolume = total;
            mostUsedChannel = {
                channel,
                label: channelLabel(channel),
                count: total,
                pct: totalActions > 0 ? Math.round((total / totalActions) * 1000) / 10 : 0,
            };
        }
    }

    let mostEffectiveChannel: ContactChannelDashboardStats['mostEffectiveChannel'] = null;
    let bestRate = -1;
    let bestEffectiveTotal = 0;
    for (const [channel, { total, effective }] of channelTotals) {
        if (total === 0 && effective === 0) continue;
        const rate = total > 0 ? effective / total : effective > 0 ? 1 : 0;
        if (rate > bestRate || (rate === bestRate && effective > bestEffectiveTotal)) {
            bestRate = rate;
            bestEffectiveTotal = effective;
            mostEffectiveChannel = {
                channel,
                label: channelLabel(channel),
                effectiveCount: effective,
                totalCount: total,
                rate: Math.round(rate * 1000) / 10,
            };
        }
    }

    const callerTotals = accumulateCallConsultantStats(scoped);

    let topCaller: ContactChannelDashboardStats['topCaller'] = null;
    let topEffectiveCaller: ContactChannelDashboardStats['topEffectiveCaller'] = null;

    for (const [userName, { total }] of callerTotals) {
        if (!topCaller || total > topCaller.callCount) {
            topCaller = { userName, callCount: total };
        }
    }

    for (const [userName, { total, effective }] of callerTotals) {
        if (effective === 0) continue;
        if (
            !topEffectiveCaller ||
            effective > topEffectiveCaller.effectiveCalls ||
            (effective === topEffectiveCaller.effectiveCalls && total < topEffectiveCaller.totalCalls)
        ) {
            topEffectiveCaller = {
                userName,
                effectiveCalls: effective,
                totalCalls: total,
                rate: total > 0 ? Math.round((effective / total) * 1000) / 10 : 100,
            };
        }
    }

    const topWhatsappUser = countTopConsultantByChannel(scoped, 'whatsapp');
    const topEmailUser = countTopConsultantByChannel(scoped, 'email');

    const channelVolume = channels
        .map(ch => {
            const { total, effective } = channelTotals.get(ch)!;
            return {
                name: channelLabel(ch),
                total,
                effective,
                rate: total > 0 ? Math.round((effective / total) * 1000) / 10 : effective > 0 ? 100 : 0,
            };
        })
        .filter(d => d.total > 0 || d.effective > 0);

    const callerRankings = Array.from(callerTotals.entries())
        .map(([name, { total, effective }]) => ({
            name,
            llamadas: total,
            efectivas: effective,
            rate: total > 0 ? Math.round((effective / total) * 1000) / 10 : effective > 0 ? 100 : 0,
        }))
        .filter(d => d.llamadas > 0 || d.efectivas > 0)
        .sort((a, b) => b.llamadas - a.llamadas || b.efectivas - a.efectivas)
        .slice(0, 8);

    return {
        totalActions,
        periodLabel,
        mostUsedChannel,
        mostEffectiveChannel,
        topCaller,
        topWhatsappUser,
        topEmailUser,
        topEffectiveCaller,
        channelVolume,
        callerRankings,
    };
}

const CHANNEL_TREND_META: Record<
    ContactAttemptChannel,
    { label: string; unitSingular: string; unitPlural: string }
> = {
    call: { label: 'Llamadas', unitSingular: 'llamada', unitPlural: 'llamadas' },
    whatsapp: { label: 'WhatsApp', unitSingular: 'chat', unitPlural: 'chats' },
    email: { label: 'Correos', unitSingular: 'correo', unitPlural: 'correos' },
};

/**
 * Cantidad ejecutada por día (o por mes en vista anual) — no acumulativa.
 * Una barra = acciones de ese usuario solo en ese día/mes.
 */
export function buildChannelDailyTrendByUser(
    attempts: ContactAttempt[],
    period: ContactConsultantPeriod,
    channel: ContactAttemptChannel,
    maxUsers = 6,
    alwaysIncludeNames: string[] = [],
    metric: ContactVolumeMetric = 'total'
): ContactDailyTrendSeries {
    const meta = CHANNEL_TREND_META[channel];
    const metricLabel = CONTACT_VOLUME_METRIC_LABELS[metric];
    const { startKey, endKey, label: periodLabel } = getContactPeriodRange(period);
    const channelAttempts = filterAttemptsInDateRange(
        attempts.filter(a => matchesContactVolumeMetric(a, channel, metric)),
        startKey,
        endKey
    );

    const userTotals = new Map<string, number>();
    for (const a of channelAttempts) {
        const name = normalizeUserName(a.userName);
        userTotals.set(name, (userTotals.get(name) || 0) + 1);
    }
    const ranked = [...userTotals.entries()].sort((a, b) => b[1] - a[1]);
    const users: string[] = [];
    const seen = new Set<string>();
    for (const [name] of ranked) {
        if (seen.has(name)) continue;
        users.push(name);
        seen.add(name);
    }
    for (const name of alwaysIncludeNames) {
        const trimmed = name?.trim();
        if (!trimmed || trimmed === 'Sin consultor' || seen.has(trimmed)) continue;
        if (userTotals.has(trimmed)) {
            users.push(trimmed);
            seen.add(trimmed);
        }
    }

    if (period === 'year') {
        const { y } = parseDateKey(endKey);
        const endMonth = parseDateKey(endKey).m;
        const buckets = new Map<string, ContactCallTrendPoint>();
        for (let m = 1; m <= endMonth; m++) {
            const key = formatMonthKeyFromParts(y, m);
            const label = new Date(`${key}-01T12:00:00-05:00`).toLocaleDateString('es-PE', {
                month: 'short',
                timeZone: LIMA_TZ,
            });
            const row: ContactCallTrendPoint = { key, label };
            for (const u of users) row[u] = 0;
            buckets.set(key, row);
        }
        for (const a of channelAttempts) {
            const name = normalizeUserName(a.userName);
            if (!users.includes(name)) continue;
            const key = formatMonthKeyLima(a.createdAt);
            const row = buckets.get(key);
            if (row) row[name] = (Number(row[name]) || 0) + 1;
        }
        return {
            data: [...buckets.values()],
            users,
            granularity: 'month',
            periodLabel,
            channel,
            channelLabel: meta.label,
            unitLabel: meta.unitPlural,
            metric,
            metricLabel,
        };
    }

    const buckets = new Map<string, ContactCallTrendPoint>();
    for (const key of iterDateKeys(startKey, endKey)) {
        const label = formatDayLabelFromKey(key);
        const row: ContactCallTrendPoint = { key, label };
        for (const u of users) row[u] = 0;
        buckets.set(key, row);
    }

    for (const a of channelAttempts) {
        const name = normalizeUserName(a.userName);
        if (!users.includes(name)) continue;
        const key = formatDateKeyLima(a.createdAt);
        const row = buckets.get(key);
        if (row) row[name] = (Number(row[name]) || 0) + 1;
    }

    return {
        data: [...buckets.values()],
        users,
        granularity: 'day',
        periodLabel,
        channel,
        channelLabel: meta.label,
        unitLabel: meta.unitPlural,
        metric,
        metricLabel,
    };
}

export function buildChannelTrendBundle(
    attempts: ContactAttempt[],
    period: ContactConsultantPeriod,
    channel: ContactAttemptChannel,
    maxUsers = 10,
    alwaysIncludeNames: string[] = []
): Record<
    ContactVolumeMetric,
    { daily: ContactDailyTrendSeries; hourly: ContactHourlyDistribution }
> {
    const metrics: ContactVolumeMetric[] = ['total', 'failed', 'effective'];
    const out = {} as Record<
        ContactVolumeMetric,
        { daily: ContactDailyTrendSeries; hourly: ContactHourlyDistribution }
    >;
    for (const metric of metrics) {
        out[metric] = {
            daily: buildChannelDailyTrendByUser(
                attempts,
                period,
                channel,
                maxUsers,
                alwaysIncludeNames,
                metric
            ),
            hourly: buildChannelHourlyDistribution(attempts, period, channel, metric),
        };
    }
    return out;
}

/** @deprecated use buildChannelDailyTrendByUser */
export function buildCallTrendByUser(
    attempts: ContactAttempt[],
    period: ContactConsultantPeriod,
    maxUsers = 6
): ContactDailyTrendSeries {
    return buildChannelDailyTrendByUser(attempts, period, 'call', maxUsers);
}

function getHourInLima(iso: string): number {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return -1;
    const parts = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'America/Lima',
    }).formatToParts(d);
    const hourPart = parts.find(p => p.type === 'hour');
    return hourPart ? parseInt(hourPart.value, 10) : d.getHours();
}

/** Distribución por hora del día (0–23, hora Lima) en el periodo seleccionado. */
export function buildChannelHourlyDistribution(
    attempts: ContactAttempt[],
    period: ContactConsultantPeriod,
    channel: ContactAttemptChannel,
    metric: ContactVolumeMetric = 'total'
): ContactHourlyDistribution {
    const meta = CHANNEL_TREND_META[channel];
    const metricLabel = CONTACT_VOLUME_METRIC_LABELS[metric];
    const { startKey, endKey, label: periodLabel } = getContactPeriodRange(period);
    const channelAttempts = filterAttemptsInDateRange(
        attempts.filter(a => matchesContactVolumeMetric(a, channel, metric)),
        startKey,
        endKey
    );

    const counts = new Array<number>(24).fill(0);
    for (const a of channelAttempts) {
        const h = getHourInLima(a.createdAt);
        if (h >= 0 && h < 24) counts[h] += 1;
    }

    const data: ContactHourlyPoint[] = counts.map((count, hour) => ({
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        count,
    }));

    let peakHour: ContactHourlyDistribution['peakHour'] = null;
    for (const row of data) {
        if (row.count === 0) continue;
        if (!peakHour || row.count > peakHour.count) {
            peakHour = { label: row.label, count: row.count };
        }
    }

    return {
        data,
        channel,
        channelLabel: meta.label,
        unitLabel: meta.unitPlural,
        periodLabel,
        peakHour,
        metric,
        metricLabel,
    };
}
