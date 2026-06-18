import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Save, Loader2, Trash2, StickyNote, ImageIcon, Upload } from 'lucide-react';
import type { BulkInfoPin } from '../types';
import { fileToBase64 } from '../lib/fileUtils';
import {
    BULK_INFO_PIN_COLOR_OPTIONS,
    BULK_INFO_PIN_STYLES,
    getBulkInfoPinStyle,
    getImageFileFromClipboardEvent,
    validateBulkInfoPinImageFile,
    BULK_INFO_PIN_IMAGE_MAX_MB,
} from '../lib/bulkInfoPins';

interface BulkInfoPinModalProps {
    isOpen: boolean;
    pin: BulkInfoPin | null;
    isNew?: boolean;
    isSaving?: boolean;
    onClose: () => void;
    onSave: (pin: BulkInfoPin) => void;
    onDelete?: (pinId: string) => void;
}

export const BulkInfoPinModal: React.FC<BulkInfoPinModalProps> = ({
    isOpen,
    pin,
    isNew = false,
    isSaving = false,
    onClose,
    onSave,
    onDelete,
}) => {
    const [draft, setDraft] = useState<BulkInfoPin | null>(pin);
    const [imageError, setImageError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && pin) {
            setDraft({ ...pin });
            setImageError(null);
        }
    }, [isOpen, pin]);

    const applyImageFile = useCallback(async (file: File | undefined, fromClipboard = false) => {
        if (!file) return;
        const validationError = validateBulkInfoPinImageFile(file, { fromClipboard });
        if (validationError) {
            setImageError(validationError);
            return;
        }
        setImageError(null);
        try {
            const dataUrl = await fileToBase64(file);
            const imageFileName =
                file.name ||
                (fromClipboard
                    ? `portapapeles.${file.type === 'image/jpeg' ? 'jpg' : 'png'}`
                    : 'imagen.png');
            setDraft(prev =>
                prev
                    ? {
                          ...prev,
                          imageDataUrl: dataUrl,
                          imageFileName,
                      }
                    : null
            );
        } catch {
            setImageError('No se pudo leer la imagen.');
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const onPaste = (event: ClipboardEvent) => {
            const file = getImageFileFromClipboardEvent(event);
            if (!file) return;

            event.preventDefault();
            void applyImageFile(file, true);
        };

        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [isOpen, applyImageFile]);

    if (!isOpen || !draft) return null;

    const style = getBulkInfoPinStyle(draft.color);

    const handleSave = () => {
        const title = draft.title.trim() || 'Sin título';
        onSave({ ...draft, title, content: draft.content });
    };

    const clearImage = () => {
        setDraft(prev =>
            prev
                ? {
                      ...prev,
                      imageDataUrl: undefined,
                      imageFileName: undefined,
                  }
                : null
        );
        setImageError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div
                className={`rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col border-2 ${style.button}`}
            >
                <div className="flex items-start justify-between gap-3 p-4 border-b border-black/10 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <StickyNote className="w-5 h-5 shrink-0 opacity-70" />
                        <h2 className="text-sm font-semibold opacity-80">
                            {isNew ? 'Nueva referencia' : 'Editar referencia'}
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
                            placeholder="Ej. Horarios, Tarifas, Mapa sede..."
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
                            Imagen PNG (opcional)
                        </label>
                        <p className="text-[11px] text-gray-600 mb-2">
                            Sube un PNG (hasta {BULK_INFO_PIN_IMAGE_MAX_MB} MB), pega con{' '}
                            <kbd className="px-1 py-0.5 rounded bg-white/80 border border-black/10 text-[10px] font-mono">Ctrl+V</kbd>{' '}
                            si la imagen está en el portapapeles, o reemplázala cuando se actualice.
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png"
                            className="hidden"
                            onChange={e => void applyImageFile(e.target.files?.[0])}
                        />
                        <div className="rounded-lg border border-dashed border-black/20 bg-white/50 px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-black/15 rounded-lg hover:bg-gray-50"
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    {draft.imageDataUrl ? 'Cambiar imagen' : 'Subir PNG'}
                                </button>
                                {draft.imageDataUrl && (
                                    <button
                                        type="button"
                                        onClick={clearImage}
                                        className="px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg"
                                    >
                                        Quitar imagen
                                    </button>
                                )}
                            </div>
                            <p className="mt-2 text-[10px] text-gray-500">
                                Con el modal abierto, usa Ctrl+V en cualquier parte para pegar una captura o imagen copiada.
                            </p>
                        </div>
                        {imageError && (
                            <p className="mt-2 text-xs text-red-600">{imageError}</p>
                        )}
                        {draft.imageDataUrl && (
                            <div className="mt-3 rounded-lg border border-black/10 bg-gray-50 overflow-hidden">
                                <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-200 bg-white">
                                    <ImageIcon className="w-3.5 h-3.5 text-gray-500" />
                                    <span className="text-[10px] text-gray-500 truncate">
                                        {draft.imageFileName || 'imagen.png'}
                                    </span>
                                </div>
                                <div className="overflow-auto max-h-40">
                                    <img
                                        src={draft.imageDataUrl}
                                        alt="Vista previa"
                                        className="block max-w-none h-auto w-max min-w-full"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">
                            Contenido de texto (opcional)
                        </label>
                        <textarea
                            value={draft.content}
                            onChange={e => setDraft({ ...draft, content: e.target.value })}
                            placeholder="Información complementaria..."
                            rows={8}
                            className="w-full px-3 py-2 text-sm border border-black/15 rounded-lg bg-white/80 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-y min-h-[120px] font-mono leading-relaxed"
                        />
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
