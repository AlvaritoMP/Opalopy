import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Pencil, ImageIcon } from 'lucide-react';
import type { BulkInfoPin } from '../types';
import { bulkInfoPinHasImage, getBulkInfoPinStyle } from '../lib/bulkInfoPins';

interface BulkInfoPinPanelProps {
    pin: BulkInfoPin;
    canEdit: boolean;
    onClose: () => void;
    onEdit: () => void;
}

const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT_IMAGE = 520;
const DEFAULT_HEIGHT_TEXT = 320;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 180;
const VIEWPORT_MARGIN = 32;

type ResizeCorner = 'nw' | 'ne' | 'sw';

function clampSize(width: number, height: number) {
    const maxW = typeof window !== 'undefined' ? window.innerWidth - VIEWPORT_MARGIN : 1400;
    const maxH = typeof window !== 'undefined' ? window.innerHeight - VIEWPORT_MARGIN : 900;
    return {
        width: Math.min(maxW, Math.max(MIN_WIDTH, width)),
        height: Math.min(maxH, Math.max(MIN_HEIGHT, height)),
    };
}

const CornerHandle: React.FC<{
    corner: ResizeCorner;
    onResizeStart: (e: React.MouseEvent, corner: ResizeCorner) => void;
}> = ({ corner, onResizeStart }) => {
    const position =
        corner === 'nw'
            ? 'top-0 left-0 cursor-nw-resize rounded-tl-[10px]'
            : corner === 'ne'
              ? 'top-0 right-0 cursor-ne-resize rounded-tr-[10px]'
              : 'bottom-0 left-0 cursor-sw-resize rounded-bl-[10px]';

    return (
        <div
            role="presentation"
            className={`absolute z-10 w-4 h-4 ${position}`}
            onMouseDown={e => onResizeStart(e, corner)}
            title={
                corner === 'nw'
                    ? 'Arrastra para agrandar ancho y alto'
                    : corner === 'ne'
                      ? 'Arrastra para agrandar alto'
                      : 'Arrastra para agrandar ancho'
            }
        >
            <span className="absolute inset-0 opacity-0 hover:opacity-100 bg-primary-500/10 transition-opacity" />
            <span
                className={`absolute block w-2 h-2 border-primary-500/70 ${
                    corner === 'nw'
                        ? 'top-1 left-1 border-t-2 border-l-2'
                        : corner === 'ne'
                          ? 'top-1 right-1 border-t-2 border-r-2'
                          : 'bottom-1 left-1 border-b-2 border-l-2'
                }`}
            />
        </div>
    );
};

export const BulkInfoPinPanel: React.FC<BulkInfoPinPanelProps> = ({
    pin,
    canEdit,
    onClose,
    onEdit,
}) => {
    const style = getBulkInfoPinStyle(pin.color);
    const hasImage = bulkInfoPinHasImage(pin);
    const hasText = Boolean(pin.content?.trim());

    const [size, setSize] = useState(() =>
        clampSize(DEFAULT_WIDTH, hasImage ? DEFAULT_HEIGHT_IMAGE : DEFAULT_HEIGHT_TEXT)
    );
    const resizeRef = useRef<{
        corner: ResizeCorner;
        startX: number;
        startY: number;
        startW: number;
        startH: number;
    } | null>(null);

    useEffect(() => {
        setSize(
            clampSize(DEFAULT_WIDTH, hasImage ? DEFAULT_HEIGHT_IMAGE : DEFAULT_HEIGHT_TEXT)
        );
    }, [pin.id, hasImage]);

    const onResizeStart = useCallback(
        (e: React.MouseEvent, corner: ResizeCorner) => {
            e.preventDefault();
            e.stopPropagation();
            resizeRef.current = {
                corner,
                startX: e.clientX,
                startY: e.clientY,
                startW: size.width,
                startH: size.height,
            };
        },
        [size.width, size.height]
    );

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const r = resizeRef.current;
            if (!r) return;

            const dx = r.startX - e.clientX;
            const dy = r.startY - e.clientY;

            let nextW = r.startW;
            let nextH = r.startH;

            if (r.corner === 'nw' || r.corner === 'sw') {
                nextW = r.startW + dx;
            }
            if (r.corner === 'nw' || r.corner === 'ne') {
                nextH = r.startH + dy;
            }

            setSize(clampSize(nextW, nextH));
        };

        const onUp = () => {
            resizeRef.current = null;
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, []);

    return (
        <div
            className="fixed bottom-4 right-4 z-40 flex flex-col rounded-xl shadow-2xl border-2 pointer-events-auto"
            style={{
                width: size.width,
                height: size.height,
                boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            }}
            role="dialog"
            aria-label={`Referencia: ${pin.title}`}
        >
            <CornerHandle corner="nw" onResizeStart={onResizeStart} />
            {hasImage && (
                <>
                    <CornerHandle corner="ne" onResizeStart={onResizeStart} />
                    <CornerHandle corner="sw" onResizeStart={onResizeStart} />
                </>
            )}

            <div
                className={`flex items-center justify-between gap-2 px-3 py-2 border-b border-black/10 shrink-0 rounded-t-[10px] ${style.button}`}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                    <h3 className="text-sm font-bold truncate">{pin.title}</h3>
                    {hasImage && (
                        <ImageIcon className="w-3.5 h-3.5 shrink-0 opacity-60" aria-hidden />
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {canEdit && (
                        <button
                            type="button"
                            onClick={onEdit}
                            className="p-1.5 rounded-md hover:bg-black/10 transition-colors"
                            title="Editar referencia"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-black/10 transition-colors"
                        title="Cerrar"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col bg-white/95 rounded-b-[10px] overflow-hidden">
                {hasImage && (
                    <div
                        className="flex-1 min-h-0 flex flex-col border-b border-gray-200 bg-gray-50"
                        title="Desplázate horizontal y verticalmente para ver toda la imagen"
                    >
                        <p className="px-3 py-1 text-[10px] text-gray-500 select-none shrink-0">
                            Esquinas para agrandar · desplaza ↓ y → para recorrer la imagen
                        </p>
                        <div className="flex-1 min-h-0 overflow-auto w-full touch-pan-x touch-pan-y">
                            <img
                                src={pin.imageDataUrl}
                                alt={pin.imageFileName || pin.title}
                                className="block max-w-none h-auto w-max min-w-full"
                                draggable={false}
                            />
                        </div>
                    </div>
                )}

                {hasText && (
                    <div
                        className={`overflow-y-auto px-3 py-3 text-sm whitespace-pre-wrap leading-relaxed text-gray-800 shrink-0 ${
                            hasImage ? 'max-h-[38%]' : 'flex-1 min-h-0'
                        }`}
                    >
                        {pin.content}
                    </div>
                )}

                {!hasImage && !hasText && (
                    <p className="px-3 py-4 text-sm italic text-gray-500">Sin contenido</p>
                )}
            </div>
        </div>
    );
};
