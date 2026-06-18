import type { BulkCellMeta } from './bulkCellMeta';

export const BULK_UNDO_MAX_STACK = 50;

export interface BulkUndoCellSnapshot {
    candidateId: string;
    colId: string;
    kind: 'standard' | 'custom';
    previousValue: unknown;
}

export interface BulkUndoCellMetaSnapshot {
    candidateId: string;
    colId: string;
    previous: BulkCellMeta | undefined;
}

export interface BulkUndoStatusSnapshot {
    candidateId: string;
    stageId?: string;
    discarded?: boolean;
    archived?: boolean;
}

export type BulkUndoEntryPayload =
    | { label: string; type: 'cells'; cells: BulkUndoCellSnapshot[] }
    | { label: string; type: 'cell_meta'; cells: BulkUndoCellMetaSnapshot[] }
    | { label: string; type: 'candidate_status'; changes: BulkUndoStatusSnapshot[] };

export type BulkUndoEntry = BulkUndoEntryPayload & { id: string };

export function createUndoEntryId(): string {
    return `undo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function cloneCellMeta(meta: BulkCellMeta | undefined): BulkCellMeta | undefined {
    if (!meta) return undefined;
    return { ...meta };
}
