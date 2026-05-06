import React, { useState } from 'react';
import { X, MessageCircle, Users, Send } from 'lucide-react';
import { BulkCandidate } from '../lib/api/bulkCandidates';

interface BulkWhatsAppModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidates: BulkCandidate[];
    onSend: (message: string, createGroup: boolean) => Promise<void>;
}

export const BulkWhatsAppModal: React.FC<BulkWhatsAppModalProps> = ({
    isOpen,
    onClose,
    candidates,
    onSend,
}) => {
    const [message, setMessage] = useState('');
    const [createGroup, setCreateGroup] = useState(false);
    const [isSending, setIsSending] = useState(false);

    if (!isOpen) return null;

    const candidatesWithPhone = candidates.filter(c => c.phone);

    const handleSend = async () => {
        if (!message.trim()) {
            alert('Por favor, ingresa un mensaje');
            return;
        }

        setIsSending(true);
        try {
            await onSend(message, createGroup);
            setMessage('');
            setCreateGroup(false);
            onClose();
        } catch (error) {
            console.error('Error enviando mensajes:', error);
            alert('Error al enviar mensajes. Por favor, inténtalo de nuevo.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <MessageCircle className="w-6 h-6 text-green-600" />
                        <h2 className="text-xl font-semibold text-gray-900">
                            Enviar WhatsApp Masivo
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-sm text-blue-800">
                            <Users className="w-4 h-4" />
                            <span className="font-medium">
                                {candidatesWithPhone.length} candidato{candidatesWithPhone.length !== 1 ? 's' : ''} con teléfono
                            </span>
                        </div>
                        {candidates.length > candidatesWithPhone.length && (
                            <p className="text-xs text-blue-600 mt-2">
                                {candidates.length - candidatesWithPhone.length} candidato(s) sin teléfono no recibirán el mensaje
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Mensaje
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Escribe el mensaje que se enviará a todos los candidatos seleccionados..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                            rows={6}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Puedes usar variables como {'{'}{'{nombre}'}{'}'} para personalizar el mensaje
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="createGroup"
                            checked={createGroup}
                            onChange={(e) => setCreateGroup(e.target.checked)}
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                        />
                        <label htmlFor="createGroup" className="text-sm text-gray-700 cursor-pointer">
                            Crear grupo de WhatsApp (abrirá WhatsApp Web para crear el grupo)
                        </label>
                    </div>

                    {createGroup && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <p className="text-sm text-yellow-800">
                                <strong>Nota:</strong> Para crear un grupo, se abrirá WhatsApp Web. 
                                Deberás crear el grupo manualmente y agregar a los candidatos seleccionados.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            disabled={isSending}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={isSending || !message.trim()}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSending ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Enviar a {candidatesWithPhone.length} candidato{candidatesWithPhone.length !== 1 ? 's' : ''}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
