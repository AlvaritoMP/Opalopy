export const SESSION_USER_KEY = 'ats_pro_user';
export const SESSION_ACTIVITY_KEY = 'ats_pro_last_activity';
export const SESSION_EXPIRED_NOTICE_KEY = 'ats_session_expired_notice';

/** 1 hora de inactividad antes de cerrar sesión automáticamente */
export const SESSION_INACTIVITY_MS = 60 * 60 * 1000;

export function getStoredUserId(): string | null {
    return localStorage.getItem(SESSION_USER_KEY);
}

export function getSessionActivityAt(): number | null {
    const raw = localStorage.getItem(SESSION_ACTIVITY_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

export function touchSessionActivity(now = Date.now()): void {
    localStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
}

/** Sesiones previas sin marca de actividad: iniciar el reloj desde ahora (no expulsar al desplegar). */
export function ensureSessionActivityBaseline(): void {
    if (getStoredUserId() && getSessionActivityAt() === null) {
        touchSessionActivity();
    }
}

export function isSessionExpired(now = Date.now()): boolean {
    const userId = getStoredUserId();
    if (!userId) return false;
    const last = getSessionActivityAt();
    if (last === null) return false;
    return now - last > SESSION_INACTIVITY_MS;
}

export function establishSession(userId: string): void {
    localStorage.setItem(SESSION_USER_KEY, userId);
    touchSessionActivity();
}

export function clearStoredSession(): void {
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(SESSION_ACTIVITY_KEY);
}

export function markSessionExpiredNotice(): void {
    try {
        sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, '1');
    } catch {
        /* ignore */
    }
}

export function consumeSessionExpiredNotice(): boolean {
    try {
        const had = sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY) === '1';
        if (had) sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
        return had;
    } catch {
        return false;
    }
}

export function expireSessionDueToInactivity(): void {
    markSessionExpiredNotice();
    clearStoredSession();
}
