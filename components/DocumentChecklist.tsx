import React, { useState } from 'react';
import { Candidate, Process, DocumentCategory, Attachment } from '../types';
import { CheckCircle, XCircle, AlertCircle, FileText, Edit, X } from 'lucide-react';
import { useAppState } from '../App';

interface DocumentChecklistProps {
    candidate: Candidate;
    process: Process;
}

export const DocumentChecklist: React.FC<DocumentChecklistProps> = ({ candidate, process }) => {
    const { state, actions } = useAppState();
    const [editingAttachmentCategory, setEditingAttachmentCategory] = useState<string | null>(null);
    const [selectedCategoryForEdit, setSelectedCategoryForEdit] = useState<string>('');
    
    const canEdit = ['admin', 'recruiter'].includes(state.currentUser?.role as string);
    const categories = process.documentCategories || [];
    const candidateAttachments = candidate.attachments || [];
    
    // Agrupar attachments por categoría
    const attachmentsByCategory = candidateAttachments.reduce((acc, att) => {
        const category = att.category || 'sin_categoria';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(att);
        return acc;
    }, {} as Record<string, Attachment[]>);
    
    // Obtener documentos sin categoría
    const uncategorizedAttachments = attachmentsByCategory['sin_categoria'] || [];
    
    // Verificar qué categorías están completas
    const getCategoryStatus = (category: DocumentCategory) => {
        const categoryAttachments = attachmentsByCategory[category.id] || [];
        const hasDocuments = categoryAttachments.length > 0;
        
        if (category.required) {
            return hasDocuments ? 'complete' : 'missing';
        }
        return hasDocuments ? 'optional-complete' : 'optional-empty';
    };
    
    // Verificar requisitos de la etapa actual
    const currentStage = process.stages.find(s => s.id === candidate.stageId);
    const requiredForStage = currentStage?.requiredDocuments || [];
    const canAdvance = requiredForStage.every(catId => {
        const categoryAttachments = attachmentsByCategory[catId] || [];
        return categoryAttachments.length > 0;
    });
    
    if (categories.length === 0) {
        return (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600">
                    No hay categorías de documentos definidas para este proceso. 
                    Configúralas en la edición del proceso.
                </p>
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            {/* Estado general */}
            <div className={`rounded-lg p-4 border-2 ${canAdvance ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                    {canAdvance ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-yellow-600" />
                    )}
                    <h3 className="font-semibold text-gray-800">
                        {canAdvance 
                            ? 'Documentos completos - Puede avanzar de etapa' 
                            : 'Faltan documentos requeridos para avanzar'}
                    </h3>
                </div>
                {!canAdvance && requiredForStage.length > 0 && (
                    <p className="text-sm text-gray-700">
                        Para avanzar a la siguiente etapa, se requieren los siguientes documentos: 
                        {requiredForStage.map(catId => {
                            const cat = categories.find(c => c.id === catId);
                            return cat ? ` ${cat.name}` : '';
                        }).join(', ')}
                    </p>
                )}
            </div>
            
            {/* Lista de categorías */}
            <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Checklist de documentos</h4>
                {categories.map(category => {
                    const status = getCategoryStatus(category);
                    const categoryAttachments = attachmentsByCategory[category.id] || [];
                    const isRequired = category.required || requiredForStage.includes(category.id);
                    
                    return (
                        <div 
                            key={category.id} 
                            className={`border rounded-lg p-3 ${
                                status === 'complete' 
                                    ? 'bg-green-50 border-green-200' 
                                    : status === 'missing'
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-gray-50 border-gray-200'
                            }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        {status === 'complete' || status === 'optional-complete' ? (
                                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                        ) : (
                                            <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                                        )}
                                        <span className="font-medium text-gray-800">
                                            {category.name}
                                        </span>
                                        {isRequired && (
                                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                                Requerido
                                            </span>
                                        )}
                                        {!isRequired && (
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                                Opcional
                                            </span>
                                        )}
                                    </div>
                                    {category.description && (
                                        <p className="text-xs text-gray-600 mb-2">{category.description}</p>
                                    )}
                                    {categoryAttachments.length > 0 ? (
                                        <div className="mt-2 space-y-1">
                                            {categoryAttachments.map(att => (
                                                <div key={att.id} className="flex items-center justify-between gap-2 text-xs text-gray-700 bg-white rounded px-2 py-1 group">
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <FileText className="w-3 h-3 flex-shrink-0" />
                                                        <span className="truncate">{att.name}</span>
                                                        {att.uploadedAt && (
                                                            <span className="text-gray-500 flex-shrink-0">
                                                                ({new Date(att.uploadedAt).toLocaleDateString()})
                                                            </span>
                                                        )}
                                                    </div>
                                                    {canEdit && (
                                                        <button
                                                            onClick={() => {
                                                                setEditingAttachmentCategory(att.id);
                                                                setSelectedCategoryForEdit(att.category || '');
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 transition-opacity flex-shrink-0"
                                                            title="Editar categoría"
                                                        >
                                                            <Edit className="w-3 h-3 text-blue-600" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 italic mt-1">
                                            No hay documentos en esta categoría
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {/* Resumen */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div>
                        <div className="font-semibold text-gray-800">
                            {categories.filter(c => getCategoryStatus(c) === 'complete' || getCategoryStatus(c) === 'optional-complete').length}
                        </div>
                        <div className="text-gray-600">Completadas</div>
                    </div>
                    <div>
                        <div className="font-semibold text-red-600">
                            {categories.filter(c => getCategoryStatus(c) === 'missing').length}
                        </div>
                        <div className="text-gray-600">Faltantes</div>
                    </div>
                    <div>
                        <div className="font-semibold text-gray-800">
                            {categories.length}
                        </div>
                        <div className="text-gray-600">Total</div>
                    </div>
                </div>
            </div>
            
            {/* Documentos sin categoría */}
            {uncategorizedAttachments.length > 0 && (
                <div className="border rounded-lg p-3 bg-yellow-50 border-yellow-200">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                        <span className="font-medium text-gray-800">
                            Documentos sin categoría ({uncategorizedAttachments.length})
                        </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                        Estos documentos no tienen una categoría asignada. Asigna una categoría para que se incluyan en el checklist.
                    </p>
                    <div className="mt-2 space-y-1">
                        {uncategorizedAttachments.map(att => (
                            <div key={att.id} className="flex items-center justify-between gap-2 text-xs text-gray-700 bg-white rounded px-2 py-1 group">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <FileText className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{att.name}</span>
                                    {att.uploadedAt && (
                                        <span className="text-gray-500 flex-shrink-0">
                                            ({new Date(att.uploadedAt).toLocaleDateString()})
                                        </span>
                                    )}
                                </div>
                                {canEdit && (
                                    <button
                                        onClick={() => {
                                            setEditingAttachmentCategory(att.id);
                                            setSelectedCategoryForEdit(att.category || '');
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 transition-opacity flex-shrink-0"
                                        title="Asignar categoría"
                                    >
                                        <Edit className="w-3 h-3 text-blue-600" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Modal para editar categoría de documento */}
            {editingAttachmentCategory && (() => {
                const attachment = candidateAttachments.find(att => att.id === editingAttachmentCategory);
                if (!attachment) return null;
                
                const handleUpdateCategory = async () => {
                    const loadingToastId = actions.showToast('Actualizando categoría...', 'loading', 0);
                    try {
                        // Obtener el candidato más reciente del estado para asegurar que tenemos los datos actualizados
                        const currentCandidateFromState = state.candidates.find(c => c.id === candidate.id) || candidate;
                        
                        // Actualizar attachments localmente
                        const updatedAttachments = (currentCandidateFromState.attachments || []).map(att => 
                            att.id === editingAttachmentCategory 
                                ? { ...att, category: selectedCategoryForEdit || undefined }
                                : att
                        );
                        
                        // Crear candidato actualizado con los attachments modificados
                        const updatedCandidate = { 
                            ...currentCandidateFromState, 
                            attachments: updatedAttachments 
                        };
                        
                        // Guardar en la base de datos (updateCandidate ya devuelve el candidato con attachments actualizados)
                        const savedCandidate = await actions.updateCandidate(updatedCandidate, state.currentUser?.name);
                        
                        // NO recargar candidatos del estado global aquí porque puede sobrescribir los cambios
                        // actions.updateCandidate ya actualiza el estado global correctamente con las categorías
                        
                        setEditingAttachmentCategory(null);
                        setSelectedCategoryForEdit('');
                        actions.hideToast(loadingToastId);
                        actions.showToast('Categoría actualizada exitosamente', 'success', 3000);
                    } catch (error: any) {
                        console.error('Error actualizando categoría:', error);
                        actions.hideToast(loadingToastId);
                        actions.showToast(`Error al actualizar la categoría: ${error.message || 'Error desconocido'}`, 'error', 5000);
                    }
                };
                
                return (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">Editar categoría de documento</h3>
                                <p className="text-sm text-gray-600 mt-1">Archivo: {attachment.name}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setEditingAttachmentCategory(null);
                                    setSelectedCategoryForEdit('');
                                }}
                                className="p-2 rounded-full hover:bg-gray-100"
                            >
                                <X className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Categoría
                            </label>
                            <select
                                value={selectedCategoryForEdit}
                                onChange={(e) => setSelectedCategoryForEdit(e.target.value)}
                                className="w-full border-gray-300 rounded-md shadow-sm mb-4"
                            >
                                <option value="">Sin categoría</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name} {cat.required && '(Requerido)'}
                                    </option>
                                ))}
                            </select>
                            {categories.length === 0 && (
                                <p className="text-sm text-gray-500 mb-4">
                                    No hay categorías definidas para este proceso.
                                </p>
                            )}
                        </div>
                        <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setEditingAttachmentCategory(null);
                                    setSelectedCategoryForEdit('');
                                }}
                                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleUpdateCategory}
                                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
};

