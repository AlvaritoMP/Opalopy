import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    X,
    Save,
    Loader2,
    Trash2,
    MessageSquare,
    Upload,
    Link2,
    ImageIcon,
    Film,
    FileText,
} from 'lucide-react';
import type { BulkQuickReply, BulkQuickReplyAttachment, BulkQuickReplyAttachmentType } from '../types';
import { fileToBase64 } from '../lib/fileUtils';
import {
    BULK_INFO_PIN_COLOR_OPTIONS,
    BULK_INFO_PIN_STYLES,
    getBulkInfoPinStyle,
} from '../lib/bulkInfoPins';
import {
    COMMON_REPLY_EMOJI_GROUPS,
    createBulkQuickReplyAttachment,
    getImageFileFromClipboardEvent,
    validateBulkQuickReplyAttachmentFile,
} from '../lib/bulkQuickReplies';

interface BulkQuickReplyModalProps {
    isOpen: boolean;
    reply: BulkQuickReply | null;
    isNew?: boolean;
    isSaving?: boolean;
    onClose: () => void;
    onSave: (reply: BulkQuickReply) => void;
    onDelete?: (replyId: string) => void;
}

const ATTACHMENT_TYPE_LABELS: Record<BulkQuickReplyAttachmentType, string> = {
    image: 'Imagen',
    video: 'Video',
    file: 'Archivo',
};

export const BulkQuickReplyModal: React.FC<BulkQuickReplyModalProps> = ({
    isOpen,
    reply,
    isNew = false,
    isSaving = false,
    onClose,
    onSave,
    onDelete,
}) => {
    const [draft, setDraft] = useState<BulkQuickReply | null>(reply);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);
    const [pendingType, setPendingType] = useState<BulkQuickReplyAttachmentType>('image');
    const [urlInput, setUrlInput] = useState('');
    const [urlType, setUrlType] = useState<BulkQuickReplyAttachmentType>('video');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen && reply) {
            setDraft({ ...reply, attachments: [...(reply.attachments ?? [])] });
            setAttachmentError(null);
            setUrlInput('');
        }
    }, [isOpen, reply]);

    const applyFile = useCallback(
        async (file: File | undefined, type: BulkQuickReplyAttachmentType, fromClipboard = false) => {
            if (!file) return;
            const validationError = validateBulkQuickReplyAttachmentFile(file, type, { fromClipboard });
            if (validationError) {
                setAttachmentError(validationError);
                return;
            }
            setAttachmentError(null);
            try {
                const dataUrl = await fileToBase64(file);
                const att = createBulkQuickReplyAttachment({
                    type,
                    fileName:
                        file.name ||
                        (fromClipboard
                            ? `portapapeles.${file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1] || 'bin'}`
                            : type === 'image'
                              ? 'imagen.png'
                              : 'archivo'),
                    mimeType: file.type || undefined,
                    dataUrl,
                });
                setDraft(prev =>
                    prev ? { ...prev, attachments: [...(prev.attachments ?? []), att] } : null
                );
            } catch {
                setAttachmentError('No se pudo leer el archivo.');
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        },
        []
    );

    useEffect(() => {
        if (!isOpen) return;
        const onPaste = (event: ClipboardEvent) => {
            const file = getImageFileFromClipboardEvent(event);
            if (!file) return;
            event.preventDefault();
            void applyFile(file, 'image', true);
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [isOpen, applyFile]);

    if (!isOpen || !draft) return null;

    const style = getBulkInfoPinStyle(draft.color);

    const handleSave = () => {
        const title = draft.title.trim() || 'Sin título';
        onSave({ ...draft, title, content: draft.content, attachments: draft.attachments ?? [] });
    };

    const insertEmoji = (emoji: string) => {
        const el = contentRef.current;
        if (!el) {
            setDraft(prev => (prev ? { ...prev, content: prev.content + emoji } : null));
            return;
        }
        const start = el.selectionStart ?? draft.content.length;
        const end = el.selectionEnd ?? start;
        const next = draft.content.slice(0, start) + emoji + draft.content.slice(end);
        setDraft({ ...draft, content: next });
        requestAnimationFrame(() => {
            el.focus();
            const pos = start + emoji.length;
            el.setSelectionRange(pos, pos);
        });
    };

    const removeAttachment = (id: string) => {
        setDraft(prev =>
            prev
                ? { ...prev, attachments: (prev.attachments ?? []).filter(a => a.id !== id) }
                : null
        );
    };

    const addUrlAttachment = () => {
        const url = urlInput.trim();
        if (!url) {
            setAttachmentError('Ingrese una URL válida.');
            return;
        }
        try {
            new URL(url);
        } catch {
            setAttachmentError('La URL no es válida.');
            return;
        }
        setAttachmentError(null);
        const fileName = url.split('/').pop()?.split('?')[0] || 'enlace';
        const att = createBulkQuickReplyAttachment({
            type: urlType,
            fileName,
            url,
        });
        setDraft(prev =>
            prev ? { ...prev, attachments: [...(prev.attachments ?? []), att] } : null
        );
        setUrlInput('');
    };

    const fileAccept =
        pendingType === 'image' ? 'image/*' : pendingType === 'video' ? 'video/*' : '*/*';

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div
                className={`rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col border-2 ${style.button}`}
            >
                <div className="flex items-start justify-between gap-3 p-4 border-b border-black/10 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare className="w-5 h-5 shrink-0 opacity-70" />
                        <h2 className="text-sm font-semibold opacity-80">
                            {isNew ? 'Nueva respuesta rápida' : 'Editar respuesta rápida'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-current/50 hover:text-current/80 transition-colors shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">
                            Título del botón
                        </label>
                        <input
                            type="text"
                            value={draft.title}
                            onChange={e => setDraft({ ...draft, title: e.target.value })}
                            placeholder="Ej. Saludo inicial, Confirmar entrevista..."
                            className="w-full px-3 py-2 text-sm border border-black/15 rounded-lg bg-white/80 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">
                            Color
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {BULK_INFO_PIN_COLOR_OPTIONS.map(color => {
                                const colorStyle = BULK_INFO_PIN_STYLES[color];
                                const selected = draft.color === color;
                                return (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setDraft({ ...draft, color })}
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                            selected
                                                ? `${colorStyle.button} ring-2 ring-offset-1 ring-primary-500`
                                                : 'bg-white/70 border-black/10 text-gray-700 hover:bg-white'
                                        }`}
                                    >
                                        <span className={`w-2.5 h-2.5 rounded-full ${colorStyle.dot}`} />
                                        {colorStyle.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">
                            Texto de la respuesta
                        </label>
                        <div className="space-y-2 mb-2">
                            {COMMON_REPLY_EMOJI_GROUPS.map(group => (
                                <div key={group.label}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                                        {group.label}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {group.emojis.map(emoji => (
                                            <button
                                                key={`${group.label}-${emoji}`}
                                                type="button"
                                                onClick={() => insertEmoji(emoji)}
                                                className="w-8 h-8 text-base rounded-md border border-black/10 bg-white/80 hover:bg-white transition-colors"
                                                title={`Insertar ${emoji}`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <textarea
                            ref={contentRef}
                            value={draft.content}
                            onChange={e => setDraft({ ...draft, content: e.target.value })}
                            placeholder="Escribe el mensaje que quieres copiar al portapapeles..."
                            rows={6}
                            className="w-full px-3 py-2 text-sm border border-black/15 rounded-lg bg-white/80 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-y min-h-[120px] leading-relaxed"
                        />
                        <p className="mt-1 text-[10px] text-gray-600">
                            Al hacer clic en el botón se copia este texto (con emojis) al portapapeles.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">
                            Adjuntos (opcional)
                        </label>
                        <p className="text-[11px] text-gray-600 mb-2">
                            Imágenes, videos o archivos. También puedes pegar una imagen con{' '}
                            <kbd className="px-1 py-0.5 rounded bg-white/80 border border-black/10 text-[10px] font-mono">
                                Ctrl+V
                            </kbd>{' '}
                            o agregar enlaces externos.
                        </p>

                        <div className="flex flex-wrap gap-2 mb-3">
                            {(['image', 'video', 'file'] as BulkQuickReplyAttachmentType[]).map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => {
                                        setPendingType(type);
                                        fileInputRef.current?.click();
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-black/15 rounded-lg hover:bg-gray-50"
                                >
                                    {type === 'image' ? (
                                        <ImageIcon className="w-3.5 h-3.5" />
                                    ) : type === 'video' ? (
                                        <Film className="w-3.5 h-3.5" />
                                    ) : (
                                        <FileText className="w-3.5 h-3.5" />
                                    )}
                                    Subir {ATTACHMENT_TYPE_LABELS[type].toLowerCase()}
                                </button>
                            ))}
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={fileAccept}
                            className="hidden"
                            onChange={e => void applyFile(e.target.files?.[0], pendingType)}
                        />

                        <div className="rounded-lg border border-dashed border-black/20 bg-white/50 px-3 py-3 space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                Enlace externo
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <select
                                    value={urlType}
                                    onChange={e =>
                                        setUrlType(e.target.value as BulkQuickReplyAttachmentType)
                                    }
                                    className="px-2 py-1.5 text-xs border border-black/15 rounded-lg bg-white"
                                >
                                    <option value="video">Video (URL)</option>
                                    <option value="file">Archivo (URL)</option>
                                    <option value="image">Imagen (URL)</option>
                                </select>
                                <input
                                    type="url"
                                    value={urlInput}
                                    onChange={e => setUrlInput(e.target.value)}
                                    placeholder="https://..."
                                    className="flex-1 min-w-[160px] px-2 py-1.5 text-xs border border-black/15 rounded-lg bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={addUrlAttachment}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border border-black/15 rounded-lg hover:bg-gray-50"
                                >
                                    <Link2 className="w-3.5 h-3.5" />
                                    Agregar enlace
                                </button>
                            </div>
                        </div>

                        {attachmentError && (
                            <p className="mt-2 text-xs text-red-600">{attachmentError}</p>
                        )}

                        {(draft.attachments?.length ?? 0) > 0 && (
                            <ul className="mt-3 space-y-2">
                                {(draft.attachments ?? []).map(att => (
                                    <li
                                        key={att.id}
                                        className="flex items-start gap-2 rounded-lg border border-black/10 bg-white/80 px-3 py-2"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-gray-800 truncate">
                                                {ATTACHMENT_TYPE_LABELS[att.type]} · {att.fileName}
                                            </p>
                                            {att.url && (
                                                <p className="text-[10px] text-gray-500 truncate">{att.url}</p>
                                            )}
                                            {att.type === 'image' && att.dataUrl && (
                                                <img
                                                    src={att.dataUrl}
                                                    alt={att.fileName}
                                                    className="mt-1 max-h-20 rounded border border-gray-200"
                                                />
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(att.id)}
                                            className="text-red-600 hover:bg-red-50 rounded p-1 shrink-0"
                                            title="Quitar adjunto"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="rounded-lg bg-white/60 border border-black/10 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                            Vista previa al copiar
                        </p>
                        <pre className="text-xs whitespace-pre-wrap text-gray-800 font-sans leading-relaxed">
                            {draft.content.trim() || '(sin texto)'}
                            {(draft.attachments?.length ?? 0) > 0 && (
                                <>
                                    {'\n\n'}
                                    {(draft.attachments ?? [])
                                        .map(a => a.url?.trim() || `[${a.fileName}]`)
                                        .join('\n')}
                                </>
                            )}
                        </pre>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 p-4 border-t border-black/10 shrink-0">
                    <div>
                        {!isNew && onDelete && (
                            <button
                                type="button"
                                onClick={() => onDelete(draft.id)}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Eliminar
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white/80 border border-black/10 rounded-lg hover:bg-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                        >
                            {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Save className="w-3.5 h-3.5" />
                            )}
                            Guardar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
