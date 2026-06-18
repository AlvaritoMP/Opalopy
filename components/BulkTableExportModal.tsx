import React, { useEffect, useMemo, useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { useAppState } from '../App';
import { bulkCandidatesApi } from '../lib/api/bulkCandidates';
import type { BulkCandidate } from '../lib/api/bulkCandidates';
import { buildBulkTableExportDocument, BulkExportScope, CLIENT_EXPORT_EXCLUDE_COLUMN_IDS } from '../lib/bulkTableExport';
import { getColumnLabel } from '../lib/bulkTableColumns';
import type { HiredStageActor } from '../lib/hiringStageTracking';
import type { CustomColumn, Process } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    process: Process;
    columnOrder: string[];
    visibleColumns: string[];
    customColumns: CustomColumn[];
    columnValues: Record<string, Record<string, unknown>>;
    displayCandidates: BulkCandidate[];
    hasMore: boolean;
    total: number;
    searchQuery: string;
    selectedIds: string[];
    hiringStageActors?: Record<string, HiredStageActor>;
}

export const BulkTableExportModal: React.FC<Props> = ({
    isOpen,
    onClose,
    process,
    columnOrder,
    visibleColumns,
    customColumns,
    columnValues,
    displayCandidates,
    hasMore,
    total,
    searchQuery,
    selectedIds,
    hiringStageActors = {},
}) => {
    const { actions } = useAppState();
    const [scope, setScope] = useState<BulkExportScope>('current_view');
    const [selectedColIds, setSelectedColIds] = useState<Set<string>>(() => new Set());
    const [includedStageIds, setIncludedStageIds] = useState<Set<string>>(() => new Set());
    const [delimiter, setDelimiter] = useState<'\t' | ';'>('\t');
    const [busy, setBusy] = useState(false);

    const bulkConfig = process.bulkConfig;

    useEffect(() => {
        if (!isOpen) return;
        setSelectedColIds(new Set(visibleColumns));
        setIncludedStageIds(new Set(process.stages.map(s => s.id)));
        setScope(selectedIds.length > 0 ? 'selected' : 'current_view');
        setDelimiter('\t');
    }, [isOpen, process.id, visibleColumns, process.stages, selectedIds.length]);

    const orderedSelectedColumns = useMemo(() => {
        const sel = selectedColIds;
        return columnOrder.filter(id => sel.has(id));
    }, [columnOrder, selectedColIds]);

    const toggleCol = (id: string) => {
        setSelectedColIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleStage = (stageId: string) => {
        setIncludedStageIds(prev => {
            const next = new Set(prev);
            if (next.has(stageId)) next.delete(stageId);
            else next.add(stageId);
            return next;
        });
    };

    const selectPresetVisible = () => setSelectedColIds(new Set(visibleColumns));
    const selectPresetAll = () => setSelectedColIds(new Set(columnOrder));
    const selectPresetClient = () =>
        setSelectedColIds(
            new Set(columnOrder.filter(id => !(CLIENT_EXPORT_EXCLUDE_COLUMN_IDS as readonly string[]).includes(id)))
        );

    const filterByStages = (list: BulkCandidate[]) =>
        list.filter(c => includedStageIds.has(c.stageId));

    const runExport = async () => {
        if (orderedSelectedColumns.length === 0) {
            actions.showToast('Seleccione al menos una columna', 'error', 3000);
            return;
        }
        if (includedStageIds.size === 0) {
            actions.showToast('Incluya al menos una etapa', 'error', 3000);
            return;
        }

        let candidates: BulkCandidate[] = [];
        let exportColumnValues = columnValues;

        if (scope === 'current_view') {
            candidates = filterByStages(displayCandidates);
        } else if (scope === 'selected') {
            const selectedSet = new Set(selectedIds);
            const fromView = filterByStages(displayCandidates.filter(c => selectedSet.has(c.id)));

            if (fromView.length === selectedIds.length) {
                candidates = fromView;
            } else {
                setBusy(true);
                try {
                    const [all, fromDb] = await Promise.all([
                        bulkCandidatesApi.getAllCandidates(process.id, {
                            archived: false,
                            discarded: false,
                        }),
                        bulkCandidatesApi.loadAllBulkColumnValues(process.id),
                    ]);
                    exportColumnValues = { ...fromDb, ...columnValues };
                    candidates = filterByStages(all.filter(c => selectedSet.has(c.id)));
                } catch (e: any) {
                    actions.showToast(e?.message || 'Error al cargar candidatos', 'error', 4000);
                    setBusy(false);
                    return;
                } finally {
                    setBusy(false);
                }
            }
        } else {
            setBusy(true);
            try {
                candidates = await bulkCandidatesApi.getAllCandidates(process.id, {
                    search: searchQuery.trim() || undefined,
                    archived: false,
                    discarded: false,
                });
                candidates = filterByStages(candidates);
            } catch (e: any) {
                actions.showToast(e?.message || 'Error al cargar candidatos', 'error', 4000);
                setBusy(false);
                return;
            } finally {
                setBusy(false);
            }
        }

        if (candidates.length === 0) {
            actions.showToast(
                scope === 'selected'
                    ? 'No hay candidatos seleccionados que cumplan las etapas marcadas'
                    : 'No hay candidatos que cumplan etapas y origen elegidos',
                'info',
                3500
            );
            return;
        }

        const headerLabels = orderedSelectedColumns.map(id => getColumnLabel(id, customColumns));
        const body = buildBulkTableExportDocument(orderedSelectedColumns, candidates, headerLabels, {
            columnValues: exportColumnValues,
            customColumns,
            process,
            bulkConfig,
            delimiter,
            hiringStageActors,
        });
        const ext = delimiter === '\t' ? 'tsv' : 'csv';
        const safeTitle = process.title
            .slice(0, 44)
            .replace(/[^\p{L}\p{N}\-_]+/gu, '_')
            .replace(/_+/g, '_');
        const blob = new Blob([`\uFEFF${body}`], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `entrega_${safeTitle || 'proceso'}_${new Date().toISOString().slice(0, 10)}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        actions.showToast(`Exportados ${candidates.length} registro(s)`, 'success', 3000);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col border border-gray-200">
                <div className="flex items-start justify-between gap-2 px-4 py-3 border-b">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Exportar tabla para cliente</h2>
                        <p className="text-xs text-gray-600 mt-0.5">
                            Elija columnas y etapas. El archivo abre en Excel o Sheets (UTF-8).
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-sm">
                    <div>
                        <div className="font-medium text-gray-800 mb-2">Origen de filas</div>
                        {selectedIds.length > 0 && (
                            <label className="flex items-start gap-2 cursor-pointer mb-2">
                                <input
                                    type="radio"
                                    name="exscope"
                                    checked={scope === 'selected'}
                                    onChange={() => setScope('selected')}
                                    className="mt-1"
                                />
                                <span>
                                    <span className="font-medium text-gray-900">
                                        Solo seleccionados ({selectedIds.length})
                                    </span>
                                    <span className="block text-xs text-gray-600">
                                        Exporta únicamente los candidatos marcados con el checkbox en la tabla.
                                    </span>
                                </span>
                            </label>
                        )}
                        <label className="flex items-start gap-2 cursor-pointer mb-2">
                            <input
                                type="radio"
                                name="exscope"
                                checked={scope === 'current_view'}
                                onChange={() => setScope('current_view')}
                                className="mt-1"
                            />
                            <span>
                                <span className="font-medium text-gray-900">Vista actual</span>
                                <span className="block text-xs text-gray-600">
                                    Candidatos que ves ahora (filtros de columnas, orden). Usa la etapa y búsqueda del
                                    panel superior.
                                    {hasMore ? (
                                        <span className="block text-amber-700 mt-1">
                                            Hay más páginas: solo se exportan{' '}
                                            {displayCandidates.length} filas cargadas (de ~{total}).
                                        </span>
                                    ) : null}
                                </span>
                            </span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="exscope"
                                checked={scope === 'full_process'}
                                onChange={() => setScope('full_process')}
                                className="mt-1"
                            />
                            <span>
                                <span className="font-medium text-gray-900">Todo el proceso</span>
                                <span className="block text-xs text-gray-600">
                                    Todos los candidatos del proceso (activos), con la búsqueda global actual
                                    {searchQuery.trim() ? ` (“${searchQuery.trim()}”)` : ''}. Luego se filtran por las
                                    etapas marcadas abajo (no aplica filtros por columna de la tabla).
                                </span>
                            </span>
                        </label>
                    </div>

                    <div>
                        <div className="font-medium text-gray-800 mb-2">Etapas a incluir</div>
                        <p className="text-xs text-gray-600 mb-2">Desmarque etapas que no deben aparecer en la entrega.</p>
                        <div className="flex flex-wrap gap-2">
                            {process.stages.map(s => (
                                <label
                                    key={s.id}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-gray-200 bg-gray-50 text-xs cursor-pointer hover:bg-gray-100"
                                >
                                    <input
                                        type="checkbox"
                                        checked={includedStageIds.has(s.id)}
                                        onChange={() => toggleStage(s.id)}
                                        className="rounded text-primary-600"
                                    />
                                    {s.name}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="font-medium text-gray-800">Columnas a exportar</span>
                            <div className="flex flex-wrap gap-1">
                                <button
                                    type="button"
                                    onClick={selectPresetVisible}
                                    className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                                >
                                    Como visible
                                </button>
                                <button
                                    type="button"
                                    onClick={selectPresetClient}
                                    className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                                >
                                    Sugerencia cliente
                                </button>
                                <button
                                    type="button"
                                    onClick={selectPresetAll}
                                    className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                                >
                                    Todas
                                </button>
                            </div>
                        </div>
                        <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                            {columnOrder.map(colId => (
                                <label
                                    key={colId}
                                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedColIds.has(colId)}
                                        onChange={() => toggleCol(colId)}
                                        className="rounded text-primary-600 shrink-0"
                                    />
                                    <span className="truncate">{getColumnLabel(colId, customColumns)}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block font-medium text-gray-800 mb-1">Separador</label>
                        <select
                            value={delimiter === '\t' ? 'tab' : 'semi'}
                            onChange={e => setDelimiter(e.target.value === 'tab' ? '\t' : ';')}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="tab">Tabulador (.tsv, recomendado para Excel)</option>
                            <option value="semi">Punto y coma (.csv)</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-2 px-4 py-3 border-t bg-gray-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-white"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runExport()}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Descargar
                    </button>
                </div>
            </div>
        </div>
    );
};
