import type { CustomColumn } from '../types';

export interface BulkTableTemplateLayout {
    columns: CustomColumn[];
    columnOrder: string[];
    hiddenColumns: string[];
    pinnedColumns: string[];
    columnWidths: Record<string, number>;
}

export interface BulkTableTemplate extends BulkTableTemplateLayout {
    id: string;
    name: string;
    createdAt: string;
    createdBy?: string;
    createdByName?: string;
}

export const BULK_TABLE_TEMPLATES_CACHE_KEY = 'bulkProcessesTableTemplates';

export function readBulkTableTemplatesCache(): BulkTableTemplate[] {
    try {
        const raw = localStorage.getItem(BULK_TABLE_TEMPLATES_CACHE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as BulkTableTemplate[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeBulkTableTemplatesCache(templates: BulkTableTemplate[]): void {
    try {
        localStorage.setItem(BULK_TABLE_TEMPLATES_CACHE_KEY, JSON.stringify(templates));
    } catch {
        /* ignore quota */
    }
}

/** Plantillas guardadas solo en este navegador (id legacy). */
export function isLegacyLocalTemplateId(id: string): boolean {
    return id.startsWith('template_');
}
