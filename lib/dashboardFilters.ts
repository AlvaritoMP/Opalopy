import type { ContactConsultantPeriod } from './contactDashboardStats';

export interface DashboardFiltersState {
    processFilter: string;
    processScopeFilter: 'all' | 'bulk' | 'standard';
    dateFilter: { start: string; end: string };
    contactConsultantPeriod: ContactConsultantPeriod;
}

export const DEFAULT_DASHBOARD_FILTERS: DashboardFiltersState = {
    processFilter: 'all',
    processScopeFilter: 'all',
    dateFilter: { start: '', end: '' },
    contactConsultantPeriod: 'month',
};

const STORAGE_PREFIX = 'dashboardFilters';

export function getDashboardFiltersStorageKey(userId?: string | null): string {
    return userId ? `${STORAGE_PREFIX}_${userId}` : STORAGE_PREFIX;
}

export function loadDashboardFilters(userId?: string | null): DashboardFiltersState {
    try {
        const raw = localStorage.getItem(getDashboardFiltersStorageKey(userId));
        if (!raw) return { ...DEFAULT_DASHBOARD_FILTERS };
        const parsed = JSON.parse(raw) as Partial<DashboardFiltersState>;
        return {
            processFilter: typeof parsed.processFilter === 'string' ? parsed.processFilter : 'all',
            processScopeFilter:
                parsed.processScopeFilter === 'bulk' || parsed.processScopeFilter === 'standard'
                    ? parsed.processScopeFilter
                    : 'all',
            dateFilter: {
                start: parsed.dateFilter?.start ?? '',
                end: parsed.dateFilter?.end ?? '',
            },
            contactConsultantPeriod:
                parsed.contactConsultantPeriod === 'week' ||
                parsed.contactConsultantPeriod === 'year'
                    ? parsed.contactConsultantPeriod
                    : 'month',
        };
    } catch {
        return { ...DEFAULT_DASHBOARD_FILTERS };
    }
}

export function saveDashboardFilters(filters: DashboardFiltersState, userId?: string | null): void {
    try {
        localStorage.setItem(getDashboardFiltersStorageKey(userId), JSON.stringify(filters));
    } catch {
        /* ignore quota / private mode */
    }
}

/** Descarta un proceso seleccionado que ya no existe en el alcance actual. */
export function sanitizeDashboardProcessFilter(
    filters: DashboardFiltersState,
    validProcessIds: Set<string>
): DashboardFiltersState {
    if (filters.processFilter === 'all') return filters;
    if (validProcessIds.has(filters.processFilter)) return filters;
    return { ...filters, processFilter: 'all' };
}
