import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Loader2, RefreshCw, ChevronDown, ChevronUp, User, Filter } from 'lucide-react';
import {
    bulkProcessActivityApi,
    BulkProcessActivityEntry,
    BulkActivityActionType,
} from '../lib/api/bulkProcessActivity';

const ACTION_LABELS: Record<BulkActivityActionType, string> = {
    cell_edit: 'Edición de celda',
    stage_change: 'Cambio de etapa',
    bulk_stage_change: 'Cambio de etapa masivo',
    bulk_discard: 'Descarte masivo',
    bulk_archive: 'Archivado masivo',
    bulk_approve: 'Aprobación masiva',
    candidate_delete: 'Eliminación de candidato',
    import: 'Importación',
    config_change: 'Configuración',
    cell_meta: 'Color/comentario de celda',
    paste: 'Pegado en celdas',
    contact_attempt: 'Intento de contacto',
    contact_status: 'Estado de contacto',
    contact_reset: 'Reinicio de contacto',
    add_row: 'Fila añadida',
    opsflow_send: 'Envío a OpsFlow',
    candidate_transfer: 'Traslado entre procesos',
};

interface BulkProcessActivityLogProps {
    processId: string;
    refreshToken?: number;
    /** footer = barra colapsable inferior; standalone = contenido para modal */
    variant?: 'footer' | 'standalone';
}

export const BulkProcessActivityLog: React.FC<BulkProcessActivityLogProps> = ({
    processId,
    refreshToken = 0,
    variant = 'footer',
}) => {
    const [expanded, setExpanded] = useState(variant === 'standalone');
    const [entries, setEntries] = useState<BulkProcessActivityEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [userFilter, setUserFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');

    const loadEntries = useCallback(async () => {
        if (!processId) return;
        setIsLoading(true);
        setLoadError(null);
        try {
            const data = await bulkProcessActivityApi.getByProcess(processId);
            setEntries(data);
        } catch (err: any) {
            const msg = err?.message || 'Error desconocido';
            if (msg.includes('bulk_process_activity_log') || msg.includes('schema cache') || msg.includes('Could not find')) {
                setLoadError('Ejecute MIGRATION_ADD_BULK_PROCESS_ACTIVITY_LOG.sql en Supabase para habilitar el historial.');
            } else {
                setLoadError('No se pudo cargar el historial de cambios.');
            }
            setEntries([]);
        } finally {
            setIsLoading(false);
        }
    }, [processId]);

    useEffect(() => {
        if (variant === 'standalone' || expanded) {
            void loadEntries();
        }
    }, [variant, expanded, loadEntries, refreshToken]);

    const uniqueUsers = useMemo(() => {
        const names = new Set<string>();
        entries.forEach(e => {
            if (e.userName) names.add(e.userName);
        });
        return Array.from(names).sort((a, b) => a.localeCompare(b, 'es'));
    }, [entries]);

    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            if (userFilter && e.userName !== userFilter) return false;
            if (actionFilter && e.actionType !== actionFilter) return false;
            return true;
        });
    }, [entries, userFilter, actionFilter]);

    const formatDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleString('es-PE', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return iso;
        }
    };

    const describeEntry = (entry: BulkProcessActivityEntry) => {
        const parts: string[] = [];
        if (entry.candidateName) {
            parts.push(entry.candidateName);
        }
        if (entry.fieldName) {
            parts.push(`campo «${entry.fieldName}»`);
        }
        if (entry.oldValue != null || entry.newValue != null) {
            const from = entry.oldValue != null && entry.oldValue !== '' ? `"${entry.oldValue}"` : '(vacío)';
            const to = entry.newValue != null && entry.newValue !== '' ? `"${entry.newValue}"` : '(vacío)';
            parts.push(`${from} → ${to}`);
        } else if (entry.details?.count != null) {
            parts.push(`${entry.details.count} candidato(s)`);
        } else if (entry.details?.summary) {
            parts.push(String(entry.details.summary));
        }
        return parts.join(' · ') || '—';
    };

    const panelContent = (
        <div className={variant === 'footer' ? 'px-4 pb-4 space-y-3' : 'px-4 py-4 space-y-3'}>
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-gray-400" />
                    <select
                        value={userFilter}
                        onChange={e => setUserFilter(e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                    >
                        <option value="">Todos los usuarios</option>
                        {uniqueUsers.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                </div>
                <select
                    value={actionFilter}
                    onChange={e => setActionFilter(e.target.value)}
                    className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                >
                    <option value="">Todas las acciones</option>
                    {Object.entries(ACTION_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => void loadEntries()}
                    disabled={isLoading}
                    className="flex items-center gap-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Actualizar
                </button>
            </div>

            {loadError && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    {loadError}
                </p>
            )}

            {!loadError && !isLoading && filteredEntries.length === 0 && (
                <p className="text-xs text-gray-500 py-4 text-center">
                    No hay registros de actividad todavía.
                </p>
            )}

            {isLoading && entries.length === 0 && (
                <div className="flex items-center justify-center py-6 text-gray-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Cargando historial…
                </div>
            )}

            {filteredEntries.length > 0 && (
                <div className={`overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y divide-gray-100 ${variant === 'standalone' ? 'max-h-[55vh]' : 'max-h-48'}`}>
                    {filteredEntries.map(entry => (
                        <div key={entry.id} className="px-3 py-2 text-xs hover:bg-gray-50">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <span className="font-medium text-primary-700">
                                            {ACTION_LABELS[entry.actionType] || entry.actionType}
                                        </span>
                                        <span className="text-gray-400">·</span>
                                        <span className="flex items-center gap-1 text-gray-600">
                                            <User className="w-3 h-3 shrink-0" />
                                            {entry.userName || 'Usuario desconocido'}
                                        </span>
                                    </div>
                                    <p className="text-gray-600 mt-0.5 truncate" title={describeEntry(entry)}>
                                        {describeEntry(entry)}
                                    </p>
                                </div>
                                <time className="text-gray-400 whitespace-nowrap shrink-0">
                                    {formatDate(entry.createdAt)}
                                </time>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    if (variant === 'standalone') {
        return panelContent;
    }

    return (
        <div className="border-t border-gray-200 bg-gray-50 shrink-0">
            <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
                <span className="flex items-center gap-2">
                    <History className="w-4 h-4 text-primary-600" />
                    Historial de cambios
                    {entries.length > 0 && !expanded && (
                        <span className="text-xs font-normal text-gray-500">({entries.length} registros)</span>
                    )}
                </span>
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {expanded && panelContent}
        </div>
    );
};
