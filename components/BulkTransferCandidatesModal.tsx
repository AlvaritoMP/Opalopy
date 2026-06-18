import React, { useMemo, useState } from 'react';
import { X, Loader2, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { Process } from '../types';
import { BulkCandidate } from '../lib/api/bulkCandidates';
import {
    transferBulkCandidates,
    type BulkCandidateTransferMode,
} from '../lib/api/bulkCandidateTransfer';

interface BulkTransferCandidatesModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceProcess: Process;
    candidates: BulkCandidate[];
    bulkProcesses: Process[];
    userId?: string;
    userName?: string;
    onSuccess: (result: {
        mode: BulkCandidateTransferMode;
        success: number;
        targetProcessId: string;
        targetProcessTitle: string;
    }) => void;
    onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const BulkTransferCandidatesModal: React.FC<BulkTransferCandidatesModalProps> = ({
    isOpen,
    onClose,
    sourceProcess,
    candidates,
    bulkProcesses,
    userId,
    userName,
    onSuccess,
    onNotify,
}) => {
    const targetOptions = useMemo(
        () => bulkProcesses.filter(p => p.id !== sourceProcess.id),
        [bulkProcesses, sourceProcess.id]
    );

    const [mode, setMode] = useState<BulkCandidateTransferMode>('duplicate');
    const [targetProcessId, setTargetProcessId] = useState('');
    const [targetStageId, setTargetStageId] = useState('');
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

    const targetProcess = useMemo(
        () => targetOptions.find(p => p.id === targetProcessId),
        [targetOptions, targetProcessId]
    );

    if (!isOpen) return null;

    const handleTargetProcessChange = (processId: string) => {
        setTargetProcessId(processId);
        const proc = targetOptions.find(p => p.id === processId);
        setTargetStageId(proc?.stages[0]?.id || '');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetProcessId || !targetStageId) {
            onNotify('Seleccione el proceso y la etapa destino', 'error');
            return;
        }
        if (candidates.length === 0) {
            onNotify('No hay candidatos seleccionados', 'error');
            return;
        }

        if (mode === 'move') {
            const ok = window.confirm(
                `¿Mover ${candidates.length} candidato(s) a «${targetProcess?.title}»?\n\n` +
                'Dejarán de aparecer en el proceso actual.'
            );
            if (!ok) return;
        }

        setBusy(true);
        setProgress({ done: 0, total: candidates.length });
        try {
            const result = await transferBulkCandidates({
                candidateIds: candidates.map(c => c.id),
                sourceProcessId: sourceProcess.id,
                targetProcessId,
                targetStageId,
                mode,
                sourceConfig: sourceProcess.bulkConfig,
                targetConfig: targetProcess?.bulkConfig,
                movedBy: userName || userId,
                createdBy: userId,
                createdByName: userName,
                onProgress: (done, total) => setProgress({ done, total }),
            });

            if (result.success === 0) {
                onNotify(
                    result.failed[0]?.error || 'No se pudo trasladar ningún candidato',
                    'error'
                );
                return;
            }

            const actionLabel = mode === 'move' ? 'movido(s)' : 'duplicado(s)';
            if (result.failed.length > 0) {
                onNotify(
                    `${result.success} ${actionLabel}, ${result.failed.length} con error`,
                    'info'
                );
            }

            onSuccess({
                mode,
                success: result.success,
                targetProcessId,
                targetProcessTitle: targetProcess?.title || '',
            });
            onClose();
        } catch (err: unknown) {
            console.error('Error trasladando candidatos:', err);
            onNotify(
                err instanceof Error ? err.message : 'Error al trasladar candidatos',
                'error'
            );
        } finally {
            setBusy(false);
            setProgress(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
                    <div className="flex items-center justify-between p-4 border-b shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <ArrowRightLeft className="w-5 h-5 text-indigo-600 shrink-0" />
                            <h2 className="text-lg font-semibold truncate">Trasladar candidatos</h2>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={busy}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-4 space-y-4 overflow-y-auto flex-1">
                        <p className="text-sm text-gray-600">
                            <span className="font-medium text-gray-900">{candidates.length}</span>
                            {' '}candidato(s) seleccionado(s) en{' '}
                            <span className="font-medium">{sourceProcess.title}</span>
                        </p>

                        <div className="space-y-2">
                            <span className="text-sm font-medium text-gray-700">Acción</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <label
                                    className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer ${
                                        mode === 'duplicate'
                                            ? 'border-indigo-500 bg-indigo-50'
                                            : 'border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="transfer-mode"
                                        checked={mode === 'duplicate'}
                                        onChange={() => setMode('duplicate')}
                                        className="mt-1"
                                    />
                                    <span>
                                        <span className="block text-sm font-medium">Duplicar</span>
                                        <span className="block text-xs text-gray-500 mt-0.5">
                                            Copia al otro proceso; el original permanece aquí.
                                        </span>
                                    </span>
                                </label>
                                <label
                                    className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer ${
                                        mode === 'move'
                                            ? 'border-indigo-500 bg-indigo-50'
                                            : 'border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="transfer-mode"
                                        checked={mode === 'move'}
                                        onChange={() => setMode('move')}
                                        className="mt-1"
                                    />
                                    <span>
                                        <span className="block text-sm font-medium">Mover</span>
                                        <span className="block text-xs text-gray-500 mt-0.5">
                                            Cambia de proceso; desaparece de la lista actual.
                                        </span>
                                    </span>
                                </label>
                            </div>
                        </div>

                        {mode === 'move' && (
                            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>
                                    Los candidatos movidos ya no estarán en este proceso. Se conservan
                                    columnas personalizadas con el mismo nombre en el destino.
                                </span>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Proceso destino
                            </label>
                            <select
                                value={targetProcessId}
                                onChange={e => handleTargetProcessChange(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                required
                            >
                                <option value="">Seleccionar proceso…</option>
                                {targetOptions.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                            {targetOptions.length === 0 && (
                                <p className="text-xs text-amber-700 mt-1">
                                    No hay otros procesos masivos disponibles.
                                </p>
                            )}
                        </div>

                        {targetProcess && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Etapa inicial en destino
                                </label>
                                <select
                                    value={targetStageId}
                                    onChange={e => setTargetStageId(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    required
                                >
                                    {targetProcess.stages.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <p className="text-xs text-gray-500">
                            Se copian datos básicos (nombre, contacto, DNI, etc.) y columnas
                            personalizadas cuyo nombre coincida en el proceso destino.
                        </p>

                        {progress && (
                            <div className="text-sm text-gray-600 text-center">
                                Procesando {progress.done} / {progress.total}…
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t flex justify-end gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={busy}
                            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={busy || !targetProcessId || !targetStageId || targetOptions.length === 0}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {busy ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <ArrowRightLeft className="w-4 h-4" />
                            )}
                            {mode === 'move' ? 'Mover' : 'Duplicar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
