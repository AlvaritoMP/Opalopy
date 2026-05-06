import React, { useState, useEffect } from 'react';
import { X, Mail, Send, FileText } from 'lucide-react';
import { BulkCandidate } from '../lib/api/bulkCandidates';

interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
}

interface BulkEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidates: BulkCandidate[];
    onSend: (subject: string, body: string, templateId?: string) => Promise<void>;
}

const DEFAULT_TEMPLATES: EmailTemplate[] = [
    {
        id: 'invitation',
        name: 'Invitación a Entrevista',
        subject: 'Invitación a Entrevista - {{nombre}}',
        body: `Estimado/a {{nombre}},

Nos complace informarte que has sido seleccionado/a para continuar con el proceso de selección.

Te invitamos a una entrevista en la que podremos conocerte mejor y resolver cualquier duda que tengas.

Por favor, confirma tu disponibilidad respondiendo a este correo.

Saludos cordiales,
Equipo de Recursos Humanos`
    },
    {
        id: 'rejection',
        name: 'Rechazo',
        subject: 'Actualización sobre tu postulación - {{nombre}}',
        body: `Estimado/a {{nombre}},

Agradecemos tu interés en formar parte de nuestro equipo.

Después de una cuidadosa revisión de tu perfil, lamentamos informarte que en esta ocasión no podremos continuar con tu proceso de selección.

Te deseamos mucho éxito en tu búsqueda profesional.

Saludos cordiales,
Equipo de Recursos Humanos`
    },
    {
        id: 'offer',
        name: 'Oferta de Trabajo',
        subject: 'Oferta de Trabajo - {{nombre}}',
        body: `Estimado/a {{nombre}},

Nos complace hacerte una oferta formal para unirte a nuestro equipo.

Estamos muy interesados en tu perfil y creemos que serías una excelente adición a nuestro equipo.

Por favor, revisa los detalles adjuntos y no dudes en contactarnos si tienes alguna pregunta.

Esperamos tu respuesta.

Saludos cordiales,
Equipo de Recursos Humanos`
    },
];

export const BulkEmailModal: React.FC<BulkEmailModalProps> = ({
    isOpen,
    onClose,
    candidates,
    onSend,
}) => {
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);

    useEffect(() => {
        // Cargar plantillas guardadas desde localStorage (si existen)
        const savedTemplates = localStorage.getItem('emailTemplates');
        if (savedTemplates) {
            try {
                const parsed = JSON.parse(savedTemplates);
                setTemplates([...DEFAULT_TEMPLATES, ...parsed]);
            } catch (error) {
                console.error('Error cargando plantillas:', error);
            }
        }
    }, []);

    useEffect(() => {
        if (selectedTemplate) {
            const template = templates.find(t => t.id === selectedTemplate);
            if (template) {
                setSubject(template.subject);
                setBody(template.body);
            }
        }
    }, [selectedTemplate, templates]);

    if (!isOpen) return null;

    const candidatesWithEmail = candidates.filter(c => c.email);

    const handleSend = async () => {
        if (!subject.trim() || !body.trim()) {
            alert('Por favor, completa el asunto y el cuerpo del correo');
            return;
        }

        setIsSending(true);
        try {
            await onSend(subject, body, selectedTemplate || undefined);
            setSubject('');
            setBody('');
            setSelectedTemplate('');
            onClose();
        } catch (error) {
            console.error('Error enviando correos:', error);
            alert('Error al enviar correos. Por favor, inténtalo de nuevo.');
        } finally {
            setIsSending(false);
        }
    };

    const replaceVariables = (text: string, candidate: BulkCandidate): string => {
        return text
            .replace(/\{\{nombre\}\}/g, candidate.name || 'Candidato')
            .replace(/\{\{email\}\}/g, candidate.email || '')
            .replace(/\{\{telefono\}\}/g, candidate.phone || '');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <Mail className="w-6 h-6 text-blue-600" />
                        <h2 className="text-xl font-semibold text-gray-900">
                            Enviar Correo Masivo
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
                            <Mail className="w-4 h-4" />
                            <span className="font-medium">
                                {candidatesWithEmail.length} candidato{candidatesWithEmail.length !== 1 ? 's' : ''} con correo
                            </span>
                        </div>
                        {candidates.length > candidatesWithEmail.length && (
                            <p className="text-xs text-blue-600 mt-2">
                                {candidates.length - candidatesWithEmail.length} candidato(s) sin correo no recibirán el mensaje
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Plantilla (opcional)
                        </label>
                        <select
                            value={selectedTemplate}
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Seleccionar plantilla...</option>
                            {templates.map(template => (
                                <option key={template.id} value={template.id}>
                                    {template.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Asunto
                        </label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Asunto del correo..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Variables disponibles: {'{'}{'{nombre}'}{'}'}, {'{'}{'{email}'}{'}'}, {'{'}{'{telefono}'}{'}'}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cuerpo del correo
                        </label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Escribe el cuerpo del correo..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            rows={10}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Variables disponibles: {'{'}{'{nombre}'}{'}'}, {'{'}{'{email}'}{'}'}, {'{'}{'{telefono}'}{'}'}
                        </p>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                            <FileText className="w-4 h-4" />
                            Vista previa (primer candidato)
                        </div>
                        {candidatesWithEmail.length > 0 && (
                            <div className="text-sm text-gray-600 space-y-2">
                                <div>
                                    <strong>Asunto:</strong> {replaceVariables(subject, candidatesWithEmail[0])}
                                </div>
                                <div className="whitespace-pre-wrap border-t pt-2">
                                    {replaceVariables(body, candidatesWithEmail[0])}
                                </div>
                            </div>
                        )}
                    </div>

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
                            disabled={isSending || !subject.trim() || !body.trim()}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSending ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Enviar a {candidatesWithEmail.length} candidato{candidatesWithEmail.length !== 1 ? 's' : ''}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
