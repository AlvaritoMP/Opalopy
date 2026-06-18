import React, { useMemo, useState } from 'react';
import { X, Mail, Send, Copy } from 'lucide-react';
import { BulkCandidate } from '../lib/api/bulkCandidates';
import type { BulkContactMessageTemplate } from '../types';
import {
    applyContactMessageTemplate,
    copyContactMessageToClipboard,
    filterContactTemplatesByChannel,
} from '../lib/contactMessageTemplates';

interface BulkEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidates: BulkCandidate[];
    templates: BulkContactMessageTemplate[];
    processTitle?: string;
    onSend: (subject: string, body: string, templateId?: string) => Promise<void>;
    onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const BulkEmailModal: React.FC<BulkEmailModalProps> = ({
    isOpen,
    onClose,
    candidates,
    templates,
    processTitle,
    onSend,
    onNotify,
}) => {
    const emailTemplates = useMemo(
        () => filterContactTemplatesByChannel(templates, 'email'),
        [templates]
    );
    const [selectedId, setSelectedId] = useState(emailTemplates[0]?.id ?? '');
    const [busy, setBusy] = useState(false);

    if (!isOpen) return null;

    const candidatesWithEmail = candidates.filter(c => c.email);
    const template = emailTemplates.find(t => t.id === selectedId) ?? emailTemplates[0];
    const previewCandidate = candidatesWithEmail[0];
    const previewVars = {
        nombre: previewCandidate?.name,
        email: previewCandidate?.email,
        telefono: previewCandidate?.phone,
        puesto: processTitle,
    };
    const subject = template ? applyContactMessageTemplate(template.subject ?? '', previewVars) : '';
    const body = template ? applyContactMessageTemplate(template.body, previewVars) : '';

    const handleOpen = async () => {
        if (!template || !subject.trim() || !body.trim()) {
            onNotify?.('Selecciona una plantilla válida', 'error');
            return;
        }
        setBusy(true);
        try {
            await onSend(template.subject ?? '', template.body, template.id);
            onClose();
        } finally {
            setBusy(false);
        }
    };

    const handleCopy = async () => {
        if (!template) return;
        const ok = await copyContactMessageToClipboard('email', subject, body);
        onNotify?.(ok ? 'Mensaje copiado' : 'No se pudo copiar', ok ? 'success' : 'error');
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                        <Mail className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-semibold">Correo masivo</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    <p className="text-sm text-gray-600">
                        {candidatesWithEmail.length} candidato(s) con correo
                    </p>
                    <select
                        value={selectedId}
                        onChange={e => setSelectedId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                        {emailTemplates.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                    {template && previewCandidate && (
                        <p className="text-xs text-gray-500 line-clamp-3 whitespace-pre-wrap">
                            <span className="font-medium">Asunto:</span> {subject}
                        </p>
                    )}
                </div>
                <div className="p-4 border-t flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => void handleCopy()}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
                    >
                        <Copy className="w-4 h-4" />
                        Copiar
                    </button>
                    <button
                        onClick={() => void handleOpen()}
                        disabled={busy || !template}
                        className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                        <Send className="w-4 h-4" />
                        Abrir
                    </button>
                </div>
            </div>
        </div>
    );
};
