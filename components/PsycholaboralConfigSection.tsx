import React from 'react';
import { BulkProcessConfig, PsycholaboralInventory } from '../types';
import { BookOpen } from 'lucide-react';

interface PsycholaboralConfigSectionProps {
    bulkConfig: BulkProcessConfig;
    setBulkConfig: (config: BulkProcessConfig) => void;
    inventory: PsycholaboralInventory;
    onOpenInventory: () => void;
}

export const PsycholaboralConfigSection: React.FC<PsycholaboralConfigSectionProps> = ({
    bulkConfig,
    setBulkConfig,
    inventory,
    onOpenInventory,
}) => {
    const psych = bulkConfig.psycholaboral || { enabled: true };
    const selectedSetId = psych.competencySetId || inventory.competencySets[0]?.id || '';

    const updatePsych = (patch: Partial<NonNullable<BulkProcessConfig['psycholaboral']>>) => {
        setBulkConfig({
            ...bulkConfig,
            psycholaboral: { ...psych, enabled: psych.enabled !== false, ...patch },
        });
    };

    const selectedSet = inventory.competencySets.find(s => s.id === selectedSetId);

    return (
        <div className="space-y-4 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">Informes Psicolaborales</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Configure competencias y plantillas para generar informes desde Procesos Masivos.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onOpenInventory}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                >
                    <BookOpen className="w-3.5 h-3.5" />
                    Inventario
                </button>
            </div>

            <label className="flex items-center gap-2">
                <input
                    type="checkbox"
                    checked={psych.enabled !== false}
                    onChange={e => updatePsych({ enabled: e.target.checked })}
                    className="rounded text-primary-600"
                />
                <span className="text-sm text-gray-700">Habilitar informes psicolaborales en este proceso</span>
            </label>

            {psych.enabled !== false && (
                <>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Puesto por defecto en el informe</label>
                        <input
                            type="text"
                            value={psych.defaultPositionTitle || ''}
                            onChange={e => updatePsych({ defaultPositionTitle: e.target.value })}
                            placeholder="Ej: Vendedor de Líneas Móviles"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Set de competencias</label>
                        <select
                            value={selectedSetId}
                            onChange={e => updatePsych({ competencySetId: e.target.value, competencies: undefined })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                            {inventory.competencySets.map(set => (
                                <option key={set.id} value={set.id}>{set.name}</option>
                            ))}
                        </select>
                    </div>

                    {selectedSet && (
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-medium text-gray-600">
                                Competencias ({selectedSet.competencies.length})
                            </p>
                            {selectedSet.competencies.map(c => (
                                <div key={c.id} className="text-xs text-gray-700 border-b border-gray-100 pb-2 last:border-0">
                                    <span className="font-medium">{c.name}</span>
                                    <span className="text-gray-500"> — Ptje. esperado: {c.expectedScore}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla de conclusión por defecto</label>
                        <select
                            value={psych.defaultConclusionTemplateId || ''}
                            onChange={e => updatePsych({ defaultConclusionTemplateId: e.target.value || undefined })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                            <option value="">— Seleccionar al evaluar —</option>
                            {inventory.conclusionTemplates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                </>
            )}
        </div>
    );
};
