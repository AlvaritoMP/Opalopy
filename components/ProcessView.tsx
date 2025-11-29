import React, { useState } from 'react';
import { useAppState } from '../App';
import { CandidateCard } from './CandidateCard';
import { Plus, Edit, Briefcase, DollarSign, BarChart, Clock, Paperclip, X, FileText, ClipboardList, Tag, Users, ArrowLeft } from 'lucide-react';
import { AddCandidateModal } from './AddCandidateModal';
import { ProcessEditorModal } from './ProcessEditorModal';
import { BulkLetterModal } from './BulkLetterModal';
import { Attachment, UserRole, ProcessStatus, Candidate } from '../types';

interface ProcessViewProps {
    processId: string;
}

const ProcessAttachmentsModal: React.FC<{ 
    processId: string; 
    attachments: Attachment[]; 
    onClose: () => void;
    onLoadAttachments?: () => Promise<void>;
    processFolderId?: string;
    googleDriveConfig?: any;
}> = ({ processId, attachments, onClose, onLoadAttachments, processFolderId, googleDriveConfig }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [loadedAttachments, setLoadedAttachments] = useState<Attachment[]>(attachments);
    const [hasLoaded, setHasLoaded] = useState(attachments.length > 0);

    const handleLoadAttachments = async () => {
        if (hasLoaded || isLoading) return;
        setIsLoading(true);
        try {
            if (onLoadAttachments) {
                await onLoadAttachments();
            } else {
                const { processesApi } = await import('../lib/api/processes');
                const atts = await processesApi.getAttachments(processId, processFolderId, googleDriveConfig);
                setLoadedAttachments(atts);
            }
            setHasLoaded(true);
        } catch (error) {
            console.error('Error cargando attachments del proceso:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Cargar attachments automáticamente si no hay ninguno cargado
    React.useEffect(() => {
        if (!hasLoaded && loadedAttachments.length === 0) {
            handleLoadAttachments();
        }
    }, []);

    const displayAttachments = hasLoaded ? loadedAttachments : attachments;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Documentos del proceso</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                        <X />
                    </button>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="text-center py-8">
                            <p className="text-sm text-gray-500">Cargando documentos...</p>
                        </div>
                    ) : displayAttachments.length > 0 ? (
                        displayAttachments.map(att => (
                            <a 
                                href={att.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                key={att.id} 
                                className="flex items-center p-2 rounded-md hover:bg-gray-100"
                            >
                                <FileText className="w-5 h-5 mr-3 text-gray-500"/>
                                <span className="text-sm font-medium text-primary-600">{att.name}</span>
                            </a>
                        ))
                    ) : (
                        <p className="text-sm text-gray-500 text-center">No hay documentos adjuntos para este proceso.</p>
                    )}
                </div>
            </div>
        </div>
    );
};


export const ProcessView: React.FC<ProcessViewProps> = ({ processId }) => {
    const { state, actions } = useAppState();
    const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
    const [isProcessEditorOpen, setIsProcessEditorOpen] = useState(false);
    const [isAttachmentsModalOpen, setIsAttachmentsModalOpen] = useState(false);
    const [isBulkLetterOpen, setIsBulkLetterOpen] = useState(false);
    const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
    const [attachmentsCount, setAttachmentsCount] = useState<number | null>(null);
    const [processAttachments, setProcessAttachments] = useState<Attachment[]>([]);
    const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
    const dragPayload = React.useRef<{ candidateId: string; isBulk: boolean; processing?: boolean } | null>(null);

    const process = state.processes.find(p => p.id === processId);

    // Cargar conteo de attachments al montar el componente (incluyendo archivos de Google Drive)
    React.useEffect(() => {
        const loadAttachmentsCount = async () => {
            if (!processId || !process) return;
            try {
                const { processesApi } = await import('../lib/api/processes');
                const googleDriveConfig = state.settings?.googleDrive;
                const count = await processesApi.getAttachmentsCount(
                    processId, 
                    process.googleDriveFolderId,
                    googleDriveConfig
                );
                setAttachmentsCount(count);
            } catch (error) {
                console.warn('Error cargando conteo de attachments del proceso:', error);
                // Si falla, usar el conteo de attachments existentes si hay
                if (process?.attachments && process.attachments.length > 0) {
                    setAttachmentsCount(process.attachments.length);
                }
            }
        };
        loadAttachmentsCount();
    }, [processId, process?.id, process?.googleDriveFolderId, state.settings?.googleDrive]);
    
    // Filtrar candidatos según el rol del usuario
    // Admin y Recruiter ven todos los candidatos
    // Client y Viewer solo ven candidatos con visibleToClients === true
    const userRole = state.currentUser?.role as UserRole;
    const canManageProcess = ['admin', 'recruiter'].includes(userRole);
    const canMoveCandidates = ['admin', 'recruiter', 'client'].includes(userRole);
    const isClientOrViewer = ['client', 'viewer'].includes(userRole);
    
    const candidates = state.candidates.filter(c => {
        if (c.processId !== processId || c.archived) return false;
        // Si es cliente o viewer, solo mostrar candidatos visibles
        if (isClientOrViewer && !c.visibleToClients) return false;
        return true;
    });


    const handleSelectCandidate = (candidateId: string) => {
        setSelectedCandidates(prev =>
            prev.includes(candidateId) ? prev.filter(id => id !== candidateId) : [...prev, candidateId]
        );
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, candidateId: string) => {
        if (!canMoveCandidates) return;
        const isBulk = selectedCandidates.includes(candidateId);
        dragPayload.current = { candidateId, isBulk };
        e.dataTransfer.setData("text/plain", candidateId); // Necessary for Firefox
    };

    const validateDocumentRequirements = async (candidate: Candidate, targetStageId: string): Promise<{ valid: boolean; missingDocs: string[] }> => {
        const targetStage = process?.stages.find(s => s.id === targetStageId);
        if (!targetStage || !targetStage.requiredDocuments || targetStage.requiredDocuments.length === 0) {
            console.log(`✅ No hay documentos requeridos para la etapa ${targetStage.name}`);
            return { valid: true, missingDocs: [] };
        }
        
        // Cargar attachments si no están disponibles (lazy loading)
        // SIEMPRE cargar desde la BD para asegurar que tenemos los attachments más recientes con sus categorías
        let candidateAttachments: Attachment[] = [];
        try {
            const { candidatesApi } = await import('../lib/api/candidates');
            candidateAttachments = await candidatesApi.getAttachments(candidate.id);
            console.log(`📄 Cargados ${candidateAttachments.length} attachments para validación del candidato ${candidate.name}`);
        } catch (error) {
            console.error('❌ Error cargando attachments para validación:', error);
            // Si falla la carga, intentar usar los attachments del candidato en memoria
            candidateAttachments = candidate.attachments || [];
            console.log(`⚠️ Usando attachments en memoria (${candidateAttachments.length} encontrados)`);
        }
        
        // Agrupar attachments por categoría PRIMERO
        const attachmentsByCategory = candidateAttachments.reduce((acc, att) => {
            if (att.category) {
                if (!acc[att.category]) acc[att.category] = [];
                acc[att.category].push(att);
            }
            return acc;
        }, {} as Record<string, Attachment[]>);
        
        // Debug: Log de attachments y categorías
        console.log(`🔍 Validando documentos para candidato "${candidate.name}" (ID: ${candidate.id}):`);
        console.log(`  - Attachments encontrados: ${candidateAttachments.length}`);
        
        // Mostrar categorías requeridas con sus nombres
        const requiredCategoriesInfo = targetStage.requiredDocuments.map(catId => {
            const category = process?.documentCategories?.find(c => c.id === catId);
            return category ? `${category.name} (${catId})` : `[CATEGORÍA NO ENCONTRADA] (${catId})`;
        });
        console.log(`  - 📋 Categorías requeridas (${targetStage.requiredDocuments.length}):`, requiredCategoriesInfo.join(', '));
        
        // Mostrar todas las categorías disponibles en el proceso
        console.log(`  - 📚 Categorías disponibles en el proceso:`, process?.documentCategories?.map(c => `${c.name} (${c.id})`).join(', ') || 'ninguna');
        
        // Mostrar todos los attachments con sus categorías
        console.log(`  - 📄 Attachments del candidato:`);
        candidateAttachments.forEach(att => {
            const categoryName = att.category ? (process?.documentCategories?.find(c => c.id === att.category)?.name || `[CATEGORÍA NO ENCONTRADA] (${att.category})`) : 'sin categoría';
            console.log(`     • ${att.name}: categoría = "${categoryName}"`);
        });
        
        // Mostrar attachments agrupados por categoría
        const categoriesWithAttachments = Object.keys(attachmentsByCategory).map(catId => {
            const catName = process?.documentCategories?.find(c => c.id === catId)?.name || `[CATEGORÍA NO ENCONTRADA] (${catId})`;
            return `${catName} (${attachmentsByCategory[catId].length} archivo(s))`;
        });
        console.log(`  - 📦 Attachments agrupados por categoría:`, categoriesWithAttachments.join(', ') || 'ninguna');
        
        const missingDocs: string[] = [];
        targetStage.requiredDocuments.forEach(catId => {
            const categoryAttachments = attachmentsByCategory[catId] || [];
            const category = process?.documentCategories?.find(c => c.id === catId);
            const categoryName = category?.name || `[CATEGORÍA NO ENCONTRADA] (${catId})`;
            
            if (categoryAttachments.length === 0) {
                missingDocs.push(categoryName);
                console.log(`  ❌ FALTA: ${categoryName} (ID: ${catId})`);
                // Mostrar qué categorías SÍ tiene el candidato para ayudar a identificar el problema
                const candidateCategoryIds = Object.keys(attachmentsByCategory);
                if (candidateCategoryIds.length > 0) {
                    const candidateCategoryNames = candidateCategoryIds.map(id => {
                        const cat = process?.documentCategories?.find(c => c.id === id);
                        return cat ? cat.name : `[CATEGORÍA NO ENCONTRADA] (${id})`;
                    });
                    console.log(`     ⚠️ El candidato tiene estas categorías: ${candidateCategoryNames.join(', ')}`);
                }
            } else {
                console.log(`  ✅ ENCONTRADO: ${categoryName} (ID: ${catId}) - ${categoryAttachments.length} archivo(s)`);
                categoryAttachments.forEach(att => {
                    console.log(`     - ${att.name}`);
                });
            }
        });
        
        const isValid = missingDocs.length === 0;
        console.log(`📊 Resultado de validación: ${isValid ? '✅ VÁLIDO' : '❌ INVÁLIDO'} - ${missingDocs.length} documento(s) faltante(s)`);
        
        if (!isValid) {
            console.log(`💡 SOLUCIÓN: Asigna las siguientes categorías a los documentos del candidato:`);
            missingDocs.forEach(docName => {
                const requiredCatId = targetStage.requiredDocuments.find(catId => {
                    const cat = process?.documentCategories?.find(c => c.id === catId);
                    return cat?.name === docName;
                });
                console.log(`   - "${docName}" (ID: ${requiredCatId})`);
            });
        }
        
        return { valid: isValid, missingDocs };
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>, stageId: string) => {
        if (!canMoveCandidates || !dragPayload.current) {
            // Limpiar clase si existe
            if (e.currentTarget) {
                e.currentTarget.classList.remove('bg-primary-50');
            }
            return;
        }
        
        // Prevenir múltiples ejecuciones
        if (dragPayload.current.processing) {
            console.log('⚠️ Ya se está procesando un movimiento, ignorando...');
            return;
        }
        
        dragPayload.current.processing = true;
        const { candidateId, isBulk } = dragPayload.current;

        const movedBy = state.currentUser?.name || 'System';

        try {
            if (isBulk && selectedCandidates.length > 0) {
            const candidatesToMove: Candidate[] = [];
            const candidatesWithMissingDocs: { candidate: Candidate; missingDocs: string[] }[] = [];
            
            // Validar todos los candidatos en paralelo
            const validationPromises = selectedCandidates.map(async (id) => {
                const candidate = state.candidates.find(c => c.id === id);
                if (candidate && candidate.stageId !== stageId) {
                    const validation = await validateDocumentRequirements(candidate, stageId);
                    return { candidate, validation };
                }
                return null;
            });
            
            const validationResults = await Promise.all(validationPromises);
            
            validationResults.forEach(result => {
                if (result && result.validation.valid) {
                    candidatesToMove.push(result.candidate);
                } else if (result && !result.validation.valid) {
                    candidatesWithMissingDocs.push({ candidate: result.candidate, missingDocs: result.validation.missingDocs });
                }
            });
            
            if (candidatesWithMissingDocs.length > 0) {
                const names = candidatesWithMissingDocs.map(c => c.candidate.name).join(', ');
                const missingDocsList = candidatesWithMissingDocs[0].missingDocs.join(', ');
                alert(`No se pueden mover los siguientes candidatos porque faltan documentos requeridos:\n\n${names}\n\nDocumentos faltantes: ${missingDocsList}\n\nRevisa la pestaña "Documentos" en los detalles del candidato.`);
            }
            
            // Mover candidatos uno por uno (no usar forEach con async/await)
            for (const candidate of candidatesToMove) {
                try {
                    await actions.updateCandidate({ ...candidate, stageId }, movedBy);
                } catch (error) {
                    console.error('Error moviendo candidato:', error);
                    // El error ya fue manejado en updateCandidate
                }
            }
            
            // Recargar candidatos después de mover todos para asegurar sincronización
            if (candidatesToMove.length > 0 && actions.reloadCandidates && typeof actions.reloadCandidates === 'function') {
                try {
                    await actions.reloadCandidates();
                } catch (reloadError) {
                    console.warn('Error recargando candidatos después de mover (no crítico):', reloadError);
                }
            }
            
            setSelectedCandidates([]);
        } else {
            const candidate = state.candidates.find(c => c.id === candidateId);
            if (candidate && candidate.stageId !== stageId) {
                const validation = await validateDocumentRequirements(candidate, stageId);
                if (!validation.valid) {
                    alert(`No se puede mover a "${process?.stages.find(s => s.id === stageId)?.name}" porque faltan los siguientes documentos requeridos:\n\n${validation.missingDocs.join(', ')}\n\nRevisa la pestaña "Documentos" en los detalles del candidato.`);
                    dragPayload.current = null;
                    if (e.currentTarget) {
                        e.currentTarget.classList.remove('bg-primary-50');
                    }
                    return;
                }
                try {
                    await actions.updateCandidate({ ...candidate, stageId }, movedBy);
                    // Recargar candidatos después de mover para asegurar sincronización
                    if (actions.reloadCandidates && typeof actions.reloadCandidates === 'function') {
                        try {
                            await actions.reloadCandidates();
                        } catch (reloadError) {
                            console.warn('Error recargando candidatos después de mover (no crítico):', reloadError);
                        }
                    }
                } catch (error) {
                    console.error('Error moviendo candidato:', error);
                    // El error ya fue manejado en updateCandidate
                }
            }
        }
        } finally {
            // Limpiar estado de procesamiento
            if (dragPayload.current) {
                dragPayload.current.processing = false;
            }
            dragPayload.current = null;
            if (e.currentTarget) {
                e.currentTarget.classList.remove('bg-primary-50');
            }
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!canMoveCandidates) return;
        e.preventDefault();
        e.currentTarget.classList.add('bg-primary-50');
    };
    
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        if (e.currentTarget) {
            e.currentTarget.classList.remove('bg-primary-50');
        }
    };

    if (!process) return <div className="p-8 text-center">Proceso no encontrado.</div>;
    
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

    const InfoChip: React.FC<{icon: React.ElementType, text: string}> = ({ icon: Icon, text }) => (
        <div className="flex items-center bg-gray-100 text-gray-700 px-2 md:px-3 py-1 rounded-full text-xs md:text-sm">
            <Icon className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-1.5 flex-shrink-0" /> <span className="truncate max-w-[150px] md:max-w-none">{text}</span>
        </div>
    );

    const currentStatus = process.status || 'en_proceso';
    const totalVacancies = process.vacancies ?? 0;

    return (
        <div className="flex flex-col h-full">
            <header className="p-3 md:p-4 border-b bg-white flex-shrink-0">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-3">
                     <div className="flex items-center space-x-2 md:space-x-3 flex-wrap">
                        <button
                            onClick={() => actions.setView('processes', null)}
                            className="flex items-center justify-center p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
                            title="Volver a la lista de procesos"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-800 break-words">{process.title}</h1>
                        <span className={`px-2 md:px-3 py-1 rounded-full text-xs font-semibold ${statusColors[currentStatus]} whitespace-nowrap`}>
                            {statusLabels[currentStatus]}
                        </span>
                     </div>
                     {canManageProcess && (
                        <div className="flex flex-wrap items-center gap-2 md:gap-3">
                            {selectedCandidates.length > 0 && (
                                <button onClick={() => setIsBulkLetterOpen(true)} className="flex items-center px-3 md:px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-xs md:text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap">
                                    <FileText className="w-4 h-4 mr-1 md:mr-2"/> <span className="hidden sm:inline">Emitir cartas</span> <span className="sm:hidden">Cartas</span> ({selectedCandidates.length})
                                </button>
                            )}
                            <button 
                                onClick={async () => {
                                    setIsAttachmentsModalOpen(true);
                                    // Cargar attachments si no están cargados
                                    if (processAttachments.length === 0 && !isLoadingAttachments) {
                                        setIsLoadingAttachments(true);
                                        try {
                                            const { processesApi } = await import('../lib/api/processes');
                                            const googleDriveConfig = state.settings?.googleDrive;
                                            const atts = await processesApi.getAttachments(
                                                processId,
                                                process?.googleDriveFolderId,
                                                googleDriveConfig
                                            );
                                            setProcessAttachments(atts);
                                        } catch (error) {
                                            console.error('Error cargando attachments:', error);
                                        } finally {
                                            setIsLoadingAttachments(false);
                                        }
                                    }
                                }} 
                                className="flex items-center px-3 md:px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-xs md:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap" 
                                disabled={attachmentsCount !== null && attachmentsCount === 0}
                            >
                                <Paperclip className="w-4 h-4 mr-1 md:mr-2"/> 
                                <span className="hidden sm:inline">Ver documentos</span> 
                                ({attachmentsCount !== null ? attachmentsCount : process.attachments?.length || 0})
                            </button>
                            <button onClick={() => setIsProcessEditorOpen(true)} className="flex items-center px-3 md:px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-xs md:text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap">
                                <Edit className="w-4 h-4 mr-1 md:mr-2"/> <span className="hidden md:inline">Editar proceso</span> <span className="md:hidden">Editar</span>
                            </button>
                            <button onClick={() => setIsAddCandidateOpen(true)} className="flex items-center px-3 md:px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700 whitespace-nowrap">
                                <Plus className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" /> <span className="hidden md:inline">Añadir candidato</span> <span className="md:hidden">Añadir</span>
                            </button>
                        </div>
                     )}
                </div>
                <div className="flex items-center flex-wrap gap-2 md:gap-3">
                    {process.serviceOrderCode && <InfoChip icon={ClipboardList} text={`OS: ${process.serviceOrderCode}`} />}
                    {process.seniority && <InfoChip icon={Briefcase} text={process.seniority} />}
                    {process.salaryRange && <InfoChip icon={DollarSign} text={`${state.settings?.currencySymbol || ''}${process.salaryRange.replace(/[$\€£S/]/g, '').trim()}`} />}
                    {process.experienceLevel && <InfoChip icon={BarChart} text={process.experienceLevel} />}
                    {process.startDate && process.endDate && <InfoChip icon={Clock} text={`${process.startDate} a ${process.endDate}`} />}
                    <InfoChip icon={Users} text={`Vacantes: ${totalVacancies}`} />
                </div>
            </header>
            <main className="flex-1 flex overflow-x-auto p-2 md:p-4 bg-gray-50/50 space-x-2 md:space-x-4 pb-4">
                {process.stages.map(stage => (
                    <div
                        key={stage.id}
                        onDrop={(e) => handleDrop(e, stage.id)}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className="flex-shrink-0 w-[280px] md:w-80 bg-gray-100 rounded-lg p-2 md:p-3 transition-colors"
                    >
                        <h3 className="font-semibold text-sm md:text-base text-gray-700 mb-2 md:mb-3 px-1 flex justify-between">
                            <span className="truncate mr-2">{stage.name}</span>
                            <span className="flex-shrink-0">({candidates.filter(c => c.stageId === stage.id).length})</span>
                        </h3>
                        <div className="space-y-3 min-h-[50px]">
                            {candidates
                                .filter(c => c.stageId === stage.id)
                                .map(candidate => (
                                    <div key={candidate.id} draggable={canMoveCandidates} onDragStart={(e) => handleDragStart(e, candidate.id)}>
                                        <CandidateCard 
                                            candidate={candidate}
                                            isSelected={selectedCandidates.includes(candidate.id)}
                                            onSelect={handleSelectCandidate}
                                        />
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                ))}
            </main>
            {isAddCandidateOpen && <AddCandidateModal process={process} onClose={() => setIsAddCandidateOpen(false)} />}
            {isProcessEditorOpen && <ProcessEditorModal process={process} onClose={() => setIsProcessEditorOpen(false)} />}
            {isAttachmentsModalOpen && (
                <ProcessAttachmentsModal 
                    processId={processId}
                    attachments={processAttachments.length > 0 ? processAttachments : (process.attachments || [])} 
                    onClose={() => setIsAttachmentsModalOpen(false)}
                    processFolderId={process?.googleDriveFolderId}
                    googleDriveConfig={state.settings?.googleDrive}
                    onLoadAttachments={async () => {
                        if (processAttachments.length === 0) {
                            const { processesApi } = await import('../lib/api/processes');
                            const googleDriveConfig = state.settings?.googleDrive;
                            const atts = await processesApi.getAttachments(
                                processId,
                                process?.googleDriveFolderId,
                                googleDriveConfig
                            );
                            setProcessAttachments(atts);
                        }
                    }}
                />
            )}
            {isBulkLetterOpen && <BulkLetterModal candidateIds={selectedCandidates} onClose={() => setIsBulkLetterOpen(false)} />}
        </div>
    );
};