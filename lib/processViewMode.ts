import { Process } from '../types';
import { APP_NAME } from './appConfig';

export type ProcessWorkMode = 'kanban' | 'table';

function storageKey(processId: string, userId?: string | null): string {
    const appSlug = APP_NAME.replace(/\s+/g, '_');
    const userSlug = userId || 'anon';
    return `processWorkMode_${appSlug}_${userSlug}_${processId}`;
}

export function getProcessWorkMode(processId: string, userId?: string | null): ProcessWorkMode {
    try {
        const raw = localStorage.getItem(storageKey(processId, userId));
        return raw === 'table' ? 'table' : 'kanban';
    } catch {
        return 'kanban';
    }
}

export function setProcessWorkMode(
    processId: string,
    userId: string | null | undefined,
    mode: ProcessWorkMode
): void {
    try {
        localStorage.setItem(storageKey(processId, userId), mode);
    } catch {
        /* ignore */
    }
}

/** Procesos específicos (no masivos) que pueden alternar a vista de tabla alta densidad. */
export function supportsHighDensityTableView(process?: Process | null): boolean {
    return !!process && process.isBulkProcess !== true;
}

/** Proceso con configuración de tabla (masivo o específico con bulkConfig). */
export function processUsesBulkTableConfig(process?: Process | null): boolean {
    if (!process) return false;
    if (process.isBulkProcess) return true;
    const cfg = process.bulkConfig;
    if (!cfg) return false;
    return !!(
        cfg.customColumns?.length ||
        cfg.columnOrder?.length ||
        cfg.highDensityTableEnabled
    );
}
