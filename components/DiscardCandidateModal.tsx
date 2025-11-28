import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAppState } from '../App';

interface DiscardCandidateModalProps {
    candidateId: string;
    candidateName: string;
    onClose: () => void;
    onDiscard: (reason: string) => Promise<void>;
}

export const DiscardCandidateModal: React.FC<DiscardCandidateModalProps> = ({
    candidateId,
    candidateName,
    onClose,
    onDiscard,
}) => {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) {
            alert('Por favor ingresa un motivo para descartar al candidato');
            return;
        }

        setIsSubmitting(true);
        try {
            await onDiscard(reason.trim());
            onClose();
        } catch (error) {
            console.error('Error descartando candidato:', error);
            alert('Error al descartar el candidato. Por favor intenta nuevamente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Descartar Candidato</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100"
                        disabled={isSubmitting}
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-4">
                            ¿Estás seguro de que deseas descartar a <strong>{candidateName}</strong>?
                        </p>
                        <label htmlFor="discardReason" className="block text-sm font-medium text-gray-700 mb-2">
                            Motivo del descarte <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="discardReason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Ej: No cumple con los requisitos mínimos, No disponible para la fecha requerida, etc."
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            required
                            disabled={isSubmitting}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Este motivo será guardado y el candidato será movido a archivados.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-300"
                            disabled={isSubmitting || !reason.trim()}
                        >
                            {isSubmitting ? 'Descartando...' : 'Descartar Candidato'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

