import React from 'react';
import { RefreshCw, Loader2, Calculator } from 'lucide-react';
import { formatRouteCostDisplay } from '../lib/limaTransportFares';

interface BulkRouteCostCellProps {
    value: number | null | undefined;
    loading?: boolean;
    error?: string | null;
    missingOrigin?: boolean;
    missingSourceRoute?: boolean;
    breakdownTitle?: string;
    /** Primera consulta a Google Maps (celda sin valor guardado). */
    onCalculate?: () => void;
    /** Nueva consulta explícita cuando ya hay valor persistido. */
    onRecalculate?: () => void;
}

export const BulkRouteCostCell: React.FC<BulkRouteCostCellProps> = ({
    value,
    loading,
    error,
    missingOrigin,
    missingSourceRoute,
    breakdownTitle,
    onCalculate,
    onRecalculate,
}) => {
    if (missingSourceRoute) {
        return <span className="text-gray-400 text-xs">Sin columna de ruta</span>;
    }
    if (missingOrigin) {
        return <span className="text-gray-400 text-xs" title="Agregue dirección, distrito o provincia al candidato">Sin ubicación</span>;
    }

    const hasValue = value != null && !Number.isNaN(value);

    if (loading) {
        return (
            <div className="flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600 shrink-0" />
                <span className="text-xs text-gray-500">Consultando…</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-1 min-w-0">
                <span className="text-red-600 text-xs truncate" title={error}>Error</span>
                {onCalculate && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCalculate(); }}
                        className="p-0.5 text-gray-400 hover:text-primary-600 rounded"
                        title="Reintentar cálculo"
                    >
                        <RefreshCw className="w-3 h-3" />
                    </button>
                )}
            </div>
        );
    }

    if (!hasValue) {
        if (!onCalculate) return <span className="text-gray-400 text-xs">Pendiente</span>;
        return (
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCalculate(); }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded whitespace-nowrap"
                title="Consultar Google Maps y guardar costo aproximado en la tabla"
            >
                <Calculator className="w-3 h-3 shrink-0" />
                Calcular
            </button>
        );
    }

    return (
        <div className="flex items-center gap-1 min-w-0">
            {hasValue && (
                <span
                    className="text-xs font-medium text-gray-800 whitespace-nowrap cursor-help underline decoration-dotted decoration-gray-400"
                    title={breakdownTitle || 'Costo guardado en la base de datos'}
                >
                    {formatRouteCostDisplay(value)}
                </span>
            )}
            {onRecalculate && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRecalculate();
                    }}
                    className="p-0.5 text-gray-400 hover:text-amber-600 rounded"
                    title="Recalcular (nueva consulta a Google Maps)"
                >
                    <RefreshCw className="w-3 h-3" />
                </button>
            )}
        </div>
    );
};
