export interface BulkCellMeta {
    bgColor?: string;
    comment?: string;
}

export type BulkCellMetaStore = Record<string, Record<string, BulkCellMeta>>;

export const CELL_COLOR_PRESETS: { id: string; label: string; value: string }[] = [
    { id: 'none', label: 'Sin color', value: '' },
    { id: 'yellow', label: 'Amarillo', value: '#FEF9C3' },
    { id: 'green', label: 'Verde', value: '#DCFCE7' },
    { id: 'blue', label: 'Azul', value: '#DBEAFE' },
    { id: 'pink', label: 'Rosa', value: '#FCE7F3' },
    { id: 'orange', label: 'Naranja', value: '#FFEDD5' },
    { id: 'purple', label: 'Morado', value: '#EDE9FE' },
    { id: 'gray', label: 'Gris', value: '#F3F4F6' },
];

export function getCellMetaStorageKey(processId: string): string {
    return `bulkCellMeta_${processId}`;
}

export function getCellMetaKey(candidateId: string, colId: string): string {
    return `${candidateId}::${colId}`;
}

export function parseCellMetaKey(key: string): { candidateId: string; colId: string } {
    const sep = key.indexOf('::');
    return { candidateId: key.slice(0, sep), colId: key.slice(sep + 2) };
}
