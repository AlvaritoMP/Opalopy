import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Archive,
    Calendar,
    CheckCircle,
    ClipboardList,
    FileText,
    Filter,
    Loader2,
    Package,
    Phone,
    RefreshCw,
    UserPlus,
    XCircle,
    ArrowRight,
    Edit3,
    AlertCircle,
} from 'lucide-react';
import {
    bulkCandidateTimelineApi,
    BulkTimelineEvent,
    BulkTimelineEventKind,
    BulkChecklistSummary,
} from '../lib/api/bulkCandidateTimeline';
import type { Process } from '../types';

const KIND_META: Record<
    BulkTimelineEventKind,
    { label: string; icon: React.ElementType; dotClass: string; bgClass: string }
> = {
    incorporation: { label: 'Ingreso', icon: UserPlus, dotClass: 'bg-blue-500', bgClass: 'bg-blue-50 text-blue-800' },
    stage_change: { label: 'Etapa', icon: ArrowRight, dotClass: 'bg-indigo-500', bgClass: 'bg-indigo-50 text-indigo-800' },
    edit: { label: 'Edición', icon: Edit3, dotClass: 'bg-slate-500', bgClass: 'bg-slate-50 text-slate-800' },
    contact: { label: 'Contacto', icon: Phone, dotClass: 'bg-cyan-500', bgClass: 'bg-cyan-50 text-cyan-800' },
    document: { label: 'Documento', icon: FileText, dotClass: 'bg-emerald-500', bgClass: 'bg-emerald-50 text-emerald-800' },
    interview: { label: 'Entrevista', icon: Calendar, dotClass: 'bg-violet-500', bgClass: 'bg-violet-50 text-violet-800' },
    psycholaboral: { label: 'Psicolaboral', icon: ClipboardList, dotClass: 'bg-teal-500', bgClass: 'bg-teal-50 text-teal-800' },
    opsflow: { label: 'OpsFlow', icon: Package, dotClass: 'bg-orange-500', bgClass: 'bg-orange-50 text-orange-800' },
    discard: { label: 'Descarte', icon: XCircle, dotClass: 'bg-red-500', bgClass: 'bg-red-50 text-red-800' },
    archive: { label: 'Archivo', icon: Archive, dotClass: 'bg-gray-500', bgClass: 'bg-gray-100 text-gray-800' },
    approval: { label: 'Aprobación', icon: CheckCircle, dotClass: 'bg-green-500', bgClass: 'bg-green-50 text-green-800' },
    import: { label: 'Importación', icon: UserPlus, dotClass: 'bg-blue-400', bgClass: 'bg-blue-50 text-blue-700' },
    other: { label: 'Otro', icon: Edit3, dotClass: 'bg-gray-400', bgClass: 'bg-gray-50 text-gray-700' },
};

interface BulkCandidateTimelineProps {
    candidateId: string;
    process?: Process;
    userNameById?: Map<string, string>;
    refreshToken?: number;
}

function formatDateTime(iso: string): string {
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
}

const ChecklistSummary: React.FC<{ checklist: BulkChecklistSummary; stageName?: string }> = ({
    checklist,
    stageName,
}) => (
    <div className={`rounded-lg border p-4 ${checklist.canAdvanceStage ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-start gap-2 mb-3">
            {checklist.canAdvanceStage ? (
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
                <h4 className="text-sm font-semibold text-gray-900">Checklist documental</h4>
                <p className="text-xs text-gray-600 mt-0.5">
                    {checklist.completeRequired}/{checklist.requiredTotal} requeridos completos
                    {stageName ? ` · Etapa actual: ${stageName}` : ''}
                </p>
                {!checklist.canAdvanceStage && checklist.missingForStage.length > 0 && (
                    <p className="text-xs text-amber-800 mt-1">
                        Faltan para avanzar: {checklist.missingForStage.join(', ')}
                    </p>
                )}
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {checklist.items.map(item => (
                <div
                    key={item.categoryId}
                    className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${
                        item.complete ? 'bg-white/80 text-gray-700' : item.required ? 'bg-white text-amber-900' : 'bg-white/60 text-gray-500'
                    }`}
                >
                    {item.complete ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    ) : (
                        <XCircle className={`w-3.5 h-3.5 shrink-0 ${item.required ? 'text-amber-600' : 'text-gray-300'}`} />
                    )}
                    <span className="truncate">
                        {item.categoryName}
                        {item.documentCount > 0 ? ` (${item.documentCount})` : ''}
                        {item.required ? ' *' : ''}
                    </span>
                </div>
            ))}
        </div>
    </div>
);

export const BulkCandidateTimeline: React.FC<BulkCandidateTimelineProps> = ({
    candidateId,
    process,
    userNameById,
    refreshToken = 0,
}) => {
    const [events, setEvents] = useState<BulkTimelineEvent[]>([]);
    const [checklist, setChecklist] = useState<BulkChecklistSummary | null>(null);
    const [statusLabel, setStatusLabel] = useState<string | undefined>();
    const [currentStageName, setCurrentStageName] = useState<string | undefined>();
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [kindFilter, setKindFilter] = useState<BulkTimelineEventKind | ''>('');

    const loadTimeline = useCallback(async () => {
        if (!candidateId) return;
        setIsLoading(true);
        setLoadError(null);
        try {
            const result = await bulkCandidateTimelineApi.getTimeline(
                candidateId,
                process,
                userNameById
            );
            setEvents(result.events);
            setChecklist(result.checklist);
            setStatusLabel(result.statusLabel);
            setCurrentStageName(result.currentStageName);
        } catch {
            setLoadError('No se pudo cargar la línea de tiempo del candidato.');
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    }, [candidateId, process, userNameById]);

    useEffect(() => {
        void loadTimeline();
    }, [loadTimeline, refreshToken]);

    const filteredEvents = useMemo(() => {
        if (!kindFilter) return events;
        return events.filter(e => e.kind === kindFilter);
    }, [events, kindFilter]);

    const kindCounts = useMemo(() => {
        const counts = new Map<BulkTimelineEventKind, number>();
        for (const e of events) {
            counts.set(e.kind, (counts.get(e.kind) || 0) + 1);
        }
        return counts;
    }, [events]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Cargando línea de tiempo…
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {loadError}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {statusLabel && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-primary-50 border border-primary-100 rounded-lg">
                    <span className="text-xs font-medium text-primary-800">Estado actual</span>
                    <span className="text-sm font-semibold text-primary-900">{statusLabel}</span>
                </div>
            )}

            {checklist && (
                <ChecklistSummary checklist={checklist} stageName={currentStageName} />
            )}

            <div className="flex flex-wrap items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select
                    value={kindFilter}
                    onChange={e => setKindFilter(e.target.value as BulkTimelineEventKind | '')}
                    className="text-xs border border-gray-300 rounded px-2 py-1 bg-white flex-1 min-w-[140px]"
                >
                    <option value="">Todos los eventos ({events.length})</option>
                    {Array.from(kindCounts.entries())
                        .sort((a, b) => b[1] - a[1])
                        .map(([kind, count]) => (
                            <option key={kind} value={kind}>
                                {KIND_META[kind].label} ({count})
                            </option>
                        ))}
                </select>
                <button
                    type="button"
                    onClick={() => void loadTimeline()}
                    className="flex items-center gap-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50"
                >
                    <RefreshCw className="w-3 h-3" />
                    Actualizar
                </button>
            </div>

            {filteredEvents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                    No hay eventos registrados para este candidato.
                </p>
            ) : (
                <ol className="relative border-l-2 border-gray-200 ml-3 space-y-0">
                    {filteredEvents.map((event, idx) => {
                        const meta = KIND_META[event.kind];
                        const Icon = meta.icon;
                        const isLast = idx === filteredEvents.length - 1;
                        return (
                            <li key={event.id} className={`relative pl-6 ${isLast ? 'pb-0' : 'pb-5'}`}>
                                <span
                                    className={`absolute -left-[9px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${meta.dotClass}`}
                                />
                                <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm hover:border-gray-200 transition-colors">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${meta.bgClass}`}>
                                                    <Icon className="w-3 h-3" />
                                                    {meta.label}
                                                </span>
                                                <span className="text-sm font-medium text-gray-900">{event.title}</span>
                                            </div>
                                            {event.description && (
                                                <p className="text-xs text-gray-600 mt-0.5 break-words">{event.description}</p>
                                            )}
                                            {event.userName && (
                                                <p className="text-[11px] text-gray-400 mt-1">Por {event.userName}</p>
                                            )}
                                        </div>
                                        <time className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">
                                            {formatDateTime(event.timestamp)}
                                        </time>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
};
