import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Save, Loader2, RefreshCw } from 'lucide-react';
import { useAppState } from '../App';
import { BulkCandidate } from '../lib/api/bulkCandidates';
import { Process, PsycholaboralEvaluation, PsycholaboralInventory, IntellectualLevelId, PersonalityLevel, PsycholaboralSuitability, CustomColumn } from '../types';
import { psycholaboralApi } from '../lib/api/psycholaboral';
import {
    resolveProcessCompetencies,
    createEmptyEvaluation,
    calculateCompetencyTotals,
    generateConclusionFromTemplate,
    mergePsycholaboralInventory,
    buildPsycholaboralDisplayName,
} from '../lib/psycholaboralUtils';
import {
    resolveCandidateAge,
    getCandidateCustomColumnValue,
} from '../lib/bulkTableColumns';
import { captureElementToPdf, downloadPsycholaboralPdf } from '../lib/psycholaboralPdf';
import { PsycholaboralReportDocument } from './PsycholaboralReportDocument';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    candidates: BulkCandidate[];
    process: Process;
    inventory: PsycholaboralInventory;
    /** Columnas masivas / valores para armar nombre + apellidos en el PDF */
    customColumns?: CustomColumn[];
    columnValues?: Record<string, Record<string, unknown>>;
    legacyColumnIdToName?: Record<string, string>;
}

export const PsycholaboralReportModal: React.FC<Props> = ({
    isOpen,
    onClose,
    candidates,
    process,
    inventory: initialInventory,
    customColumns = [],
    columnValues = {},
    legacyColumnIdToName = {},
}) => {
    const { state, actions } = useAppState();
    const inventory = useMemo(() => mergePsycholaboralInventory(initialInventory), [initialInventory]);
    const competencies = useMemo(() => resolveProcessCompetencies(process, inventory), [process, inventory]);

    const [index, setIndex] = useState(0);
    const [evaluation, setEvaluation] = useState<PsycholaboralEvaluation | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState(
        process.bulkConfig?.psycholaboral?.defaultConclusionTemplateId || ''
    );
    const reportRef = useRef<HTMLDivElement>(null);

    const candidate = candidates[index];
    const primaryColor = state.settings?.reportTheme?.primaryColor || '#0f766e';
    const accentColor = state.settings?.reportTheme?.accentColor || '#4f46e5';

    const fullNameForReport = useMemo(() => {
        if (!candidate) return '';
        const getCell = (columnId: string) =>
            getCandidateCustomColumnValue(
                candidate,
                columnId,
                customColumns,
                columnValues,
                legacyColumnIdToName
            );
        return buildPsycholaboralDisplayName(candidate.name, customColumns, getCell);
    }, [candidate, customColumns, columnValues, legacyColumnIdToName]);

    const reportAge = useMemo(() => {
        if (!candidate) return undefined;
        return resolveCandidateAge(
            candidate,
            customColumns,
            columnValues,
            legacyColumnIdToName
        );
    }, [candidate, customColumns, columnValues, legacyColumnIdToName]);

    const candidateForReport = useMemo(() => {
        if (!candidate) return candidate;
        return { ...candidate, age: reportAge };
    }, [candidate, reportAge]);

    useEffect(() => {
        if (!isOpen || !candidate) return;
        setLoading(true);
        psycholaboralApi
            .getEvaluation(candidate.id)
            .then(saved => {
                const empty = createEmptyEvaluation(
                    inventory,
                    competencies,
                    saved,
                    process.bulkConfig?.psycholaboral?.defaultPositionTitle || process.title
                );
                setEvaluation(empty);
            })
            .finally(() => setLoading(false));
    }, [isOpen, candidate?.id, index]);

    if (!isOpen || candidates.length === 0) return null;

    const { totalExpected, totalObtained, percentage } = evaluation
        ? calculateCompetencyTotals(competencies, evaluation.competencies)
        : { totalExpected: 0, totalObtained: 0, percentage: 0 };

    const intellectualLevel = inventory.intellectualLevels.find(
        l => l.id === evaluation?.intellectualLevelId
    );

    const applyTemplate = () => {
        const tpl = inventory.conclusionTemplates.find(t => t.id === selectedTemplateId);
        if (!tpl || !evaluation || !candidate) return;
        const text = generateConclusionFromTemplate(
            tpl,
            candidate,
            process,
            evaluation,
            inventory,
            competencies,
            { displayName: fullNameForReport }
        );
        setEvaluation({ ...evaluation, conclusions: text });
    };

    const handleSave = async () => {
        if (!evaluation || !candidate) return;
        setSaving(true);
        try {
            await psycholaboralApi.saveEvaluation(candidate.id, evaluation);
            actions.showToast('Evaluación guardada', 'success', 2500);
        } catch (e: any) {
            actions.showToast(e.message || 'Error al guardar', 'error', 4000);
        } finally {
            setSaving(false);
        }
    };

    const handleGeneratePdf = async () => {
        if (!evaluation || !candidate) return;
        setGenerating(true);
        try {
            await psycholaboralApi.saveEvaluation(candidate.id, evaluation);
            if (!reportRef.current) throw new Error('No se pudo preparar el documento');
            await new Promise(r => setTimeout(r, 400));
            const blob = await captureElementToPdf(reportRef.current);
            const safeName = (fullNameForReport || candidate.name).replace(/[^a-z0-9_-]/gi, '_');
            downloadPsycholaboralPdf(blob, `informe_psicolaboral_${safeName}.pdf`);
            actions.showToast('PDF generado', 'success', 2500);
        } catch (e: any) {
            console.error(e);
            actions.showToast(e.message || 'Error al generar PDF', 'error', 4000);
        } finally {
            setGenerating(false);
        }
    };

    const updatePersonality = (traitId: string, patch: Partial<{ level: PersonalityLevel; observations: string }>) => {
        if (!evaluation) return;
        setEvaluation({
            ...evaluation,
            personality: evaluation.personality.map(p =>
                p.traitId === traitId ? { ...p, ...patch } : p
            ),
        });
    };

    const updateCompetency = (
        competencyId: string,
        patch: Partial<{ obtainedScore: number; observations: string }>
    ) => {
        if (!evaluation) return;
        setEvaluation({
            ...evaluation,
            competencies: evaluation.competencies.map(c =>
                c.competencyId === competencyId ? { ...c, ...patch } : c
            ),
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-2 md:p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col">
                <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        {candidates.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() => setIndex(i => i - 1)}
                                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {index + 1} / {candidates.length}
                                </span>
                                <button
                                    type="button"
                                    disabled={index >= candidates.length - 1}
                                    onClick={() => setIndex(i => i + 1)}
                                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </>
                        )}
                        <h2 className="text-base md:text-lg font-semibold truncate">
                            Informe psicolaboral — {fullNameForReport || candidate?.name}
                        </h2>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading || !evaluation ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        {/* Datos */}
                        <section>
                            <h3 className="text-sm font-semibold text-primary-700 mb-2">Datos del evaluado</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-gray-500">Nombre en informe:</span>{' '}
                                    {fullNameForReport || candidate.name}
                                </div>
                                <div>
                                    <span className="text-gray-500">DNI:</span> {candidate.dni || '—'}
                                </div>
                                <div>
                                    <span className="text-gray-500">Edad:</span>{' '}
                                    {reportAge ? `${reportAge} años` : '—'}
                                </div>
                                <div>
                                    <label className="text-gray-500 block mb-0.5">Puesto evaluado</label>
                                    <input
                                        type="text"
                                        value={evaluation.positionApplied || ''}
                                        onChange={e =>
                                            setEvaluation({ ...evaluation, positionApplied: e.target.value })
                                        }
                                        className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-500 block mb-0.5">Fecha del informe</label>
                                    <input
                                        type="date"
                                        value={evaluation.reportDate || ''}
                                        onChange={e =>
                                            setEvaluation({ ...evaluation, reportDate: e.target.value })
                                        }
                                        className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-500 block mb-0.5">Resultado</label>
                                    <select
                                        value={evaluation.suitabilityStatus || 'apto'}
                                        onChange={e =>
                                            setEvaluation({
                                                ...evaluation,
                                                suitabilityStatus: e.target.value as PsycholaboralSuitability,
                                            })
                                        }
                                        className="w-full px-2 py-1 border rounded text-sm"
                                    >
                                        <option value="apto">Apto</option>
                                        <option value="apto_reservas">Apto con reservas</option>
                                        <option value="no_apto">No apto</option>
                                    </select>
                                </div>
                            </div>
                        </section>

                        {/* Nivel intelectual */}
                        <section>
                            <h3 className="text-sm font-semibold text-primary-700 mb-2">Nivel intelectual</h3>
                            <select
                                value={evaluation.intellectualLevelId}
                                onChange={e =>
                                    setEvaluation({
                                        ...evaluation,
                                        intellectualLevelId: e.target.value as IntellectualLevelId,
                                    })
                                }
                                className="w-full md:w-auto px-3 py-2 border rounded-lg text-sm mb-2"
                            >
                                {inventory.intellectualLevels.map(l => (
                                    <option key={l.id} value={l.id}>
                                        {l.name} ({l.scoreRange})
                                    </option>
                                ))}
                            </select>
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-gray-700">
                                {intellectualLevel?.interpretation}
                            </div>
                        </section>

                        {/* Personalidad */}
                        <section>
                            <h3 className="text-sm font-semibold text-primary-700 mb-2">Recursos de personalidad</h3>
                            <div className="space-y-3">
                                {inventory.personalityTraits.map(trait => {
                                    const rating = evaluation.personality.find(p => p.traitId === trait.id);
                                    if (!rating) return null;
                                    return (
                                        <div key={trait.id} className="border rounded-lg p-3">
                                            <p className="text-sm font-medium">{trait.name}</p>
                                            <p className="text-xs text-gray-500 mb-2">{trait.definition}</p>
                                            <div className="flex gap-4 mb-2">
                                                {(['bajo', 'promedio', 'alto'] as PersonalityLevel[]).map(lvl => (
                                                    <label key={lvl} className="flex items-center gap-1 text-sm capitalize">
                                                        <input
                                                            type="radio"
                                                            name={`trait-${trait.id}`}
                                                            checked={rating.level === lvl}
                                                            onChange={() => updatePersonality(trait.id, { level: lvl })}
                                                        />
                                                        {lvl}
                                                    </label>
                                                ))}
                                            </div>
                                            <input
                                                type="text"
                                                value={rating.observations}
                                                onChange={e =>
                                                    updatePersonality(trait.id, { observations: e.target.value })
                                                }
                                                placeholder="Observaciones..."
                                                className="w-full px-2 py-1 border rounded text-sm"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Competencias */}
                        <section>
                            <h3 className="text-sm font-semibold text-primary-700 mb-2">
                                Competencias psicolaborales
                                <span className="ml-2 font-normal text-gray-500 text-xs">
                                    Total: {totalObtained}/{totalExpected} ({percentage}%)
                                </span>
                            </h3>
                            <p className="text-xs text-gray-500 mb-2">Escala: 1-3 Bajo · 4-6 Promedio · 7-9 Alto</p>
                            <div className="space-y-3">
                                {competencies.map(comp => {
                                    const rating = evaluation.competencies.find(c => c.competencyId === comp.id);
                                    if (!rating) return null;
                                    return (
                                        <div key={comp.id} className="border rounded-lg p-3 grid md:grid-cols-[1fr,80px,80px,1fr] gap-2 items-start">
                                            <div>
                                                <p className="text-sm font-medium">{comp.name}</p>
                                                <p className="text-xs text-gray-500">{comp.definition}</p>
                                            </div>
                                            <div className="text-center">
                                                <span className="text-xs text-gray-500 block">Esperado</span>
                                                <span className="font-medium">{comp.expectedScore}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-500 block">Obtenido</span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={9}
                                                    value={rating.obtainedScore}
                                                    onChange={e =>
                                                        updateCompetency(comp.id, {
                                                            obtainedScore: Math.min(
                                                                9,
                                                                Math.max(1, Number(e.target.value) || 0)
                                                            ),
                                                        })
                                                    }
                                                    className="w-full px-2 py-1 border rounded text-sm text-center"
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                value={rating.observations}
                                                onChange={e =>
                                                    updateCompetency(comp.id, { observations: e.target.value })
                                                }
                                                placeholder="Observaciones..."
                                                className="w-full px-2 py-1 border rounded text-sm"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Conclusiones */}
                        <section>
                            <h3 className="text-sm font-semibold text-primary-700 mb-2">Conclusiones</h3>
                            <div className="flex flex-wrap gap-2 mb-2">
                                <select
                                    value={selectedTemplateId}
                                    onChange={e => setSelectedTemplateId(e.target.value)}
                                    className="flex-1 min-w-[200px] px-2 py-1 border rounded text-sm"
                                >
                                    <option value="">Plantilla de conclusión...</option>
                                    {inventory.conclusionTemplates.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={applyTemplate}
                                    disabled={!selectedTemplateId}
                                    className="flex items-center gap-1 px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-40"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Aplicar plantilla
                                </button>
                            </div>
                            <textarea
                                value={evaluation.conclusions}
                                onChange={e => setEvaluation({ ...evaluation, conclusions: e.target.value })}
                                rows={6}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                placeholder="Redacte o edite las conclusiones del informe..."
                            />
                        </section>
                    </div>
                )}

                <div className="border-t px-4 md:px-6 py-3 flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                    >
                        Cerrar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || loading || !evaluation}
                        className="px-4 py-2 text-sm border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar
                    </button>
                    <button
                        type="button"
                        onClick={handleGeneratePdf}
                        disabled={generating || loading || !evaluation}
                        className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {generating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        Generar PDF
                    </button>
                </div>
            </div>

            {evaluation && candidate && (
                <div
                    aria-hidden
                    style={{
                        position: 'fixed',
                        left: -10000,
                        top: 0,
                        pointerEvents: 'none',
                        zIndex: -1,
                    }}
                >
                    <PsycholaboralReportDocument
                        ref={reportRef}
                        candidate={candidateForReport}
                        process={process}
                        evaluation={evaluation}
                        competencies={competencies}
                        inventory={inventory}
                        poweredByLogoUrl={state.settings?.poweredByLogoUrl ?? null}
                        logoUrl={state.settings?.logoUrl}
                        companyName={state.settings?.appName}
                        primaryColor={primaryColor}
                        accentColor={accentColor}
                        introText={state.settings?.reportTheme?.psycholaboralIntroText ?? null}
                        closingText={state.settings?.reportTheme?.psycholaboralClosingText ?? null}
                        footerLegalText={state.settings?.reportTheme?.footerText ?? null}
                        fullNameForReport={fullNameForReport}
                    />
                </div>
            )}
        </div>
    );
};
