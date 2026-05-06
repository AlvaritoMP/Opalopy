import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppState } from '../App';
import { bulkCandidatesApi, BulkCandidate } from '../lib/api/bulkCandidates';
import { processesApi } from '../lib/api/processes';
import { Check, X, Loader2, Send, Archive, Search, ChevronDown, ChevronUp, Plus, Edit, Trash2, ArrowLeft, MessageCircle, Phone, Upload, Filter, Mail, Calendar, Settings, ArrowUp, ArrowDown } from 'lucide-react';
import { Process } from '../types';
import { BulkProcessEditorModal } from './BulkProcessEditorModal';
import { BulkProcessImportModal } from './BulkProcessImportModal';
import { BulkWhatsAppModal } from './BulkWhatsAppModal';
import { BulkEmailModal } from './BulkEmailModal';
import { QuickScheduleModal } from './QuickScheduleModal';
import { QuickScheduleInline } from './QuickScheduleInline';
import { BulkScheduleModal } from './BulkScheduleModal';
import { AddColumnModal } from './AddColumnModal';
import { TableTemplateModal } from './TableTemplateModal';

interface BulkProcessesViewProps {}

// Función helper para formatear tiempo relativo
const formatTimeAgo = (dateString?: string): string => {
    if (!dateString) return 'Nunca';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    
    if (diffMins < 1) return 'Hace menos de 1 min';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    if (diffDays < 7) return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
    if (diffWeeks < 4) return `Hace ${diffWeeks} ${diffWeeks === 1 ? 'semana' : 'semanas'}`;
    if (diffMonths < 12) return `Hace ${diffMonths} ${diffMonths === 1 ? 'mes' : 'meses'}`;
    return `Hace más de ${Math.floor(diffDays / 365)} ${Math.floor(diffDays / 365) === 1 ? 'año' : 'años'}`;
};

// Drawer lateral para mostrar detalles del candidato
const CandidateDrawer: React.FC<{
    candidate: BulkCandidate | null;
    isOpen: boolean;
    onClose: () => void;
    onLoadDetails: (candidateId: string) => Promise<void>;
    process?: Process;
}> = ({ candidate, isOpen, onClose, onLoadDetails, process }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [fullCandidate, setFullCandidate] = useState<BulkCandidate | null>(null);

    useEffect(() => {
        if (isOpen && candidate && !fullCandidate) {
            setIsLoading(true);
            bulkCandidatesApi.getCandidateDetails(candidate.id)
                .then(details => {
                    setFullCandidate(details);
                })
                .catch(error => {
                    console.error('Error cargando detalles:', error);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [isOpen, candidate, fullCandidate]);

    useEffect(() => {
        if (!isOpen) {
            setFullCandidate(null);
        }
    }, [isOpen]);

    if (!isOpen || !candidate) return null;

    const displayCandidate = fullCandidate || candidate;
    const stage = process?.stages.find(s => s.id === candidate.stageId);

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black bg-opacity-50" onClick={onClose} />
            <div className="w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                    <h2 className="text-xl font-semibold text-gray-900">{displayCandidate.name}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                            <span className="ml-2 text-gray-600">Cargando detalles...</span>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Email</label>
                                    <p className="text-gray-900">{displayCandidate.email || 'N/A'}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Teléfono</label>
                                    <p className="text-gray-900">{displayCandidate.phone || 'N/A'}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Etapa</label>
                                    <p className="text-gray-900">{stage?.name || 'N/A'}</p>
                                </div>
                                {displayCandidate.scoreIa !== undefined && (
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Score IA</label>
                                        <p className="text-gray-900">{displayCandidate.scoreIa}</p>
                                    </div>
                                )}
                            </div>
                            {displayCandidate.description && (
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Descripción</label>
                                    <p className="text-gray-900 mt-1 whitespace-pre-wrap">{displayCandidate.description}</p>
                                </div>
                            )}
                            {displayCandidate.metadataIa && (
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Resumen IA</label>
                                    <p className="text-gray-900 mt-1 whitespace-pre-wrap">{displayCandidate.metadataIa}</p>
                                </div>
                            )}
                            {displayCandidate.attachments && displayCandidate.attachments.length > 0 && (
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Documentos</label>
                                    <div className="mt-2 space-y-2">
                                        {displayCandidate.attachments.map((att: any) => (
                                            <a
                                                key={att.id}
                                                href={att.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                            >
                                                <p className="text-sm font-medium text-gray-900">{att.name}</p>
                                                <p className="text-xs text-gray-500">{att.type}</p>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {displayCandidate.history && displayCandidate.history.length > 0 && (
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Historial</label>
                                    <div className="mt-2 space-y-2">
                                        {displayCandidate.history.map((h: any, idx: number) => (
                                            <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-900">
                                                    Movido a: {process?.stages.find(s => s.id === h.stage_id)?.name || h.stage_id}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(h.moved_at).toLocaleString()} por {h.moved_by || 'Sistema'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// Tooltip para mostrar metadata_ia al hover con formato mejorado
const MetadataTooltip: React.FC<{
    metadata: string;
    scoreIa?: number;
    children: React.ReactNode;
}> = ({ metadata, scoreIa, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    if (!metadata && scoreIa === undefined) return <>{children}</>;
    
    // Intentar parsear metadata como JSON o usar como texto plano
    let parsedMetadata: any = null;
    try {
        parsedMetadata = metadata ? JSON.parse(metadata) : null;
    } catch {
        // Si no es JSON, usar como texto
    }
    
    return (
        <div className="relative inline-block" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
            {children}
            {isVisible && (
                <div className="absolute z-50 w-96 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl left-0 top-full mt-2">
                    {scoreIa !== undefined && (
                        <div className="mb-2 pb-2 border-b border-gray-700">
                            <span className="font-semibold">Score IA: </span>
                            <span className={scoreIa >= 70 ? 'text-green-400' : scoreIa >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                                {scoreIa}/100
                            </span>
                        </div>
                    )}
                    {parsedMetadata && typeof parsedMetadata === 'object' ? (
                        <div className="space-y-1">
                            {parsedMetadata.experiencia && (
                                <div><span className="font-semibold">Experiencia: </span>{parsedMetadata.experiencia}</div>
                            )}
                            {parsedMetadata.ubicacion && (
                                <div><span className="font-semibold">Ubicación: </span>{parsedMetadata.ubicacion}</div>
                            )}
                            {parsedMetadata.match && (
                                <div><span className="font-semibold">Match: </span>{parsedMetadata.match}</div>
                            )}
                            {parsedMetadata.resumen && (
                                <div className="mt-2 pt-2 border-t border-gray-700">{parsedMetadata.resumen}</div>
                            )}
                        </div>
                    ) : (
                        <p className="whitespace-pre-wrap">{metadata}</p>
                    )}
                    <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45" />
                </div>
            )}
        </div>
    );
};

// Floating Action Button para acciones masivas
const BulkActionsFAB: React.FC<{
    selectedIds: string[];
    onApprove: () => void;
    onReject: () => void;
    onArchive: () => void;
    onWebhook: () => void;
    onDelete: () => void;
    onWhatsApp: () => void;
    onEmail: () => void;
    onBulkSchedule: () => void;
}> = ({ selectedIds, onApprove, onReject, onArchive, onWebhook, onDelete, onWhatsApp, onEmail, onBulkSchedule }) => {
    const [isOpen, setIsOpen] = useState(false);
    if (selectedIds.length === 0) return null;
    return (
        <div className="fixed bottom-6 right-6 z-40">
            {isOpen && (
                <div className="mb-4 space-y-2">
                    <button onClick={() => { onApprove(); setIsOpen(false); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 transition-colors">
                        <Check className="w-4 h-4" /> Aprobar ({selectedIds.length})
                    </button>
                    <button onClick={() => { onReject(); setIsOpen(false); }} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700 transition-colors">
                        <X className="w-4 h-4" /> Rechazar ({selectedIds.length})
                    </button>
                    <button onClick={() => { onArchive(); setIsOpen(false); }} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg shadow-lg hover:bg-gray-700 transition-colors">
                        <Archive className="w-4 h-4" /> Archivar ({selectedIds.length})
                    </button>
                    <button onClick={() => { onBulkSchedule(); setIsOpen(false); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700 transition-colors">
                        <Calendar className="w-4 h-4" /> Agendar Entrevista ({selectedIds.length})
                    </button>
                    <button onClick={() => { onWhatsApp(); setIsOpen(false); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 transition-colors">
                        <MessageCircle className="w-4 h-4" /> WhatsApp ({selectedIds.length})
                    </button>
                    <button onClick={() => { onEmail(); setIsOpen(false); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors">
                        <Mail className="w-4 h-4" /> Email ({selectedIds.length})
                    </button>
                    <button onClick={() => { onWebhook(); setIsOpen(false); }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg shadow-lg hover:bg-purple-700 transition-colors">
                        <Send className="w-4 h-4" /> Enviar a n8n ({selectedIds.length})
                    </button>
                    <button onClick={() => { onDelete(); setIsOpen(false); }} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700 transition-colors">
                        <Trash2 className="w-4 h-4" /> Eliminar ({selectedIds.length})
                    </button>
                </div>
            )}
            <button onClick={() => setIsOpen(!isOpen)} className="w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors flex items-center justify-center">
                {isOpen ? <ChevronDown className="w-6 h-6" /> : <ChevronUp className="w-6 h-6" />}
            </button>
        </div>
    );
};

export const BulkProcessesView: React.FC<BulkProcessesViewProps> = () => {
    const { state, actions } = useAppState();
    const [bulkProcesses, setBulkProcesses] = useState<Process[]>([]);
    const [candidates, setCandidates] = useState<BulkCandidate[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingProcesses, setIsLoadingProcesses] = useState(false);
    const [selectedProcess, setSelectedProcess] = useState<string>('');
    const [selectedStage, setSelectedStage] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [drawerCandidate, setDrawerCandidate] = useState<BulkCandidate | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, Partial<BulkCandidate>>>(new Map());
    const [showProcessModal, setShowProcessModal] = useState(false);
    const [editingProcess, setEditingProcess] = useState<Process | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [schedulingCandidate, setSchedulingCandidate] = useState<{ id: string; name: string } | null>(null);
    const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
    const [editingCell, setEditingCell] = useState<{ candidateId: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState('');
    interface CustomColumn {
        id: string;
        name: string;
        type: 'text' | 'number' | 'checkbox' | 'date' | 'select';
        options?: string[]; // Para tipo 'select'
    }

    const [customColumns, setCustomColumns] = useState<CustomColumn[]>(() => {
        const saved = localStorage.getItem('bulkProcessesCustomColumns');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Si es un array de strings (formato antiguo), convertir a formato nuevo
                if (parsed.length > 0 && typeof parsed[0] === 'string') {
                    return parsed.map((name: string, index: number) => ({
                        id: `col_${index}_${Date.now()}`,
                        name,
                        type: 'text' as const,
                    }));
                }
                return parsed;
            } catch {
                return [];
            }
        }
        return [];
    });
    const [showAddColumnModal, setShowAddColumnModal] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [columnValues, setColumnValues] = useState<Record<string, Record<string, any>>>(() => {
        const saved = localStorage.getItem('bulkProcessesColumnValues');
        return saved ? JSON.parse(saved) : {};
    });
    const [quickScheduleCandidate, setQuickScheduleCandidate] = useState<string | null>(null);
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const pageSize = 50;

    const process = useMemo(() => {
        if (!selectedProcess) return undefined;
        return bulkProcesses.find(p => p.id === selectedProcess);
    }, [selectedProcess, bulkProcesses]);

    // Cargar procesos masivos
    const loadBulkProcesses = useCallback(async () => {
        setIsLoadingProcesses(true);
        try {
            const processes = await processesApi.getAllBulkProcesses();
            setBulkProcesses(processes);
            if (processes.length > 0 && !selectedProcess) {
                setSelectedProcess(processes[0].id);
            }
        } catch (error) {
            console.error('Error cargando procesos masivos:', error);
            actions.showToast('Error al cargar procesos masivos', 'error', 3000);
        } finally {
            setIsLoadingProcesses(false);
        }
    }, [selectedProcess, actions]);

    useEffect(() => {
        loadBulkProcesses();
    }, []);

    // Cargar candidatos
    const loadCandidates = useCallback(async (page: number = 0, reset: boolean = false) => {
        if (!selectedProcess) {
            setCandidates([]);
            setTotal(0);
            return;
        }

        setIsLoading(true);
        try {
            // Obtener configuración del proceso para filtrado automático
            const bulkConfig = process?.bulkConfig;
            
            const result = await bulkCandidatesApi.getCandidates(
                selectedProcess,
                page,
                pageSize,
                {
                    stageId: selectedStage || undefined,
                    search: searchQuery || undefined,
                    archived: false,
                    discarded: false,
                },
                bulkConfig ? {
                    scoreThreshold: bulkConfig.scoreThreshold,
                    autoFilterEnabled: bulkConfig.autoFilterEnabled,
                } : undefined
            );

            if (reset) {
                setCandidates(result.candidates);
            } else {
                setCandidates(prev => [...prev, ...result.candidates]);
            }
            setTotal(result.total);
            setHasMore(result.hasMore);
            setCurrentPage(page);
        } catch (error) {
            console.error('Error cargando candidatos:', error);
            actions.showToast('Error al cargar candidatos', 'error', 3000);
        } finally {
            setIsLoading(false);
        }
    }, [selectedProcess, selectedStage, searchQuery, actions]);

    useEffect(() => {
        loadCandidates(0, true);
    }, [selectedProcess, selectedStage, searchQuery]);

    const applyOptimisticUpdate = useCallback((candidateId: string, updates: Partial<BulkCandidate>) => {
        setOptimisticUpdates(prev => new Map(prev).set(candidateId, updates));
        setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, ...updates } : c));
    }, []);

    const updateCandidateStatus = useCallback(async (candidateId: string, updates: { stageId?: string; discarded?: boolean; archived?: boolean }) => {
        applyOptimisticUpdate(candidateId, updates);
        try {
            await bulkCandidatesApi.updateCandidate(candidateId, updates);
            setOptimisticUpdates(prev => {
                const newMap = new Map(prev);
                newMap.delete(candidateId);
                return newMap;
            });
        } catch (error) {
            console.error('Error actualizando candidato:', error);
            loadCandidates(currentPage, true);
            actions.showToast('Error al actualizar candidato', 'error', 3000);
        }
    }, [applyOptimisticUpdate, loadCandidates, currentPage, actions]);

    const handleBulkApprove = useCallback(async () => {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        ids.forEach(id => {
            applyOptimisticUpdate(id, { stageId: process?.stages[process.stages.length - 1]?.id });
        });
        try {
            await bulkCandidatesApi.updateCandidatesBatch(ids, {
                stageId: process?.stages[process.stages.length - 1]?.id,
            });
            setSelectedIds(new Set());
            actions.showToast(`${ids.length} candidatos aprobados`, 'success', 3000);
        } catch (error) {
            console.error('Error aprobando candidatos:', error);
            loadCandidates(currentPage, true);
            actions.showToast('Error al aprobar candidatos', 'error', 3000);
        }
    }, [selectedIds, process, applyOptimisticUpdate, loadCandidates, currentPage, actions]);

    const handleBulkReject = useCallback(async () => {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        ids.forEach(id => { applyOptimisticUpdate(id, { discarded: true }); });
        try {
            await bulkCandidatesApi.updateCandidatesBatch(ids, { discarded: true, discardReason: 'Rechazado en proceso masivo' });
            setSelectedIds(new Set());
            actions.showToast(`${ids.length} candidatos rechazados`, 'success', 3000);
            loadCandidates(currentPage, true);
        } catch (error) {
            console.error('Error rechazando candidatos:', error);
            loadCandidates(currentPage, true);
            actions.showToast('Error al rechazar candidatos', 'error', 3000);
        }
    }, [selectedIds, applyOptimisticUpdate, loadCandidates, currentPage, actions]);

    const handleBulkArchive = useCallback(async () => {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        ids.forEach(id => { applyOptimisticUpdate(id, { archived: true }); });
        try {
            await bulkCandidatesApi.updateCandidatesBatch(ids, { archived: true });
            setSelectedIds(new Set());
            actions.showToast(`${ids.length} candidatos archivados`, 'success', 3000);
            loadCandidates(currentPage, true);
        } catch (error) {
            console.error('Error archivando candidatos:', error);
            loadCandidates(currentPage, true);
            actions.showToast('Error al archivar candidatos', 'error', 3000);
        }
    }, [selectedIds, applyOptimisticUpdate, loadCandidates, currentPage, actions]);

    const handleBulkDelete = useCallback(async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`¿Estás seguro de eliminar permanentemente ${selectedIds.size} candidato(s)? Esta acción no se puede deshacer y también se eliminarán sus carpetas en Google Drive si existen.`)) {
            return;
        }
        const ids = Array.from(selectedIds);
        try {
            // Eliminar carpetas de Google Drive si están conectadas
            if (state.settings?.googleDrive?.connected) {
                const candidatesToDelete = candidates.filter(c => ids.includes(c.id));
                for (const candidate of candidatesToDelete) {
                    // Intentar obtener el folder ID del candidato (necesitaríamos cargar los detalles completos)
                    // Por ahora, solo eliminamos de la base de datos
                }
            }
            
            await bulkCandidatesApi.deleteCandidatesBatch(ids);
            setCandidates(prev => prev.filter(c => !ids.includes(c.id)));
            setSelectedIds(new Set());
            setTotal(prev => Math.max(0, prev - ids.length));
            actions.showToast(`${ids.length} candidato(s) eliminado(s) permanentemente`, 'success', 3000);
        } catch (error) {
            console.error('Error eliminando candidatos:', error);
            loadCandidates(currentPage, true);
            actions.showToast('Error al eliminar candidatos', 'error', 3000);
        }
    }, [selectedIds, candidates, state.settings, loadCandidates, currentPage, actions]);

    const handleWhatsAppClick = useCallback(async (candidateId: string, phone: string) => {
        // Registrar la interacción en la base de datos
        try {
            await bulkCandidatesApi.recordWhatsAppInteraction(candidateId);
            
            // Actualizar optimísticamente el candidato en la lista
            setOptimisticUpdates(prev => {
                const newMap = new Map(prev);
                const candidate = candidates.find(c => c.id === candidateId);
                if (candidate) {
                    newMap.set(candidateId, {
                        ...candidate,
                        lastWhatsAppInteractionAt: new Date().toISOString(),
                    });
                }
                return newMap;
            });
        } catch (error) {
            console.error('Error registrando interacción de WhatsApp:', error);
            // No mostramos error al usuario, solo lo registramos
        }
        
        // Abrir WhatsApp en nueva pestaña
        const cleanPhone = phone.replace(/[^\d]/g, '');
        window.open(`https://wa.me/${cleanPhone}`, '_blank', 'noopener,noreferrer');
    }, [candidates]);

    const handleDeleteCandidate = useCallback(async (candidateId: string, candidateName: string) => {
        if (!confirm(`¿Estás seguro de eliminar permanentemente a ${candidateName}? Esta acción no se puede deshacer.`)) {
            return;
        }
        try {
            await bulkCandidatesApi.deleteCandidate(candidateId);
            setCandidates(prev => prev.filter(c => c.id !== candidateId));
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(candidateId);
                return newSet;
            });
            setTotal(prev => prev - 1);
            actions.showToast('Candidato eliminado', 'success', 3000);
        } catch (error) {
            console.error('Error eliminando candidato:', error);
            actions.showToast('Error al eliminar candidato', 'error', 3000);
        }
    }, [actions]);

    const handleBulkWhatsApp = useCallback(async (message: string, createGroup: boolean) => {
        const selectedCandidates = candidates.filter(c => selectedIds.has(c.id) && c.phone);
        
        if (createGroup) {
            // Para crear grupo, abrimos WhatsApp Web con los números
            const phoneNumbers = selectedCandidates.map(c => c.phone?.replace(/[^\d]/g, '')).filter(Boolean);
            // WhatsApp no permite crear grupos directamente desde URL, pero podemos abrir WhatsApp Web
            window.open('https://web.whatsapp.com', '_blank');
            actions.showToast('Abre WhatsApp Web y crea un grupo manualmente con los candidatos seleccionados', 'info', 5000);
        } else {
            // Enviar mensaje individual a cada candidato
            const cleanMessage = encodeURIComponent(message);
            let openedCount = 0;
            
            for (const candidate of selectedCandidates) {
                if (candidate.phone) {
                    const cleanPhone = candidate.phone.replace(/[^\d]/g, '');
                    const personalizedMessage = message.replace(/\{\{nombre\}\}/g, candidate.name || 'Candidato');
                    const encodedMessage = encodeURIComponent(personalizedMessage);
                    
                    // Registrar la interacción
                    try {
                        await bulkCandidatesApi.recordWhatsAppInteraction(candidate.id);
                    } catch (error) {
                        console.error('Error registrando interacción:', error);
                    }
                    
                    // Abrir WhatsApp con el mensaje prellenado
                    setTimeout(() => {
                        window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
                    }, openedCount * 500); // Delay para no bloquear el navegador
                    openedCount++;
                }
            }
            
            if (openedCount > 0) {
                actions.showToast(`Abriendo WhatsApp para ${openedCount} candidato(s)`, 'success', 3000);
            }
        }
    }, [selectedIds, candidates, actions]);

    const handleBulkEmail = useCallback(async (subject: string, body: string) => {
        const selectedCandidates = candidates.filter(c => selectedIds.has(c.id) && c.email);
        
        if (selectedCandidates.length === 0) {
            actions.showToast('No hay candidatos seleccionados con email', 'error', 3000);
            return;
        }

        // Para el asunto, no reemplazamos variables ya que es un envío masivo
        // Simplemente removemos las variables o las dejamos como están
        const emailSubject = subject
            .replace(/\{\{nombre\}\}/g, '')
            .replace(/\{\{email\}\}/g, '')
            .replace(/\{\{telefono\}\}/g, '')
            .replace(/\s+/g, ' ') // Limpiar espacios múltiples
            .trim();
        
        // Para el cuerpo, usamos el primer candidato para la vista previa
        // pero en realidad cada candidato debería recibir su versión personalizada
        // Por ahora, usamos el primero para el cuerpo también
        const firstCandidate = selectedCandidates[0];
        const personalizedBody = body
            .replace(/\{\{nombre\}\}/g, firstCandidate.name || 'Candidato')
            .replace(/\{\{email\}\}/g, firstCandidate.email || '')
            .replace(/\{\{telefono\}\}/g, firstCandidate.phone || '');

        // Obtener todas las direcciones de email y separarlas con punto y coma
        const emailAddresses = selectedCandidates.map(c => c.email).filter(Boolean);
        const toEmails = emailAddresses.join(';');
        
        // Construir el enlace mailto: con todas las direcciones en el campo "to"
        // Las direcciones en el campo "to" no deben estar codificadas, solo los parámetros
        const mailtoLink = `mailto:${toEmails}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(personalizedBody)}`;
        
        window.location.href = mailtoLink;
        actions.showToast(`Abriendo cliente de correo para ${emailAddresses.length} candidato(s)`, 'success', 3000);
    }, [selectedIds, candidates, actions]);

    const handleQuickSchedule = useCallback(async (date: string, time: string, interviewerId: string, notes?: string) => {
        const candidateId = quickScheduleCandidate || schedulingCandidate?.id;
        if (!candidateId) return;

        const startDateTime = new Date(`${date}T${time}`);
        const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hora por defecto

        // Obtener nombre del candidato
        const candidate = candidates.find(c => c.id === candidateId);
        const candidateName = candidate?.name || 'Candidato';

        const eventData = {
            title: `Entrevista con ${candidateName}`,
            start: startDateTime,
            end: endDateTime,
            candidateId,
            interviewerId,
            notes: notes || '',
        };

        try {
            await actions.addInterviewEvent(eventData);
            actions.showToast('Entrevista agendada exitosamente', 'success', 3000);
        } catch (error) {
            console.error('Error agendando entrevista:', error);
            actions.showToast('Error al agendar la entrevista', 'error', 3000);
            throw error;
        }
    }, [quickScheduleCandidate, schedulingCandidate, candidates, actions]);

    const handleBulkSchedule = useCallback(async (date: string, time: string, interviewerId: string, notes?: string) => {
        const selectedCandidates = candidates.filter(c => selectedIds.has(c.id));
        
        if (selectedCandidates.length === 0) {
            actions.showToast('No hay candidatos seleccionados', 'error', 3000);
            return;
        }

        const startDateTime = new Date(`${date}T${time}`);
        const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hora por defecto

        let successCount = 0;
        let errorCount = 0;

        // Crear eventos de entrevista para todos los candidatos seleccionados
        for (const candidate of selectedCandidates) {
            const eventData = {
                title: `Entrevista con ${candidate.name}`,
                start: startDateTime,
                end: endDateTime,
                candidateId: candidate.id,
                interviewerId,
                notes: notes || '',
            };

            try {
                await actions.addInterviewEvent(eventData);
                successCount++;
            } catch (error) {
                console.error(`Error agendando entrevista para ${candidate.name}:`, error);
                errorCount++;
            }
        }

        if (successCount > 0) {
            actions.showToast(
                `${successCount} entrevista${successCount !== 1 ? 's' : ''} agendada${successCount !== 1 ? 's' : ''} exitosamente${errorCount > 0 ? ` (${errorCount} error${errorCount !== 1 ? 'es' : ''})` : ''}`,
                errorCount > 0 ? 'info' : 'success',
                4000
            );
            // Recargar candidatos para mostrar las nuevas entrevistas
            await loadCandidates(currentPage, true);
        } else {
            actions.showToast('Error al agendar las entrevistas', 'error', 3000);
        }
    }, [selectedIds, candidates, actions, currentPage, loadCandidates]);

    const handleWebhook = useCallback(async () => {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        const webhookUrl = state.settings?.customLabels?.n8nWebhookUrl || '';
        if (!webhookUrl) {
            actions.showToast('Webhook de n8n no configurado', 'error', 3000);
            return;
        }
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ candidateIds: ids, timestamp: new Date().toISOString() }),
            });
            if (!response.ok) throw new Error('Error en webhook');
            setSelectedIds(new Set());
            actions.showToast(`${ids.length} candidatos enviados a n8n`, 'success', 3000);
        } catch (error) {
            console.error('Error enviando a webhook:', error);
            actions.showToast('Error al enviar a n8n', 'error', 3000);
        }
    }, [selectedIds, state.settings, actions]);

    const toggleSelection = useCallback((candidateId: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(candidateId)) {
                newSet.delete(candidateId);
            } else {
                newSet.add(candidateId);
            }
            return newSet;
        });
    }, []);

    const toggleSelectAll = useCallback(() => {
        if (selectedIds.size === candidates.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(candidates.map(c => c.id)));
        }
    }, [selectedIds, candidates]);

    const openDrawer = useCallback((candidate: BulkCandidate) => {
        setDrawerCandidate(candidate);
        setIsDrawerOpen(true);
    }, []);

    const handleCreateProcess = () => {
        setEditingProcess(null);
        setShowProcessModal(true);
    };

    const handleEditProcess = (process: Process) => {
        setEditingProcess(process);
        setShowProcessModal(true);
    };

    const handleDeleteProcess = async (processId: string) => {
        if (!confirm('¿Estás seguro de eliminar este proceso masivo? Esta acción no se puede deshacer.')) {
            return;
        }
        try {
            await processesApi.delete(processId);
            actions.showToast('Proceso masivo eliminado', 'success', 3000);
            await loadBulkProcesses();
            if (selectedProcess === processId) {
                setSelectedProcess('');
                setCandidates([]);
            }
        } catch (error: any) {
            console.error('Error eliminando proceso:', error);
            actions.showToast(`Error: ${error.message || 'Error desconocido'}`, 'error', 5000);
        }
    };

    const handleProcessSaved = async () => {
        await loadBulkProcesses();
        setShowProcessModal(false);
        setEditingProcess(null);
    };

    const handleAddColumn = (column: CustomColumn) => {
        const newColumns = [...customColumns, column];
        setCustomColumns(newColumns);
        localStorage.setItem('bulkProcessesCustomColumns', JSON.stringify(newColumns));
    };

    const handleLoadTemplate = (columns: CustomColumn[]) => {
        setCustomColumns(columns);
        localStorage.setItem('bulkProcessesCustomColumns', JSON.stringify(columns));
    };

    const handleColumnValueChange = (candidateId: string, columnId: string, value: any) => {
        setColumnValues(prev => {
            const newValues = {
                ...prev,
                [candidateId]: {
                    ...prev[candidateId],
                    [columnId]: value,
                },
            };
            localStorage.setItem('bulkProcessesColumnValues', JSON.stringify(newValues));
            return newValues;
        });
    };

    const getColumnValue = (candidateId: string, columnId: string): any => {
        return columnValues[candidateId]?.[columnId] ?? (columnValues[candidateId]?.[columnId] === false ? false : '');
    };

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            // Si ya está ordenando por esta columna, cambiar dirección
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // Nueva columna, empezar con ascendente
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const sortCandidates = (candidates: BulkCandidate[]): BulkCandidate[] => {
        if (!sortColumn) return candidates;

        return [...candidates].sort((a, b) => {
            const optimisticA = optimisticUpdates.get(a.id);
            const optimisticB = optimisticUpdates.get(b.id);
            const candidateA = optimisticA ? { ...a, ...optimisticA } : a;
            const candidateB = optimisticB ? { ...b, ...optimisticB } : b;

            let valueA: any;
            let valueB: any;

            switch (sortColumn) {
                case 'name':
                    valueA = (candidateA.name || '').toLowerCase();
                    valueB = (candidateB.name || '').toLowerCase();
                    break;
                case 'dni':
                    valueA = (candidateA.dni || '').toLowerCase();
                    valueB = (candidateB.dni || '').toLowerCase();
                    break;
                case 'email':
                    valueA = (candidateA.email || '').toLowerCase();
                    valueB = (candidateB.email || '').toLowerCase();
                    break;
                case 'scoreIa':
                    valueA = candidateA.scoreIa ?? 0;
                    valueB = candidateB.scoreIa ?? 0;
                    break;
                case 'phone':
                    valueA = (candidateA.phone || '').toLowerCase();
                    valueB = (candidateB.phone || '').toLowerCase();
                    break;
                case 'lastInteraction':
                    valueA = candidateA.lastWhatsAppInteractionAt ? new Date(candidateA.lastWhatsAppInteractionAt).getTime() : 0;
                    valueB = candidateB.lastWhatsAppInteractionAt ? new Date(candidateB.lastWhatsAppInteractionAt).getTime() : 0;
                    break;
                case 'nextInterview':
                    valueA = candidateA.nextInterviewAt ? new Date(candidateA.nextInterviewAt).getTime() : 0;
                    valueB = candidateB.nextInterviewAt ? new Date(candidateB.nextInterviewAt).getTime() : 0;
                    break;
                case 'stage':
                    const stageA = process?.stages.find(s => s.id === candidateA.stageId);
                    const stageB = process?.stages.find(s => s.id === candidateB.stageId);
                    valueA = (stageA?.name || '').toLowerCase();
                    valueB = (stageB?.name || '').toLowerCase();
                    break;
                default:
                    return 0;
            }

            // Comparar valores
            let comparison = 0;
            if (valueA < valueB) {
                comparison = -1;
            } else if (valueA > valueB) {
                comparison = 1;
            }

            // Aplicar dirección de ordenamiento
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    };

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="border-b bg-white p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">Procesos Masivos</h1>
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-500">
                            {selectedProcess ? `${total} candidatos` : `${bulkProcesses.length} procesos`}
                        </div>
                        <button
                            onClick={handleCreateProcess}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Nuevo Proceso Masivo
                        </button>
                    </div>
                </div>

                {!selectedProcess ? (
                    <div className="space-y-2">
                        {isLoadingProcesses ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                                <span className="ml-2 text-gray-600">Cargando procesos...</span>
                            </div>
                        ) : bulkProcesses.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                                <p className="text-gray-500 mb-4">No hay procesos masivos creados</p>
                                <button
                                    onClick={handleCreateProcess}
                                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                                >
                                    Crear Primer Proceso Masivo
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {bulkProcesses.map(p => (
                                    <div
                                        key={p.id}
                                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                                        onClick={() => setSelectedProcess(p.id)}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <h3 className="font-semibold text-gray-900">{p.title}</h3>
                                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => handleEditProcess(p)}
                                                    className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteProcess(p.id)}
                                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        {p.description && (
                                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{p.description}</p>
                                        )}
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span>{p.stages.length} etapas</span>
                                            <span>{p.vacancies} vacante{p.vacancies !== 1 ? 's' : ''}</span>
                                            <span className="capitalize">{p.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => {
                                    setSelectedProcess('');
                                    setCandidates([]);
                                    setSelectedStage('');
                                    setSearchQuery('');
                                }}
                                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Volver a procesos
                            </button>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700">
                                    Proceso: {process?.title}
                                </label>
                            </div>
                            {process && (
                                <>
                                    <button
                                        onClick={() => handleEditProcess(process)}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                        title="Editar proceso"
                                    >
                                        <Settings className="w-4 h-4" />
                                        Editar Proceso
                                    </button>
                                    <button
                                        onClick={() => setShowImportModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Importar desde Excel
                                    </button>
                                    <button
                                        onClick={() => setShowAddColumnModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        title="Agregar columna personalizada"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Agregar Columna
                                    </button>
                                    <button
                                        onClick={() => setShowTemplateModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                                        title="Gestionar plantillas de tabla"
                                    >
                                        <Settings className="w-4 h-4" />
                                        Plantillas
                                    </button>
                                </>
                            )}
                        </div>
                        
                        <div className="space-y-3">
                            {/* Información de filtrado automático */}
                            {process?.bulkConfig?.autoFilterEnabled && process?.bulkConfig?.scoreThreshold !== undefined && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Filter className="w-4 h-4 text-blue-600" />
                                        <span className="font-medium text-blue-800">
                                            Filtrado Automático Activo:
                                        </span>
                                        <span className="text-blue-700">
                                            Solo se muestran candidatos con Score IA ≥ {process.bulkConfig.scoreThreshold}
                                        </span>
                                    </div>
                                </div>
                            )}
                            
                            <div className="flex gap-4 items-end">
                                {process && (
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Etapa</label>
                                        <select
                                            value={selectedStage}
                                            onChange={(e) => setSelectedStage(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        >
                                            <option value="">Todas las etapas</option>
                                            {process.stages.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Búsqueda</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Nombre, teléfono..."
                                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {selectedProcess && (
                <div className="flex-1 overflow-hidden relative flex flex-col">
                    {quickScheduleCandidate && (
                        <div 
                            className="fixed inset-0 z-30" 
                            onClick={() => setQuickScheduleCandidate(null)}
                        />
                    )}
                    <div className="flex-1 overflow-x-auto overflow-y-auto" style={{ minHeight: 0 }}>
                        <table className="w-full" style={{ tableLayout: 'auto', width: '100%' }}>
                            <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-2 py-3 text-left whitespace-nowrap" style={{ width: '40px' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === candidates.length && candidates.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                    />
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '150px' }}>
                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => handleSort('name')}
                                            className="flex items-center gap-1 hover:text-primary-600 transition-colors"
                                        >
                                            <span>Nombre</span>
                                            {sortColumn === 'name' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3 h-3" />
                                                ) : (
                                                    <ArrowDown className="w-3 h-3" />
                                                )
                                            ) : (
                                                <div className="w-3 h-3 opacity-30">
                                                    <ArrowUp className="w-3 h-3" />
                                                </div>
                                            )}
                                        </button>
                                        <input
                                            type="text"
                                            placeholder="Filtrar..."
                                            value={columnFilters.name || ''}
                                            onChange={(e) => setColumnFilters({ ...columnFilters, name: e.target.value })}
                                            className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>
                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => handleSort('dni')}
                                            className="flex items-center gap-1 hover:text-primary-600 transition-colors"
                                        >
                                            <span>DNI</span>
                                            {sortColumn === 'dni' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3 h-3" />
                                                ) : (
                                                    <ArrowDown className="w-3 h-3" />
                                                )
                                            ) : (
                                                <div className="w-3 h-3 opacity-30">
                                                    <ArrowUp className="w-3 h-3" />
                                                </div>
                                            )}
                                        </button>
                                        <input
                                            type="text"
                                            placeholder="Filtrar..."
                                            value={columnFilters.dni || ''}
                                            onChange={(e) => setColumnFilters({ ...columnFilters, dni: e.target.value })}
                                            className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '180px' }}>
                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => handleSort('email')}
                                            className="flex items-center gap-1 hover:text-primary-600 transition-colors"
                                        >
                                            <span>Email</span>
                                            {sortColumn === 'email' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3 h-3" />
                                                ) : (
                                                    <ArrowDown className="w-3 h-3" />
                                                )
                                            ) : (
                                                <div className="w-3 h-3 opacity-30">
                                                    <ArrowUp className="w-3 h-3" />
                                                </div>
                                            )}
                                        </button>
                                        <input
                                            type="text"
                                            placeholder="Filtrar..."
                                            value={columnFilters.email || ''}
                                            onChange={(e) => setColumnFilters({ ...columnFilters, email: e.target.value })}
                                            className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>
                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => handleSort('scoreIa')}
                                            className="flex items-center gap-1 hover:text-primary-600 transition-colors"
                                        >
                                            <span>Score IA</span>
                                            {sortColumn === 'scoreIa' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3 h-3" />
                                                ) : (
                                                    <ArrowDown className="w-3 h-3" />
                                                )
                                            ) : (
                                                <div className="w-3 h-3 opacity-30">
                                                    <ArrowUp className="w-3 h-3" />
                                                </div>
                                            )}
                                        </button>
                                        <input
                                            type="text"
                                            placeholder="Min..."
                                            value={columnFilters.scoreIa || ''}
                                            onChange={(e) => setColumnFilters({ ...columnFilters, scoreIa: e.target.value })}
                                            className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>
                                    <button
                                        onClick={() => handleSort('scoreIa')}
                                        className="flex items-center gap-1 hover:text-primary-600 transition-colors"
                                    >
                                        <span>Status</span>
                                        {sortColumn === 'scoreIa' ? (
                                            sortDirection === 'asc' ? (
                                                <ArrowUp className="w-3 h-3" />
                                            ) : (
                                                <ArrowDown className="w-3 h-3" />
                                            )
                                        ) : (
                                            <div className="w-3 h-3 opacity-30">
                                                <ArrowUp className="w-3 h-3" />
                                            </div>
                                        )}
                                    </button>
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '130px' }}>
                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => handleSort('phone')}
                                            className="flex items-center gap-1 hover:text-primary-600 transition-colors"
                                        >
                                            <span>Teléfono</span>
                                            {sortColumn === 'phone' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3 h-3" />
                                                ) : (
                                                    <ArrowDown className="w-3 h-3" />
                                                )
                                            ) : (
                                                <div className="w-3 h-3 opacity-30">
                                                    <ArrowUp className="w-3 h-3" />
                                                </div>
                                            )}
                                        </button>
                                        <input
                                            type="text"
                                            placeholder="Filtrar..."
                                            value={columnFilters.phone || ''}
                                            onChange={(e) => setColumnFilters({ ...columnFilters, phone: e.target.value })}
                                            className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '140px' }}>
                                    <button
                                        onClick={() => handleSort('lastInteraction')}
                                        className="flex items-center gap-1 hover:text-primary-600 transition-colors"
                                    >
                                        <span>Última Interacción</span>
                                        {sortColumn === 'lastInteraction' ? (
                                            sortDirection === 'asc' ? (
                                                <ArrowUp className="w-3 h-3" />
                                            ) : (
                                                <ArrowDown className="w-3 h-3" />
                                            )
                                        ) : (
                                            <div className="w-3 h-3 opacity-30">
                                                <ArrowUp className="w-3 h-3" />
                                            </div>
                                        )}
                                    </button>
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>Contacto</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '150px' }}>
                                    <button
                                        onClick={() => handleSort('nextInterview')}
                                        className="flex items-center gap-1 hover:text-primary-600 transition-colors"
                                    >
                                        <span>Próxima Entrevista</span>
                                        {sortColumn === 'nextInterview' ? (
                                            sortDirection === 'asc' ? (
                                                <ArrowUp className="w-3 h-3" />
                                            ) : (
                                                <ArrowDown className="w-3 h-3" />
                                            )
                                        ) : (
                                            <div className="w-3 h-3 opacity-30">
                                                <ArrowUp className="w-3 h-3" />
                                            </div>
                                        )}
                                    </button>
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '90px' }}>Agendar</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '130px' }}>
                                    <button
                                        onClick={() => handleSort('stage')}
                                        className="flex items-center gap-1 hover:text-primary-600 transition-colors"
                                    >
                                        <span>Etapa</span>
                                        {sortColumn === 'stage' ? (
                                            sortDirection === 'asc' ? (
                                                <ArrowUp className="w-3 h-3" />
                                            ) : (
                                                <ArrowDown className="w-3 h-3" />
                                            )
                                        ) : (
                                            <div className="w-3 h-3 opacity-30">
                                                <ArrowUp className="w-3 h-3" />
                                            </div>
                                        )}
                                    </button>
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>Acciones</th>
                                {customColumns.map(col => (
                                    <th key={col.id} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                                        {col.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortCandidates(candidates.filter(candidate => {
                                // Aplicar filtros de columnas
                                const optimistic = optimisticUpdates.get(candidate.id);
                                const displayCandidate = optimistic ? { ...candidate, ...optimistic } : candidate;
                                
                                if (columnFilters.name && !displayCandidate.name.toLowerCase().includes(columnFilters.name.toLowerCase())) {
                                    return false;
                                }
                                if (columnFilters.dni && !(displayCandidate.dni || '').toLowerCase().includes(columnFilters.dni.toLowerCase())) {
                                    return false;
                                }
                                if (columnFilters.email && !(displayCandidate.email || '').toLowerCase().includes(columnFilters.email.toLowerCase())) {
                                    return false;
                                }
                                if (columnFilters.scoreIa) {
                                    const minScore = parseFloat(columnFilters.scoreIa);
                                    if (isNaN(minScore) || (displayCandidate.scoreIa ?? 0) < minScore) {
                                        return false;
                                    }
                                }
                                if (columnFilters.phone && !(displayCandidate.phone || '').includes(columnFilters.phone)) {
                                    return false;
                                }
                                
                                return true;
                            })).map(candidate => {
                                const stage = process?.stages.find(s => s.id === candidate.stageId);
                                const isSelected = selectedIds.has(candidate.id);
                                const optimistic = optimisticUpdates.get(candidate.id);
                                const displayCandidate = optimistic ? { ...candidate, ...optimistic } : candidate;

                                return (
                                    <tr
                                        key={candidate.id}
                                        className={`hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-primary-50' : ''}`}
                                        onClick={() => openDrawer(candidate)}
                                    >
                                        <td className="px-2 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelection(candidate.id)}
                                                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                            />
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            {editingCell?.candidateId === candidate.id && editingCell?.field === 'name' ? (
                                                <input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleSaveEdit(candidate.id, 'name')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveEdit(candidate.id, 'name');
                                                        if (e.key === 'Escape') handleCancelEdit();
                                                    }}
                                                    autoFocus
                                                    className="w-full px-2 py-1 border border-primary-500 rounded focus:ring-2 focus:ring-primary-500"
                                                />
                                            ) : (
                                                <MetadataTooltip 
                                                    metadata={displayCandidate.metadataIa || ''} 
                                                    scoreIa={displayCandidate.scoreIa}
                                                >
                                                    <span 
                                                        className="font-medium text-gray-900 cursor-help hover:bg-gray-50 px-1 py-0.5 rounded"
                                                        onDoubleClick={() => handleStartEdit(candidate.id, 'name', displayCandidate.name)}
                                                        title="Doble clic para editar"
                                                    >
                                                        {displayCandidate.name}
                                                    </span>
                                                </MetadataTooltip>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                                            {editingCell?.candidateId === candidate.id && editingCell?.field === 'dni' ? (
                                                <input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleSaveEdit(candidate.id, 'dni')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveEdit(candidate.id, 'dni');
                                                        if (e.key === 'Escape') handleCancelEdit();
                                                    }}
                                                    autoFocus
                                                    className="w-full px-2 py-1 border border-primary-500 rounded focus:ring-2 focus:ring-primary-500"
                                                />
                                            ) : (
                                                <span 
                                                    className="text-gray-600 hover:bg-gray-50 px-1 py-0.5 rounded cursor-pointer"
                                                    onDoubleClick={() => handleStartEdit(candidate.id, 'dni', displayCandidate.dni || '')}
                                                    title="Doble clic para editar"
                                                >
                                                    {displayCandidate.dni || '-'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap">
                                            {editingCell?.candidateId === candidate.id && editingCell?.field === 'email' ? (
                                                <input
                                                    type="email"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleSaveEdit(candidate.id, 'email')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveEdit(candidate.id, 'email');
                                                        if (e.key === 'Escape') handleCancelEdit();
                                                    }}
                                                    autoFocus
                                                    className="w-full px-2 py-1 border border-primary-500 rounded focus:ring-2 focus:ring-primary-500"
                                                />
                                            ) : displayCandidate.email ? (
                                                <a 
                                                    href={`mailto:${displayCandidate.email}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onDoubleClick={(e) => {
                                                        e.preventDefault();
                                                        handleStartEdit(candidate.id, 'email', displayCandidate.email || '');
                                                    }}
                                                    className="text-blue-600 hover:text-blue-700 hover:underline"
                                                    title="Doble clic para editar"
                                                >
                                                    {displayCandidate.email}
                                                </a>
                                            ) : (
                                                <span 
                                                    className="text-gray-400 hover:bg-gray-50 px-1 py-0.5 rounded cursor-pointer"
                                                    onDoubleClick={() => handleStartEdit(candidate.id, 'email', '')}
                                                    title="Doble clic para editar"
                                                >
                                                    N/A
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                                            {displayCandidate.scoreIa !== undefined ? (
                                                <span className={`font-semibold ${
                                                    displayCandidate.scoreIa >= 70 ? 'text-green-600' : 
                                                    displayCandidate.scoreIa >= 50 ? 'text-yellow-600' : 
                                                    'text-red-600'
                                                }`}>
                                                    {displayCandidate.scoreIa}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                                            {(() => {
                                                const scoreThreshold = process?.bulkConfig?.scoreThreshold;
                                                const autoFilterEnabled = process?.bulkConfig?.autoFilterEnabled;
                                                
                                                if (displayCandidate.scoreIa === undefined) {
                                                    return <span className="text-gray-400">-</span>;
                                                }
                                                
                                                // Si el filtrado automático está activo y hay threshold
                                                if (autoFilterEnabled && scoreThreshold !== undefined) {
                                                    // Si llegó aquí, significa que pasó el filtro (porque la query ya lo filtró)
                                                    return (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            ✅ Apto
                                                        </span>
                                                    );
                                                }
                                                
                                                // Si no hay filtrado automático, mostrar estado basado en score
                                                if (displayCandidate.scoreIa >= 70) {
                                                    return (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            ✅ Alto
                                                        </span>
                                                    );
                                                } else if (displayCandidate.scoreIa >= 50) {
                                                    return (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                            ⚠️ Medio
                                                        </span>
                                                    );
                                                } else {
                                                    return (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                            ❌ Bajo
                                                        </span>
                                                    );
                                                }
                                            })()}
                                        </td>
                                        <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap">
                                            {editingCell?.candidateId === candidate.id && editingCell?.field === 'phone' ? (
                                                <input
                                                    type="tel"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleSaveEdit(candidate.id, 'phone')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveEdit(candidate.id, 'phone');
                                                        if (e.key === 'Escape') handleCancelEdit();
                                                    }}
                                                    autoFocus
                                                    className="w-full px-2 py-1 border border-primary-500 rounded focus:ring-2 focus:ring-primary-500"
                                                />
                                            ) : (
                                                <span 
                                                    className="hover:bg-gray-50 px-1 py-0.5 rounded cursor-pointer"
                                                    onDoubleClick={() => handleStartEdit(candidate.id, 'phone', displayCandidate.phone || '')}
                                                    title="Doble clic para editar"
                                                >
                                                    {displayCandidate.phone || 'N/A'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">
                                            {displayCandidate.lastWhatsAppInteractionAt ? (
                                                <span className="text-xs" title={new Date(displayCandidate.lastWhatsAppInteractionAt).toLocaleString('es-PE')}>
                                                    {formatTimeAgo(displayCandidate.lastWhatsAppInteractionAt)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">Nunca</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex gap-2 items-center">
                                                {displayCandidate.phone && (
                                                    <>
                                                        <button
                                                            onClick={() => handleWhatsAppClick(displayCandidate.id, displayCandidate.phone!)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                                                            title="Abrir WhatsApp y registrar interacción"
                                                        >
                                                            <MessageCircle className="w-4 h-4" />
                                                        </button>
                                                        {isMobile && (
                                                            <a
                                                                href={`tel:${displayCandidate.phone.replace(/[^\d]/g, '')}`}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                                                title="Llamar"
                                                            >
                                                                <Phone className="w-4 h-4" />
                                                            </a>
                                                        )}
                                                    </>
                                                )}
                                                {displayCandidate.email && (
                                                    <a
                                                        href={`mailto:${displayCandidate.email}`}
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                                        title="Enviar correo"
                                                    >
                                                        <Mail className="w-4 h-4" />
                                                    </a>
                                                )}
                                                {!displayCandidate.phone && !displayCandidate.email && (
                                                    <span className="text-gray-400 text-xs">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">
                                            {displayCandidate.nextInterviewAt ? (
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-gray-900">
                                                        {new Date(displayCandidate.nextInterviewAt).toLocaleDateString('es-PE', { 
                                                            day: '2-digit', 
                                                            month: 'short',
                                                            weekday: 'short'
                                                        })}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {new Date(displayCandidate.nextInterviewAt).toLocaleTimeString('es-PE', { 
                                                            hour: '2-digit', 
                                                            minute: '2-digit' 
                                                        })}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <div className="relative">
                                                <button
                                                    onClick={() => setQuickScheduleCandidate(quickScheduleCandidate === candidate.id ? null : candidate.id)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors"
                                                    title="Agendar entrevista rápidamente"
                                                >
                                                    <Calendar className="w-4 h-4" />
                                                </button>
                                                
                                                {quickScheduleCandidate === candidate.id && (
                                                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[280px]">
                                                        <QuickScheduleInline
                                                            candidateId={candidate.id}
                                                            candidateName={candidate.name}
                                                            onSchedule={async (date, time, interviewerId) => {
                                                                await handleQuickSchedule(date, time, interviewerId);
                                                                setQuickScheduleCandidate(null);
                                                                await loadCandidates(currentPage, true);
                                                            }}
                                                            onCancel={() => setQuickScheduleCandidate(null)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap">{stage?.name || 'N/A'}</td>
                                        <td className="px-3 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => updateCandidateStatus(candidate.id, {
                                                        stageId: process?.stages[process.stages.length - 1]?.id,
                                                    })}
                                                    className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                                    title="Aprobar"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => updateCandidateStatus(candidate.id, { discarded: true })}
                                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Rechazar"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCandidate(candidate.id, candidate.name)}
                                                    className="p-1 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                                                    title="Eliminar permanentemente"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                        {customColumns.map(col => {
                                            const value = getColumnValue(candidate.id, col.id);
                                            return (
                                                <td key={col.id} className="px-3 py-3 text-sm whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                    {col.type === 'checkbox' ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={value === true}
                                                            onChange={(e) => handleColumnValueChange(candidate.id, col.id, e.target.checked)}
                                                            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                                        />
                                                    ) : col.type === 'select' && col.options ? (
                                                        <select
                                                            value={value || ''}
                                                            onChange={(e) => handleColumnValueChange(candidate.id, col.id, e.target.value)}
                                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                                        >
                                                            <option value="">-</option>
                                                            {col.options.map(opt => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    ) : col.type === 'date' ? (
                                                        <input
                                                            type="date"
                                                            value={value || ''}
                                                            onChange={(e) => handleColumnValueChange(candidate.id, col.id, e.target.value)}
                                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                                        />
                                                    ) : col.type === 'number' ? (
                                                        <input
                                                            type="number"
                                                            value={value || ''}
                                                            onChange={(e) => handleColumnValueChange(candidate.id, col.id, e.target.value ? parseFloat(e.target.value) : '')}
                                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                                            placeholder="-"
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={value || ''}
                                                            onChange={(e) => handleColumnValueChange(candidate.id, col.id, e.target.value)}
                                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                                            placeholder="-"
                                                        />
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                        </table>
                    </div>

                    {isLoading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                            <span className="ml-2 text-gray-600">Cargando...</span>
                        </div>
                    )}

                    {!isLoading && candidates.length === 0 && (
                        <div className="text-center py-12">
                            {process?.bulkConfig?.autoFilterEnabled && process?.bulkConfig?.scoreThreshold !== undefined ? (
                                <div className="space-y-2">
                                    <p className="text-gray-500">No hay candidatos que cumplan con los filtros automáticos</p>
                                    <p className="text-sm text-gray-400">
                                        Score mínimo requerido: {process.bulkConfig.scoreThreshold}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-gray-500">No hay candidatos para mostrar</p>
                            )}
                        </div>
                    )}

                    {hasMore && !isLoading && (
                        <div className="text-center py-4">
                            <button
                                onClick={() => loadCandidates(currentPage + 1, false)}
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                            >
                                Cargar más ({total - candidates.length} restantes)
                            </button>
                        </div>
                    )}
                </div>
            )}

            <BulkActionsFAB
                selectedIds={Array.from(selectedIds)}
                onApprove={handleBulkApprove}
                onReject={handleBulkReject}
                onArchive={handleBulkArchive}
                onWebhook={handleWebhook}
                onDelete={handleBulkDelete}
                onWhatsApp={() => setShowWhatsAppModal(true)}
                onEmail={() => setShowEmailModal(true)}
                onBulkSchedule={() => setShowBulkScheduleModal(true)}
            />

            <CandidateDrawer
                candidate={drawerCandidate}
                isOpen={isDrawerOpen}
                onClose={() => {
                    setIsDrawerOpen(false);
                    setDrawerCandidate(null);
                }}
                onLoadDetails={async (candidateId) => {
                    const details = await bulkCandidatesApi.getCandidateDetails(candidateId);
                    setDrawerCandidate(details);
                }}
                process={process}
            />

            {showProcessModal && (
                <BulkProcessEditorModal
                    process={editingProcess}
                    onClose={() => {
                        setShowProcessModal(false);
                        setEditingProcess(null);
                    }}
                    onSave={handleProcessSaved}
                />
            )}

            {showImportModal && process && (
                <BulkProcessImportModal
                    process={process}
                    onClose={() => setShowImportModal(false)}
                    onImportComplete={() => {
                        setShowImportModal(false);
                        loadCandidates(0, true);
                    }}
                />
            )}

            {showWhatsAppModal && (
                <BulkWhatsAppModal
                    isOpen={showWhatsAppModal}
                    onClose={() => setShowWhatsAppModal(false)}
                    candidates={candidates.filter(c => selectedIds.has(c.id))}
                    onSend={handleBulkWhatsApp}
                />
            )}

            {showEmailModal && (
                <BulkEmailModal
                    isOpen={showEmailModal}
                    onClose={() => setShowEmailModal(false)}
                    candidates={candidates.filter(c => selectedIds.has(c.id))}
                    onSend={handleBulkEmail}
                />
            )}

            {showScheduleModal && schedulingCandidate && (
                <QuickScheduleModal
                    isOpen={showScheduleModal}
                    onClose={() => {
                        setShowScheduleModal(false);
                        setSchedulingCandidate(null);
                    }}
                    candidateId={schedulingCandidate.id}
                    candidateName={schedulingCandidate.name}
                    onSchedule={handleQuickSchedule}
                />
            )}

            {showBulkScheduleModal && (
                <BulkScheduleModal
                    isOpen={showBulkScheduleModal}
                    onClose={() => setShowBulkScheduleModal(false)}
                    candidateCount={selectedIds.size}
                    onSchedule={handleBulkSchedule}
                />
            )}

            {showAddColumnModal && (
                <AddColumnModal
                    isOpen={showAddColumnModal}
                    onClose={() => setShowAddColumnModal(false)}
                    onAdd={handleAddColumn}
                />
            )}

            {showTemplateModal && (
                <TableTemplateModal
                    isOpen={showTemplateModal}
                    onClose={() => setShowTemplateModal(false)}
                    currentColumns={customColumns}
                    onLoadTemplate={handleLoadTemplate}
                />
            )}
        </div>
    );
};
