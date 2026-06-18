import { supabase } from '../supabase';
import { APP_NAME } from '../appConfig';
import {
    type BulkTableTemplate,
    type BulkTableTemplateLayout,
    writeBulkTableTemplatesCache,
    readBulkTableTemplatesCache,
    isLegacyLocalTemplateId,
} from '../bulkTableTemplates';

const TABLE = 'bulk_table_templates';

type LayoutRow = BulkTableTemplateLayout & Record<string, unknown>;

function mapRow(row: Record<string, unknown>): BulkTableTemplate {
    const layout = (row.layout as LayoutRow) || {};
    return {
        id: row.id as string,
        name: row.name as string,
        createdAt: row.created_at as string,
        createdBy: (row.created_by as string) || undefined,
        createdByName: (row.created_by_name as string) || undefined,
        columns: layout.columns || [],
        columnOrder: layout.columnOrder || [],
        hiddenColumns: layout.hiddenColumns || [],
        pinnedColumns: layout.pinnedColumns || [],
        columnWidths: layout.columnWidths || {},
    };
}

function layoutPayload(layout: BulkTableTemplateLayout): LayoutRow {
    return {
        columns: layout.columns,
        columnOrder: layout.columnOrder,
        hiddenColumns: layout.hiddenColumns,
        pinnedColumns: layout.pinnedColumns,
        columnWidths: layout.columnWidths,
    };
}

let remoteSupported: boolean | null = null;

function isMissingTableError(error: { code?: string; message?: string }): boolean {
    const msg = (error.message || '').toLowerCase();
    return (
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        msg.includes('bulk_table_templates') ||
        msg.includes('does not exist')
    );
}

export const bulkTableTemplatesApi = {
    isRemoteEnabled(): boolean {
        return remoteSupported !== false;
    },

    async getAll(): Promise<BulkTableTemplate[]> {
        if (remoteSupported === false) {
            return readBulkTableTemplatesCache();
        }

        const { data, error } = await supabase
            .from(TABLE)
            .select('id, name, layout, created_by, created_by_name, created_at')
            .eq('app_name', APP_NAME)
            .order('created_at', { ascending: false });

        if (error) {
            if (isMissingTableError(error)) {
                remoteSupported = false;
                return readBulkTableTemplatesCache();
            }
            throw error;
        }

        remoteSupported = true;
        const templates = (data || []).map(mapRow);
        writeBulkTableTemplatesCache(templates);
        return templates;
    },

    async create(
        name: string,
        layout: BulkTableTemplateLayout,
        actor?: { id?: string; name?: string }
    ): Promise<BulkTableTemplate> {
        const row = {
            name: name.trim(),
            layout: layoutPayload(layout),
            created_by: actor?.id || null,
            created_by_name: actor?.name || null,
            app_name: APP_NAME,
        };

        if (remoteSupported === false) {
            const template: BulkTableTemplate = {
                id: `template_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                name: row.name,
                ...layout,
                createdAt: new Date().toISOString(),
                createdBy: actor?.id,
                createdByName: actor?.name,
            };
            const updated = [template, ...readBulkTableTemplatesCache()];
            writeBulkTableTemplatesCache(updated);
            return template;
        }

        const { data, error } = await supabase.from(TABLE).insert(row).select().single();

        if (error) {
            if (isMissingTableError(error)) {
                remoteSupported = false;
                return this.create(name, layout, actor);
            }
            throw error;
        }

        remoteSupported = true;
        const template = mapRow(data as Record<string, unknown>);
        const cached = readBulkTableTemplatesCache().filter(t => t.id !== template.id);
        writeBulkTableTemplatesCache([template, ...cached]);
        return template;
    },

    async delete(id: string): Promise<void> {
        if (remoteSupported === false || isLegacyLocalTemplateId(id)) {
            writeBulkTableTemplatesCache(readBulkTableTemplatesCache().filter(t => t.id !== id));
            if (remoteSupported === false || isLegacyLocalTemplateId(id)) return;
        }

        const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('app_name', APP_NAME);

        if (error) {
            if (isMissingTableError(error)) {
                remoteSupported = false;
                writeBulkTableTemplatesCache(readBulkTableTemplatesCache().filter(t => t.id !== id));
                return;
            }
            throw error;
        }

        writeBulkTableTemplatesCache(readBulkTableTemplatesCache().filter(t => t.id !== id));
    },

    async refreshCache(actor?: { id?: string; name?: string }): Promise<BulkTableTemplate[]> {
        const localBefore = readBulkTableTemplatesCache();
        const legacy = localBefore.filter(t => isLegacyLocalTemplateId(t.id));

        try {
            const remote = await this.getAll();

            if (remoteSupported !== false && legacy.length > 0) {
                for (const t of legacy) {
                    const already = remote.some(
                        r => r.name === t.name && (r.columns?.length || 0) === (t.columns?.length || 0)
                    );
                    if (already) continue;
                    try {
                        await this.create(t.name, t, actor);
                    } catch {
                        /* continuar */
                    }
                }
                return this.getAll();
            }

            return remote;
        } catch {
            return localBefore.length > 0 ? localBefore : readBulkTableTemplatesCache();
        }
    },
};
