import React, { useEffect, useState } from 'react';
import { X, FileText, Download, Loader2 } from 'lucide-react';
import { Attachment } from '../types';
import { processesApi } from '../lib/api/processes';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    processId: string;
    processTitle: string;
    initialAttachments?: Attachment[];
    googleDriveFolderId?: string;
    googleDriveConfig?: { connected?: boolean; accessToken?: string };
}

export const BulkProcessAttachmentsModal: React.FC<Props> = ({
    isOpen,
    onClose,
    processId,
    processTitle,
    initialAttachments = [],
    googleDriveFolderId,
    googleDriveConfig,
}) => {
    const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !processId) return;
        setLoading(true);
        processesApi
            .getAttachments(processId)
            .then(setAttachments)
            .catch(() => setAttachments(initialAttachments))
            .finally(() => setLoading(false));
    }, [isOpen, processId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Documentos del proceso</h2>
                        <p className="text-sm text-gray-500 truncate">{processTitle}</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                        </div>
                    ) : attachments.length === 0 ? (
                        <p className="text-center text-sm text-gray-500 py-8">
                            No hay documentos adjuntos. Edite el proceso para subir archivos de consulta.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {attachments.map(att => (
                                <li
                                    key={att.id}
                                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
                                >
                                    <FileText className="w-5 h-5 text-primary-600 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{att.name}</p>
                                        {att.size > 0 && (
                                            <p className="text-xs text-gray-500">
                                                {(att.size / 1024).toFixed(1)} KB
                                            </p>
                                        )}
                                    </div>
                                    <a
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 shrink-0"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        Ver / Descargar
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};
