import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Package, RotateCcw, Send } from 'lucide-react';
import { useAppState } from '../App';
import { workerHandoffApi } from '../lib/api/workerHandoff';
import { DELIVERY_STATUS_LABELS } from '../lib/workerHandoffFields';
import type { CandidateHandoffHistoryEntry } from '../types';

function formatDateTime(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

interface BulkCandidateOpsFlowPanelProps {
    candidateId: string;
    candidateName: string;
    onSend: () => void;
    refreshToken?: number;
}

export const BulkCandidateOpsFlowPanel: React.FC<BulkCandidateOpsFlowPanelProps> = ({
    candidateId,
    candidateName,
    onSend,
    refreshToken = 0,
}) => {
    const { actions } = useAppState();
    const [entries, setEntries] = useState<CandidateHandoffHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [retryingPackageId, setRetryingPackageId] = useState<string | null>(null);

    const loadHistory = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await workerHandoffApi.getCandidateHandoffHistory(candidateId);
            setEntries(rows);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'No se pudo cargar el historial OpsFlow';
            actions.showToast(message, 'error', 4000);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, [candidateId, actions]);

    useEffect(() => {
        void loadHistory();
    }, [loadHistory, refreshToken]);

    const handleRetry = async (packageId: string) => {
        setRetryingPackageId(packageId);
        try {
            await workerHandoffApi.retryDelivery(packageId);
            actions.showToast('Paquete reenviado a OpsFlow', 'success', 3500);
            await loadHistory();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'No se pudo reintentar';
            actions.showToast(message, 'error', 5000);
        } finally {
            setRetryingPackageId(null);
        }
    };

    return (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Envíos a OpsFlow</h3>
                </div>
                <button
                    type="button"
                    onClick={onSend}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
                >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    Enviar
                </button>
            </div>

            {loading ? (
                <div className="flex items-center text-sm text-gray-500 py-2">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cargando historial…
                </div>
            ) : entries.length === 0 ? (
                <p className="text-sm text-gray-500">
                    {candidateName} aún no ha sido enviado a operaciones.
                </p>
            ) : (
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {entries.map(entry => (
                        <li key={entry.itemId} className="p-2 bg-gray-50 rounded-md text-sm">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-800">{formatDateTime(entry.sentAt)}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700">
                                    {DELIVERY_STATUS_LABELS[entry.deliveryStatus || ''] || entry.deliveryStatus || '—'}
                                </span>
                            </div>
                            {entry.createdByName && (
                                <p className="text-xs text-gray-500 mt-1">Por {entry.createdByName}</p>
                            )}
                            {entry.senderNote && (
                                <p className="text-xs text-gray-600 mt-1">{entry.senderNote}</p>
                            )}
                            {entry.deliveryError && (
                                <p className="text-xs text-red-600 mt-1">{entry.deliveryError}</p>
                            )}
                            {entry.deliveryStatus === 'failed' && (
                                <button
                                    type="button"
                                    onClick={() => handleRetry(entry.packageId)}
                                    disabled={retryingPackageId === entry.packageId}
                                    className="mt-2 inline-flex items-center text-xs text-primary-700 hover:underline disabled:opacity-50"
                                >
                                    {retryingPackageId === entry.packageId ? (
                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    ) : (
                                        <RotateCcw className="w-3 h-3 mr-1" />
                                    )}
                                    Reintentar
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
