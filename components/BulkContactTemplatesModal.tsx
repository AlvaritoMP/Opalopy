import React, { useEffect, useState } from 'react';
import { X, Mail, Save } from 'lucide-react';
import type { BulkContactMessageTemplate } from '../types';
import { BulkContactTemplatesEditor } from './BulkContactTemplatesEditor';

interface BulkContactTemplatesModalProps {
    isOpen: boolean;
    onClose: () => void;
    processTitle?: string;
    templates: BulkContactMessageTemplate[];
    onSave: (templates: BulkContactMessageTemplate[]) => Promise<void>;
}

export const BulkContactTemplatesModal: React.FC<BulkContactTemplatesModalProps> = ({
    isOpen,
    onClose,
    processTitle,
    templates,
    onSave,
}) => {
    const [draft, setDraft] = useState<BulkContactMessageTemplate[]>(templates);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) setDraft(templates);
    }, [isOpen, templates]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(draft);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-blue-600" />
                            Plantillas de contacto
                        </h2>
                        {processTitle && (
                            <p className="text-sm text-gray-500 mt-0.5">{processTitle}</p>
                        )}
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    <BulkContactTemplatesEditor templates={draft} onChange={setDraft} />
                </div>

                <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        disabled={saving}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Guardando…' : 'Guardar plantillas'}
                    </button>
                </div>
            </div>
        </div>
    );
};
