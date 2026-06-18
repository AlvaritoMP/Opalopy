import React from 'react';
import { Bus, RotateCcw } from 'lucide-react';
import { AppSettings, TransportFareSetting } from '../types';
import { getDefaultTransportFaresList } from '../lib/limaTransportFares';

interface TransportFaresSettingsSectionProps {
    settings: Pick<AppSettings, 'transportFares'>;
    onChange: (transportFares: TransportFareSetting[]) => void;
    /** Sin borde/card externo cuando se usa dentro de un modal. */
    embedded?: boolean;
}

function currentFares(settings: Pick<AppSettings, 'transportFares'>): TransportFareSetting[] {
    if (settings.transportFares?.length) return settings.transportFares;
    return getDefaultTransportFaresList().map(f => ({
        id: f.id,
        label: f.label,
        fare: f.fare,
        formal: f.formal,
    }));
}

export const TransportFaresSettingsSection: React.FC<TransportFaresSettingsSectionProps> = ({
    settings,
    onChange,
    embedded = false,
}) => {
    const fares = currentFares(settings);

    const updateFare = (id: string, patch: Partial<TransportFareSetting>) => {
        onChange(
            fares.map(f => (f.id === id ? { ...f, ...patch } : f))
        );
    };

    const handleResetDefaults = () => {
        if (!window.confirm('¿Restaurar todas las tarifas a los valores predeterminados?')) return;
        onChange(
            getDefaultTransportFaresList().map(f => ({
                id: f.id,
                label: f.label,
                fare: f.fare,
                formal: f.formal,
            }))
        );
    };

    const wrapperClass = embedded
        ? 'space-y-4'
        : 'bg-white p-6 rounded-xl border border-gray-200 shadow-sm';

    return (
        <div className={wrapperClass}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                    {!embedded && (
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Bus className="w-5 h-5 text-primary-600" />
                            Tarifas de transporte público
                        </h2>
                    )}
                    <p className={`text-sm text-gray-500 ${embedded ? '' : 'mt-1'} max-w-2xl`}>
                        Tabla de referencia para estimar costos de ruta. Los cambios aplican a cálculos nuevos;
                        los valores ya guardados en candidatos no se modifican automáticamente.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                    <RotateCcw className="w-4 h-4" />
                    Restaurar predeterminadas
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50 text-left text-gray-600">
                        <tr>
                            <th className="px-3 py-2 font-medium">Tipo de transporte</th>
                            <th className="px-3 py-2 font-medium w-28">Estado</th>
                            <th className="px-3 py-2 font-medium w-36">Tarifa (S/)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {fares.map(fare => (
                            <tr key={fare.id} className="hover:bg-gray-50/80">
                                <td className="px-3 py-2">
                                    <input
                                        type="text"
                                        value={fare.label}
                                        onChange={e => updateFare(fare.id, { label: e.target.value })}
                                        className="w-full input text-sm"
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <select
                                        value={fare.formal ? 'formal' : 'informal'}
                                        onChange={e =>
                                            updateFare(fare.id, { formal: e.target.value === 'formal' })
                                        }
                                        className="w-full input text-sm"
                                    >
                                        <option value="formal">Formal</option>
                                        <option value="informal">Informal</option>
                                    </select>
                                </td>
                                <td className="px-3 py-2">
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.1}
                                        value={fare.fare}
                                        onChange={e =>
                                            updateFare(fare.id, {
                                                fare: parseFloat(e.target.value) || 0,
                                            })
                                        }
                                        className="w-full input text-sm"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
