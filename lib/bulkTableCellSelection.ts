import type { CellCoord } from './bulkTableTypes';

export const BULK_CELL_ACTIVE_ATTR = 'data-bulk-cell-active';
export const BULK_CELL_SELECTED_ATTR = 'data-bulk-cell-selected';

export function parseBulkCellKey(key: string): CellCoord {
    const sep = key.indexOf('::');
    return { candidateId: key.slice(0, sep), colId: key.slice(sep + 2) };
}

export function toBulkCellKey(coord: CellCoord): string {
    return `${coord.candidateId}::${coord.colId}`;
}

function findCellElement(container: HTMLElement, coord: CellCoord): HTMLElement | null {
    return container.querySelector(
        `[data-cell-row="${coord.candidateId}"][data-cell-col="${coord.colId}"]`
    ) as HTMLElement | null;
}

type SelectionCache = {
    activeEl: HTMLElement | null;
    activeKey: string | null;
    selectedEls: Map<string, HTMLElement>;
};

const selectionCache = new WeakMap<HTMLElement, SelectionCache>();

function getSelectionCache(container: HTMLElement): SelectionCache {
    let cache = selectionCache.get(container);
    if (!cache) {
        cache = { activeEl: null, activeKey: null, selectedEls: new Map() };
        selectionCache.set(container, cache);
    }
    return cache;
}

function clearDomSelection(container: HTMLElement, cache: SelectionCache): void {
    if (cache.activeEl) {
        cache.activeEl.removeAttribute(BULK_CELL_ACTIVE_ATTR);
        cache.activeEl = null;
        cache.activeKey = null;
    }
    for (const el of cache.selectedEls.values()) {
        el.removeAttribute(BULK_CELL_SELECTED_ATTR);
    }
    cache.selectedEls.clear();
}

/** Movimiento celda a celda sin barrer todo el DOM (navegación con flechas). */
function applySingleCellMove(
    container: HTMLElement,
    cache: SelectionCache,
    active: CellCoord,
    activeKey: string
): void {
    if (cache.activeEl) {
        cache.activeEl.removeAttribute(BULK_CELL_ACTIVE_ATTR);
    }
    for (const el of cache.selectedEls.values()) {
        el.removeAttribute(BULK_CELL_SELECTED_ATTR);
    }
    cache.selectedEls.clear();

    const el = findCellElement(container, active);
    el?.setAttribute(BULK_CELL_ACTIVE_ATTR, 'true');
    cache.activeEl = el;
    cache.activeKey = activeKey;
}

function canUseSingleCellFastPath(
    active: CellCoord | null,
    selected: Set<string>,
    cache: SelectionCache
): active is CellCoord {
    if (!active || selected.size !== 1) return false;
    const activeKey = toBulkCellKey(active);
    if (!selected.has(activeKey)) return false;
    if (cache.activeKey === activeKey) return false;
    return true;
}

/** Resalta celdas en el DOM de inmediato, sin esperar al re-render de React. */
export function applyBulkCellDomSelection(
    container: HTMLElement | null,
    active: CellCoord | null,
    selected: Set<string>
): void {
    if (!container) return;

    const cache = getSelectionCache(container);

    if (canUseSingleCellFastPath(active, selected, cache)) {
        applySingleCellMove(container, cache, active, toBulkCellKey(active));
        return;
    }

    clearDomSelection(container, cache);

    if (active) {
        const activeKey = toBulkCellKey(active);
        const el = findCellElement(container, active);
        el?.setAttribute(BULK_CELL_ACTIVE_ATTR, 'true');
        cache.activeEl = el;
        cache.activeKey = activeKey;
    }

    for (const key of selected) {
        const coord = parseBulkCellKey(key);
        if (active && coord.candidateId === active.candidateId && coord.colId === active.colId) {
            continue;
        }
        const el = findCellElement(container, coord);
        if (el) {
            el.setAttribute(BULK_CELL_SELECTED_ATTR, 'true');
            cache.selectedEls.set(key, el);
        }
    }
}

/** Desplaza la celda activa al viewport sin relayout completo de la tabla. */
export function scrollBulkCellIntoView(
    container: HTMLElement | null,
    coord: CellCoord,
    stickyLeftPx = 0,
    headerHeightPx = 0
): void {
    if (!container) return;
    const el = findCellElement(container, coord);
    if (!el) return;

    const padding = 4;
    const containerRect = container.getBoundingClientRect();
    const cellRect = el.getBoundingClientRect();

    const topBound = containerRect.top + headerHeightPx + padding;
    const bottomBound = containerRect.bottom - padding;
    if (cellRect.top < topBound) {
        container.scrollTop -= topBound - cellRect.top;
    } else if (cellRect.bottom > bottomBound) {
        container.scrollTop += cellRect.bottom - bottomBound;
    }

    const leftBound = containerRect.left + stickyLeftPx + padding;
    const rightBound = containerRect.right - padding;
    const updatedLeft = el.getBoundingClientRect().left;
    const updatedRight = el.getBoundingClientRect().right;
    if (updatedLeft < leftBound) {
        container.scrollLeft -= leftBound - updatedLeft;
    } else if (updatedRight > rightBound) {
        container.scrollLeft += updatedRight - rightBound;
    }
}

export function clearBulkCellDomSelection(container: HTMLElement | null): void {
    if (!container) return;
    const cache = getSelectionCache(container);
    clearDomSelection(container, cache);
}
