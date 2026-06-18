import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Save, Upload, Download, Target, Loader2, Trash2 } from 'lucide-react';
import {
    Process,
    CustomColumn,
    IdealProfileConfig,
    IdealProfileCriterion,
    IdealProfileMatchMode,
} from '../types';
import {
    getIdealProfileAvailableFields,
    getIdealProfileFieldType,
    parseIdealProfileImport,
    buildIdealProfileImportTemplate,
    IdealProfileFieldDef,
    criterionHasIdealValue,
    isActiveIdealProfileCriterion,
    criterionHasExcludeValue,
    normalizeIdealProfileCriteria,
    normalizeIdealProfileConfig,
    ProfileMatchSummary,
} from '../lib/bulkIdealProfileMatch';
import { getColumnLabel, normalizeColumnNameKey } from '../lib/bulkTableColumns';
import { BulkIdealProfileSummaryPanel } from './BulkIdealProfileSummaryPanel';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    process: Process;
    customColumns: CustomColumn[];
    columnOrder: string[];
    onSave: (config: IdealProfileConfig) => Promise<void>;
    profileMatchSummary?: ProfileMatchSummary | null;
    profileMatchSummaryLoading?: boolean;
}

const MATCH_MODE_LABELS: Record<IdealProfileMatchMode, string> = {
    exact: 'Exacto',
    contains: 'Contiene',
    minimum: 'Mínimo',
    maximum: 'Máximo',
    range: 'Rango',
};

function getMatchModesForType(type: IdealProfileFieldDef['type']): IdealProfileMatchMode[] {
    switch (type) {
        case 'number':
        case 'route_cost':
            return ['exact', 'minimum', 'maximum', 'range'];
        case 'date':
            return ['exact', 'range'];
        case 'checkbox':
        case 'select':
            return ['exact'];
        default:
            return ['exact', 'contains'];
    }
}

function createDefaultCriteria(
    fields: IdealProfileFieldDef[],
    existing?: IdealProfileConfig,
    customColumns: CustomColumn[] = [],
    bulkConfig?: Process['bulkConfig']
): IdealProfileCriterion[] {
    const { config: normalized } = normalizeIdealProfileConfig(
        existing,
        customColumns,
        bulkConfig
    );
    const existingByFieldId = new Map((normalized?.criteria || []).map(c => [c.fieldId, c]));
    const existingByLabel = new Map<string, IdealProfileCriterion>();
    for (const criterion of normalized?.criteria || []) {
        const label = getColumnLabel(criterion.fieldId, customColumns);
        if (label) existingByLabel.set(normalizeColumnNameKey(label), criterion);
    }

    return fields.map(f => {
        const prev =
            existingByFieldId.get(f.fieldId) ||
            existingByLabel.get(normalizeColumnNameKey(f.label));
        if (prev) {
            return {
                ...prev,
                fieldId: f.fieldId,
                enabled: prev.enabled ?? criterionHasIdealValue(prev),
            };
        }
        return {
            fieldId: f.fieldId,
            enabled: false,
            idealValue: f.type === 'checkbox' ? false : '',
            excludeValue: '',
            matchMode:
                f.type === 'route_cost' ? 'maximum'
                : f.type === 'number' ? 'minimum'
                : f.type === 'select' || f.type === 'checkbox' ? 'exact'
                : 'contains',
            weight: 1,
        };
    });
}

export const BulkIdealProfileModal: React.FC<Props> = ({
    isOpen,
    onClose,
    process,
    customColumns,
    columnOrder,
    onSave,
    profileMatchSummary = null,
    profileMatchSummaryLoading = false,
}) => {
    const availableFields = useMemo(
        () => getIdealProfileAvailableFields(customColumns, columnOrder),
        [customColumns, columnOrder]
    );

    const [enabled, setEnabled] = useState(false);
    const [greenThreshold, setGreenThreshold] = useState(80);
    const [yellowThreshold, setYellowThreshold] = useState(50);
    const [criteria, setCriteria] = useState<IdealProfileCriterion[]>([]);
    const [saving, setSaving] = useState(false);
    const [importPaste, setImportPaste] = useState('');
    const [showImport, setShowImport] = useState(false);
    const importFileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const cfg = process.bulkConfig?.idealProfile;
        setEnabled(cfg?.enabled ?? false);
        setGreenThreshold(cfg?.greenThreshold ?? 80);
        setYellowThreshold(cfg?.yellowThreshold ?? 50);
        setCriteria(createDefaultCriteria(availableFields, cfg, customColumns, process.bulkConfig));
        setImportPaste('');
        setShowImport(false);
    }, [isOpen, process.id, process.bulkConfig?.idealProfile, process.bulkConfig, availableFields, customColumns]);

    const updateCriterion = useCallback((fieldId: string, patch: Partial<IdealProfileCriterion>) => {
        setCriteria(prev =>
            prev.map(c => {
                if (c.fieldId !== fieldId) return c;
                const next = { ...c, ...patch };
                if (patch.enabled === false) return next;
                if (criterionHasIdealValue(next) || criterionHasExcludeValue(next)) {
                    next.enabled = true;
                }
                return next;
            })
        );
    }, []);

    const handleClearAllCriteria = () => {
        if (
            !window.confirm(
                '¿Limpiar todos los criterios del perfil ideal? Se desmarcarán todos los campos y se borrarán los valores configurados.'
            )
        ) {
            return;
        }
        setCriteria(createDefaultCriteria(availableFields, undefined, customColumns, process.bulkConfig));
    };

    const handleUncheckAllCriteria = () => {
        setCriteria(prev => prev.map(c => ({ ...c, enabled: false })));
    };

    const handleImportPaste = () => {
        const imported = parseIdealProfileImport(importPaste, availableFields);
        setCriteria(prev =>
            prev.map(c => {
                const val = imported[c.fieldId];
                if (val === undefined) return c;
                const field = availableFields.find(f => f.fieldId === c.fieldId);
                let idealValue: string | number | boolean = val;
                if (field?.type === 'number' || field?.type === 'route_cost') idealValue = parseFloat(val) || 0;
                if (field?.type === 'checkbox') idealValue = val === 'true' || val === '1' || val.toLowerCase() === 'sí';
                return { ...c, enabled: true, idealValue };
            })
        );
        setShowImport(false);
        setImportPaste('');
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setImportPaste(String(reader.result || ''));
            setShowImport(true);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleDownloadTemplate = () => {
        const tsv = buildIdealProfileImportTemplate(availableFields, criteria);
        const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `perfil-ideal-${process.title.replace(/\s+/g, '-')}.tsv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave({
                enabled,
                greenThreshold,
                yellowThreshold,
                criteria: normalizeIdealProfileCriteria(criteria),
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const enabledCount = criteria.filter(isActiveIdealProfileCriterion).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Perfil ideal del proceso</h2>
                    </div>
                    <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                    {enabled && (
                        <BulkIdealProfileSummaryPanel
                            summary={profileMatchSummary}
                            config={process.bulkConfig?.idealProfile}
                            loading={profileMatchSummaryLoading}
                            compact
                        />
                    )}

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={enabled}
                            onChange={e => setEnabled(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded"
                        />
                        <span className="text-sm font-medium text-gray-800">
                            Activar comparación con perfil ideal
                        </span>
                        {enabled && (
                            <span className="text-xs text-gray-500">
                                ({enabledCount} campo{enabledCount !== 1 ? 's' : ''} seleccionado{enabledCount !== 1 ? 's' : ''})
                            </span>
                        )}
                    </label>

                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Umbral verde (≥ %)
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={greenThreshold}
                                onChange={e => setGreenThreshold(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Umbral amarillo (≥ %, debajo = rojo)
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={yellowThreshold}
                                onChange={e => setYellowThreshold(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                        <p className="col-span-2 text-xs text-gray-500">
                            Los candidatos con cumplimiento ≥ {greenThreshold}% se marcan en verde,
                            entre {yellowThreshold}% y {greenThreshold - 1}% en amarillo, y por debajo de {yellowThreshold}% en rojo.
                            Las celdas de la tabla con criterio activo se colorean según su cumplimiento individual (mapa de calor).
                            Puede definir un valor ideal, valores prohibidos en «No debe contener», o ambos.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setShowImport(v => !v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-lg hover:bg-amber-100"
                        >
                            <Upload className="w-4 h-4" />
                            Importar valores
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                            <Download className="w-4 h-4" />
                            Plantilla TSV
                        </button>
                        <input ref={importFileRef} type="file" accept=".tsv,.csv,.txt" className="hidden" onChange={handleFileImport} />
                        <button
                            type="button"
                            onClick={() => importFileRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                            Subir archivo
                        </button>
                        <button
                            type="button"
                            onClick={handleUncheckAllCriteria}
                            disabled={!enabled}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                        >
                            Desmarcar todos
                        </button>
                        <button
                            type="button"
                            onClick={handleClearAllCriteria}
                            disabled={!enabled}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg hover:bg-red-100 disabled:opacity-40"
                        >
                            <Trash2 className="w-4 h-4" />
                            Limpiar criterios
                        </button>
                    </div>

                    {showImport && (
                        <div className="space-y-2 p-3 border border-amber-200 bg-amber-50/50 rounded-lg">
                            <p className="text-xs text-gray-600">
                                Pegue una fila de encabezados y una fila de valores (TSV/CSV). Los nombres deben coincidir con las columnas del proceso.
                            </p>
                            <textarea
                                value={importPaste}
                                onChange={e => setImportPaste(e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono"
                                placeholder={'Provincia\tExperiencia\tEdad\nLima\t5\t25'}
                            />
                            <button
                                type="button"
                                onClick={handleImportPaste}
                                className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                            >
                                Aplicar importación
                            </button>
                        </div>
                    )}

                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-3 py-2 text-left w-10">Usar</th>
                                    <th className="px-3 py-2 text-left">Campo</th>
                                    <th className="px-3 py-2 text-left">Valor ideal</th>
                                    <th className="px-3 py-2 text-left">No debe contener</th>
                                    <th className="px-3 py-2 text-left">Modo</th>
                                    <th className="px-3 py-2 text-left w-16">Peso</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {criteria.map(c => {
                                    const field = availableFields.find(f => f.fieldId === c.fieldId);
                                    if (!field) return null;
                                    const modes = getMatchModesForType(field.type);
                                    const fieldType = getIdealProfileFieldType(c.fieldId, customColumns);

                                    return (
                                        <tr key={c.fieldId} className={c.enabled ? 'bg-white' : 'bg-gray-50/50'}>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={isActiveIdealProfileCriterion(c)}
                                                    onChange={e => updateCriterion(c.fieldId, { enabled: e.target.checked })}
                                                    className="w-4 h-4 text-indigo-600 rounded"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="font-medium text-gray-800">{field.label}</span>
                                                <span className="ml-1.5 text-[10px] text-gray-400 uppercase">{fieldType}</span>
                                            </td>
                                            <td className="px-3 py-2">
                                                {field.type === 'checkbox' ? (
                                                    <select
                                                        value={c.idealValue === true ? 'true' : 'false'}
                                                        onChange={e => updateCriterion(c.fieldId, { idealValue: e.target.value === 'true' })}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    >
                                                        <option value="true">Sí</option>
                                                        <option value="false">No</option>
                                                    </select>
                                                ) : field.type === 'select' && field.options?.length ? (
                                                    <select
                                                        value={String(c.idealValue ?? '')}
                                                        onChange={e => updateCriterion(c.fieldId, { idealValue: e.target.value })}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    >
                                                        <option value="">—</option>
                                                        {field.options.map(opt => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                ) : (field.type === 'number' || field.type === 'route_cost') && c.matchMode === 'range' ? (
                                                    <div className="flex gap-1 items-center">
                                                        <input
                                                            type="number"
                                                            value={c.idealValue ?? ''}
                                                            onChange={e => updateCriterion(c.fieldId, { idealValue: parseFloat(e.target.value) || 0 })}
                                                            placeholder="Mín"
                                                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                                        />
                                                        <span className="text-gray-400">—</span>
                                                        <input
                                                            type="number"
                                                            value={c.maxValue ?? ''}
                                                            onChange={e => updateCriterion(c.fieldId, { maxValue: parseFloat(e.target.value) || 0 })}
                                                            placeholder="Máx"
                                                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <input
                                                            type={field.type === 'number' || field.type === 'route_cost' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                                            value={String(c.idealValue ?? '')}
                                                            onChange={e =>
                                                                updateCriterion(c.fieldId, {
                                                                    idealValue: field.type === 'number' || field.type === 'route_cost'
                                                                        ? parseFloat(e.target.value) || 0
                                                                        : e.target.value,
                                                                })
                                                            }
                                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                            placeholder={
                                                                field.type === 'text' && (c.matchMode === 'contains' || !c.matchMode)
                                                                    ? 'Ej: Los Olivos  o  1, 2, 3'
                                                                    : undefined
                                                            }
                                                        />
                                                        {field.type === 'text' && (c.matchMode === 'contains' || !c.matchMode) && (
                                                            <p className="text-[10px] text-gray-400 leading-tight">
                                                                Varias opciones (OR): sepárelas con coma, punto y coma, barra o |.
                                                                Ej: <span className="font-mono">Los Olivos, San Miguel</span> o <span className="font-mono">1|2|3</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                {field.type === 'checkbox' ? (
                                                    <select
                                                        value={c.excludeValue === true ? 'true' : c.excludeValue === false ? 'false' : ''}
                                                        onChange={e => updateCriterion(c.fieldId, {
                                                            excludeValue: e.target.value === '' ? '' : e.target.value === 'true',
                                                        })}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    >
                                                        <option value="">—</option>
                                                        <option value="true">Sí</option>
                                                        <option value="false">No</option>
                                                    </select>
                                                ) : field.type === 'select' && field.options?.length ? (
                                                    <select
                                                        value={String(c.excludeValue ?? '')}
                                                        onChange={e => updateCriterion(c.fieldId, { excludeValue: e.target.value })}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    >
                                                        <option value="">—</option>
                                                        {field.options.map(opt => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <input
                                                            type={field.type === 'number' || field.type === 'route_cost' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                                            value={String(c.excludeValue ?? '')}
                                                            onChange={e =>
                                                                updateCriterion(c.fieldId, {
                                                                    excludeValue: field.type === 'number' || field.type === 'route_cost'
                                                                        ? (e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                                                                        : e.target.value,
                                                                })
                                                            }
                                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                            placeholder={
                                                                field.type === 'text'
                                                                    ? 'Ej: Callao, Ate'
                                                                    : undefined
                                                            }
                                                        />
                                                        {field.type === 'text' && (
                                                            <p className="text-[10px] text-gray-400 leading-tight">
                                                                Varias exclusiones (OR): sepárelas con coma, ;, / o |.
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    value={c.matchMode || modes[0]}
                                                    onChange={e => updateCriterion(c.fieldId, { matchMode: e.target.value as IdealProfileMatchMode })}
                                                    disabled={modes.length <= 1}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                                                >
                                                    {modes.map(m => (
                                                        <option key={m} value={m}>{MATCH_MODE_LABELS[m]}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={10}
                                                    value={c.weight ?? 1}
                                                    onChange={e => updateCriterion(c.fieldId, { weight: parseInt(e.target.value, 10) || 1 })}
                                                    className="w-14 px-2 py-1 border border-gray-300 rounded text-sm"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar perfil ideal
                    </button>
                </div>
            </div>
        </div>
    );
};
