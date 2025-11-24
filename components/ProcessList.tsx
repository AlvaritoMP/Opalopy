import React, { useState, useEffect } from 'react';
import { useAppState } from '../App';
import { Plus, MoreVertical, Eye, Edit, Trash2, Users, RefreshCw, Copy } from 'lucide-react';
import { ProcessEditorModal } from './ProcessEditorModal';
import { Process, UserRole, ProcessStatus } from '../types';

const ProcessCard: React.FC<{
    process: Process;
    candidateCount: number;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    canEdit: boolean;
}> = ({ process, candidateCount, onView, onEdit, onDelete, onDuplicate, canEdit }) => {
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col group">
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
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[currentStatus]}`}>
                                {statusLabels[currentStatus]}
                            </span>
                        </div>
                    );
                })()}
            </div>
            <div className="p-4 flex-grow flex flex-col justify-between">
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

    const filteredProcesses = state.processes.filter(process => statusFilter === 'all' ? true : (process.status || 'en_proceso') === statusFilter);

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">{getLabel('sidebar_processes', 'Procesos de contratación')}</h1>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleReload}
                        disabled={isReloading}
                        className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg shadow-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Recargar procesos"
                    >
                        <RefreshCw className={`w-5 h-5 mr-2 ${isReloading ? 'animate-spin' : ''}`} /> 
                        {isReloading ? 'Recargando...' : 'Recargar'}
                    </button>
                    {canManageProcesses && (
                        <button
                            onClick={handleAddNew}
                            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700"
                        >
                            <Plus className="w-5 h-5 mr-2" /> Nuevo proceso
                        </button>
                    )}
                </div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProcesses.map(process => (
                    <ProcessCard
                        key={process.id}
                        process={process}
                        canEdit={canManageProcesses}
                        candidateCount={(() => {
                            const userRole = state.currentUser?.role;
                            const isClientOrViewer = userRole === 'client' || userRole === 'viewer';
                            return state.candidates.filter(c => {
                                if (c.processId !== process.id || c.archived) return false;
                                if (isClientOrViewer && !c.visibleToClients) return false;
                                return true;
                            }).length;
                        })()}
                        onView={() => actions.setView('process-view', process.id)}
                        onEdit={() => handleEdit(process)}
                        onDuplicate={() => handleDuplicate(process)}
                        onDelete={() => handleDelete(process.id)}
                    />
                ))}
            </div>
            {isEditorOpen && <ProcessEditorModal process={editingProcess} onClose={() => setIsEditorOpen(false)} />}
        </div>
    );
};