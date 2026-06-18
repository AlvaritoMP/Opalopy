import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, Loader2, Package, RotateCcw } from 'lucide-react';
import { useAppState } from '../App';
import { workerHandoffApi } from '../lib/api/workerHandoff';
import { DELIVERY_STATUS_LABELS } from '../lib/workerHandoffFields';
import type { WorkerHandoffPackage } from '../types';

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

function shortId(id: string): string {
    return id.slice(0, 8).toUpperCase();
}

function deliveryBadgeClass(status?: string): string {
    switch (status) {
        case 'delivered':
            return 'bg-green-100 text-green-800';
        case 'failed':
            return 'bg-red-100 text-red-800';
        case 'pending':
            return 'bg-amber-100 text-amber-800';
        default:
            return 'bg-gray-100 text-gray-700';
    }
}

export const OpsFlowHandoffHistory: React.FC = () => {
    const { actions } = useAppState();
    const [packages, setPackages] = useState<WorkerHandoffPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<Record<string, WorkerHandoffPackage['items']>>({});
    const [loadingItemsId, setLoadingItemsId] = useState<string | null>(null);
    const [retryingId, setRetryingId] = useState<string | null>(null);

    const loadPackages = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const rows = await workerHandoffApi.listPackages();
            setPackages(rows);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'No se pudo cargar el historial';
            actions.showToast(message, 'error', 4000);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [actions]);

    useEffect(() => {
        loadPackages();
    }, [loadPackages]);

    const toggleExpand = async (packageId: string) => {
        if (expandedId === packageId) {
            setExpandedId(null);
            return;
        }

        setExpandedId(packageId);

        if (expandedItems[packageId]) return;

        setLoadingItemsId(packageId);
        try {
            const detail = await workerHandoffApi.getPackageWithItems(packageId);
            setExpandedItems(prev => ({
                ...prev,
                [packageId]: detail?.items || [],
            }));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'No se pudieron cargar los trabajadores';
            actions.showToast(message, 'error', 4000);
        } finally {
            setLoadingItemsId(null);
        }
    };

    const handleRetry = async (packageId: string) => {
        setRetryingId(packageId);
        try {
            await workerHandoffApi.retryDelivery(packageId);
            actions.showToast('Paquete entregado a OpsFlow', 'success', 3500);
            await loadPackages(true);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'No se pudo reintentar la entrega';
            actions.showToast(message, 'error', 5000);
            await loadPackages(true);
        } finally {
            setRetryingId(null);
        }
    };

    return (
        <div className="p-4 md:p-8 h-full flex flex-col overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Envíos a OpsFlow</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Historial de paquetes enviados al área operativa.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => loadPackages(true)}
                    disabled={refreshing}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                    {refreshing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Actualizar
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        Cargando historial…
                    </div>
                ) : packages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
                        <Package className="w-10 h-10 mb-3 text-gray-300" />
                        <p className="font-medium">Aún no hay envíos a OpsFlow</p>
                        <p className="text-sm mt-1 text-center">
                            Selecciona candidatos en la lista de Candidatos y usa &quot;Enviar a OpsFlow&quot;.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-sm text-left text-gray-600 min-w-[900px]">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 w-10"></th>
                                    <th className="px-4 py-3">Referencia</th>
                                    <th className="px-4 py-3">Fecha envío</th>
                                    <th className="px-4 py-3">Trabajadores</th>
                                    <th className="px-4 py-3">Enviado por</th>
                                    <th className="px-4 py-3">Nota</th>
                                    <th className="px-4 py-3">Entrega OpsFlow</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {packages.map(pkg => {
                                    const isExpanded = expandedId === pkg.id;
                                    const items = expandedItems[pkg.id] || [];
                                    const deliveryLabel =
                                        DELIVERY_STATUS_LABELS[pkg.deliveryStatus || ''] ||
                                        (pkg.deliveryStatus ?? '—');
                                    return (
                                        <React.Fragment key={pkg.id}>
                                            <tr className="border-b hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleExpand(pkg.id)}
                                                        className="p-1 rounded hover:bg-gray-100"
                                                        aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="w-4 h-4" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs">{shortId(pkg.id)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(pkg.sentAt)}</td>
                                                <td className="px-4 py-3">{pkg.workerCount}</td>
                                                <td className="px-4 py-3">{pkg.createdByName || '—'}</td>
                                                <td className="px-4 py-3 max-w-[180px] truncate" title={pkg.senderNote || ''}>
                                                    {pkg.senderNote || '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${deliveryBadgeClass(pkg.deliveryStatus)}`}
                                                        title={pkg.deliveryError || undefined}
                                                    >
                                                        {deliveryLabel}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {pkg.deliveryStatus === 'failed' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRetry(pkg.id)}
                                                            disabled={retryingId === pkg.id}
                                                            className="inline-flex items-center px-2 py-1 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded hover:bg-primary-100 disabled:opacity-50"
                                                        >
                                                            {retryingId === pkg.id ? (
                                                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                            ) : (
                                                                <RotateCcw className="w-3 h-3 mr-1" />
                                                            )}
                                                            Reintentar
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-gray-50 border-b">
                                                    <td colSpan={8} className="px-4 py-3">
                                                        {pkg.deliveryError && (
                                                            <p className="text-sm text-red-700 mb-2">
                                                                Error: {pkg.deliveryError}
                                                            </p>
                                                        )}
                                                        {pkg.opsflowPackageId && (
                                                            <p className="text-xs text-gray-500 mb-2">
                                                                ID OpsFlow: {shortId(pkg.opsflowPackageId)}
                                                            </p>
                                                        )}
                                                        {loadingItemsId === pkg.id ? (
                                                            <div className="flex items-center text-gray-500 text-sm">
                                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                Cargando trabajadores…
                                                            </div>
                                                        ) : items.length === 0 ? (
                                                            <p className="text-sm text-gray-500">Sin trabajadores registrados.</p>
                                                        ) : (
                                                            <ul className="text-sm text-gray-700 list-disc list-inside">
                                                                {items.map(item => (
                                                                    <li key={item.id}>{item.workerName}</li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
