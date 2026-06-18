import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    X,
    Plus,
    Trash2,
    BarChart3,
    Loader2,
    Save,
    PieChart as PieChartIcon,
    LineChart as LineChartIcon,
    ChevronDown,
    ChevronUp,
    Settings2,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    LineChart,
    Line,
} from 'recharts';
import { BulkCandidate } from '../lib/api/bulkCandidates';
import {
    Process,
    CustomColumn,
    BulkProcessStatChart,
    BulkStatChartType,
    BulkStatAxisConfig,
    BulkStatSortBy,
    BulkStatSeries,
    BulkStatDateGranularity,
    BulkStatSeriesMode,
} from '../types';
import {
    aggregateBulkStatData,
    createDefaultStatChart,
    createDefaultStatSeries,
    getBulkStatChartableColumns,
    getStatChartTitle,
    getChartSeries,
    resolveBulkStatChartData,
    canUseCrossTab,
    crossTabBlockedReason,
    resolveSeriesMode,
    computeNumericAxisDomain,
    chartHasDateColumn,
    resolveChartDateGranularity,
    getDefaultDateGranularity,
    type BulkStatColumnOption,
    type BulkStatContext,
    type BulkStatMergedRow,
    type BulkStatResolvedSeries,
} from '../lib/bulkProcessStats';
import { HiredStageActor } from '../lib/hiringStageTracking';

const CHART_COLORS = ['#6366f1', '#14b8a6', '#f97316', '#ec4899', '#8b5cf6', '#06b6d4', '#eab308', '#ef4444'];

const CHART_TYPE_OPTIONS: { id: BulkStatChartType; label: string }[] = [
    { id: 'bar', label: 'Barras verticales' },
    { id: 'horizontalBar', label: 'Barras horizontales' },
    { id: 'line', label: 'Líneas' },
    { id: 'pie', label: 'Circular' },
];

const SCALE_OPTIONS: { id: BulkStatAxisConfig['scale']; label: string }[] = [
    { id: 'auto', label: 'Automática' },
    { id: 'linear', label: 'Lineal' },
    { id: 'log', label: 'Logarítmica' },
];

const SORT_OPTIONS: { id: BulkStatSortBy; label: string }[] = [
    { id: 'auto', label: 'Automático' },
    { id: 'valueDesc', label: 'Por valor (mayor a menor)' },
    { id: 'valueAsc', label: 'Por valor (menor a mayor)' },
    { id: 'category', label: 'Alfabético' },
];

const DATE_GRANULARITY_OPTIONS: { id: BulkStatDateGranularity; label: string }[] = [
    { id: 'day', label: 'Por día' },
    { id: 'week', label: 'Por semana' },
    { id: 'month', label: 'Por mes' },
    { id: 'year', label: 'Por año' },
];

const SERIES_MODE_OPTIONS: { id: BulkStatSeriesMode; label: string; description: string }[] = [
    {
        id: 'crossTab',
        label: 'Cuántos de A cumplen B',
        description:
            'Eje X = columna A. Eje Y = cantidad de candidatos (da igual el tipo de columna). Cada barra cuenta cuántos cumplen A y cada valor de B.',
    },
    {
        id: 'overlay',
        label: 'Comparar distribuciones',
        description:
            'Cada columna se cuenta por separado sobre las mismas etiquetas del eje X (no cruza candidato a candidato).',
    },
];

type DataScope = 'all' | 'stage';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    process: Process;
    customColumns: CustomColumn[];
    columnOrder: string[];
    columnValues: Record<string, Record<string, unknown>>;
    legacyColumnIdToName: Record<string, string>;
    hiringStageActors: Record<string, HiredStageActor>;
    candidates: BulkCandidate[];
    allCandidates: BulkCandidate[];
    loadingAllCandidates: boolean;
    selectedStageId: string;
    onSave: (charts: BulkProcessStatChart[]) => Promise<void>;
}

const StatChartPreview: React.FC<{
    chart: BulkProcessStatChart;
    mergedData: BulkStatMergedRow[];
    resolvedSeries: BulkStatResolvedSeries[];
    pieData: { name: string; value: number }[];
    isCrossTab?: boolean;
}> = ({ chart, mergedData, resolvedSeries, pieData, isCrossTab }) => {
    const dataKeys = resolvedSeries.map(s => s.dataKey);
    const hasData = mergedData.some(row => dataKeys.some(k => (row[k] as number) > 0));

    if (!hasData) {
        return (
            <div className="flex items-center justify-center h-56 text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg">
                Sin datos para las columnas seleccionadas.
            </div>
        );
    }

    const yDomain = computeNumericAxisDomain(mergedData, dataKeys, chart.axisY);
    const yScale = chart.axisY?.scale === 'log' ? 'log' : 'linear';
    const showGrid = chart.showGrid !== false;
    const showLegend = chart.showLegend !== false;
    const stacked = !!chart.stacked && chart.chartType !== 'line' && !isCrossTab;
    const yAxisLabel = chart.axisY?.label?.trim() || (isCrossTab ? 'Cantidad de candidatos' : undefined);

    if (chart.chartType === 'pie') {
        return (
            <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                    <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ name, percent }) =>
                            `${name.length > 14 ? `${name.slice(0, 12)}…` : name} (${(percent * 100).toFixed(0)}%)`
                        }
                    >
                        {pieData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, 'Candidatos']} />
                    {showLegend && <Legend />}
                </PieChart>
            </ResponsiveContainer>
        );
    }

    if (chart.chartType === 'line') {
        return (
            <ResponsiveContainer width="100%" height={Math.max(260, mergedData.length * 20)}>
                <LineChart
                    data={mergedData}
                    margin={{ top: 8, right: 16, left: chart.axisY?.label ? 12 : 8, bottom: chart.axisX?.label ? 24 : 8 }}
                >
                    {showGrid && <CartesianGrid strokeDasharray="3 3" />}
                    <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={mergedData.length > 6 ? -25 : 0}
                        textAnchor={mergedData.length > 6 ? 'end' : 'middle'}
                        height={mergedData.length > 6 ? 70 : 30}
                        label={
                            chart.axisX?.label
                                ? { value: chart.axisX.label, position: 'insideBottom', offset: -4, fontSize: 11 }
                                : undefined
                        }
                    />
                    <YAxis
                        scale={yScale}
                        domain={yDomain}
                        allowDecimals={false}
                        label={
                            yAxisLabel
                                ? { value: yAxisLabel, angle: -90, position: 'insideLeft', fontSize: 11 }
                                : undefined
                        }
                    />
                    <Tooltip
                        formatter={(v: number, name: string) => {
                            const series = resolvedSeries.find(s => s.dataKey === name);
                            return [v, isCrossTab ? `${v} candidatos · ${series?.label ?? name}` : series?.label ?? name];
                        }}
                    />
                    {showLegend && <Legend />}
                    {resolvedSeries.map(s => (
                        <Line
                            key={s.id}
                            type="monotone"
                            dataKey={s.dataKey}
                            name={s.label}
                            stroke={s.color}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        );
    }

    const layout = chart.chartType === 'horizontalBar' ? 'vertical' : 'horizontal';

    return (
        <ResponsiveContainer width="100%" height={Math.max(260, mergedData.length * 28)}>
            <BarChart
                data={mergedData}
                layout={layout}
                margin={{
                    top: 8,
                    right: 16,
                    left: layout === 'vertical' ? (chart.axisY?.label ? 12 : 8) : 80,
                    bottom: chart.axisX?.label ? 24 : 8,
                }}
            >
                {showGrid && <CartesianGrid strokeDasharray="3 3" />}
                {layout === 'vertical' ? (
                    <>
                        <XAxis
                            type="number"
                            scale={yScale}
                            domain={yDomain}
                            allowDecimals={false}
                            label={
                                yAxisLabel
                                    ? { value: yAxisLabel, position: 'insideBottom', offset: -4, fontSize: 11 }
                                    : undefined
                            }
                        />
                        <YAxis
                            type="category"
                            dataKey="name"
                            width={76}
                            tick={{ fontSize: 11 }}
                            label={
                                chart.axisX?.label
                                    ? { value: chart.axisX.label, angle: -90, position: 'insideLeft', fontSize: 11 }
                                    : undefined
                            }
                        />
                    </>
                ) : (
                    <>
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11 }}
                            interval={0}
                            angle={mergedData.length > 6 ? -25 : 0}
                            textAnchor={mergedData.length > 6 ? 'end' : 'middle'}
                            height={mergedData.length > 6 ? 70 : 30}
                            label={
                                chart.axisX?.label
                                    ? { value: chart.axisX.label, position: 'insideBottom', offset: -4, fontSize: 11 }
                                    : undefined
                            }
                        />
                        <YAxis
                            scale={yScale}
                            domain={yDomain}
                            allowDecimals={false}
                            label={
                                yAxisLabel
                                    ? { value: yAxisLabel, angle: -90, position: 'insideLeft', fontSize: 11 }
                                    : undefined
                            }
                        />
                    </>
                )}
                <Tooltip
                    formatter={(v: number, name: string) => {
                        const series = resolvedSeries.find(s => s.dataKey === name);
                        return [
                            v,
                            isCrossTab
                                ? `${v} candidatos · ${series?.label ?? name}`
                                : series?.label ?? name,
                        ];
                    }}
                />
                {showLegend && resolvedSeries.length > 1 && <Legend />}
                {resolvedSeries.map(s => (
                    <Bar
                        key={s.id}
                        dataKey={s.dataKey}
                        name={s.label}
                        fill={s.color}
                        stackId={stacked ? 'stack' : undefined}
                        radius={stacked ? undefined : [4, 4, 0, 0]}
                    />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );
};

const AxisNumberInput: React.FC<{
    label: string;
    value: number | undefined;
    onChange: (v: number | undefined) => void;
    placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
    <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <input
            type="number"
            value={value ?? ''}
            onChange={e => {
                const raw = e.target.value.trim();
                onChange(raw === '' ? undefined : Number(raw));
            }}
            placeholder={placeholder}
            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
        />
    </div>
);

const ChartAdvancedOptions: React.FC<{
    chart: BulkProcessStatChart;
    onUpdate: (patch: Partial<BulkProcessStatChart>) => void;
    multiSeries: boolean;
}> = ({ chart, onUpdate, multiSeries }) => {
    const [open, setOpen] = useState(false);

    const patchAxisY = (patch: Partial<BulkStatAxisConfig>) => {
        onUpdate({ axisY: { ...chart.axisY, ...patch } });
    };
    const patchAxisX = (patch: Partial<BulkStatAxisConfig>) => {
        onUpdate({ axisX: { ...chart.axisX, ...patch } });
    };

    return (
        <div className="w-full border border-gray-100 rounded-lg bg-gray-50/80">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
                <span className="inline-flex items-center gap-1.5 font-medium">
                    <Settings2 className="w-4 h-4 text-gray-500" />
                    Ejes y visualización
                </span>
                {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {open && (
                <div className="px-3 pb-3 pt-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Orden eje X</label>
                        <select
                            value={chart.sortBy ?? 'auto'}
                            onChange={e => onUpdate({ sortBy: e.target.value as BulkStatSortBy })}
                            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                        >
                            {SORT_OPTIONS.map(opt => (
                                <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Escala eje Y</label>
                        <select
                            value={chart.axisY?.scale ?? 'auto'}
                            onChange={e =>
                                patchAxisY({ scale: e.target.value as BulkStatAxisConfig['scale'] })
                            }
                            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                        >
                            {SCALE_OPTIONS.map(opt => (
                                <option key={opt.id} value={opt.id ?? 'auto'}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <AxisNumberInput
                        label="Mínimo eje Y"
                        value={chart.axisY?.min}
                        onChange={v => patchAxisY({ min: v })}
                        placeholder="Auto"
                    />
                    <AxisNumberInput
                        label="Máximo eje Y"
                        value={chart.axisY?.max}
                        onChange={v => patchAxisY({ max: v })}
                        placeholder="Auto"
                    />
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Etiqueta eje X</label>
                        <input
                            type="text"
                            value={chart.axisX?.label ?? ''}
                            onChange={e => patchAxisX({ label: e.target.value })}
                            placeholder="Opcional"
                            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Etiqueta eje Y</label>
                        <input
                            type="text"
                            value={chart.axisY?.label ?? ''}
                            onChange={e => patchAxisY({ label: e.target.value })}
                            placeholder="Candidatos"
                            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                        />
                    </div>
                    <div className="flex flex-col gap-2 justify-end">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={chart.showGrid !== false}
                                onChange={e => onUpdate({ showGrid: e.target.checked })}
                                className="rounded border-gray-300 text-indigo-600"
                            />
                            Cuadrícula
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={chart.showLegend !== false}
                                onChange={e => onUpdate({ showLegend: e.target.checked })}
                                className="rounded border-gray-300 text-indigo-600"
                            />
                            Leyenda
                        </label>
                    </div>
                    {multiSeries && chart.chartType !== 'line' && chart.chartType !== 'pie' && (
                        <div className="flex items-end">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!chart.stacked}
                                    onChange={e => onUpdate({ stacked: e.target.checked })}
                                    className="rounded border-gray-300 text-indigo-600"
                                />
                                Apilar series
                            </label>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const BulkProcessStatsModal: React.FC<Props> = ({
    isOpen,
    onClose,
    process,
    customColumns,
    columnOrder,
    columnValues,
    legacyColumnIdToName,
    hiringStageActors,
    candidates,
    allCandidates,
    loadingAllCandidates,
    selectedStageId,
    onSave,
}) => {
    const columnOptions = useMemo(
        () => getBulkStatChartableColumns(customColumns, columnOrder),
        [customColumns, columnOrder]
    );

    const [charts, setCharts] = useState<BulkProcessStatChart[]>([]);
    const [dataScope, setDataScope] = useState<DataScope>('all');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const saved = process.bulkConfig?.customStats ?? [];
        if (saved.length > 0) {
            setCharts(
                saved.map(c => ({
                    showGrid: true,
                    showLegend: true,
                    sortBy: 'auto' as BulkStatSortBy,
                    ...c,
                    series:
                        c.series && c.series.length > 0
                            ? c.series
                            : [createDefaultStatSeries(c.id, c.columnId)],
                }))
            );
        } else if (columnOptions.length > 0) {
            setCharts([createDefaultStatChart(columnOptions[0].id)]);
        } else {
            setCharts([]);
        }
        setDataScope('all');
    }, [isOpen, process.id, process.bulkConfig?.customStats, columnOptions]);

    const statContext = useMemo<BulkStatContext>(
        () => ({
            process,
            bulkConfig: process.bulkConfig,
            customColumns,
            columnValues,
            legacyColumnIdToName,
            hiringStageActors,
            idealProfileConfig: process.bulkConfig?.idealProfile ?? null,
        }),
        [process, customColumns, columnValues, legacyColumnIdToName, hiringStageActors]
    );

    const candidatePool = useMemo(() => {
        const base = allCandidates.length > 0 ? allCandidates : candidates;
        if (dataScope === 'stage' && selectedStageId) {
            return base.filter(c => c.stageId === selectedStageId);
        }
        return base;
    }, [allCandidates, candidates, dataScope, selectedStageId]);

    const chartBundleById = useMemo(() => {
        const map = new Map<
            string,
            {
                merged: BulkStatMergedRow[];
                resolved: BulkStatResolvedSeries[];
                pie: { name: string; value: number }[];
                crossTab: boolean;
                crossTabHint?: string;
            }
        >();
        for (const chart of charts) {
            const primaryColumn = getChartSeries(chart)[0]?.columnId ?? chart.columnId;
            const dateGranularity = resolveChartDateGranularity(chart, columnOptions);
            const pie = aggregateBulkStatData(candidatePool, primaryColumn, statContext, {
                dateGranularity,
            });
            const bundle = resolveBulkStatChartData(
                candidatePool,
                chart,
                columnOptions,
                CHART_COLORS,
                statContext
            );
            map.set(chart.id, {
                merged: bundle.rows,
                resolved: bundle.series,
                pie,
                crossTab: bundle.crossTab,
                crossTabHint: bundle.crossTabHint,
            });
        }
        return map;
    }, [charts, candidatePool, statContext, columnOptions]);

    const addChart = useCallback(() => {
        const used = new Set(charts.flatMap(c => getChartSeries(c).map(s => s.columnId)));
        const nextCol = columnOptions.find(c => !used.has(c.id)) ?? columnOptions[0];
        if (!nextCol) return;
        setCharts(prev => [
            ...prev,
            {
                ...createDefaultStatChart(nextCol.id, nextCol.suggestedChart),
                ...(nextCol.valueKind === 'date'
                    ? { dateGranularity: getDefaultDateGranularity(nextCol.id) }
                    : {}),
            },
        ]);
    }, [charts, columnOptions]);

    const updateChart = useCallback((id: string, patch: Partial<BulkProcessStatChart>) => {
        setCharts(prev =>
            prev.map(c => {
                if (c.id !== id) return c;
                const next = { ...c, ...patch };
                if (patch.columnId && !patch.series) {
                    const series = getChartSeries(next);
                    if (series.length === 1) {
                        next.series = [{ ...series[0], columnId: patch.columnId }];
                    }
                }
                return next;
            })
        );
    }, []);

    const removeChart = useCallback((id: string) => {
        setCharts(prev => prev.filter(c => c.id !== id));
    }, []);

    const addSeries = useCallback(
        (chartId: string) => {
            setCharts(prev =>
                prev.map(c => {
                    if (c.id !== chartId) return c;
                    const current = getChartSeries(c);
                    const effectiveMode = resolveSeriesMode(c, columnOptions);
                    if (effectiveMode === 'crossTab' && current.length >= 2) return c;
                    const used = new Set(current.map(s => s.columnId));
                    const nextCol = columnOptions.find(col => !used.has(col.id)) ?? columnOptions[0];
                    if (!nextCol) return c;
                    const nextSeries = [...current, createDefaultStatSeries(c.id, nextCol.id)];
                    const draft: BulkProcessStatChart = { ...c, series: nextSeries };
                    const useCross = canUseCrossTab(draft, columnOptions);
                    return {
                        ...c,
                        series: nextSeries,
                        seriesMode: nextSeries.length >= 2 && useCross ? 'crossTab' : c.seriesMode,
                        stacked: useCross ? false : c.stacked,
                    };
                })
            );
        },
        [columnOptions]
    );

    const updateSeries = useCallback((chartId: string, seriesId: string, patch: Partial<BulkStatSeries>) => {
        setCharts(prev =>
            prev.map(c => {
                if (c.id !== chartId) return c;
                const series = getChartSeries(c).map(s => (s.id === seriesId ? { ...s, ...patch } : s));
                const primary = series[0]?.columnId ?? c.columnId;
                const next: BulkProcessStatChart = { ...c, series, columnId: primary };
                if (patch.columnId) {
                    const col = columnOptions.find(opt => opt.id === patch.columnId);
                    if (col?.valueKind === 'date' && !next.dateGranularity) {
                        next.dateGranularity = getDefaultDateGranularity(patch.columnId);
                    }
                }
                return next;
            })
        );
    }, [columnOptions]);

    const removeSeries = useCallback((chartId: string, seriesId: string) => {
        setCharts(prev =>
            prev.map(c => {
                if (c.id !== chartId) return c;
                const series = getChartSeries(c).filter(s => s.id !== seriesId);
                if (series.length === 0) return c;
                return { ...c, series, columnId: series[0].columnId };
            })
        );
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(charts);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const stageName = selectedStageId
        ? process.stages.find(s => s.id === selectedStageId)?.name
        : undefined;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 md:p-6 bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-4 md:px-6 py-4 border-b border-gray-200">
                    <div>
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-lg font-semibold text-gray-900">Estadísticas del proceso</h2>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Gráficos personalizados · varias columnas, líneas y ejes configurables · {process.title}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 px-4 md:px-6 py-3 bg-gray-50 border-b border-gray-200">
                    <label className="text-xs font-medium text-gray-600">Datos</label>
                    <select
                        value={dataScope}
                        onChange={e => setDataScope(e.target.value as DataScope)}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="all">Todo el proceso</option>
                        {selectedStageId && stageName && (
                            <option value="stage">Etapa actual: {stageName}</option>
                        )}
                    </select>
                    <span className="text-xs text-gray-500">
                        {loadingAllCandidates ? (
                            <span className="inline-flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> Cargando candidatos…
                            </span>
                        ) : (
                            `${candidatePool.length} candidato${candidatePool.length === 1 ? '' : 's'}`
                        )}
                    </span>
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={addChart}
                        disabled={columnOptions.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md disabled:opacity-50"
                    >
                        <Plus className="w-4 h-4" />
                        Agregar gráfico
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    {columnOptions.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-12">
                            No hay columnas disponibles para graficar en este proceso.
                        </p>
                    ) : charts.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-12">
                            Agregue un gráfico para empezar.
                        </p>
                    ) : (
                        charts.map(chart => {
                            const bundle = chartBundleById.get(chart.id);
                            const mergedData = bundle?.merged ?? [];
                            const resolvedSeries = bundle?.resolved ?? [];
                            const pieData = bundle?.pie ?? [];
                            const title = getStatChartTitle(chart, columnOptions, {
                                crossTab: bundle?.crossTab,
                            });
                            const seriesList = getChartSeries(chart);
                            const isPie = chart.chartType === 'pie';
                            const hasDateColumn = chartHasDateColumn(chart, columnOptions);
                            const effectiveSeriesMode = resolveSeriesMode(chart, columnOptions);
                            const isCrossTab = bundle?.crossTab ?? false;
                            const crossTabBlocked = crossTabBlockedReason(chart, columnOptions);

                            return (
                                <div
                                    key={chart.id}
                                    className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm space-y-3"
                                >
                                    <div className="flex flex-wrap items-end gap-3">
                                        <div className="min-w-[160px]">
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Tipo de gráfico
                                            </label>
                                            <select
                                                value={chart.chartType}
                                                onChange={e =>
                                                    updateChart(chart.id, {
                                                        chartType: e.target.value as BulkStatChartType,
                                                    })
                                                }
                                                className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                                            >
                                                {CHART_TYPE_OPTIONS.map(opt => (
                                                    <option key={opt.id} value={opt.id}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex-1 min-w-[180px]">
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Título (opcional)
                                            </label>
                                            <input
                                                type="text"
                                                value={chart.title ?? ''}
                                                onChange={e =>
                                                    updateChart(chart.id, { title: e.target.value })
                                                }
                                                placeholder={title}
                                                className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeChart(chart.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                            title="Eliminar gráfico"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {!isPie && seriesList.length >= 2 && (
                                        <div className="p-3 rounded-lg border border-teal-100 bg-teal-50/50 space-y-2">
                                            <label className="block text-xs font-medium text-teal-900">
                                                ¿Cómo combinar las dos columnas?
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {SERIES_MODE_OPTIONS.map(opt => (
                                                        <button
                                                            key={opt.id}
                                                            type="button"
                                                            onClick={() =>
                                                                updateChart(chart.id, {
                                                                    seriesMode: opt.id,
                                                                    ...(opt.id === 'crossTab'
                                                                        ? { stacked: false }
                                                                        : {}),
                                                                })
                                                            }
                                                            className={`text-left px-3 py-2 rounded-md border text-sm max-w-md transition-colors ${
                                                                effectiveSeriesMode === opt.id
                                                                    ? 'border-teal-500 bg-white text-teal-900 shadow-sm'
                                                                    : 'border-gray-200 bg-white/80 text-gray-700 hover:border-teal-300'
                                                            }`}
                                                        >
                                                            <span className="font-medium block">{opt.label}</span>
                                                            <span className="text-[11px] text-gray-500 leading-snug">
                                                                {opt.description}
                                                            </span>
                                                        </button>
                                                ))}
                                            </div>
                                            {crossTabBlocked && (
                                                <p className="text-[11px] text-amber-800">{crossTabBlocked}</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <label className="text-xs font-medium text-gray-600">
                                                {isPie
                                                    ? 'Columna'
                                                    : isCrossTab
                                                      ? 'Columna A y columna B'
                                                      : 'Series de datos'}
                                            </label>
                                            {!isPie && (
                                                <button
                                                    type="button"
                                                    onClick={() => addSeries(chart.id)}
                                                    disabled={
                                                        seriesList.length >= columnOptions.length ||
                                                        (isCrossTab && seriesList.length >= 2)
                                                    }
                                                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Añadir serie
                                                </button>
                                            )}
                                        </div>
                                        {seriesList.map((series, idx) => (
                                            <div
                                                key={series.id}
                                                className="flex flex-wrap items-end gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100"
                                            >
                                                {!isCrossTab && (
                                                    <div
                                                        className="w-3 h-3 rounded-full flex-shrink-0 mb-2"
                                                        style={{
                                                            backgroundColor:
                                                                resolvedSeries[idx]?.color ??
                                                                CHART_COLORS[idx % CHART_COLORS.length],
                                                        }}
                                                    />
                                                )}
                                                <div className="flex-1 min-w-[140px]">
                                                    <label className="block text-[11px] text-gray-500 mb-0.5">
                                                        {isCrossTab
                                                            ? idx === 0
                                                                ? 'Columna A — eje X (grupo base)'
                                                                : idx === 1
                                                                  ? 'Columna B — qué se cuenta (barras / leyenda)'
                                                                  : 'Columna (no usada en cruce)'
                                                            : 'Columna'}
                                                    </label>
                                                    <select
                                                        value={series.columnId}
                                                        onChange={e =>
                                                            updateSeries(chart.id, series.id, {
                                                                columnId: e.target.value,
                                                            })
                                                        }
                                                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
                                                    >
                                                        {columnOptions.map(col => (
                                                            <option key={col.id} value={col.id}>
                                                                {col.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {!isPie && !isCrossTab && (
                                                    <div className="flex-1 min-w-[120px]">
                                                        <label className="block text-[11px] text-gray-500 mb-0.5">
                                                            Etiqueta serie
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={series.label ?? ''}
                                                            onChange={e =>
                                                                updateSeries(chart.id, series.id, {
                                                                    label: e.target.value,
                                                                })
                                                            }
                                                            placeholder={
                                                                columnOptions.find(c => c.id === series.columnId)
                                                                    ?.label
                                                            }
                                                            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
                                                        />
                                                    </div>
                                                )}
                                                {!isPie && seriesList.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeSeries(chart.id, series.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md mb-0.5"
                                                        title="Quitar serie"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {isPie && seriesList.length > 1 && (
                                            <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                                                El gráfico circular usa solo la primera serie.
                                            </p>
                                        )}
                                        {isCrossTab && bundle?.crossTabHint && (
                                            <p className="text-xs text-indigo-800 bg-indigo-50 border border-indigo-100 px-2 py-1.5 rounded">
                                                {bundle.crossTabHint}
                                            </p>
                                        )}
                                        {seriesList.length === 1 && !isPie && (
                                            <p className="text-xs text-teal-800 bg-teal-50 border border-teal-100 px-2 py-1.5 rounded">
                                                Añada una <strong>2.ª columna (B)</strong> para ver cuántos candidatos
                                                de cada valor de A también cumplen cada valor de B (como Speech ×
                                                Asistencia).
                                            </p>
                                        )}
                                        {!isCrossTab &&
                                            seriesList.length > 1 &&
                                            effectiveSeriesMode === 'overlay' && (
                                                <p className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                                    Modo comparación: no cruza A con B candidato a candidato. Para
                                                    contar «cuántos de A cumplen B», elija{' '}
                                                    <strong>Cuántos de A cumplen B</strong> arriba.
                                                </p>
                                            )}
                                    </div>

                                    {hasDateColumn && (
                                        <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border border-indigo-100 bg-indigo-50/40">
                                            <div className="min-w-[200px]">
                                                <label className="block text-xs font-medium text-indigo-900 mb-1">
                                                    Agrupación de fechas (eje X)
                                                </label>
                                                <select
                                                    value={
                                                        chart.dateGranularity ??
                                                        getDefaultDateGranularity(
                                                            seriesList[0]?.columnId ?? chart.columnId
                                                        )
                                                    }
                                                    onChange={e =>
                                                        updateChart(chart.id, {
                                                            dateGranularity: e.target
                                                                .value as BulkStatDateGranularity,
                                                        })
                                                    }
                                                    className="w-full text-sm border border-indigo-200 rounded-md px-2 py-1.5 bg-white"
                                                >
                                                    {DATE_GRANULARITY_OPTIONS.map(opt => (
                                                        <option key={opt.id} value={opt.id}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <p className="text-xs text-indigo-800/80 pb-2">
                                                Cambia la escala temporal: días, semanas, meses o años.
                                                Para ver cada día en el eje X, elige <strong>Por día</strong>.
                                            </p>
                                        </div>
                                    )}

                                    <ChartAdvancedOptions
                                        chart={chart}
                                        onUpdate={patch => updateChart(chart.id, patch)}
                                        multiSeries={seriesList.length > 1}
                                    />

                                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                                        {chart.chartType === 'pie' ? (
                                            <PieChartIcon className="w-4 h-4 text-indigo-500" />
                                        ) : chart.chartType === 'line' ? (
                                            <LineChartIcon className="w-4 h-4 text-indigo-500" />
                                        ) : (
                                            <BarChart3 className="w-4 h-4 text-indigo-500" />
                                        )}
                                        {title}
                                    </h3>
                                    <StatChartPreview
                                        chart={chart}
                                        mergedData={mergedData}
                                        resolvedSeries={resolvedSeries}
                                        pieData={pieData}
                                        isCrossTab={isCrossTab}
                                    />
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 px-4 md:px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-md"
                    >
                        Cerrar
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar configuración
                    </button>
                </div>
            </div>
        </div>
    );
};
