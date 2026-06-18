import React, { useMemo, useState } from 'react';
import { X, MessageCircle, Send, Copy } from 'lucide-react';
import { BulkCandidate } from '../lib/api/bulkCandidates';
import type { BulkContactMessageTemplate } from '../types';
import {
    applyContactMessageTemplate,
    copyContactMessageToClipboard,
    filterContactTemplatesByChannel,
} from '../lib/contactMessageTemplates';

interface BulkWhatsAppModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidates: BulkCandidate[];
    templates: BulkContactMessageTemplate[];
    processTitle?: string;
    onSend: (message: string, createGroup: boolean) => Promise<void>;
    onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const BulkWhatsAppModal: React.FC<BulkWhatsAppModalProps> = ({
    isOpen,
    onClose,
    candidates,
    templates,
    processTitle,
    onSend,
    onNotify,
}) => {
    const whatsappTemplates = useMemo(
        () => filterContactTemplatesByChannel(templates, 'whatsapp'),
        [templates]
    );
    const [selectedId, setSelectedId] = useState(whatsappTemplates[0]?.id ?? '');
    const [createGroup, setCreateGroup] = useState(false);
    const [busy, setBusy] = useState(false);

    if (!isOpen) return null;

    const candidatesWithPhone = candidates.filter(c => c.phone);
    const template = whatsappTemplates.find(t => t.id === selectedId) ?? whatsappTemplates[0];
    const previewCandidate = candidatesWithPhone[0];
    const previewBody = template && previewCandidate
        ? applyContactMessageTemplate(template.body, {
              nombre: previewCandidate.name,
              telefono: previewCandidate.phone,
              puesto: processTitle,
          })
        : '';

    const handleOpen = async () => {
        if (!template?.body.trim()) {
            onNotify?.('Selecciona una plantilla válida', 'error');
            return;
        }
        setBusy(true);
        try {
            await onSend(template.body, createGroup);
            onClose();
        } finally {
            setBusy(false);
        }
    };

    const handleCopy = async () => {
        const ok = await copyContactMessageToClipboard('whatsapp', '', previewBody);
        onNotify?.(ok ? 'Mensaje copiado' : 'No se pudo copiar', ok ? 'success' : 'error');
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-green-600" />
                        <h2 className="text-lg font-semibold">WhatsApp masivo</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    <p className="text-sm text-gray-600">
                        {candidatesWithPhone.length} candidato(s) con teléfono
                    </p>
                    <select
                        value={selectedId}
                        onChange={e => setSelectedId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                        {whatsappTemplates.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                    {previewBody && (
                        <p className="text-xs text-gray-500 line-clamp-3 whitespace-pre-wrap">
                            {previewBody}
                        </p>
                    )}
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={createGroup}
                            onChange={e => setCreateGroup(e.target.checked)}
                        />
                        Crear grupo
                    </label>
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
                        className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 justify-center"
                    >
                        <Send className="w-4 h-4" />
                        Abrir
                    </button>
                </div>
            </div>
        </div>
    );
};
