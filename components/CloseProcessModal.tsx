import React, { useState, useEffect } from 'react';
import { X, Check, Users, AlertCircle } from 'lucide-react';
import { Candidate, Process } from '../types';

interface CloseProcessModalProps {
    isOpen: boolean;
    onClose: () => void;
    process: Process | null;
    candidates: Candidate[];
    onCloseProcess: (hiredCandidateIds: string[]) => Promise<void>;
}

export const CloseProcessModal: React.FC<CloseProcessModalProps> = ({
    isOpen,
    onClose,
    process,
    candidates,
    onCloseProcess,
}) => {
    const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
    const [isClosing, setIsClosing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Cargar candidatos ya contratados si el proceso ya está cerrado
    useEffect(() => {
        if (process?.hiredCandidateIds && process.hiredCandidateIds.length > 0) {
            // Usar el nuevo sistema de hiredCandidateIds
            setSelectedCandidateIds(new Set(process.hiredCandidateIds));
        } else if (process?.status === 'terminado') {
            // Si el proceso está terminado pero no tiene hiredCandidateIds,
            // buscar candidatos con hireDate
            const candidatesWithHireDate = candidates
                .filter(c => c.hireDate && c.hireDate.trim() !== '' && !c.discarded && !c.archived)
                .map(c => c.id);
            if (candidatesWithHireDate.length > 0) {
                setSelectedCandidateIds(new Set(candidatesWithHireDate));
            } else {
                setSelectedCandidateIds(new Set());
            }
        } else {
            setSelectedCandidateIds(new Set());
        }
    }, [process, candidates]);

    if (!isOpen || !process) return null;

    // Filtrar candidatos (excluir descartados y archivados)
    const availableCandidates = candidates.filter(c => 
        !c.discarded && !c.archived
    );

    // Filtrar por búsqueda
    const filteredCandidates = availableCandidates.filter(c => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            c.name?.toLowerCase().includes(query) ||
            c.email?.toLowerCase().includes(query) ||
            c.phone?.includes(query) ||
            c.dni?.includes(query)
        );
    });

    const handleToggleCandidate = (candidateId: string) => {
        setSelectedCandidateIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(candidateId)) {
                newSet.delete(candidateId);
            } else {
                newSet.add(candidateId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedCandidateIds.size === filteredCandidates.length) {
            setSelectedCandidateIds(new Set());
        } else {
            setSelectedCandidateIds(new Set(filteredCandidates.map(c => c.id)));
        }
    };

    const handleCloseProcess = async () => {
        if (selectedCandidateIds.size === 0) {
            alert('Por favor, selecciona al menos un candidato contratado.');
            return;
        }

        setIsClosing(true);
        try {
            await onCloseProcess(Array.from(selectedCandidateIds));
            onClose();
        } catch (error) {
            console.error('Error cerrando proceso:', error);
            alert('Error al cerrar el proceso. Por favor, intenta nuevamente.');
        } finally {
            setIsClosing(false);
        }
    };

    const isProcessClosed = process.status === 'terminado' && process.hiredCandidateIds && process.hiredCandidateIds.length > 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">
                            {isProcessClosed ? 'Candidatos Contratados' : 'Cerrar Proceso de Selección'}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {isProcessClosed 
                                ? 'Candidatos seleccionados al cerrar este proceso'
                                : 'Selecciona los candidatos que fueron contratados para este proceso'
                            }
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                        disabled={isClosing}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {!isProcessClosed && (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start">
                                <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm text-blue-900 font-medium">
                                        Al cerrar el proceso, se marcará como "Terminado" y se registrarán los candidatos seleccionados como contratados.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Búsqueda */}
                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="Buscar candidatos por nombre, email, teléfono o DNI..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        />
                    </div>

                    {/* Contador y seleccionar todos */}
                    {!isProcessClosed && (
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">
                                    {selectedCandidateIds.size} de {filteredCandidates.length} seleccionados
                                </span>
                            </div>
                            {filteredCandidates.length > 0 && (
                                <button
                                    onClick={handleSelectAll}
                                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                                >
                                    {selectedCandidateIds.size === filteredCandidates.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Lista de candidatos */}
                    <div className="space-y-2">
                        {filteredCandidates.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>No hay candidatos disponibles</p>
                            </div>
                        ) : (
                            filteredCandidates.map(candidate => {
                                const isSelected = selectedCandidateIds.has(candidate.id);
                                return (
                                    <div
                                        key={candidate.id}
                                        onClick={() => !isProcessClosed && handleToggleCandidate(candidate.id)}
                                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                            isSelected
                                                ? 'border-primary-500 bg-primary-50'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        } ${isProcessClosed ? 'cursor-default' : ''}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 flex-1">
                                                {!isProcessClosed && (
                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                                        isSelected
                                                            ? 'bg-primary-500 border-primary-500'
                                                            : 'border-gray-300'
                                                    }`}>
                                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                )}
                                                {isProcessClosed && isSelected && (
                                                    <div className="w-5 h-5 rounded bg-green-500 flex items-center justify-center flex-shrink-0">
                                                        <Check className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-gray-900">{candidate.name || 'Sin nombre'}</div>
                                                    <div className="text-sm text-gray-500 space-x-3">
                                                        {candidate.email && <span>{candidate.email}</span>}
                                                        {candidate.phone && <span>{candidate.phone}</span>}
                                                        {candidate.dni && <span>DNI: {candidate.dni}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isClosing}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessClosed ? 'Cerrar' : 'Cancelar'}
                    </button>
                    {!isProcessClosed && (
                        <button
                            onClick={handleCloseProcess}
                            disabled={isClosing || selectedCandidateIds.size === 0}
                            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isClosing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Cerrando...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    Cerrar Proceso
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
