import React, { useState } from 'react';
import { useAppState } from '../App';
import { Candidate } from '../types';
import { X, ArrowRight, Copy } from 'lucide-react';

interface ChangeProcessModalProps {
    candidate: Candidate;
    onClose: () => void;
}

export const ChangeProcessModal: React.FC<ChangeProcessModalProps> = ({ candidate, onClose }) => {
    const { state, actions } = useAppState();
    const [actionType, setActionType] = useState<'move' | 'duplicate'>('move');
    const [targetProcessId, setTargetProcessId] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const availableProcesses = state.processes.filter(p => p.id !== candidate.processId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetProcessId) {
            setError('Selecciona un proceso de destino.');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            if (actionType === 'move') {
                await actions.moveCandidateToProcess(candidate.id, targetProcessId);
                // Recargar candidatos para reflejar el cambio
                await actions.reloadCandidates();
                actions.showToast(
                    `Candidato movido exitosamente a "${state.processes.find(p => p.id === targetProcessId)?.title || 'el proceso seleccionado'}"`,
                    'success',
                    3000
                );
            } else {
                await actions.duplicateCandidateToProcess(candidate.id, targetProcessId);
                // Recargar candidatos para reflejar el cambio
                await actions.reloadCandidates();
                actions.showToast(
                    `Candidato duplicado exitosamente en "${state.processes.find(p => p.id === targetProcessId)?.title || 'el proceso seleccionado'}"`,
                    'success',
                    3000
                );
            }
            
            onClose();
        } catch (error: any) {
            console.error('Error en cambio de proceso:', error);
            setError(error.message || 'Ocurrió un error al procesar la acción. Por favor, intenta nuevamente.');
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-gray-800">Mover o duplicar candidato</h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                            <X className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                    <div className="p-6 space-y-6">
                        <p className="text-sm text-gray-600">
                            Estás a punto de modificar la postulación de <span className="font-bold">{candidate.name}</span>.
                        </p>
                        
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}
                        
                        {/* Action Type Selection */}
                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium text-gray-900">Acción</legend>
                             <div className="flex items-center space-x-4">
                                <label className={`flex-1 flex items-center p-4 border rounded-lg cursor-pointer ${actionType === 'move' ? 'border-primary-500 bg-primary-50' : 'border-gray-300'}`}>
                                    <input type="radio" name="actionType" value="move" checked={actionType === 'move'} onChange={() => setActionType('move')} className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"/>
                                    <span className="ml-3 flex flex-col">
                                        <span className="font-medium text-gray-900 flex items-center"><ArrowRight className="w-4 h-4 mr-2"/> Mover a otro proceso</span>
                                        <span className="text-xs text-gray-500">Reasigna el candidato a un nuevo proceso.</span>
                                    </span>
                                </label>
                                <label className={`flex-1 flex items-center p-4 border rounded-lg cursor-pointer ${actionType === 'duplicate' ? 'border-primary-500 bg-primary-50' : 'border-gray-300'}`}>
                                    <input type="radio" name="actionType" value="duplicate" checked={actionType === 'duplicate'} onChange={() => setActionType('duplicate')} className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"/>
                                     <span className="ml-3 flex flex-col">
                                        <span className="font-medium text-gray-900 flex items-center"><Copy className="w-4 h-4 mr-2"/> Duplicar a otro proceso</span>
                                        <span className="text-xs text-gray-500">Crea una nueva postulación en otro proceso.</span>
                                    </span>
                                </label>
                            </div>
                        </fieldset>

                        {/* Target Process Selection */}
                        <div>
                            <label htmlFor="targetProcessId" className="block text-sm font-medium text-gray-700">Proceso de destino</label>
                            <select
                                id="targetProcessId"
                                value={targetProcessId}
                                onChange={e => setTargetProcessId(e.target.value)}
                                required
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            >
                                <option value="" disabled>Selecciona un proceso...</option>
                                {availableProcesses.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            disabled={isProcessing}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={!targetProcessId || isProcessing} 
                            className="px-4 py-2 bg-primary-600 text-white rounded-md shadow-sm text-sm font-medium disabled:bg-primary-300 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isProcessing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                'Confirmar acción'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
