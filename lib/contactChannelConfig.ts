import type { ContactChannel, ContactStatus } from './contactTracking';
import { CONTACT_STATUS_META, normalizeContactStatus } from './contactTracking';

/** Canal persistido en candidate_contact_attempts */
export type ContactAttemptChannel = 'call' | 'whatsapp' | 'email';

export interface ContactChannelDef {
    /** ID de columna en tabla masiva */
    columnId: string;
    label: string;
    shortLabel: string;
    attemptChannel: ContactAttemptChannel;
    dbPrefix: string;
}

export const CONTACT_CHANNELS: Record<ContactAttemptChannel, ContactChannelDef> = {
    call: {
        columnId: 'contactPhone',
        label: 'Contacto teléfono',
        shortLabel: 'Llamadas',
        attemptChannel: 'call',
        dbPrefix: 'contact_phone',
    },
    whatsapp: {
        columnId: 'contactWhatsapp',
        label: 'Contacto WhatsApp',
        shortLabel: 'WhatsApp',
        attemptChannel: 'whatsapp',
        dbPrefix: 'contact_whatsapp',
    },
    email: {
        columnId: 'contactEmail',
        label: 'Contacto correo',
        shortLabel: 'Correo',
        attemptChannel: 'email',
        dbPrefix: 'contact_email',
    },
};

export const CONTACT_COLUMN_IDS = Object.values(CONTACT_CHANNELS).map(c => c.columnId);

/** Columna derivada: último usuario que tocó teléfono, WhatsApp o correo de contacto */
export const CONTACT_LAST_USER_COLUMN_ID = 'contactLastUser';

export interface LatestContactActor {
    userName?: string;
    lastAttemptAt?: string;
    channelLabel?: string;
}

export function getLatestContactActorFromCandidate(candidate: {
    contactPhone?: ChannelContactSummary;
    contactWhatsapp?: ChannelContactSummary;
    contactEmail?: ChannelContactSummary;
}): LatestContactActor | null {
    const channels = Object.keys(CONTACT_CHANNELS) as ContactAttemptChannel[];
    let best: LatestContactActor | null = null;
    let bestTs = -1;

    for (const channel of channels) {
        const summaryKey =
            channel === 'call' ? 'contactPhone'
            : channel === 'whatsapp' ? 'contactWhatsapp'
            : 'contactEmail';
        const summary = candidate[summaryKey];
        if (!summary?.lastAttemptAt) continue;
        const ts = new Date(summary.lastAttemptAt).getTime();
        if (Number.isNaN(ts) || ts <= bestTs) continue;
        bestTs = ts;
        best = {
            userName: summary.lastUserName,
            lastAttemptAt: summary.lastAttemptAt,
            channelLabel: CONTACT_CHANNELS[channel].shortLabel,
        };
    }

    return best;
}

export function formatLatestContactActorDisplay(actor: LatestContactActor | null): string {
    if (!actor?.userName?.trim()) return '-';
    return actor.userName.trim();
}

export function formatLatestContactActorTooltip(actor: LatestContactActor | null): string | undefined {
    if (!actor?.lastAttemptAt) return actor?.userName ? `Por ${actor.userName}` : undefined;
    const parts: string[] = [];
    if (actor.channelLabel) parts.push(actor.channelLabel);
    parts.push(actor.lastAttemptAt);
    if (actor.userName) parts.push(`por ${actor.userName}`);
    return parts.join(' · ');
}

/** Mapeo columnas antiguas → nuevas (procesos con orden guardado) */
export const LEGACY_CONTACT_COLUMN_MAP: Record<string, string> = {
    contact: 'contactPhone',
    lastInteraction: 'contactWhatsapp',
};

export function columnIdToAttemptChannel(colId: string): ContactAttemptChannel | null {
    const entry = Object.values(CONTACT_CHANNELS).find(c => c.columnId === colId);
    return entry?.attemptChannel ?? null;
}

export function attemptChannelToColumnId(channel: ContactAttemptChannel): string {
    return CONTACT_CHANNELS[channel].columnId;
}

export interface ChannelDbFieldNames {
    status: string;
    attemptCount: string;
    lastAt: string;
    lastUserName: string;
}

export function getChannelDbFields(channel: ContactAttemptChannel): ChannelDbFieldNames {
    const p = CONTACT_CHANNELS[channel].dbPrefix;
    return {
        status: `${p}_status`,
        attemptCount: `${p}_attempt_count`,
        lastAt: `${p}_last_at`,
        lastUserName: `${p}_last_user_name`,
    };
}

export interface ChannelContactSummary {
    status: ContactStatus;
    attemptCount: number;
    lastAttemptAt?: string;
    lastUserName?: string;
}

export function hasChannelContactTracking(summary?: ChannelContactSummary | null): boolean {
    if (!summary) return false;
    return summary.status !== 'por_contactar' || summary.attemptCount > 0 || !!summary.lastAttemptAt;
}

const CONTACT_STATUS_FILTER_IDS = Object.keys(CONTACT_STATUS_META) as ContactStatus[];

/** Texto buscable para filtro libre en columnas de contacto (estado, usuario, intentos). */
export function getContactSummarySearchText(summary?: ChannelContactSummary | null): string {
    const s = summary ?? { status: 'por_contactar' as ContactStatus, attemptCount: 0 };
    const meta = CONTACT_STATUS_META[s.status];
    return [meta.label, meta.shortLabel, s.lastUserName || '', String(s.attemptCount)]
        .join(' ')
        .toLowerCase();
}

/** Filtra por id de estado (select) o por texto parcial (usuario, etiqueta, etc.). */
export function contactSummaryMatchesFilter(
    summary: ChannelContactSummary | undefined,
    filterValue: string
): boolean {
    const trimmed = filterValue.trim();
    if (!trimmed) return true;

    const normalized = trimmed.toLowerCase();
    const s = summary ?? { status: 'por_contactar' as ContactStatus, attemptCount: 0 };

    if (CONTACT_STATUS_FILTER_IDS.includes(trimmed as ContactStatus)) {
        return s.status === trimmed;
    }

    return getContactSummarySearchText(summary).includes(normalized);
}

export { CONTACT_STATUS_META };

export function readChannelSummaryFromRow(
    row: Record<string, unknown>,
    channel: ContactAttemptChannel
): ChannelContactSummary {
    const f = getChannelDbFields(channel);
    const statusRaw = row[f.status];

    if (statusRaw !== undefined && statusRaw !== null) {
        return {
            status: normalizeContactStatus(statusRaw as string),
            attemptCount: (row[f.attemptCount] as number) ?? 0,
            lastAttemptAt: (row[f.lastAt] as string) || undefined,
            lastUserName: (row[f.lastUserName] as string) || undefined,
        };
    }

    // Legacy: columnas globales → teléfono
    if (channel === 'call' && row.contact_status != null) {
        return {
            status: normalizeContactStatus(row.contact_status as string),
            attemptCount: (row.contact_attempt_count as number) ?? 0,
            lastAttemptAt: (row.contact_last_attempt_at as string) || undefined,
            lastUserName: (row.contact_last_user_name as string) || undefined,
        };
    }

    // Legacy: last_whatsapp_interaction_at → WhatsApp
    if (channel === 'whatsapp' && row.last_whatsapp_interaction_at) {
        return {
            status: 'en_intento',
            attemptCount: 1,
            lastAttemptAt: row.last_whatsapp_interaction_at as string,
            lastUserName: undefined,
        };
    }

    return { status: 'por_contactar', attemptCount: 0 };
}

export function buildSingleChannelResetUpdate(
    channel: ContactAttemptChannel
): Record<string, string | number | null> {
    const f = getChannelDbFields(channel);
    const out: Record<string, string | number | null> = {
        [f.status]: 'por_contactar',
        [f.attemptCount]: 0,
        [f.lastAt]: null,
        [f.lastUserName]: null,
    };
    if (channel === 'call') {
        out.contact_status = 'por_contactar';
        out.contact_attempt_count = 0;
        out.contact_last_attempt_at = null;
        out.contact_last_user_id = null;
        out.contact_last_user_name = null;
    }
    if (channel === 'whatsapp') {
        out.last_whatsapp_interaction_at = null;
    }
    return out;
}

export function buildChannelResetUpdate(): Record<string, string | number | null> {
    const out: Record<string, string | number | null> = {
        last_whatsapp_interaction_at: null,
        contact_status: 'por_contactar',
        contact_attempt_count: 0,
        contact_last_attempt_at: null,
        contact_last_user_id: null,
        contact_last_user_name: null,
    };
    for (const ch of Object.keys(CONTACT_CHANNELS) as ContactAttemptChannel[]) {
        const f = getChannelDbFields(ch);
        out[f.status] = 'por_contactar';
        out[f.attemptCount] = 0;
        out[f.lastAt] = null;
        out[f.lastUserName] = null;
    }
    return out;
}

export function migrateBulkColumnOrder(order: string[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();

    for (const id of order) {
        if (id === 'lastInteraction' || id === 'contact') {
            const mapped = LEGACY_CONTACT_COLUMN_MAP[id];
            if (mapped && !seen.has(mapped)) {
                out.push(mapped);
                seen.add(mapped);
            }
            continue;
        }
        const mapped = LEGACY_CONTACT_COLUMN_MAP[id] || id;
        if (seen.has(mapped)) continue;
        seen.add(mapped);
        out.push(mapped);
    }

    for (const colId of CONTACT_COLUMN_IDS) {
        if (!seen.has(colId)) out.push(colId);
    }

    if (!seen.has(CONTACT_LAST_USER_COLUMN_ID)) {
        let lastContactIdx = -1;
        for (let i = 0; i < out.length; i++) {
            if (CONTACT_COLUMN_IDS.includes(out[i])) lastContactIdx = i;
        }
        if (lastContactIdx >= 0) {
            out.splice(lastContactIdx + 1, 0, CONTACT_LAST_USER_COLUMN_ID);
        } else {
            out.push(CONTACT_LAST_USER_COLUMN_ID);
        }
        seen.add(CONTACT_LAST_USER_COLUMN_ID);
    }

    return out;
}
