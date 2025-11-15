import React, { useState } from 'react';
import { useAppState } from '../App';
import { Candidate } from '../types';
import { Undo2, Eye, Archive } from 'lucide-react';
import { CandidateDetailsModal } from './CandidateDetailsModal';

export const ArchivedCandidates: React.FC = () => {
    const { state, actions } = useAppState();
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

    const archivedCandidates = state.candidates.filter(c => c.archived);

    const getProcessTitle = (processId: string) => {
        return state.processes.find(p => p.id === processId)?.title || 'Proceso no disponible';
    };

    const getStageName = (candidate: Candidate) => {
        const process = state.processes.find(p => p.id === candidate.processId);
        return process?.stages.find(s => s.id === candidate.stageId)?.name || 'Etapa desconocida';
    };

    const handleRestore = (candidateId: string) => {
        actions.restoreCandidate(candidateId);
    };

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Candidatos Archivados</h1>
                    <p className="text-gray-500 mt-1">Accede al historial de candidatos archivados y restáuralos cuando sea necesario.</p>
                </div>
                <div className="px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-600">
                    Total archivados: <span className="font-semibold text-gray-800">{archivedCandidates.length}</span>
                </div>
            </div>

            {archivedCandidates.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
                    No hay candidatos archivados.
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidato</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proceso</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Etapa</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Archivado</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {archivedCandidates.map(candidate => (
                                    <tr key={candidate.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{candidate.name}</div>
                                            <div className="text-sm text-gray-500">{candidate.email}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{getProcessTitle(candidate.processId)}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{getStageName(candidate)}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {candidate.archivedAt ? new Date(candidate.archivedAt).toLocaleString('es-ES', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) : 'Sin información'}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm">
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={() => setSelectedCandidate(candidate)}
                                                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 text-sm"
                                                >
                                                    <Eye className="w-4 h-4 mr-1" /> Ver
                                                </button>
                                                <button
                                                    onClick={() => handleRestore(candidate.id)}
                                                    className="inline-flex items-center px-3 py-1.5 border border-green-200 text-green-700 rounded-md hover:bg-green-50 text-sm"
                                                >
                                                    <Undo2 className="w-4 h-4 mr-1" /> Restaurar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {selectedCandidate && (
                <CandidateDetailsModal
                    candidate={selectedCandidate}
                    onClose={() => setSelectedCandidate(null)}
                />
            )}
        </div>
    );
};



