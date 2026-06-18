import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import {
    PsycholaboralInventory,
    IntellectualLevelDefinition,
    PersonalityTraitDefinition,
    PsycholaboralCompetencySet,
    ConclusionTemplate,
} from '../types';
import { psycholaboralApi } from '../lib/api/psycholaboral';
import { createDefaultPsycholaboralInventory } from '../lib/psycholaboralDefaults';
import { useAppState } from '../App';

type Tab = 'intellectual' | 'personality' | 'competencies' | 'conclusions';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSaved?: (inventory: PsycholaboralInventory) => void;
}

const uid = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const PsycholaboralInventoryModal: React.FC<Props> = ({ isOpen, onClose, onSaved }) => {
    const { actions } = useAppState();
    const [tab, setTab] = useState<Tab>('intellectual');
    const [inventory, setInventory] = useState<PsycholaboralInventory>(createDefaultPsycholaboralInventory());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedSetIndex, setSelectedSetIndex] = useState(0);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        psycholaboralApi
            .getInventory()
            .then(setInventory)
            .finally(() => setLoading(false));
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setSaving(true);
        try {
            const saved = await psycholaboralApi.saveInventory(inventory);
            onSaved?.(saved);
            actions.showToast('Inventario psicolaboral guardado', 'success', 3000);
            onClose();
        } catch (e: any) {
            actions.showToast(e.message || 'Error al guardar', 'error', 4000);
        } finally {
            setSaving(false);
        }
    };

    const tabs: { id: Tab; label: string }[] = [
        { id: 'intellectual', label: 'Nivel intelectual' },
        { id: 'personality', label: 'Personalidad' },
        { id: 'competencies', label: 'Competencias' },
        { id: 'conclusions', label: 'Conclusiones' },
    ];

    const currentSet = inventory.competencySets[selectedSetIndex];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold">Inventario — Informes Psicolaborales</h2>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex border-b px-4 gap-1 overflow-x-auto">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 ${
                                tab === t.id
                                    ? 'border-primary-600 text-primary-600 font-medium'
                                    : 'border-transparent text-gray-500'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                        </div>
                    ) : tab === 'intellectual' ? (
                        <div className="space-y-4">
                            <p className="text-xs text-gray-500">
                                Defina los 5 niveles intelectuales y sus interpretaciones. Se usarán al generar informes.
                            </p>
                            {inventory.intellectualLevels.map((level, i) => (
                                <IntellectualLevelEditor
                                    key={level.id}
                                    level={level}
                                    onChange={updated => {
                                        const levels = [...inventory.intellectualLevels];
                                        levels[i] = updated;
                                        setInventory({ ...inventory, intellectualLevels: levels });
                                    }}
                                />
                            ))}
                        </div>
                    ) : tab === 'personality' ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <p className="text-xs text-gray-500">Rasgos evaluados en recursos de personalidad.</p>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setInventory({
                                            ...inventory,
                                            personalityTraits: [
                                                ...inventory.personalityTraits,
                                                { id: uid(), name: 'Nuevo rasgo', definition: '' },
                                            ],
                                        })
                                    }
                                    className="text-xs flex items-center gap-1 text-primary-600"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Agregar rasgo
                                </button>
                            </div>
                            {inventory.personalityTraits.map((trait, i) => (
                                <TraitEditor
                                    key={trait.id}
                                    trait={trait}
                                    onChange={updated => {
                                        const traits = [...inventory.personalityTraits];
                                        traits[i] = updated;
                                        setInventory({ ...inventory, personalityTraits: traits });
                                    }}
                                    onDelete={() =>
                                        setInventory({
                                            ...inventory,
                                            personalityTraits: inventory.personalityTraits.filter((_, j) => j !== i),
                                        })
                                    }
                                />
                            ))}
                        </div>
                    ) : tab === 'competencies' ? (
                        <div className="space-y-4">
                            <div className="flex gap-2 flex-wrap items-center">
                                <select
                                    value={selectedSetIndex}
                                    onChange={e => setSelectedSetIndex(Number(e.target.value))}
                                    className="text-sm border rounded-lg px-2 py-1"
                                >
                                    {inventory.competencySets.map((s, i) => (
                                        <option key={s.id} value={i}>{s.name}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInventory({
                                            ...inventory,
                                            competencySets: [
                                                ...inventory.competencySets,
                                                {
                                                    id: uid(),
                                                    name: 'Nuevo set',
                                                    competencies: [],
                                                },
                                            ],
                                        });
                                        setSelectedSetIndex(inventory.competencySets.length);
                                    }}
                                    className="text-xs text-primary-600 flex items-center gap-1"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Nuevo set
                                </button>
                                {inventory.competencySets.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const sets = inventory.competencySets.filter((_, i) => i !== selectedSetIndex);
                                            setInventory({ ...inventory, competencySets: sets });
                                            setSelectedSetIndex(0);
                                        }}
                                        className="text-xs text-red-600"
                                    >
                                        Eliminar set
                                    </button>
                                )}
                            </div>
                            {currentSet && (
                                <>
                                    <input
                                        type="text"
                                        value={currentSet.name}
                                        onChange={e => {
                                            const sets = [...inventory.competencySets];
                                            sets[selectedSetIndex] = { ...currentSet, name: e.target.value };
                                            setInventory({ ...inventory, competencySets: sets });
                                        }}
                                        className="w-full px-3 py-2 border rounded-lg text-sm font-medium"
                                        placeholder="Nombre del set"
                                    />
                                    {currentSet.competencies.map((comp, ci) => (
                                        <CompetencyEditor
                                            key={comp.id}
                                            comp={comp}
                                            onChange={updated => {
                                                const comps = [...currentSet.competencies];
                                                comps[ci] = updated;
                                                const sets = [...inventory.competencySets];
                                                sets[selectedSetIndex] = { ...currentSet, competencies: comps };
                                                setInventory({ ...inventory, competencySets: sets });
                                            }}
                                            onDelete={() => {
                                                const sets = [...inventory.competencySets];
                                                sets[selectedSetIndex] = {
                                                    ...currentSet,
                                                    competencies: currentSet.competencies.filter((_, j) => j !== ci),
                                                };
                                                setInventory({ ...inventory, competencySets: sets });
                                            }}
                                        />
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const sets = [...inventory.competencySets];
                                            sets[selectedSetIndex] = {
                                                ...currentSet,
                                                competencies: [
                                                    ...currentSet.competencies,
                                                    {
                                                        id: uid(),
                                                        name: '',
                                                        definition: '',
                                                        expectedScore: 7,
                                                    },
                                                ],
                                            };
                                            setInventory({ ...inventory, competencySets: sets });
                                        }}
                                        className="text-sm text-primary-600 flex items-center gap-1"
                                    >
                                        <Plus className="w-4 h-4" /> Agregar competencia
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <p className="text-xs text-gray-500">
                                    Plantillas con variables: {'{{nombre}}'}, {'{{puesto}}'}, {'{{estado}}'}, {'{{nivel_intelectual}}'}, {'{{porcentaje_competencias}}'}, etc.
                                </p>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setInventory({
                                            ...inventory,
                                            conclusionTemplates: [
                                                ...inventory.conclusionTemplates,
                                                { id: uid(), name: 'Nueva plantilla', template: '' },
                                            ],
                                        })
                                    }
                                    className="text-xs text-primary-600 flex items-center gap-1"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Nueva plantilla
                                </button>
                            </div>
                            {inventory.conclusionTemplates.map((tpl, i) => (
                                <ConclusionEditor
                                    key={tpl.id}
                                    tpl={tpl}
                                    onChange={updated => {
                                        const templates = [...inventory.conclusionTemplates];
                                        templates[i] = updated;
                                        setInventory({ ...inventory, conclusionTemplates: templates });
                                    }}
                                    onDelete={() =>
                                        setInventory({
                                            ...inventory,
                                            conclusionTemplates: inventory.conclusionTemplates.filter((_, j) => j !== i),
                                        })
                                    }
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t px-6 py-4 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50">
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar inventario
                    </button>
                </div>
            </div>
        </div>
    );
};

const IntellectualLevelEditor: React.FC<{
    level: IntellectualLevelDefinition;
    onChange: (l: IntellectualLevelDefinition) => void;
}> = ({ level, onChange }) => (
    <div className="border rounded-lg p-3 space-y-2">
        <div className="flex gap-2">
            <input
                type="text"
                value={level.name}
                onChange={e => onChange({ ...level, name: e.target.value })}
                className="flex-1 px-2 py-1 border rounded text-sm font-medium"
                placeholder="Nombre del nivel"
            />
            <input
                type="text"
                value={level.scoreRange}
                onChange={e => onChange({ ...level, scoreRange: e.target.value })}
                className="w-24 px-2 py-1 border rounded text-sm"
                placeholder="0-15"
            />
        </div>
        <textarea
            value={level.interpretation}
            onChange={e => onChange({ ...level, interpretation: e.target.value })}
            rows={3}
            className="w-full px-2 py-1 border rounded text-sm"
            placeholder="Interpretación..."
        />
    </div>
);

const TraitEditor: React.FC<{
    trait: PersonalityTraitDefinition;
    onChange: (t: PersonalityTraitDefinition) => void;
    onDelete: () => void;
}> = ({ trait, onChange, onDelete }) => (
    <div className="border rounded-lg p-3 space-y-2">
        <div className="flex gap-2">
            <input
                type="text"
                value={trait.name}
                onChange={e => onChange({ ...trait, name: e.target.value })}
                className="flex-1 px-2 py-1 border rounded text-sm font-medium"
            />
            <button type="button" onClick={onDelete} className="p-1 text-red-600 hover:bg-red-50 rounded">
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
        <textarea
            value={trait.definition}
            onChange={e => onChange({ ...trait, definition: e.target.value })}
            rows={2}
            className="w-full px-2 py-1 border rounded text-sm"
            placeholder="Definición del rasgo"
        />
    </div>
);

const CompetencyEditor: React.FC<{
    comp: { id: string; name: string; definition: string; expectedScore: number };
    onChange: (c: { id: string; name: string; definition: string; expectedScore: number }) => void;
    onDelete: () => void;
}> = ({ comp, onChange, onDelete }) => (
    <div className="border rounded-lg p-3 space-y-2">
        <div className="flex gap-2">
            <input
                type="text"
                value={comp.name}
                onChange={e => onChange({ ...comp, name: e.target.value })}
                className="flex-1 px-2 py-1 border rounded text-sm font-medium"
                placeholder="Nombre competencia"
            />
            <input
                type="number"
                min={1}
                max={9}
                value={comp.expectedScore}
                onChange={e => onChange({ ...comp, expectedScore: Number(e.target.value) || 0 })}
                className="w-16 px-2 py-1 border rounded text-sm"
                title="Puntaje esperado"
            />
            <button type="button" onClick={onDelete} className="p-1 text-red-600">
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
        <textarea
            value={comp.definition}
            onChange={e => onChange({ ...comp, definition: e.target.value })}
            rows={2}
            className="w-full px-2 py-1 border rounded text-sm"
            placeholder="Definición"
        />
    </div>
);

const ConclusionEditor: React.FC<{
    tpl: ConclusionTemplate;
    onChange: (t: ConclusionTemplate) => void;
    onDelete: () => void;
}> = ({ tpl, onChange, onDelete }) => (
    <div className="border rounded-lg p-3 space-y-2">
        <div className="flex gap-2">
            <input
                type="text"
                value={tpl.name}
                onChange={e => onChange({ ...tpl, name: e.target.value })}
                className="flex-1 px-2 py-1 border rounded text-sm font-medium"
                placeholder="Nombre de la plantilla"
            />
            <button type="button" onClick={onDelete} className="p-1 text-red-600">
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
        <textarea
            value={tpl.template}
            onChange={e => onChange({ ...tpl, template: e.target.value })}
            rows={4}
            className="w-full px-2 py-1 border rounded text-sm font-mono"
            placeholder="Texto de conclusión con {{variables}}..."
        />
    </div>
);


