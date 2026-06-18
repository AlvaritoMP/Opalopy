import React, { useState, useEffect } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { CELL_COLOR_PRESETS, BulkCellMeta } from '../lib/bulkCellMeta';

interface BulkCellContextMenuProps {
    x: number;
    y: number;
    candidateId: string;
    colId: string;
    meta?: BulkCellMeta;
    onClose: () => void;
    onApply: (candidateIds: string[], colIds: string[], meta: Partial<BulkCellMeta>) => void;
    selectedCellKeys: string[];
}

export const BulkCellContextMenu: React.FC<BulkCellContextMenuProps> = ({
    x,
    y,
    candidateId,
    colId,
    meta,
    onClose,
    onApply,
    selectedCellKeys,
}) => {
    const [comment, setComment] = useState(meta?.comment ?? '');

    useEffect(() => {
        setComment(meta?.comment ?? '');
    }, [meta?.comment, candidateId, colId]);

    const targets = selectedCellKeys.length > 0
        ? selectedCellKeys.map(k => {
            const sep = k.indexOf('::');
            return { candidateId: k.slice(0, sep), colId: k.slice(sep + 2) };
        })
        : [{ candidateId, colId }];

    const applyColor = (color: string) => {
        const grouped = new Map<string, string[]>();
        targets.forEach(t => {
            const list = grouped.get(t.candidateId) ?? [];
            list.push(t.colId);
            grouped.set(t.candidateId, list);
        });
        grouped.forEach((colIds, cId) => {
            onApply([cId], colIds, { bgColor: color || undefined });
        });
    };

    const saveComment = () => {
        const grouped = new Map<string, string[]>();
        targets.forEach(t => {
            const list = grouped.get(t.candidateId) ?? [];
            list.push(t.colId);
            grouped.set(t.candidateId, list);
        });
        grouped.forEach((colIds, cId) => {
            onApply([cId], colIds, { comment: comment.trim() || undefined });
        });
        onClose();
    };

    const cellCount = targets.length;

    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
            <div
                className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-64"
                style={{ left: Math.min(x, window.innerWidth - 280), top: Math.min(y, window.innerHeight - 320) }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700">
                        {cellCount > 1 ? `${cellCount} celdas` : 'Celda'}
                    </span>
                    <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                </div>

                <div className="mb-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">Color de fondo</p>
                    <div className="flex flex-wrap gap-1.5">
                        {CELL_COLOR_PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                type="button"
                                title={preset.label}
                                onClick={() => applyColor(preset.value)}
                                className={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${
                                    meta?.bgColor === preset.value || (!meta?.bgColor && !preset.value)
                                        ? 'border-primary-500'
                                        : 'border-gray-300'
                                }`}
                                style={{ backgroundColor: preset.value || '#fff' }}
                            />
                        ))}
                    </div>
                </div>

                <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Comentario
                    </p>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Nota sobre esta celda..."
                        rows={3}
                        className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-primary-500 resize-none"
                    />
                    <button
                        type="button"
                        onClick={saveComment}
                        className="mt-1.5 w-full text-xs py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                        Guardar comentario
                    </button>
                </div>
            </div>
        </>
    );
};
