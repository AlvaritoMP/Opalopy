export type ContactStatus =
    | 'por_contactar'
    | 'en_intento'
    | 'interesado'
    | 'no_interesado'
    | 'inubicable';

export type ContactChannel = 'call' | 'whatsapp' | 'email';

export type ContactOutcome =
    | 'no_answer'
    | 'busy'
    | 'no_response'
    | 'answered'
    | 'interested'
    | 'not_interested'
    | 'unreachable'
    | 'status_change'
    | 'reset_all';

export interface ContactAttempt {
    id: string;
    candidateId: string;
    processId: string;
    userId?: string;
    userName?: string;
    channel: ContactChannel;
    outcome: ContactOutcome;
    attemptNumber: number;
    statusAfter?: ContactStatus;
    notes?: string;
    createdAt: string;
}

export interface ContactSummary {
    status: ContactStatus;
    attemptCount: number;
    lastAttemptAt?: string;
    lastUserId?: string;
    lastUserName?: string;
}

export const CONTACT_COOLDOWN_MS = 10 * 60 * 1000;

export const CONTACT_STATUS_META: Record<
    ContactStatus,
    { label: string; shortLabel: string; badgeClass: string; dot: string }
> = {
    por_contactar: {
        label: 'Por contactar',
        shortLabel: 'Por contactar',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        dot: '🟢',
    },
    en_intento: {
        label: 'En intento',
        shortLabel: 'Intento',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
        dot: '🟡',
    },
    interesado: {
        label: 'Interesado / En proceso',
        shortLabel: 'Interesado',
        badgeClass: 'bg-orange-100 text-orange-900 border-orange-300',
        dot: '🟠',
    },
    no_interesado: {
        label: 'No interesado / Desistió',
        shortLabel: 'No interesado',
        badgeClass: 'bg-red-100 text-red-800 border-red-300',
        dot: '🔴',
    },
    inubicable: {
        label: 'Inubicable (descarte)',
        shortLabel: 'Inubicable',
        badgeClass: 'bg-gray-200 text-gray-800 border-gray-400',
        dot: '⚫',
    },
};

export const CONTACT_OUTCOME_LABELS: Record<ContactOutcome, string> = {
    no_answer: 'No contestó',
    busy: 'Ocupado',
    no_response: 'Sin respuesta',
    answered: 'Contestó',
    interested: 'Interesado',
    not_interested: 'No interesado',
    unreachable: 'Inubicable',
    status_change: 'Cambio de estado',
    reset_all: 'Reinicio de seguimiento',
};

export const QUICK_STATUS_OPTIONS: {
    status: ContactStatus;
    label: string;
    description?: string;
}[] = [
    { status: 'por_contactar', label: 'Por contactar' },
    { status: 'en_intento', label: 'En intento (sin marcar llamada)' },
    { status: 'interesado', label: 'Interesado / En proceso' },
    { status: 'no_interesado', label: 'No interesado / Desistió' },
    { status: 'inubicable', label: 'Inubicable (descarte)' },
];

export function normalizeContactStatus(raw?: string | null): ContactStatus {
    const s = (raw || 'por_contactar') as ContactStatus;
    if (s in CONTACT_STATUS_META) return s;
    return 'por_contactar';
}

export function getContactBadgeLabel(status: ContactStatus, attemptCount: number): string {
    const meta = CONTACT_STATUS_META[status];
    if (status === 'en_intento' && attemptCount > 0) {
        return `Intento ${attemptCount}`;
    }
    return meta.shortLabel;
}

/** Etiqueta mínima para celda de una sola línea */
export function getContactBadgeLabelCompact(status: ContactStatus, attemptCount: number): string {
    if (status === 'por_contactar') return '';
    if (status === 'en_intento' && attemptCount > 0) return String(attemptCount);
    const short = CONTACT_STATUS_META[status].shortLabel;
    return short.length > 8 ? `${short.slice(0, 7)}…` : short;
}

/** Hora o fecha corta para la fila de la tabla */
export function formatContactLastAtCompact(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const sameDay =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
    const t = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return t;
    return `${d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })} ${t}`;
}

export function isContactCooldownActive(lastAttemptAt?: string | null, now = Date.now()): boolean {
    if (!lastAttemptAt) return false;
    const t = new Date(lastAttemptAt).getTime();
    if (isNaN(t)) return false;
    return now - t < CONTACT_COOLDOWN_MS;
}

export interface ContactAttemptSyncMeta {
    sync?: string;
    source?: string;
}

export function parseContactAttemptNotes(notes?: string | null): ContactAttemptSyncMeta | null {
    if (!notes) return null;
    try {
        const parsed = JSON.parse(notes) as ContactAttemptSyncMeta;
        if (parsed.sync || parsed.source === 'contactHistorySync') return parsed;
    } catch {
        /* notas en texto plano */
    }
    return null;
}

/** Intento reconstruido por syncContactHistoryForCandidates, no una acción en vivo del reclutador. */
export function isSyncedContactAttempt(attempt: Pick<ContactAttempt, 'notes'>): boolean {
    const meta = parseContactAttemptNotes(attempt.notes);
    return (
        meta?.sync === 'summary_backfill' ||
        meta?.sync === 'interesado_backfill' ||
        meta?.source === 'contactHistorySync'
    );
}

export const SYNCED_CONTACT_ATTEMPT_LABEL =
    'Sincronizado (reconstruido desde la tabla, no fue una acción en vivo)';

export function formatContactCooldownWarning(lastAttemptAt: string, lastUserName?: string): string {
    const who = lastUserName ? ` por ${lastUserName}` : '';
    const mins = Math.max(1, Math.ceil((CONTACT_COOLDOWN_MS - (Date.now() - new Date(lastAttemptAt).getTime())) / 60000));
    return `Contacto hace ${mins} min${who}. Mejor esperar antes de insistir.`;
}

export function formatAttemptHistoryLine(attempt: ContactAttempt): string {
    const time = formatHistoryTime(attempt.createdAt);
    const who = attempt.userName || 'Usuario';

    if (attempt.outcome === 'reset_all') {
        try {
            const meta = JSON.parse(attempt.notes || '{}') as {
                clearedAttempts?: number;
                previous?: { status?: string; attemptCount?: number };
            };
            const n = meta.clearedAttempts ?? 0;
            const prev = meta.previous?.status
                ? CONTACT_STATUS_META[normalizeContactStatus(meta.previous.status)].label
                : '—';
            return `${time} - ${who}: Reinició seguimiento (${n} acción(es) borradas, antes: ${prev})`;
        } catch {
            return `${time} - ${who}: Reinició seguimiento de contacto`;
        }
    }

    const channel =
        attempt.channel === 'whatsapp'
            ? 'Envió WhatsApp'
            : attempt.channel === 'email'
              ? 'Envió correo'
              : 'Llamó';
    const outcome = CONTACT_OUTCOME_LABELS[attempt.outcome] || attempt.outcome;
    const attemptSuffix =
        attempt.outcome !== 'status_change' &&
        attempt.outcome !== 'reset_all' &&
        attempt.attemptNumber > 0
            ? ` (Intento ${attempt.attemptNumber})`
            : '';
    const syncSuffix = isSyncedContactAttempt(attempt) ? ` · ${SYNCED_CONTACT_ATTEMPT_LABEL}` : '';
    return `${time} - ${who}: ${channel} - ${outcome}${attemptSuffix}${syncSuffix}`;
}

function formatHistoryTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const now = new Date();
    const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
        d.getDate() === yesterday.getDate() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getFullYear() === yesterday.getFullYear();

    const time = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;
    if (isYesterday) return `Ayer ${time}`;
    return d.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}


export function nextStatusAfterCallAttempt(
    current: ContactStatus,
    _outcome: ContactOutcome
): ContactStatus {
    if (current === 'por_contactar' || current === 'en_intento') {
        return 'en_intento';
    }
    return current;
}
