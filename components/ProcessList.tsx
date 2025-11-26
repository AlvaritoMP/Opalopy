import React, { useState, useEffect, useMemo } from 'react';
import { useAppState } from '../App';
import { Plus, MoreVertical, Eye, Edit, Trash2, Users, RefreshCw, Copy, Search, X, AlertTriangle } from 'lucide-react';
import { ProcessEditorModal } from './ProcessEditorModal';
import { Process, UserRole, ProcessStatus, Candidate } from '../types';

// Función utility para detectar si un proceso tiene candidatos en etapas críticas (no revisados)
const hasCandidatesInCriticalStages = (process: Process, candidates: Candidate[]): { hasCritical: boolean; count: number; stageNames: string[] } => {
    const criticalStageIds = process.stages.filter(stage => stage.isCritical).map(stage => stage.id);
    if (criticalStageIds.length === 0) {
        return { hasCritical: false, count: 0, stageNames: [] };
    }
    
    // Filtrar candidatos que están en etapas críticas y que NO han sido revisados
    const candidatesInCriticalStages = candidates.filter(c => {
        if (c.processId !== process.id || c.archived) return false;
        if (!criticalStageIds.includes(c.stageId)) return false;
        // Solo incluir si NO ha sido revisado (criticalStageReviewedAt es null/undefined)
        return !c.criticalStageReviewedAt;
    });
    
    const stageNames = candidatesInCriticalStages.map(c => {
        const stage = process.stages.find(s => s.id === c.stageId);
        return stage?.name || '';
    }).filter(Boolean);
    
    return {
        hasCritical: candidatesInCriticalStages.length > 0,
        count: candidatesInCriticalStages.length,
        stageNames: [...new Set(stageNames)] // Eliminar duplicados
    };
};

const ProcessCard: React.FC<{
    process: Process;
    candidateCount: number;
    criticalInfo: { hasCritical: boolean; count: number; stageNames: string[] };
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    canEdit: boolean;
}> = ({ process, candidateCount, criticalInfo, onView, onEdit, onDelete, onDuplicate, canEdit }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const { state } = useAppState();

    const statusLabels: Record<ProcessStatus, string> = {
        en_proceso: 'En Proceso',
        standby: 'Stand By',
        terminado: 'Terminado',
    };

    const statusColors: Record<ProcessStatus, string> = {
        en_proceso: 'bg-green-100 text-green-800',
        standby: 'bg-yellow-100 text-yellow-800',
        terminado: 'bg-gray-200 text-gray-700',
    };

    return (
        <div className={`bg-white rounded-xl border-2 ${criticalInfo.hasCritical ? 'border-amber-400 shadow-lg shadow-amber-100' : 'border-gray-200 shadow-sm'} overflow-hidden flex flex-col group`}>
            <div 
                className="h-40 bg-cover relative"
                style={{ 
                    backgroundImage: `url(${process.flyerUrl || 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800'})`,
                    backgroundPosition: process.flyerPosition || 'center center'
                }}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                {canEdit && (
                    <div className="absolute top-2 right-2">
                        <div className="relative">
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setDropdownOpen(!dropdownOpen); 
                                }} 
                                onBlur={(e) => {
                                    // Solo cerrar si el foco no se mueve a un elemento dentro del dropdown
                                    if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
                                        setTimeout(() => setDropdownOpen(false), 150);
                                    }
                                }} 
                                className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50"
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>
                            {dropdownOpen && (
                                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                                    <div className="py-1">
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDropdownOpen(false); onView(); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <Eye className="w-4 h-4 mr-3" /> Ver Tablero
                                        </button>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDropdownOpen(false); onEdit(); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <Edit className="w-4 h-4 mr-3" /> Editar
                                        </button>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDropdownOpen(false); onDuplicate(); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <Copy className="w-4 h-4 mr-3" /> Duplicar
                                        </button>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDropdownOpen(false); onDelete(); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                            <Trash2 className="w-4 h-4 mr-3" /> Eliminar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {(() => {
                    const currentStatus = process.status || 'en_proceso';
                    return (
                        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white">{process.title}</h3>
                            <div className="flex items-center gap-2">
                                {criticalInfo.hasCritical && (
                                    <div className="px-2 py-1 bg-amber-500 rounded-full flex items-center">
                                        <AlertTriangle className="w-3 h-3 text-white" />
                                    </div>
                                )}
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[currentStatus]}`}>
                                    {statusLabels[currentStatus]}
                                </span>
                            </div>
                        </div>
                    );
                })()}
            </div>
            <div className="p-4 flex-grow flex flex-col justify-between">
                {criticalInfo.hasCritical && (
                    <div className="mb-3 p-2.5 bg-amber-50 border border-amber-300 rounded-lg">
                        <div className="flex items-start">
                            <AlertTriangle className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-xs font-bold text-amber-900">⚠️ Requiere Atención</p>
                                <p className="text-xs text-amber-800 mt-1">
                                    {criticalInfo.count} candidato{criticalInfo.count !== 1 ? 's' : ''} en etapa{criticalInfo.count !== 1 ? 's' : ''} crítica: <strong>{criticalInfo.stageNames.join(', ')}</strong>
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{process.description}</p>
                <div>
                    {process.serviceOrderCode && (
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                            <span className="font-medium text-gray-700">Código OS:</span>
                            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{process.serviceOrderCode}</span>
                        </div>
                    )}
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                            <span className="font-medium text-gray-700">Rango salarial:</span>
                            <span>{process.salaryRange ? `${state.settings?.currencySymbol || ''}${process.salaryRange.replace(/[$\€£S/]/g, '').trim()}` : 'N/D'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                        <span className="font-medium text-gray-700">Vacantes:</span>
                        <span className="font-semibold text-gray-800">{process.vacancies ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                        <span className="font-medium text-gray-700">Candidatos:</span>
                        <div className="flex items-center">
                            <Users className="w-4 h-4 mr-1"/>
                            <span>{candidateCount}</span>
                        </div>
                    </div>
                </div>
            </div>
             <div className="p-4 bg-gray-50 border-t">
                <button onClick={onView} className="w-full text-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700 text-sm font-medium">
                    Ver Tablero
                </button>
            </div>
        </div>
    );
};


export const ProcessList: React.FC = () => {
    const { state, actions, getLabel } = useAppState();
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingProcess, setEditingProcess] = useState<Process | null>(null);
    const [statusFilter, setStatusFilter] = useState<ProcessStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isReloading, setIsReloading] = useState(false);
    
    const canManageProcesses = ['admin', 'recruiter'].includes(state.currentUser?.role as UserRole);
    
    // Recarga automática cada 30 segundos
    useEffect(() => {
        const interval = setInterval(() => {
            actions.reloadProcesses().catch(error => {
                console.error('Error en recarga automática:', error);
            });
        }, 30000); // 30 segundos
        
        return () => clearInterval(interval);
    }, [actions]);
    
    const handleReload = async () => {
        setIsReloading(true);
        try {
            await actions.reloadProcesses();
        } catch (error: any) {
            console.error('Error al recargar:', error);
            alert(`Error al recargar procesos: ${error.message || 'No se pudieron recargar los procesos.'}`);
        } finally {
            setIsReloading(false);
        }
    };

    const handleEdit = (process: Process) => {
        setEditingProcess(process);
        setIsEditorOpen(true);
    };

    const handleAddNew = () => {
        setEditingProcess(null);
        setIsEditorOpen(true);
    };

    const handleDuplicate = (processToDuplicate: Process) => {
        // Crear una copia del proceso sin el ID y sin la carpeta de Google Drive
        // El modal verifica si process tiene ID para decidir si crear o actualizar
        // Al pasar un proceso sin ID válido, se tratará como nuevo proceso
        const duplicatedProcess: Process = {
            ...processToDuplicate,
            id: `temp-duplicate-${Date.now()}`, // ID temporal que no existe en BD
            title: `${processToDuplicate.title} (Copia)`, // Agregar "(Copia)" al título
            googleDriveFolderId: undefined, // No copiar la carpeta de Google Drive
            googleDriveFolderName: undefined, // No copiar el nombre de la carpeta
            attachments: [], // No copiar attachments (se pueden subir nuevos)
        };
        setEditingProcess(duplicatedProcess);
        setIsEditorOpen(true);
    };

    const handleDelete = async (processId: string) => {
        if (window.confirm('¿Seguro que deseas eliminar este proceso y todos sus candidatos? Esta acción no se puede deshacer.')) {
            try {
                await actions.deleteProcess(processId);
            } catch (error: any) {
                // El error ya se muestra en el alert dentro de deleteProcess
                console.error('Error al eliminar proceso:', error);
            }
        }
    };

    const statusFilters: { id: ProcessStatus | 'all'; label: string }[] = [
        { id: 'all', label: 'Todos' },
        { id: 'en_proceso', label: 'En Proceso' },
        { id: 'standby', label: 'Stand By' },
        { id: 'terminado', label: 'Terminado' },
    ];

    // Filtrar procesos por estado y búsqueda
    const filteredProcesses = useMemo(() => {
        let filtered = state.processes.filter(process => 
            statusFilter === 'all' ? true : (process.status || 'en_proceso') === statusFilter
        );

        // Aplicar filtro de búsqueda si hay un término
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(process => {
                // Buscar en título
                if (process.title?.toLowerCase().includes(query)) return true;
                // Buscar en descripción
                if (process.description?.toLowerCase().includes(query)) return true;
                // Buscar en código de orden de servicio
                if (process.serviceOrderCode?.toLowerCase().includes(query)) return true;
                // Buscar en rango salarial
                if (process.salaryRange?.toLowerCase().includes(query)) return true;
                // Buscar en nivel de experiencia
                if (process.experienceLevel?.toLowerCase().includes(query)) return true;
                // Buscar en seniority
                if (process.seniority?.toLowerCase().includes(query)) return true;
                return false;
            });
        }

        return filtered;
    }, [state.processes, statusFilter, searchQuery]);

    return (
        <div className="p-4 md:p-8 overflow-y-auto h-full">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 md:mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{getLabel('sidebar_processes', 'Procesos de contratación')}</h1>
                <div className="flex items-center gap-2 md:gap-3">
                    <button
                        onClick={handleReload}
                        disabled={isReloading}
                        className="flex items-center px-3 md:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg shadow-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                        title="Recargar procesos"
                    >
                        <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 md:mr-2 ${isReloading ? 'animate-spin' : ''}`} /> 
                        <span className="hidden sm:inline">{isReloading ? 'Recargando...' : 'Recargar'}</span>
                    </button>
                    {canManageProcesses && (
                        <button
                            onClick={handleAddNew}
                            className="flex items-center px-3 md:px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700 text-sm md:text-base whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4 md:w-5 md:h-5 md:mr-2" /> <span className="hidden sm:inline">Nuevo proceso</span> <span className="sm:hidden">Nuevo</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Barra de búsqueda */}
            <div className="mb-4 md:mb-6">
                <div className="relative max-w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar procesos por título, descripción, código OS..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            title="Limpiar búsqueda"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
                {searchQuery && (
                    <p className="mt-2 text-sm text-gray-500">
                        {filteredProcesses.length === 0 
                            ? 'No se encontraron procesos que coincidan con la búsqueda'
                            : `${filteredProcesses.length} proceso${filteredProcesses.length !== 1 ? 's' : ''} encontrado${filteredProcesses.length !== 1 ? 's' : ''}`
                        }
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-6">
                {statusFilters.map(filter => (
                    <button
                        key={filter.id}
                        onClick={() => setStatusFilter(filter.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border ${statusFilter === filter.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            {filteredProcesses.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                    <p className="text-gray-500 text-lg">
                        {searchQuery || statusFilter !== 'all' 
                            ? 'No se encontraron procesos que coincidan con los filtros seleccionados'
                            : 'No hay procesos disponibles. Crea tu primer proceso para comenzar.'
                        }
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProcesses.map(process => {
                    const userRole = state.currentUser?.role;
                    const isClientOrViewer = userRole === 'client' || userRole === 'viewer';
                    
                    const filteredCandidates = state.candidates.filter(c => {
                        if (c.processId !== process.id || c.archived) return false;
                        if (isClientOrViewer && !c.visibleToClients) return false;
                        return true;
                    });
                    
                    const criticalInfo = hasCandidatesInCriticalStages(process, filteredCandidates);
                    
                    return (
                        <ProcessCard
                            key={process.id}
                            process={process}
                            canEdit={canManageProcesses}
                            candidateCount={filteredCandidates.length}
                            criticalInfo={criticalInfo}
                            onView={() => actions.setView('process-view', process.id)}
                            onEdit={() => handleEdit(process)}
                            onDuplicate={() => handleDuplicate(process)}
                            onDelete={() => handleDelete(process.id)}
                        />
                    );
                })}
                </div>
            )}
            {isEditorOpen && <ProcessEditorModal process={editingProcess} onClose={() => setIsEditorOpen(false)} />}
        </div>
    );
};