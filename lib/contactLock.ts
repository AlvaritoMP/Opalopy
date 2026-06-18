import type { ContactOutcome, ContactStatus } from './contactTracking';
import type { CandidateRegistrationOrigin } from './candidateRegistrationOrigin';

/** Reserva tras alta manual o masiva por quien subió el registro */
export const CONTACT_UPLOAD_LOCK_MS = 30 * 60 * 1000;

/** Reserva tras contacto exitoso */
export const CONTACT_SUCCESS_LOCK_MS = 4 * 60 * 60 * 1000;

export type ContactLockReason = 'upload' | 'success';

export interface ContactLockInfo {
    userId?: string;
    userName?: string;
    until: string;
    reason: ContactLockReason;
}

export class ContactLockError extends Error {
    readonly lock: ContactLockInfo;

    constructor(lock: ContactLockInfo) {
        super('CONTACT_LOCKED');
        this.name = 'ContactLockError';
        this.lock = lock;
    }
}

export interface ContactLockCandidateRow {
    contact_lock_user_id?: string | null;
    contact_lock_user_name?: string | null;
    contact_lock_until?: string | null;
    contact_lock_reason?: string | null;
    created_by?: string | null;
    created_at?: string | null;
    registration_origin?: string | null;
}

function isContactLockReason(value: unknown): value is ContactLockReason {
    return value === 'upload' || value === 'success';
}

export function isSuccessfulContactOutcome(outcome: ContactOutcome): boolean {
    return outcome === 'answered' || outcome === 'interested';
}

export function shouldApplySuccessContactLock(
    newStatus: ContactStatus,
    outcome: ContactOutcome
): boolean {
    return newStatus === 'interesado' || isSuccessfulContactOutcome(outcome);
}

export function buildContactLockUpdate(
    userId: string | undefined,
    userName: string | undefined,
    reason: ContactLockReason,
    durationMs: number,
    now = Date.now()
): Record<string, string | null> {
    return {
        contact_lock_user_id: userId || null,
        contact_lock_user_name: userName?.trim() || null,
        contact_lock_until: new Date(now + durationMs).toISOString(),
        contact_lock_reason: reason,
    };
}

export function buildUploadContactLockUpdate(
    userId: string | undefined,
    userName: string | undefined,
    now = Date.now()
): Record<string, string | null> {
    return buildContactLockUpdate(userId, userName, 'upload', CONTACT_UPLOAD_LOCK_MS, now);
}

export function buildSuccessContactLockUpdate(
    userId: string | undefined,
    userName: string | undefined,
    now = Date.now()
): Record<string, string | null> {
    return buildContactLockUpdate(userId, userName, 'success', CONTACT_SUCCESS_LOCK_MS, now);
}

/** Lock persistido en BD si sigue vigente */
export function readPersistedContactLock(
    row: ContactLockCandidateRow,
    nowMs = Date.now()
): ContactLockInfo | null {
    if (!row.contact_lock_until || !row.contact_lock_user_id) return null;
    const untilMs = new Date(row.contact_lock_until).getTime();
    if (!Number.isFinite(untilMs) || untilMs <= nowMs) return null;
    if (!isContactLockReason(row.contact_lock_reason)) return null;
    return {
        userId: row.contact_lock_user_id,
        userName: row.contact_lock_user_name || undefined,
        until: row.contact_lock_until,
        reason: row.contact_lock_reason,
    };
}

/** Lock de 30 min para registros manual/masivo subidos por un reclutador */
export function readUploadContactLockFallback(
    row: ContactLockCandidateRow,
    nowMs = Date.now()
): ContactLockInfo | null {
    const origin = row.registration_origin as CandidateRegistrationOrigin | undefined;
    if (origin !== 'manual' && origin !== 'masivo') return null;
    if (!row.created_by || !row.created_at) return null;

    const startMs = new Date(row.created_at).getTime();
    if (!Number.isFinite(startMs)) return null;

    const untilMs = startMs + CONTACT_UPLOAD_LOCK_MS;
    if (untilMs <= nowMs) return null;

    return {
        userId: row.created_by,
        until: new Date(untilMs).toISOString(),
        reason: 'upload',
    };
}

/** Devuelve la reserva activa más restrictiva (la que expira más tarde) */
export function resolveActiveContactLock(
    row: ContactLockCandidateRow,
    nowMs = Date.now()
): ContactLockInfo | null {
    const candidates: ContactLockInfo[] = [];
    const persisted = readPersistedContactLock(row, nowMs);
    if (persisted) candidates.push(persisted);

    const uploadFallback = readUploadContactLockFallback(row, nowMs);
    if (uploadFallback) {
        const duplicatePersisted =
            persisted?.reason === 'upload' &&
            persisted.userId === uploadFallback.userId;
        if (!duplicatePersisted) candidates.push(uploadFallback);
    }

    if (candidates.length === 0) return null;

    candidates.sort(
        (a, b) => new Date(b.until).getTime() - new Date(a.until).getTime()
    );
    return candidates[0];
}

export function isContactLockedForUser(
    lock: ContactLockInfo | null | undefined,
    currentUserId?: string | null
): boolean {
    if (!lock) return false;
    if (!lock.userId) return true;
    if (!currentUserId) return true;
    return lock.userId !== currentUserId;
}

export function formatContactLockMessage(lock: ContactLockInfo): string {
    const who = lock.userName?.trim() || 'otro reclutador';
    const mins = Math.max(1, Math.ceil((new Date(lock.until).getTime() - Date.now()) / 60_000));
    if (lock.reason === 'upload') {
        return `Reservado por ${who} (${mins} min) — registro que subió al proceso`;
    }
    return `Contacto exitoso de ${who} — reservado ${mins} min más`;
}

export function mergeContactLockUpdate(
    existing: ContactLockCandidateRow,
    next: Record<string, string | null>,
    nowMs = Date.now()
): Record<string, string | null> {
    const current = readPersistedContactLock(existing, nowMs);
    const nextUntil = next.contact_lock_until
        ? new Date(next.contact_lock_until).getTime()
        : 0;
    const currentUntil = current ? new Date(current.until).getTime() : 0;

    if (!current || nextUntil >= currentUntil) return next;
    return {};
}
