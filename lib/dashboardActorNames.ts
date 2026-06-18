import type { User } from '../types';
import type { ContactAttempt } from './contactTracking';

export type DashboardActorUser = Pick<User, 'id' | 'name' | 'email' | 'role'>;

/** Roles que pueden aparecer en rankings del panel (consultores + administrador). */
export function isDashboardStaffRole(role?: User['role']): boolean {
    return role === 'admin' || role === 'recruiter';
}

/** Asegura que el usuario en sesión (p. ej. admin) esté en el lookup aunque falte en la lista cargada. */
export function buildUserLookupForStats(
    users: DashboardActorUser[],
    currentUser?: DashboardActorUser | null
): DashboardActorUser[] {
    if (!currentUser?.id) return users;
    if (users.some(u => u.id === currentUser.id)) return users;
    return [...users, currentUser];
}

const GENERIC_ACTOR_LABELS = new Set(['', 'Usuario', 'Sin consultor', 'usuario']);

function normalizePersonKey(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');
}

function personNameTokens(name: string): string[] {
    return normalizePersonKey(name).split(' ').filter(Boolean);
}

function personNamesLooselyMatch(a: string, b: string): boolean {
    const na = normalizePersonKey(a);
    const nb = normalizePersonKey(b);
    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;
    const ta = personNameTokens(a);
    const tb = personNameTokens(b);
    if (ta.length === 0 || tb.length === 0) return false;
    const firstA = ta[0];
    const firstB = tb[0];
    const lastA = ta[ta.length - 1];
    const lastB = tb[tb.length - 1];
    return firstA === firstB && lastA === lastB;
}

function findUserByLooseName(users: DashboardActorUser[], raw: string): DashboardActorUser | undefined {
    const norm = normalizePersonKey(raw);
    if (!norm) return undefined;
    const exact = users.find(u => {
        const name = u.name?.trim();
        if (name && normalizePersonKey(name) === norm) return true;
        const email = u.email?.trim().toLowerCase();
        const local = email?.split('@')[0];
        return email === norm || local === norm;
    });
    if (exact) return exact;
    return users.find(u => u.name?.trim() && personNamesLooselyMatch(u.name, raw));
}

export function resolveActorDisplayName(
    actor: { userId?: string; userName?: string },
    users: DashboardActorUser[]
): string {
    if (actor.userId) {
        const byId = users.find(u => u.id === actor.userId);
        if (byId?.name?.trim()) return byId.name.trim();
        if (byId?.email?.trim()) {
            const local = byId.email.trim().split('@')[0];
            if (local) return local;
        }
    }

    const trimmed = actor.userName?.trim();
    if (trimmed && !GENERIC_ACTOR_LABELS.has(trimmed)) {
        const matched = findUserByLooseName(users, trimmed);
        if (matched?.name?.trim()) return matched.name.trim();
        return trimmed;
    }

    return 'Sin consultor';
}

export function enrichContactAttemptsForStats(
    attempts: ContactAttempt[],
    users: DashboardActorUser[]
): ContactAttempt[] {
    return attempts.map(a => ({
        ...a,
        userName: resolveActorDisplayName({ userId: a.userId, userName: a.userName }, users),
    }));
}
