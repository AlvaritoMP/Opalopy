import React from 'react';
import { MapPin, Copy } from 'lucide-react';

interface BulkRouteCellProps {
    url: string | null;
    missingOrigin?: boolean;
    missingDestination?: boolean;
    onCopy?: (url: string) => void;
}

export const BulkRouteCell: React.FC<BulkRouteCellProps> = ({
    url,
    missingOrigin,
    missingDestination,
    onCopy,
}) => {
    if (missingDestination) {
        return <span className="text-gray-400 text-xs">Sin destino</span>;
    }
    if (missingOrigin || !url) {
        return <span className="text-gray-400 text-xs" title="Agregue dirección, distrito o provincia al candidato">Sin ubicación</span>;
    }

    return (
        <div className="flex items-center gap-1">
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded whitespace-nowrap"
                title="Abrir ruta en transporte público (Google Maps)"
            >
                <MapPin className="w-3 h-3 shrink-0" />
                Ver ruta
            </a>
            {onCopy && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onCopy(url);
                    }}
                    className="p-0.5 text-gray-400 hover:text-gray-600 rounded"
                    title="Copiar enlace"
                >
                    <Copy className="w-3 h-3" />
                </button>
            )}
        </div>
    );
};
