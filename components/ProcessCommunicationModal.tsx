import React, { useState, useEffect } from 'react';
import { X, Mail, MessageCircle, Send, CheckSquare, Square, Search } from 'lucide-react';
import { Candidate } from '../types';

interface ProcessCommunicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidates: Candidate[];
    onSendEmail: (candidateIds: string[], subject: string, body: string) => void;
    onSendWhatsApp: (candidateIds: string[], message: string) => void;
}

type CommunicationType = 'email' | 'whatsapp';

export const ProcessCommunicationModal: React.FC<ProcessCommunicationModalProps> = ({
    isOpen,
    onClose,
    candidates,
    onSendEmail,
    onSendWhatsApp,
}) => {
    const [communicationType, setCommunicationType] = useState<CommunicationType>('email');
    const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');

    // Filtrar candidatos disponibles (excluir descartados y archivados)
    const availableCandidates = candidates.filter(c => !c.discarded && !c.archived);

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

    // Filtrar candidatos con email o teléfono según el tipo de comunicación
    const candidatesWithContact = filteredCandidates.filter(c => {
        if (communicationType === 'email') {
            return c.email && c.email.trim() !== '';
        } else {
            return c.phone && c.phone.trim() !== '';
        }
    });

    useEffect(() => {
        // Resetear selección al cambiar tipo de comunicación
        setSelectedCandidateIds(new Set());
        setSubject('');
        setMessage('');
    }, [communicationType]);

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
        if (selectedCandidateIds.size === candidatesWithContact.length) {
            setSelectedCandidateIds(new Set());
        } else {
            setSelectedCandidateIds(new Set(candidatesWithContact.map(c => c.id)));
        }
    };

    const handleSend = () => {
        if (selectedCandidateIds.size === 0) {
            alert('Por favor, selecciona al menos un candidato.');
            return;
        }

        if (communicationType === 'email') {
            if (!subject.trim()) {
                alert('Por favor, ingresa un asunto para el correo.');
                return;
            }
            if (!message.trim()) {
                alert('Por favor, ingresa un mensaje.');
                return;
            }
            onSendEmail(Array.from(selectedCandidateIds), subject, message);
        } else {
            if (!message.trim()) {
                alert('Por favor, ingresa un mensaje.');
                return;
            }
            onSendWhatsApp(Array.from(selectedCandidateIds), message);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Comunicación Masiva</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Selecciona candidatos y envía mensajes personalizados
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {/* Selector de tipo de comunicación */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tipo de Comunicación
                        </label>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setCommunicationType('email')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                                    communicationType === 'email'
                                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                            >
                                <Mail className="w-5 h-5" />
                                <span className="font-medium">Email</span>
                            </button>
                            <button
                                onClick={() => setCommunicationType('whatsapp')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                                    communicationType === 'whatsapp'
                                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                            >
                                <MessageCircle className="w-5 h-5" />
                                <span className="font-medium">WhatsApp</span>
                            </button>
                        </div>
                    </div>

                    {/* Búsqueda */}
                    <div className="mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Buscar candidatos por nombre, email, teléfono o DNI..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Contador y seleccionar todos */}
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                                {selectedCandidateIds.size} de {candidatesWithContact.length} seleccionados
                            </span>
                            {candidatesWithContact.length < filteredCandidates.length && (
                                <span className="text-xs text-gray-400">
                                    ({filteredCandidates.length - candidatesWithContact.length} sin {communicationType === 'email' ? 'email' : 'teléfono'})
                                </span>
                            )}
                        </div>
                        {candidatesWithContact.length > 0 && (
                            <button
                                onClick={handleSelectAll}
                                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                            >
                                {selectedCandidateIds.size === candidatesWithContact.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                            </button>
                        )}
                    </div>

                    {/* Lista de candidatos */}
                    <div className="mb-6 space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2">
                        {candidatesWithContact.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <p>
                                    {communicationType === 'email'
                                        ? 'No hay candidatos con email disponible'
                                        : 'No hay candidatos con teléfono disponible'}
                                </p>
                            </div>
                        ) : (
                            candidatesWithContact.map(candidate => {
                                const isSelected = selectedCandidateIds.has(candidate.id);
                                return (
                                    <div
                                        key={candidate.id}
                                        onClick={() => handleToggleCandidate(candidate.id)}
                                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                            isSelected
                                                ? 'border-primary-500 bg-primary-50'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                                isSelected
                                                    ? 'bg-primary-500 border-primary-500'
                                                    : 'border-gray-300'
                                            }`}>
                                                {isSelected && <CheckSquare className="w-3 h-3 text-white" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-gray-900">{candidate.name || 'Sin nombre'}</div>
                                                <div className="text-sm text-gray-500">
                                                    {communicationType === 'email' ? candidate.email : candidate.phone}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Formulario de mensaje */}
                    <div className="space-y-4">
                        {communicationType === 'email' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Asunto <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Ej: Actualización sobre tu postulación"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Puedes usar variables: {'{{nombre}}'}, {'{{email}}'}, {'{{telefono}}'}
                                </p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Mensaje <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder={
                                    communicationType === 'email'
                                        ? 'Escribe tu mensaje aquí...'
                                        : 'Escribe tu mensaje de WhatsApp aquí...'
                                }
                                rows={8}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Puedes usar variables: {'{{nombre}}'}, {'{{email}}'}, {'{{telefono}}'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={selectedCandidateIds.size === 0 || !message.trim() || (communicationType === 'email' && !subject.trim())}
                        className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Send className="w-4 h-4" />
                        Enviar a {selectedCandidateIds.size} candidato{selectedCandidateIds.size !== 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};
