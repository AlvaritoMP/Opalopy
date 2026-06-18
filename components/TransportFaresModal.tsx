import React, { useEffect, useState } from 'react';
import { X, Save, Loader2, Bus } from 'lucide-react';
import { useAppState } from '../App';
import { TransportFareSetting } from '../types';
import { TransportFaresSettingsSection } from './TransportFaresSettingsSection';
import { getDefaultTransportFaresList } from '../lib/limaTransportFares';

interface TransportFaresModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function faresFromSettings(settings: { transportFares?: TransportFareSetting[] } | null): TransportFareSetting[] {
    if (settings?.transportFares?.length) return settings.transportFares;
    return getDefaultTransportFaresList().map(f => ({
        id: f.id,
        label: f.label,
        fare: f.fare,
        formal: f.formal,
    }));
}

export const TransportFaresModal: React.FC<TransportFaresModalProps> = ({ isOpen, onClose }) => {
    const { state, actions } = useAppState();
    const [draftFares, setDraftFares] = useState<TransportFareSetting[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && state.settings) {
            setDraftFares(faresFromSettings(state.settings));
        }
    }, [isOpen, state.settings]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!state.settings) return;
        setIsSaving(true);
        try {
            await actions.saveSettings({
                ...state.settings,
                transportFares: draftFares,
            });
            actions.showToast('Tarifas de transporte guardadas', 'success', 3000);
            onClose();
        } catch (error) {
            console.error('Error guardando tarifas:', error);
            actions.showToast('Error al guardar tarifas', 'error', 4000);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b shrink-0">
                    <div className="flex items-center gap-2">
                        <Bus className="w-5 h-5 text-primary-600" />
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Tarifas de transporte público</h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Referencia para estimar costos de ruta en procesos masivos
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    <TransportFaresSettingsSection
                        embedded
                        settings={{ transportFares: draftFares }}
                        onChange={setDraftFares}
                    />
                </div>

                <div className="p-5 border-t shrink-0 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar tarifas
                    </button>
                </div>
            </div>
        </div>
    );
};
