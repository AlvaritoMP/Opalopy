import React from 'react';
import { MapPin, Copy, MessageCircle } from 'lucide-react';
import { Candidate, InterviewLocation } from '../types';
import { buildCandidateTransitRoutes, buildTransitRouteShareMessage } from '../lib/transitRouteLinks';

interface CandidateTransitRoutesProps {
    candidate: Pick<Candidate, 'address' | 'district' | 'province' | 'phone' | 'phone2'>;
    locations: InterviewLocation[] | undefined;
    onCopy?: (text: string) => void;
}

export const CandidateTransitRoutes: React.FC<CandidateTransitRoutesProps> = ({
    candidate,
    locations,
    onCopy,
}) => {
    const { origin, routes } = buildCandidateTransitRoutes(candidate, locations);

    if (!locations?.length) return null;

    const handleCopy = (text: string) => {
        if (onCopy) {
            onCopy(text);
            return;
        }
        void navigator.clipboard.writeText(text);
    };

    const phone = candidate.phone || candidate.phone2;
    const normalizedPhone = phone?.replace(/\D/g, '');

    return (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-primary-600" />
                Rutas en transporte público
            </h3>
            {!origin ? (
                <p className="text-sm text-gray-600">
                    Agregue dirección, distrito o provincia del candidato para generar rutas.
                </p>
            ) : (
                <div className="space-y-2">
                    {routes.map(({ location, url }) => (
                        <div
                            key={location.id}
                            className="flex flex-wrap items-center gap-2 text-sm"
                        >
                            <span className="text-gray-700 font-medium min-w-[8rem]">{location.name}:</span>
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded border border-primary-200"
                            >
                                <MapPin className="w-3.5 h-3.5" />
                                Ver ruta en Maps
                            </a>
                            <button
                                type="button"
                                onClick={() => handleCopy(url)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-white rounded border border-gray-200"
                                title="Copiar enlace"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Copiar
                            </button>
                            {normalizedPhone && (
                                <a
                                    href={`https://wa.me/${normalizedPhone}?text=${encodeURIComponent(buildTransitRouteShareMessage(location.name, url))}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 rounded border border-green-200"
                                >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    Enviar por WhatsApp
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
