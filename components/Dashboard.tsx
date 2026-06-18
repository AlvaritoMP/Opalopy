import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAppState } from '../App';
import { Briefcase, Users, FileText, CheckCircle, Calendar, Grid3x3, Phone, TrendingUp, UserCheck, Headphones, UserPlus, MessageCircle, Mail, Clock, Target, Zap, RefreshCw } from 'lucide-react';
import { Tooltip, Legend, BarChart, CartesianGrid, XAxis, YAxis, Bar, LineChart, Line, ComposedChart, Cell } from 'recharts';
import { Candidate, Process } from '../types';
import { resolveCandidateAgeForProcess, resolveCandidateHomonymField, buildLegacyColumnIdToName } from '../lib/bulkTableColumns';
import {
    computeContactDashboardStats,
    buildChannelTrendBundle,
    matchesContactVolumeMetric,
    type ContactConsultantPeriod,
    type ContactDailyTrendSeries,
    type ContactHourlyDistribution,
    type ContactVolumeMetric,
} from '../lib/contactDashboardStats';
import {
    computeContactologyAdvancedStats,
    resolveCandidateRecordCreatedAt,
} from '../lib/contactologyAnalytics';
import { computeRegistrationCreationStats } from '../lib/registrationCreationStats';
import {
    reconcileContactAttemptsWithSummaries,
    attributeContactAttemptsFromSummaries,
    synthesizeVolumeAttemptsFromSummaries,
    synthesizeInteresadoAttemptsFromSummaries,
} from '../lib/contactAttemptReconcile';
import type { ContactAttemptChannel } from '../lib/contactChannelConfig';
import { computeHiringStageConsultantStats, resolveHiringStageId, type HiredStageActor } from '../lib/hiringStageTracking';
import { computeInterviewSchedulingStats } from '../lib/interviewSchedulingStats';
import {
    computeSchedulingEffectiveness,
    SCHEDULING_OUTCOME_COLORS,
    SCHEDULING_OUTCOME_LABELS,
} from '../lib/interviewSchedulingEffectiveness';
import { computeHiredProfileSummary, HIRED_PROFILE_GROUP_LABELS } from '../lib/dashboardHiredProfileSummary';
import { reconcileInterviewSchedulingFromBulkCandidates } from '../lib/interviewSchedulingReconcile';
import {
    buildUserLookupForStats,
    enrichContactAttemptsForStats,
} from '../lib/dashboardActorNames';
import {
    resolveProcessPublishedDate,
    resolveHireAcceptedDate,
    resolveApplicationStartedDate,
    resolveApplicationCompletedDate,
    getLastStageId,
} from '../lib/dashboardEfficiencyMetrics';
import { resolveDashboardApplicationDate } from '../lib/dashboardCandidatePool';
import type { BulkCandidateFieldExtras } from '../lib/dashboardDataLoader';
import type { ContactSummaryCandidate } from '../lib/contactAttemptReconcile';
import { LimaDistrictMap } from './LimaDistrictMap';
import { normalizeDistrictLabel } from '../lib/limaDistrictMap';
import {
    buildDashboardHiredContext,
    augmentNamedCountRows,
    augmentValueRows,
    countHiredByBucket,
    countHiredByTimeBand,
    injectHiredIntoDailyTrendSeries,
    injectHiredIntoHourlyDistribution,
    HIRED_METRIC_KEY,
    HIRED_METRIC_COLOR,
    HIRED_CHART_HINT,
} from '../lib/dashboardHiredComparison';
import { startOfWeekMondayLimaKey } from '../lib/contactDashboardStats';
import {
    CONTACTOLOGY_DEFS,
    CONTACT_CHANNEL_DEFS,
    REGISTRATION_DEFS,
    SCHEDULING_DEFS,
    FIRST_CONTACT_LINE_LABEL,
    HIRED_PROFILE_DEF,
} from '../lib/dashboardMetricDefinitions';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#6366f1', '#14b8a6', '#f97316'];

const StatCard: React.FC<{
    icon: React.ElementType;
    title: string;
    value: number | string;
    subtitle: string;
    color: string;
    /** Definición para interpretar correctamente el indicador */
    definition?: string;
}> = ({ icon: Icon, title, value, subtitle, color, definition }) => (
    <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
        <div className="flex items-start gap-3 md:gap-4 flex-1">
            <div className={`p-2 md:p-3 rounded-full flex-shrink-0 ${color}`}>
                <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm text-gray-500">{title}</p>
                <p className="text-xl md:text-2xl font-bold text-gray-800">{value}</p>
                <p className="text-xs text-gray-400 mt-1 leading-snug">{subtitle}</p>
            </div>
        </div>
        {definition && (
            <p className="text-[11px] text-gray-500 mt-3 pt-3 border-t border-gray-100 leading-relaxed">
                {definition}
            </p>
        )}
    </div>
);

const COMPACT_CHART_HEIGHT = 200;

/** Mide el ancho del contenedor y pasa dimensiones explícitas a los gráficos (evita cuadros vacíos con Recharts 3 + React 19). */
const MeasuredChartArea: React.FC<{
    height: number;
    className?: string;
    children: (size: { width: number; height: number }) => React.ReactNode;
}> = ({ height, className = '', children }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<{ width: number; height: number } | null>(null);

    const updateSize = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const width = rect.width > 0 ? rect.width : el.clientWidth || el.offsetWidth || 320;
        if (width > 0) {
            setSize(prev => (prev?.width === width && prev?.height === height ? prev : { width, height }));
        }
    }, [height]);

    useEffect(() => {
        updateSize();
        const raf = requestAnimationFrame(updateSize);
        const timer = window.setTimeout(updateSize, 150);
        const el = containerRef.current;
        if (!el || typeof ResizeObserver === 'undefined') {
            return () => {
                cancelAnimationFrame(raf);
                window.clearTimeout(timer);
            };
        }
        const observer = new ResizeObserver(updateSize);
        observer.observe(el);
        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(timer);
            observer.disconnect();
        };
    }, [updateSize]);

    return (
        <div ref={containerRef} className={`min-w-0 w-full ${className}`} style={{ height }}>
            {size ? children(size) : null}
        </div>
    );
};

const ChartContainer: React.FC<{
    title: string;
    description?: string;
    children: React.ReactNode;
    hasData: boolean;
    className?: string;
    height?: number;
    /** Contenido a altura completa sin Recharts (p. ej. mapa SVG) */
    fillContent?: boolean;
}> = ({ title, description, children, hasData, className = '', height = 280, fillContent = false }) => (
    <div className={`bg-white p-4 md:p-6 rounded-xl border border-gray-200 shadow-sm min-w-0 flex flex-col ${className}`}>
        <h2 className="text-lg md:text-xl font-semibold text-gray-800">{title}</h2>
        {description && <p className="text-xs md:text-sm text-gray-500 mt-1 mb-3">{description}</p>}
        {!description && <div className="mb-3 md:mb-4" />}
        {hasData ? (
            fillContent ? (
                <div className="flex-1 min-h-0" style={{ minHeight: height }}>
                    {React.Children.map(children, child =>
                        React.isValidElement(child)
                            ? React.cloneElement(child as React.ReactElement<{ height?: number }>, { height })
                            : child
                    )}
                </div>
            ) : (
                <MeasuredChartArea height={height}>
                    {({ width, height: chartHeight }) =>
                        React.Children.map(children, child =>
                            React.isValidElement(child)
                                ? React.cloneElement(child as React.ReactElement<{ width?: number; height?: number }>, {
                                    width,
                                    height: chartHeight,
                                })
                                : child
                        )
                    }
                </MeasuredChartArea>
            )
        ) : (
            <div className="flex items-center justify-center text-gray-500 text-sm md:text-base" style={{ height }}>
                Sin datos para los filtros seleccionados.
            </div>
        )}
    </div>
);

const translateSource = (source: string) => {
    switch (source.toLowerCase()) {
        case 'linkedin': return 'LinkedIn';
        case 'referral': return 'Referido';
        case 'website': return 'Sitio web';
        case 'other': return 'Otro';
        default: return source;
    }
};

const normalizeDistrictName = normalizeDistrictLabel;

const isHiredInProcess = (candidate: Candidate, process?: Process): boolean => {
    const hiringStageId = resolveHiringStageId(process);
    if (!hiringStageId) return false;
    return candidate.stageId === hiringStageId && !candidate.discarded;
};

const getStageName = (candidate: Candidate, processes: Process[]): string => {
    const process = processes.find(p => p.id === candidate.processId);
    return process?.stages.find(s => s.id === candidate.stageId)?.name || 'Sin etapa';
};

const truncateLabel = (label: string, max = 28): string =>
    label.length > max ? `${label.slice(0, max - 1)}…` : label;

const topNWithOthers = (
    entries: [string, number][],
    limit: number
): { name: string; Candidatos: number }[] => {
    const sorted = [...entries].sort((a, b) => b[1] - a[1]);
    if (sorted.length <= limit) {
        return sorted.map(([name, Candidatos]) => ({ name, Candidatos }));
    }
    const top = sorted.slice(0, limit);
    const others = sorted.slice(limit).reduce((sum, [, count]) => sum + count, 0);
    return [
        ...top.map(([name, Candidatos]) => ({ name, Candidatos })),
        { name: 'Otros', Candidatos: others },
    ];
};

const resolveDashboardCandidateField = (
    candidate: Candidate,
    field: 'source' | 'province' | 'district',
    process: Process | undefined,
    bulkExtra?: BulkCandidateFieldExtras
): string | undefined => {
    const customColumns = process?.bulkConfig?.customColumns ?? [];
    const legacyColumnIdToName = buildLegacyColumnIdToName(process?.bulkConfig, customColumns);
    const enrichedRow = {
        ...(candidate.bulkColumnValues || {}),
        ...(bulkExtra?.bulkColumnValues || {}),
    };
    const columnValues = Object.keys(enrichedRow).length > 0
        ? { [candidate.id]: enrichedRow }
        : {};
    const homonymCandidate = {
        id: candidate.id,
        source: bulkExtra?.source ?? candidate.source,
        province: bulkExtra?.province ?? candidate.province,
        district: bulkExtra?.district ?? candidate.district,
        bulkColumnValues: Object.keys(enrichedRow).length > 0 ? enrichedRow : undefined,
    };
    const resolved = resolveCandidateHomonymField(
        homonymCandidate,
        field,
        customColumns,
        columnValues,
        legacyColumnIdToName
    );
    if (resolved == null || resolved === '') return undefined;
    return String(resolved);
};

const CompactChartContainer: React.FC<{
    title: string;
    description?: string;
    children: React.ReactNode;
    hasData: boolean;
}> = ({ title, description, children, hasData }) => (
    <div className="bg-gray-50/80 p-3 rounded-lg border border-gray-200 min-w-0">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {description && <p className="text-[11px] text-gray-500 mt-0.5 mb-2 leading-snug">{description}</p>}
        {!description && <div className="mb-2" />}
        {hasData ? (
            <MeasuredChartArea height={COMPACT_CHART_HEIGHT}>
                {({ width, height: chartHeight }) =>
                    React.Children.map(children, child =>
                        React.isValidElement(child)
                            ? React.cloneElement(child as React.ReactElement<{ width?: number; height?: number }>, {
                                width,
                                height: chartHeight,
                            })
                            : child
                    )
                }
            </MeasuredChartArea>
        ) : (
            <div
                className="flex items-center justify-center text-gray-400 text-xs"
                style={{ height: COMPACT_CHART_HEIGHT }}
            >
                Sin datos en el periodo.
            </div>
        )}
    </div>
);

const ContactDailyTrendChart: React.FC<{ series: ContactDailyTrendSeries }> = ({ series }) => {
    const hasData = series.data.some(row => series.users.some(u => Number(row[u]) > 0));
    const isDaily = series.granularity === 'day';
    const unitSingular = series.unitLabel.replace(/s$/, '') || series.unitLabel;

    return (
        <CompactChartContainer
            title={isDaily ? `Por día y usuario · ${series.metricLabel}` : `Por mes y usuario · ${series.metricLabel}`}
            description={`${series.channelLabel} · ${series.periodLabel.toLowerCase()} · ${series.metricLabel.toLowerCase()}`}
            hasData={hasData}
        >
            <LineChart data={series.data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9 }}
                    interval={isDaily ? 'preserveStartEnd' : 0}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 9 }} width={28} />
                <Tooltip
                    formatter={(value: number, name: string) => [
                        `${value} ${value === 1 ? unitSingular : series.unitLabel}`,
                        truncateLabel(name, 20),
                    ]}
                />
                <Legend formatter={(value: string) => truncateLabel(value, 14)} wrapperStyle={{ fontSize: 10 }} />
                {series.users.map((userName, index) => (
                    <Line
                        key={userName}
                        type="monotone"
                        dataKey={userName}
                        name={userName}
                        stroke={userName === HIRED_METRIC_KEY ? HIRED_METRIC_COLOR : COLORS[index % COLORS.length]}
                        strokeWidth={userName === HIRED_METRIC_KEY ? 2.5 : 2}
                        strokeDasharray={userName === HIRED_METRIC_KEY ? '6 3' : undefined}
                        dot={userName === HIRED_METRIC_KEY ? { r: 3 } : false}
                        activeDot={{ r: 4 }}
                    />
                ))}
            </LineChart>
        </CompactChartContainer>
    );
};

const CHANNEL_CHART_COLORS: Record<string, string> = {
    call: '#8b5cf6',
    whatsapp: '#10b981',
    email: '#0ea5e9',
};

const METRIC_HOURLY_COLORS: Record<ContactVolumeMetric, string> = {
    total: '#6366f1',
    failed: '#f97316',
    effective: '#22c55e',
};

const ContactHourlyChart: React.FC<{ series: ContactHourlyDistribution }> = ({ series }) => {
    const hasData = series.data.some(d => d.count > 0);
    const unitSingular = series.unitLabel.replace(/s$/, '') || series.unitLabel;
    const peakNote = series.peakHour
        ? ` · pico ${series.peakHour.label} (${series.peakHour.count})`
        : '';
    const channelTint = CHANNEL_CHART_COLORS[series.channel];
    const fill = channelTint && series.metric === 'total' ? channelTint : METRIC_HOURLY_COLORS[series.metric];

    return (
        <CompactChartContainer
            title={`Por hora · ${series.metricLabel}`}
            description={`${series.channelLabel} · hora Lima · ${series.metricLabel.toLowerCase()}${peakNote}`}
            hasData={hasData}
        >
            <BarChart data={series.data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 9 }} width={28} />
                <Tooltip
                    formatter={(value: number) => [
                        `${value} ${value === 1 ? unitSingular : series.unitLabel}`,
                        'Contactos',
                    ]}
                    labelFormatter={label => `Hora ${label}`}
                />
                <Legend />
                <Bar dataKey="count" name="Contactos" fill={fill} radius={[2, 2, 0, 0]} />
                {series.data.some(d => (d as { hiredCount?: number }).hiredCount > 0) && (
                    <Bar
                        dataKey="hiredCount"
                        name={HIRED_METRIC_KEY}
                        fill={HIRED_METRIC_COLOR}
                        radius={[2, 2, 0, 0]}
                    />
                )}
            </BarChart>
        </CompactChartContainer>
    );
};

const CONTACT_METRICS: ContactVolumeMetric[] = ['total', 'failed', 'effective'];

function contactVolumeMetricDefinition(metric: ContactVolumeMetric): string {
    if (metric === 'failed') return CONTACT_CHANNEL_DEFS.intentosFallidos;
    if (metric === 'effective') return CONTACT_CHANNEL_DEFS.intentosEfectivos;
    return CONTACT_CHANNEL_DEFS.intentosTotales;
}

const ContactChannelChartsRow: React.FC<{
    bundle: Record<ContactVolumeMetric, { daily: ContactDailyTrendSeries; hourly: ContactHourlyDistribution }>;
}> = ({ bundle }) => {
    const channelLabel = bundle.total.daily.channelLabel;
    return (
        <div className="mb-6 pb-6 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">{channelLabel}</h3>
            <div className="space-y-4">
                {CONTACT_METRICS.map(metric => (
                    <div key={metric}>
                        <p className="text-xs font-medium text-gray-500 mb-1">
                            {bundle[metric].daily.metricLabel}
                        </p>
                        <p className="text-[11px] text-gray-400 mb-2 leading-snug">
                            {contactVolumeMetricDefinition(metric)}
                        </p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <ContactDailyTrendChart series={bundle[metric].daily} />
                            <ContactHourlyChart series={bundle[metric].hourly} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const Dashboard: React.FC = () => {
    const { state, getLabel, actions } = useAppState();
    const {
        processes,
        candidates: allCandidates,
        interviewEvents,
        users,
        currentUser,
        dashboardFilters,
        dashboardCache,
        dashboardCacheLoading,
    } = state;

    const {
        processFilter,
        processScopeFilter,
        dateFilter,
        contactConsultantPeriod,
    } = dashboardFilters;

    const setProcessFilter = (value: string) => actions.setDashboardFilters({ processFilter: value });
    const setProcessScopeFilter = (value: 'all' | 'bulk' | 'standard') =>
        actions.setDashboardFilters({ processScopeFilter: value, processFilter: 'all' });
    const setDateFilter = (patch: Partial<{ start: string; end: string }>) =>
        actions.setDashboardFilters({ dateFilter: { ...dateFilter, ...patch } });
    const setContactConsultantPeriod = (value: ContactConsultantPeriod) =>
        actions.setDashboardFilters({ contactConsultantPeriod: value });

    const statsUsers = useMemo(
        () => buildUserLookupForStats(users, currentUser),
        [users, currentUser]
    );

    const scopedProcesses = useMemo(() => {
        if (processScopeFilter === 'bulk') return processes.filter(p => p.isBulkProcess);
        if (processScopeFilter === 'standard') return processes.filter(p => !p.isBulkProcess);
        return processes;
    }, [processes, processScopeFilter]);

    useEffect(() => {
        const validIds = new Set(scopedProcesses.map(p => p.id));
        if (processFilter !== 'all' && !validIds.has(processFilter)) {
            actions.setDashboardFilters({ processFilter: 'all' });
        }
    }, [scopedProcesses, processFilter, actions]);

    const processMap = useMemo(() => new Map(processes.map(p => [p.id, p])), [processes]);

    const bulkProcessIdsInScope = useMemo(() => {
        if (processFilter !== 'all') {
            const p = processMap.get(processFilter);
            return p?.isBulkProcess ? [processFilter] : [];
        }
        return scopedProcesses.filter(p => p.isBulkProcess).map(p => p.id);
    }, [processFilter, scopedProcesses, processMap]);

    const bulkProcessIdSet = useMemo(
        () => new Set(bulkProcessIdsInScope),
        [bulkProcessIdsInScope]
    );

    const bulkPoolCandidates = useMemo(() => {
        if (!dashboardCache || bulkProcessIdsInScope.length === 0) return [];
        return dashboardCache.bulkPoolCandidates.filter(c => bulkProcessIdSet.has(c.processId));
    }, [dashboardCache, bulkProcessIdsInScope, bulkProcessIdSet]);

    const bulkCandidateFields = useMemo(() => {
        if (!dashboardCache) return {};
        const fields: Record<string, BulkCandidateFieldExtras> = {};
        for (const candidate of bulkPoolCandidates) {
            const extra = dashboardCache.bulkCandidateFields[candidate.id];
            if (extra) fields[candidate.id] = extra;
        }
        return fields;
    }, [dashboardCache, bulkPoolCandidates]);

    const bulkContactSummaries = useMemo(() => {
        if (!dashboardCache || bulkProcessIdsInScope.length === 0) return {};
        const summaries: Record<string, ContactSummaryCandidate> = {};
        for (const [id, summary] of Object.entries(dashboardCache.bulkContactSummaries)) {
            if (bulkProcessIdSet.has(summary.processId)) summaries[id] = summary;
        }
        return summaries;
    }, [dashboardCache, bulkProcessIdsInScope, bulkProcessIdSet]);

    const bulkSchedulingRows = useMemo(() => {
        if (!dashboardCache || bulkProcessIdsInScope.length === 0) return [];
        return dashboardCache.bulkSchedulingRows.filter(row => bulkProcessIdSet.has(row.processId));
    }, [dashboardCache, bulkProcessIdsInScope, bulkProcessIdSet]);

    const bulkHiringActorsByProcess = useMemo(() => {
        if (!dashboardCache || bulkProcessIdsInScope.length === 0) return {};
        const byProcess: Record<string, Record<string, HiredStageActor>> = {};
        for (const processId of bulkProcessIdsInScope) {
            const actors = dashboardCache.bulkHiringActorsByProcess[processId];
            if (actors) byProcess[processId] = actors;
        }
        return byProcess;
    }, [dashboardCache, bulkProcessIdsInScope]);

    const targetProcessIds = useMemo(() => {
        if (processFilter !== 'all') return [processFilter];
        return scopedProcesses.map(p => p.id);
    }, [processFilter, scopedProcesses]);

    const targetProcessIdSet = useMemo(
        () => new Set(targetProcessIds),
        [targetProcessIds]
    );

    const contactAttempts = useMemo(() => {
        if (!dashboardCache || targetProcessIds.length === 0) return [];
        return dashboardCache.contactAttempts.filter(attempt => targetProcessIdSet.has(attempt.processId));
    }, [dashboardCache, targetProcessIds, targetProcessIdSet]);

    const schedulingLogs = useMemo(() => {
        if (!dashboardCache || targetProcessIds.length === 0) return [];
        return dashboardCache.schedulingLogs.filter(log => targetProcessIdSet.has(log.processId));
    }, [dashboardCache, targetProcessIds, targetProcessIdSet]);

    const schedulingCycles = useMemo(() => {
        if (!dashboardCache || targetProcessIds.length === 0) return [];
        return dashboardCache.schedulingCycles.filter(cycle => targetProcessIdSet.has(cycle.processId));
    }, [dashboardCache, targetProcessIds, targetProcessIdSet]);

    const contactStatsLoading = dashboardCacheLoading && !dashboardCache;
    const schedulingStatsLoading = dashboardCacheLoading && !dashboardCache;

    useEffect(() => {
        if (!dashboardCache && !dashboardCacheLoading) {
            void actions.loadDashboardCache();
        }
    }, [dashboardCache, dashboardCacheLoading, actions]);

    const analyticsCandidates = useMemo(() => {
        const standardProcessIds = new Set(
            scopedProcesses.filter(p => !p.isBulkProcess).map(p => p.id)
        );
        const standard = allCandidates.filter(c => standardProcessIds.has(c.processId));
        return [...standard, ...bulkPoolCandidates];
    }, [allCandidates, bulkPoolCandidates, scopedProcesses]);

    const candidateProcessIdMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const c of analyticsCandidates) {
            map.set(c.id, c.processId);
        }
        return map;
    }, [analyticsCandidates]);

    const filteredCandidates = useMemo(() => {
        const userRole = state.currentUser?.role;
        const isClientOrViewer = userRole === 'client' || userRole === 'viewer';
        const scopedProcessIds = new Set(scopedProcesses.map(p => p.id));

        return analyticsCandidates.filter(candidate => {
            if (isClientOrViewer && !candidate.visibleToClients) return false;
            if (!scopedProcessIds.has(candidate.processId)) return false;

            const processMatch = processFilter === 'all' || candidate.processId === processFilter;

            const applicationDateRaw = resolveDashboardApplicationDate(candidate);
            if (!applicationDateRaw) return processMatch;

            const applicationDate = new Date(applicationDateRaw);
            const startDate = dateFilter.start ? new Date(dateFilter.start) : null;
            const endDate = dateFilter.end ? new Date(dateFilter.end) : null;
            if (startDate) startDate.setHours(0, 0, 0, 0);
            if (endDate) endDate.setHours(23, 59, 59, 999);

            const dateMatch =
                (!startDate || applicationDate >= startDate) &&
                (!endDate || applicationDate <= endDate);

            return processMatch && dateMatch;
        });
    }, [analyticsCandidates, processFilter, dateFilter, scopedProcesses, state.currentUser?.role]);

    const dashboardHiredContext = useMemo(
        () => buildDashboardHiredContext(filteredCandidates, processMap),
        [filteredCandidates, processMap]
    );

    const activeProcesses = scopedProcesses.filter(p => p.status === 'en_proceso');
    const bulkActiveCount = activeProcesses.filter(p => p.isBulkProcess).length;
    const standardActiveCount = activeProcesses.length - bulkActiveCount;

    const bulkCandidates = filteredCandidates.filter(c => processMap.get(c.processId)?.isBulkProcess).length;
    const standardCandidates = filteredCandidates.length - bulkCandidates;

    const discardedCandidates = filteredCandidates.filter(c => c.discarded === true).length;
    const activeCandidates = filteredCandidates.filter(c => !c.discarded).length;

    const hiredCandidates = filteredCandidates.filter(c =>
        isHiredInProcess(c, processMap.get(c.processId))
    ).length;

    const conversionRate = activeCandidates > 0
        ? Math.round((hiredCandidates / activeCandidates) * 1000) / 10
        : null;

    const candidateSources = useMemo(() => {
        const sourceMap = new Map<string, number>();
        filteredCandidates.forEach(c => {
            const process = processMap.get(c.processId);
            const bulkExtra = bulkCandidateFields[c.id];
            const rawSource = resolveDashboardCandidateField(c, 'source', process, bulkExtra);
            const source = translateSource(rawSource || 'Otro');
            sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
        });
        return Array.from(sourceMap, ([name, value]) => ({ name, value }));
    }, [filteredCandidates, processMap, bulkCandidateFields]);

    const candidateDistrictCounts = useMemo(() => {
        const districtMap = new Map<string, number>();
        filteredCandidates.forEach(c => {
            const process = processMap.get(c.processId);
            const bulkExtra = bulkCandidateFields[c.id];
            const rawDistrict = resolveDashboardCandidateField(c, 'district', process, bulkExtra);
            const district = normalizeDistrictName(rawDistrict);
            const key = district || 'Sin distrito';
            districtMap.set(key, (districtMap.get(key) || 0) + 1);
        });
        return districtMap;
    }, [filteredCandidates, processMap, bulkCandidateFields]);

    const candidateDistricts = useMemo(
        () => topNWithOthers([...candidateDistrictCounts.entries()], 10),
        [candidateDistrictCounts]
    );

    const candidatesByStage = useMemo(() => {
        const stageMap = new Map<string, number>();
        filteredCandidates.forEach(c => {
            const stageName = getStageName(c, processes);
            stageMap.set(stageName, (stageMap.get(stageName) || 0) + 1);
        });

        if (processFilter !== 'all') {
            const process = processMap.get(processFilter);
            if (process?.stages?.length) {
                return process.stages
                    .map(stage => ({
                        name: stage.name,
                        Candidatos: stageMap.get(stage.name) || 0,
                    }))
                    .filter(d => d.Candidatos > 0);
            }
        }

        return topNWithOthers(Array.from(stageMap.entries()), 12);
    }, [filteredCandidates, processes, processFilter, processMap]);

    const candidatesByPosition = useMemo(() => {
        const positionMap = new Map<string, number>();
        filteredCandidates.forEach(c => {
            const process = processMap.get(c.processId);
            const label = process?.title?.trim() || 'Sin puesto asignado';
            positionMap.set(label, (positionMap.get(label) || 0) + 1);
        });
        return topNWithOthers(Array.from(positionMap.entries()), 8);
    }, [filteredCandidates, processMap]);

    const ageDistribution = useMemo(() => {
        const ageBrackets: Record<string, number> = {
            '<20': 0,
            '20-29': 0,
            '30-39': 0,
            '40-49': 0,
            '50+': 0,
            'Sin dato': 0,
        };
        filteredCandidates.forEach(c => {
            const process = processMap.get(c.processId);
            const bulkExtra = bulkCandidateFields[c.id];
            const enrichedRow = {
                ...(c.bulkColumnValues || {}),
                ...(bulkExtra?.bulkColumnValues || {}),
            };
            const age = resolveCandidateAgeForProcess(
                {
                    id: c.id,
                    age: bulkExtra?.age ?? c.age,
                    bulkColumnValues: Object.keys(enrichedRow).length > 0 ? enrichedRow : undefined,
                },
                process,
                Object.keys(enrichedRow).length > 0 ? { [c.id]: enrichedRow } : {}
            );
            if (age == null) {
                ageBrackets['Sin dato']++;
            } else if (age < 20) ageBrackets['<20']++;
            else if (age <= 29) ageBrackets['20-29']++;
            else if (age <= 39) ageBrackets['30-39']++;
            else if (age <= 49) ageBrackets['40-49']++;
            else ageBrackets['50+']++;
        });
        return Object.entries(ageBrackets)
            .filter(([, count]) => count > 0)
            .map(([name, Candidatos]) => ({ name, Candidatos }));
    }, [filteredCandidates, processMap, bulkCandidateFields]);

    const upcomingInterviews = useMemo(() => {
        const now = new Date();
        const filteredIds = new Set(filteredCandidates.map(c => c.id));
        return interviewEvents
            .filter(event => event.start > now && filteredIds.has(event.candidateId))
            .sort((a, b) => a.start.getTime() - b.start.getTime())
            .slice(0, 5);
    }, [interviewEvents, filteredCandidates]);

    const timeToHire = useMemo(() => {
        const hiredCandidatesWithDates = filteredCandidates
            .map(c => {
                const process = processMap.get(c.processId);
                const lastStageId = getLastStageId(process);
                if (!lastStageId || c.stageId !== lastStageId) return null;

                const publishedDate = resolveProcessPublishedDate(process);
                const acceptedDate = resolveHireAcceptedDate(c, process);
                if (!publishedDate || !acceptedDate) return null;

                const published = new Date(publishedDate);
                const accepted = new Date(acceptedDate);
                const days = Math.ceil((accepted.getTime() - published.getTime()) / (1000 * 60 * 60 * 24));
                return days >= 0 ? days : null;
            })
            .filter((days): days is number => days !== null);

        if (hiredCandidatesWithDates.length === 0) return null;
        const average = hiredCandidatesWithDates.reduce((sum, days) => sum + days, 0) / hiredCandidatesWithDates.length;
        return Math.round(average * 10) / 10;
    }, [filteredCandidates, processMap]);

    const timeToFill = useMemo(() => {
        const filledProcesses = scopedProcesses
            .filter(p => {
                if (!p.needIdentifiedDate) return false;
                const processCandidates = filteredCandidates.filter(c => c.processId === p.id);
                const lastStageId = getLastStageId(p);
                if (!lastStageId) return false;
                const hiredCount = processCandidates.filter(c => c.stageId === lastStageId && !c.discarded).length;
                return hiredCount >= p.vacancies;
            })
            .map(p => {
                const processCandidates = filteredCandidates.filter(c => c.processId === p.id);
                const lastStageId = getLastStageId(p);
                if (!lastStageId) return null;

                const lastHired = processCandidates
                    .filter(c => c.stageId === lastStageId && !c.discarded)
                    .map(c => ({ candidate: c, acceptedDate: resolveHireAcceptedDate(c, p) }))
                    .filter((entry): entry is { candidate: Candidate; acceptedDate: string } => Boolean(entry.acceptedDate))
                    .sort((a, b) => b.acceptedDate.localeCompare(a.acceptedDate))[0];

                if (!lastHired || !p.needIdentifiedDate) return null;

                const needDate = new Date(p.needIdentifiedDate);
                const fillDate = new Date(lastHired.acceptedDate);
                const days = Math.ceil((fillDate.getTime() - needDate.getTime()) / (1000 * 60 * 60 * 24));
                return days >= 0 ? days : null;
            })
            .filter((days): days is number => days !== null);

        if (filledProcesses.length === 0) return null;
        const average = filledProcesses.reduce((sum, days) => sum + days, 0) / filledProcesses.length;
        return Math.round(average * 10) / 10;
    }, [filteredCandidates, scopedProcesses]);

    const stageDuration = useMemo(() => {
        const stageDurations: Record<string, number[]> = {};
        const stageNames: Record<string, string> = {};

        filteredCandidates.forEach(candidate => {
            if (!candidate.history || candidate.history.length < 2) return;

            for (let i = 1; i < candidate.history.length; i++) {
                const prevStage = candidate.history[i - 1];
                const currentStage = candidate.history[i];

                const prevDate = new Date(prevStage.movedAt);
                const currentDate = new Date(currentStage.movedAt);
                const days = Math.ceil((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

                if (days >= 0) {
                    if (!stageDurations[prevStage.stageId]) stageDurations[prevStage.stageId] = [];
                    stageDurations[prevStage.stageId].push(days);

                    const process = processMap.get(candidate.processId);
                    const stageName = process?.stages.find(s => s.id === prevStage.stageId)?.name;
                    if (stageName) stageNames[prevStage.stageId] = stageName;
                }
            }
        });

        const byName = new Map<string, number[]>();
        for (const [stageId, durations] of Object.entries(stageDurations)) {
            const name = stageNames[stageId] || stageId;
            const existing = byName.get(name) || [];
            byName.set(name, [...existing, ...durations]);
        }

        return Array.from(byName.entries())
            .map(([stageName, durations]) => ({
                name: stageName,
                dias: Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10,
                muestras: durations.length,
            }))
            .sort((a, b) => b.dias - a.dias);
    }, [filteredCandidates, processMap]);

    const applicationCompletionRate = useMemo(() => {
        const started = filteredCandidates.filter(c => resolveApplicationStartedDate(c)).length;
        const completed = filteredCandidates.filter(c => {
            const process = processMap.get(c.processId);
            return resolveApplicationCompletedDate(c, process);
        }).length;
        if (started === 0) return null;
        return Math.round((completed / started) * 1000) / 10;
    }, [filteredCandidates, processMap]);

    const scopedProcessIds = useMemo(
        () => new Set(targetProcessIds),
        [targetProcessIds]
    );

    const filteredCandidateIdSet = useMemo(
        () => new Set(filteredCandidates.map(c => c.id)),
        [filteredCandidates]
    );

    const scopedContactAttempts = useMemo(
        () =>
            contactAttempts.filter(a => {
                const processId = a.processId || candidateProcessIdMap.get(a.candidateId);
                return processId != null && scopedProcessIds.has(processId);
            }),
        [contactAttempts, scopedProcessIds, candidateProcessIdMap]
    );

    /** Candidatos en procesos del filtro (sin restricción de fecha de postulación) para contactología */
    const contactStatsCandidateIds = useMemo(() => {
        const ids = new Set<string>();
        for (const c of analyticsCandidates) {
            if (scopedProcessIds.has(c.processId)) ids.add(c.id);
        }
        return ids;
    }, [analyticsCandidates, scopedProcessIds]);

    const reconciledContactAttempts = useMemo(() => {
        const summaries = Object.values(bulkContactSummaries).filter(c =>
            scopedProcessIds.has(c.processId)
        );
        let rows = scopedContactAttempts;
        rows = synthesizeVolumeAttemptsFromSummaries(rows, summaries);
        rows = reconcileContactAttemptsWithSummaries(rows, summaries);
        rows = synthesizeInteresadoAttemptsFromSummaries(rows, summaries);
        rows = attributeContactAttemptsFromSummaries(rows, summaries);
        return rows;
    }, [scopedContactAttempts, bulkContactSummaries, scopedProcessIds]);

    const contactSummariesForStats = useMemo(
        () =>
            Object.values(bulkContactSummaries).filter(c => scopedProcessIds.has(c.processId)),
        [bulkContactSummaries, scopedProcessIds]
    );

    const enrichedContactAttempts = useMemo(
        () =>
            enrichContactAttemptsForStats(reconciledContactAttempts, statsUsers).filter(a =>
                contactStatsCandidateIds.has(a.candidateId)
            ),
        [reconciledContactAttempts, statsUsers, contactStatsCandidateIds]
    );

    const contactStats = useMemo(
        () =>
            computeContactDashboardStats(
                enrichedContactAttempts,
                contactConsultantPeriod,
                contactSummariesForStats
            ),
        [enrichedContactAttempts, contactConsultantPeriod, contactSummariesForStats]
    );

    const schedulingReconciled = useMemo(() => {
        const scopedSchedulingRows = bulkSchedulingRows.filter(r =>
            filteredCandidateIdSet.has(r.id)
        );
        return reconcileInterviewSchedulingFromBulkCandidates(
            schedulingLogs,
            schedulingCycles,
            scopedSchedulingRows,
            processMap,
            contactConsultantPeriod
        );
    }, [
        schedulingLogs,
        schedulingCycles,
        bulkSchedulingRows,
        processMap,
        contactConsultantPeriod,
        filteredCandidateIdSet,
    ]);

    const schedulingStats = useMemo(
        () =>
            computeInterviewSchedulingStats(
                schedulingReconciled.logs,
                schedulingReconciled.cycles,
                contactConsultantPeriod,
                statsUsers,
                filteredCandidateIdSet,
                dashboardHiredContext
            ),
        [
            schedulingReconciled,
            contactConsultantPeriod,
            statsUsers,
            filteredCandidateIdSet,
            dashboardHiredContext,
        ]
    );

    const schedulingEffectiveness = useMemo(
        () =>
            computeSchedulingEffectiveness(
                schedulingReconciled.logs,
                schedulingReconciled.cycles,
                contactConsultantPeriod,
                statsUsers,
                filteredCandidateIdSet
            ),
        [schedulingReconciled, contactConsultantPeriod, statsUsers, filteredCandidateIdSet]
    );

    const hiredProfileSummary = useMemo(
        () =>
            computeHiredProfileSummary(
                dashboardHiredContext,
                processMap,
                bulkCandidateFields,
                enrichedContactAttempts,
                schedulingReconciled.logs,
                schedulingReconciled.cycles
            ),
        [
            dashboardHiredContext,
            processMap,
            bulkCandidateFields,
            enrichedContactAttempts,
            schedulingReconciled,
        ]
    );

    const contactTrendOpts = useMemo(() => {
        const names = new Set<string>();
        if (currentUser?.name?.trim()) names.add(currentUser.name.trim());
        for (const u of statsUsers) {
            if (u.name?.trim()) names.add(u.name.trim());
        }
        return [...names];
    }, [currentUser?.name, statsUsers]);

    const contactChannelTrends = useMemo(() => {
        const channels: ContactAttemptChannel[] = ['call', 'whatsapp', 'email'];
        return Object.fromEntries(
            channels.map(ch => {
                const bundle = buildChannelTrendBundle(
                    enrichedContactAttempts,
                    contactConsultantPeriod,
                    ch,
                    10,
                    contactTrendOpts
                );
                return [
                    ch,
                    {
                        ...bundle,
                        total: {
                            daily: injectHiredIntoDailyTrendSeries(
                                bundle.total.daily,
                                dashboardHiredContext,
                                contactConsultantPeriod
                            ),
                            hourly: injectHiredIntoHourlyDistribution(
                                bundle.total.hourly,
                                dashboardHiredContext,
                                contactConsultantPeriod
                            ),
                        },
                    },
                ];
            })
        ) as Record<
            ContactAttemptChannel,
            Record<ContactVolumeMetric, { daily: ContactDailyTrendSeries; hourly: ContactHourlyDistribution }>
        >;
    }, [enrichedContactAttempts, contactConsultantPeriod, contactTrendOpts, dashboardHiredContext]);

    const contactologyAdvanced = useMemo(() => {
        const candidateInputs = analyticsCandidates
            .filter(c => contactStatsCandidateIds.has(c.id))
            .map(c => ({
                id: c.id,
                processId: c.processId,
                recordCreatedAt: resolveCandidateRecordCreatedAt(c),
            }));
        return computeContactologyAdvancedStats(
            enrichedContactAttempts,
            enrichedContactAttempts,
            candidateInputs,
            contactSummariesForStats,
            contactConsultantPeriod,
            contactStatsCandidateIds
        );
    }, [
        enrichedContactAttempts,
        analyticsCandidates,
        contactConsultantPeriod,
        contactStatsCandidateIds,
        contactSummariesForStats,
    ]);

    const registrationCreationStats = useMemo(
        () =>
            computeRegistrationCreationStats(
                filteredCandidates.map(c => ({
                    id: c.id,
                    createdAt: c.createdAt,
                    firstApplicationAt: c.firstApplicationAt,
                    applicationStartedDate: c.applicationStartedDate,
                    registrationOrigin: c.registrationOrigin,
                    applicationCount: c.applicationCount,
                }))
            ),
        [filteredCandidates]
    );

    const hiringConsultantStats = useMemo(
        () =>
            computeHiringStageConsultantStats(
                filteredCandidates.map(c => ({
                    id: c.id,
                    processId: c.processId,
                    stageId: c.stageId,
                    discarded: c.discarded,
                    history: c.history,
                })),
                processMap,
                statsUsers,
                bulkHiringActorsByProcess
            ),
        [filteredCandidates, processMap, statsUsers, bulkHiringActorsByProcess]
    );

    const candidatesByStageChart = useMemo(() => {
        const hiredByStage = countHiredByBucket(dashboardHiredContext, e =>
            getStageName(e.candidate, processes)
        );
        return augmentNamedCountRows(candidatesByStage, 'name', hiredByStage);
    }, [candidatesByStage, dashboardHiredContext, processes]);

    const candidateSourcesChart = useMemo(() => {
        const hiredBySource = countHiredByBucket(dashboardHiredContext, e => {
            const process = processMap.get(e.candidate.processId);
            const bulkExtra = bulkCandidateFields[e.candidate.id];
            const rawSource = resolveDashboardCandidateField(e.candidate, 'source', process, bulkExtra);
            return translateSource(rawSource || 'Otro');
        });
        return augmentValueRows(candidateSources, hiredBySource);
    }, [candidateSources, dashboardHiredContext, processMap, bulkCandidateFields]);

    const candidatesByPositionChart = useMemo(() => {
        const hiredByPosition = countHiredByBucket(dashboardHiredContext, e => {
            const process = processMap.get(e.candidate.processId);
            return process?.title?.trim() || 'Sin puesto asignado';
        });
        return augmentNamedCountRows(candidatesByPosition, 'name', hiredByPosition);
    }, [candidatesByPosition, dashboardHiredContext, processMap]);

    const ageDistributionChart = useMemo(() => {
        const hiredByAge = countHiredByBucket(dashboardHiredContext, e => {
            const process = processMap.get(e.candidate.processId);
            const bulkExtra = bulkCandidateFields[e.candidate.id];
            const enrichedRow = {
                ...(e.candidate.bulkColumnValues || {}),
                ...(bulkExtra?.bulkColumnValues || {}),
            };
            const age = resolveCandidateAgeForProcess(
                {
                    id: e.candidate.id,
                    age: bulkExtra?.age ?? e.candidate.age,
                    bulkColumnValues: Object.keys(enrichedRow).length > 0 ? enrichedRow : undefined,
                },
                process,
                Object.keys(enrichedRow).length > 0 ? { [e.candidate.id]: enrichedRow } : {}
            );
            if (age == null) return 'Sin dato';
            if (age < 20) return '<20';
            if (age <= 29) return '20-29';
            if (age <= 39) return '30-39';
            if (age <= 49) return '40-49';
            return '50+';
        });
        return augmentNamedCountRows(ageDistribution, 'name', hiredByAge);
    }, [ageDistribution, dashboardHiredContext, processMap, bulkCandidateFields]);

    const candidateDistrictsChart = useMemo(() => {
        const hiredByDistrict = countHiredByBucket(dashboardHiredContext, e => {
            const process = processMap.get(e.candidate.processId);
            const bulkExtra = bulkCandidateFields[e.candidate.id];
            const rawDistrict = resolveDashboardCandidateField(e.candidate, 'district', process, bulkExtra);
            return normalizeDistrictName(rawDistrict) || 'Sin distrito';
        });
        return augmentNamedCountRows(candidateDistricts, 'name', hiredByDistrict);
    }, [candidateDistricts, dashboardHiredContext, processMap, bulkCandidateFields]);

    const registrationTimeBandChart = useMemo(() => {
        const hiredBands = countHiredByTimeBand(dashboardHiredContext);
        return registrationCreationStats.timeBandDistribution.map(row => ({
            ...row,
            hiredCount: hiredBands[row.band],
        }));
    }, [registrationCreationStats, dashboardHiredContext]);

    const contactologyWeeklyTrendChart = useMemo(() => {
        const hiredByWeek = countHiredByBucket(dashboardHiredContext, e =>
            startOfWeekMondayLimaKey(new Date(e.hireDateIso))
        );
        return contactologyAdvanced.weeklyFirstContact.weeklyTrend.map(w => ({
            ...w,
            name: w.isCurrent ? `${w.label}*` : w.label,
            Contactados: w.contactedCount,
            Registros: w.registrationCount,
            tiempoHoras: w.avgHours,
            tiempoLabel: w.avgLabel,
            Contratados: hiredByWeek.get(w.weekKey) || 0,
        }));
    }, [contactologyAdvanced, dashboardHiredContext]);

    const contactologyCurrentWeekDailyChart = useMemo(() => {
        const hiredByDay = countHiredByBucket(dashboardHiredContext, e => e.hireDateKey);
        return contactologyAdvanced.weeklyFirstContact.currentWeekDailyTrend.map(d => ({
            ...d,
            tiempoHoras: d.avgHours,
            Contratados: hiredByDay.get(d.dayKey) || 0,
        }));
    }, [contactologyAdvanced, dashboardHiredContext]);

    const contactChannelVolumeChart = useMemo(() => {
        const hiredIds = dashboardHiredContext.idSet;
        const channels: ContactAttemptChannel[] = ['call', 'whatsapp', 'email'];
        const hiredUniqueByLabel = new Map<string, number>();
        for (const ch of channels) {
            const contacted = new Set<string>();
            for (const a of enrichedContactAttempts) {
                if (!hiredIds.has(a.candidateId)) continue;
                if (matchesContactVolumeMetric(a, ch, 'total')) contacted.add(a.candidateId);
            }
            const label =
                ch === 'call' ? 'Llamadas' : ch === 'whatsapp' ? 'WhatsApp' : 'Correo';
            hiredUniqueByLabel.set(label, contacted.size);
        }
        return contactStats.channelVolume.map(row => ({
            ...row,
            Contratados: hiredUniqueByLabel.get(row.name) || 0,
        }));
    }, [contactStats.channelVolume, enrichedContactAttempts, dashboardHiredContext]);

    const stageChartHeight = Math.max(280, candidatesByStageChart.length * 36);

    return (
        <div className="p-4 md:p-8 bg-gray-50/50 min-h-full overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 md:mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{getLabel('sidebar_dashboard', 'Panel')}</h1>
                <div className="flex items-center gap-3 shrink-0">
                    {dashboardCache?.loadedAt && (
                        <span className="text-xs text-gray-400 hidden md:inline">
                            Datos al{' '}
                            {new Date(dashboardCache.loadedAt).toLocaleString('es-PE', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                            })}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => void actions.loadDashboardCache(true)}
                        disabled={dashboardCacheLoading}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Actualizar datos del panel"
                    >
                        <RefreshCw className={`w-4 h-4 ${dashboardCacheLoading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>
                </div>
            </div>

            <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-200 shadow-sm mb-6 md:mb-8 flex flex-col lg:flex-row lg:flex-wrap lg:items-end gap-3 md:gap-4">
                <div>
                    <label htmlFor="processScopeFilter" className="block text-sm font-medium text-gray-700 mb-1">Tipo de proceso</label>
                    <select
                        id="processScopeFilter"
                        value={processScopeFilter}
                        onChange={(e) => {
                            setProcessScopeFilter(e.target.value as 'all' | 'bulk' | 'standard');
                        }}
                        className="border-gray-300 rounded-md shadow-sm text-sm w-full md:w-auto"
                    >
                        <option value="all">Todos (regulares + masivos)</option>
                        <option value="bulk">Solo procesos masivos</option>
                        <option value="standard">Solo procesos regulares</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="processFilter" className="block text-sm font-medium text-gray-700 mb-1">Proceso</label>
                    <select
                        id="processFilter"
                        value={processFilter}
                        onChange={(e) => setProcessFilter(e.target.value)}
                        className="border-gray-300 rounded-md shadow-sm text-sm w-full md:w-auto max-w-xs"
                    >
                        <option value="all">Todos los procesos</option>
                        {scopedProcesses.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.isBulkProcess ? `[Masivo] ${p.title}` : p.title}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Postulación desde</label>
                    <input
                        type="date"
                        id="startDate"
                        value={dateFilter.start}
                        onChange={(e) => setDateFilter({ start: e.target.value })}
                        className="border-gray-300 rounded-md shadow-sm text-sm"
                    />
                </div>
                <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">Postulación hasta</label>
                    <input
                        type="date"
                        id="endDate"
                        value={dateFilter.end}
                        onChange={(e) => setDateFilter({ end: e.target.value })}
                        className="border-gray-300 rounded-md shadow-sm text-sm"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    icon={Briefcase}
                    title="Procesos activos"
                    value={activeProcesses.length}
                    subtitle={`${bulkActiveCount} masivos · ${standardActiveCount} regulares en curso`}
                    color="bg-blue-500"
                />
                <StatCard
                    icon={Users}
                    title="Candidatos en alcance"
                    value={filteredCandidates.length}
                    subtitle={`${bulkCandidates} en masivos · ${standardCandidates} en regulares · ${activeCandidates} activos`}
                    color="bg-green-500"
                />
                <StatCard
                    icon={FileText}
                    title="Descartados"
                    value={discardedCandidates}
                    subtitle={
                        filteredCandidates.length > 0
                            ? `${Math.round((discardedCandidates / filteredCandidates.length) * 1000) / 10}% del total filtrado`
                            : 'Sin candidatos en el filtro actual'
                    }
                    color="bg-purple-500"
                />
                <StatCard
                    icon={CheckCircle}
                    title="Contratados"
                    value={hiredCandidates}
                    subtitle={
                        conversionRate !== null
                            ? `${conversionRate}% de conversión sobre candidatos activos`
                            : 'Sin candidatos activos en el filtro'
                    }
                    color="bg-teal-500"
                />
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-1">Indicadores de Eficiencia</h2>
                <p className="text-sm text-gray-500 mb-4">Métricas calculadas sobre los candidatos y procesos del filtro actual.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h3 className="text-sm font-medium text-blue-800 mb-1">Time to Hire</h3>
                        <p className="text-2xl font-bold text-blue-900">{timeToHire !== null ? `${timeToHire} días` : 'N/D'}</p>
                        <p className="text-xs text-blue-600 mt-1">Promedio desde publicación del proceso hasta aceptación de oferta</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h3 className="text-sm font-medium text-green-800 mb-1">Time to Fill</h3>
                        <p className="text-2xl font-bold text-green-900">{timeToFill !== null ? `${timeToFill} días` : 'N/D'}</p>
                        <p className="text-xs text-green-600 mt-1">Promedio desde identificación de necesidad hasta cubrir vacantes</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <h3 className="text-sm font-medium text-purple-800 mb-1">Tasa de Finalización</h3>
                        <p className="text-2xl font-bold text-purple-900">
                            {applicationCompletionRate !== null ? `${applicationCompletionRate}%` : 'N/D'}
                        </p>
                        <p className="text-xs text-purple-600 mt-1">Postulaciones completadas vs. iniciadas</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <h3 className="text-sm font-medium text-orange-800 mb-1">Tasa de Conversión</h3>
                        <p className="text-2xl font-bold text-orange-900">
                            {conversionRate !== null ? `${conversionRate}%` : 'N/D'}
                        </p>
                        <p className="text-xs text-orange-600 mt-1">Contratados sobre candidatos activos (no descartados)</p>
                    </div>
                </div>

                {stageDuration.length > 0 && (
                    <div className="mt-6 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-800 mb-1">Duración promedio por etapa</h3>
                        <p className="text-sm text-gray-500 mb-3">Días que los candidatos permanecen en cada etapa antes de avanzar.</p>
                        <MeasuredChartArea height={Math.max(200, stageDuration.length * 40)}>
                            {({ width, height: chartHeight }) => (
                                <BarChart
                                    width={width}
                                    height={chartHeight}
                                    data={stageDuration}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" unit=" d" />
                                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        formatter={(value: number, _name, item) => [
                                            `${value} días (${item.payload.muestras} movimientos)`,
                                            'Promedio',
                                        ]}
                                    />
                                    <Bar dataKey="dias" fill="#f97316" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            )}
                        </MeasuredChartArea>
                    </div>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800 mb-1">Canales de atención</h2>
                        <p className="text-sm text-gray-500">
                            Uso y efectividad de llamadas, WhatsApp y correo. Cada canal incluye gráficos de
                            intentos totales, fallidos y efectivos (total = fallidos + efectivos, incluye marcar
                            «Interesado»). El rango semanal/mensual/anual aplica a la fecha del intento, no a la
                            fecha de postulación del candidato.
                        </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                        <span className="text-xs font-medium text-gray-600">Rango (consultores y admin)</span>
                        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
                            {([
                                ['week', 'Semanal'],
                                ['month', 'Mensual'],
                                ['year', 'Anual'],
                            ] as const).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setContactConsultantPeriod(value)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        contactConsultantPeriod === value
                                            ? 'bg-white text-primary-700 shadow-sm border border-gray-200'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {contactStatsLoading ? (
                    <p className="text-sm text-gray-500 py-6 text-center">Cargando datos de contacto…</p>
                ) : contactStats.totalActions === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">
                        Sin acciones de contacto en {contactStats.periodLabel.toLowerCase()} para los procesos y candidatos del filtro actual.
                    </p>
                ) : (
                    <>
                        <p className="text-xs text-gray-400 mb-4">{contactStats.periodLabel}</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
                            <StatCard
                                icon={Phone}
                                title="Más llamadas"
                                value={contactStats.topCaller?.userName ?? 'N/D'}
                                subtitle={
                                    contactStats.topCaller
                                        ? `${contactStats.topCaller.callCount} llamada${contactStats.topCaller.callCount !== 1 ? 's' : ''}`
                                        : 'Sin llamadas'
                                }
                                definition={CONTACT_CHANNEL_DEFS.masLlamadas}
                                color="bg-violet-500"
                            />
                            <StatCard
                                icon={MessageCircle}
                                title="Más WhatsApp"
                                value={contactStats.topWhatsappUser?.userName ?? 'N/D'}
                                subtitle={
                                    contactStats.topWhatsappUser
                                        ? `${contactStats.topWhatsappUser.count} contacto${contactStats.topWhatsappUser.count !== 1 ? 's' : ''}`
                                        : 'Sin WhatsApp'
                                }
                                definition={CONTACT_CHANNEL_DEFS.masWhatsapp}
                                color="bg-emerald-500"
                            />
                            <StatCard
                                icon={Mail}
                                title="Más correos"
                                value={contactStats.topEmailUser?.userName ?? 'N/D'}
                                subtitle={
                                    contactStats.topEmailUser
                                        ? `${contactStats.topEmailUser.count} correo${contactStats.topEmailUser.count !== 1 ? 's' : ''}`
                                        : 'Sin correos'
                                }
                                definition={CONTACT_CHANNEL_DEFS.masCorreos}
                                color="bg-sky-500"
                            />
                            <StatCard
                                icon={UserCheck}
                                title="Llamadas efectivas"
                                value={contactStats.topEffectiveCaller?.userName ?? 'N/D'}
                                subtitle={
                                    contactStats.topEffectiveCaller
                                        ? `${contactStats.topEffectiveCaller.effectiveCalls} interesado${contactStats.topEffectiveCaller.effectiveCalls !== 1 ? 's' : ''} · ${contactStats.topEffectiveCaller.rate}%`
                                        : 'Sin interés por llamada'
                                }
                                definition={CONTACT_CHANNEL_DEFS.llamadasEfectivas}
                                color="bg-amber-500"
                            />
                            <StatCard
                                icon={TrendingUp}
                                title="Canal más usado"
                                value={contactStats.mostUsedChannel?.label ?? 'N/D'}
                                subtitle={
                                    contactStats.mostUsedChannel
                                        ? `${contactStats.mostUsedChannel.count} · ${contactStats.mostUsedChannel.pct}%`
                                        : 'Sin datos'
                                }
                                definition={CONTACT_CHANNEL_DEFS.canalMasUsado}
                                color="bg-indigo-500"
                            />
                            <StatCard
                                icon={Headphones}
                                title="Mayor efectividad"
                                value={contactStats.mostEffectiveChannel?.label ?? 'N/D'}
                                subtitle={
                                    contactStats.mostEffectiveChannel
                                        ? `${contactStats.mostEffectiveChannel.rate}% interesado`
                                        : 'Sin datos'
                                }
                                definition={CONTACT_CHANNEL_DEFS.mayorEfectividad}
                                color="bg-teal-500"
                            />
                        </div>

                        <ContactChannelChartsRow bundle={contactChannelTrends.call} />
                        <ContactChannelChartsRow bundle={contactChannelTrends.whatsapp} />
                        <ContactChannelChartsRow bundle={contactChannelTrends.email} />

                        <ChartContainer
                            title="Acciones por canal"
                            description={`Total de contactos vs. interesados en el periodo. ${CONTACT_CHANNEL_DEFS.intentosTotales} ${HIRED_CHART_HINT}`}
                            hasData={contactStats.channelVolume.length > 0}
                            className="mt-2"
                        >
                            <BarChart data={contactChannelVolumeChart} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip
                                    formatter={(value: number, name: string) => {
                                        if (name === HIRED_METRIC_KEY) {
                                            return [`${value} contratado${value !== 1 ? 's' : ''} contactado${value !== 1 ? 's' : ''}`, name];
                                        }
                                        if (name === 'total') return [`${value} acciones`, 'Total'];
                                        if (name === 'effective') return [`${value} interesado${value !== 1 ? 's' : ''}`, 'Efectivas'];
                                        return [value, name];
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="total" name="Total" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="effective" name="Interesado" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Contratados" name={HIRED_METRIC_KEY} fill={HIRED_METRIC_COLOR} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ChartContainer>
                    </>
                )}

                {!contactStatsLoading && (
                        <div className={`${contactStats.totalActions > 0 ? 'mt-8 pt-6 border-t border-gray-200' : 'mt-2'}`}>
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">Análisis avanzado de contactología</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                {CONTACTOLOGY_DEFS.seccionAvanzada} Periodo de intentos:{' '}
                                {contactologyAdvanced.periodLabel.toLowerCase()}.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <StatCard
                                    icon={Clock}
                                    title="Tiempo al 1.er contacto"
                                    value={contactologyAdvanced.weeklyFirstContact.currentWeekAvgLabel}
                                    subtitle={
                                        contactologyAdvanced.weeklyFirstContact.currentWeekRegistrationCount > 0
                                            ? `Semana ${contactologyAdvanced.weeklyFirstContact.currentWeekLabel} · ${contactologyAdvanced.weeklyFirstContact.currentWeekContactedCount} de ${contactologyAdvanced.weeklyFirstContact.currentWeekRegistrationCount} registros contactados`
                                            : 'Sin registros nuevos esta semana'
                                    }
                                    definition={CONTACTOLOGY_DEFS.tiempoPrimerContacto}
                                    color="bg-blue-500"
                                />
                                <StatCard
                                    icon={Zap}
                                    title="Reacción más rápida"
                                    value={contactologyAdvanced.weeklyFirstContact.fastestFirstContactConsultant?.userName ?? 'N/D'}
                                    subtitle={
                                        contactologyAdvanced.weeklyFirstContact.fastestFirstContactConsultant
                                            ? `${contactologyAdvanced.weeklyFirstContact.fastestFirstContactConsultant.avgHours} h prom. · registros de esta semana`
                                            : 'Sin primer contacto atribuido esta semana'
                                    }
                                    definition={CONTACTOLOGY_DEFS.reaccionMasRapida}
                                    color="bg-violet-500"
                                />
                                <StatCard
                                    icon={Target}
                                    title="Intentos hasta respuesta"
                                    value={
                                        contactologyAdvanced.avgAttemptsUntilEffectiveResponse !== null
                                            ? String(contactologyAdvanced.avgAttemptsUntilEffectiveResponse)
                                            : 'N/D'
                                    }
                                    subtitle={`Promedio sobre ${contactologyAdvanced.candidatesWithResponse} candidato${contactologyAdvanced.candidatesWithResponse !== 1 ? 's' : ''} con respuesta`}
                                    definition={CONTACTOLOGY_DEFS.intentosHastaRespuesta}
                                    color="bg-amber-500"
                                />
                                <StatCard
                                    icon={TrendingUp}
                                    title="Ratio con interés"
                                    value={
                                        contactologyAdvanced.interestedResponseRatio !== null
                                            ? `${contactologyAdvanced.interestedResponseRatio}%`
                                            : 'N/D'
                                    }
                                    subtitle={
                                        contactologyAdvanced.totalClassifiedResponses > 0
                                            ? `${contactologyAdvanced.interestedResponseCount} de ${contactologyAdvanced.totalClassifiedResponses} clasificados con interés`
                                            : 'Sin contactos clasificados como interesado / no interesado'
                                    }
                                    definition={CONTACTOLOGY_DEFS.ratioConInteres}
                                    color="bg-emerald-500"
                                />
                                <StatCard
                                    icon={Users}
                                    title="Ratio sin interés"
                                    value={
                                        contactologyAdvanced.notInterestedResponseRatio !== null
                                            ? `${contactologyAdvanced.notInterestedResponseRatio}%`
                                            : 'N/D'
                                    }
                                    subtitle={
                                        contactologyAdvanced.totalClassifiedResponses > 0
                                            ? `${contactologyAdvanced.notInterestedResponseCount} de ${contactologyAdvanced.totalClassifiedResponses} clasificados sin interés`
                                            : 'Sin contactos clasificados como interesado / no interesado'
                                    }
                                    definition={CONTACTOLOGY_DEFS.ratioSinInteres}
                                    color="bg-red-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                                <ChartContainer
                                    title="Evolución semana en curso"
                                    description={CONTACTOLOGY_DEFS.evolucionSemanaEnCurso}
                                    hasData={contactologyAdvanced.weeklyFirstContact.currentWeekDailyTrend.some(d => d.contactedCumulative > 0) || contactologyCurrentWeekDailyChart.some(d => d.Contratados > 0)}
                                    height={260}
                                >
                                    <ComposedChart
                                        data={contactologyCurrentWeekDailyChart}
                                        margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                                        <YAxis yAxisId="time" allowDecimals={false} tick={{ fontSize: 10 }} />
                                        <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 10 }} />
                                        <Tooltip
                                            formatter={(value: number, name: string, item) => {
                                                if (name === HIRED_METRIC_KEY) {
                                                    return [`${value} contratación${value !== 1 ? 'es' : ''}`, name];
                                                }
                                                return [
                                                    item.payload.contactedCumulative > 0
                                                        ? `${item.payload.avgLabel} (${item.payload.contactedCumulative}/${item.payload.registrationsCumulative} contactados)`
                                                        : 'Sin contactos aún',
                                                    FIRST_CONTACT_LINE_LABEL,
                                                ];
                                            }}
                                        />
                                        <Legend />
                                        <Line
                                            yAxisId="time"
                                            type="monotone"
                                            dataKey="tiempoHoras"
                                            name={FIRST_CONTACT_LINE_LABEL}
                                            stroke="#2563eb"
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                            connectNulls
                                        />
                                        <Bar yAxisId="count" dataKey="Contratados" name={HIRED_METRIC_KEY} fill={HIRED_METRIC_COLOR} radius={[4, 4, 0, 0]} />
                                    </ComposedChart>
                                </ChartContainer>

                                <ChartContainer
                                    title="Contactados y contratados por semana de alta"
                                    description={CONTACTOLOGY_DEFS.contactadosPorSemana}
                                    hasData={contactologyAdvanced.weeklyFirstContact.weeklyTrend.some(w => w.contactedCount > 0) || contactologyWeeklyTrendChart.some(w => w.Contratados > 0)}
                                    height={280}
                                >
                                    <ComposedChart
                                        data={contactologyWeeklyTrendChart}
                                        margin={{ top: 10, right: 24, left: 8, bottom: 60 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={60} />
                                        <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 10 }} />
                                        <YAxis yAxisId="time" orientation="right" allowDecimals={false} tick={{ fontSize: 10 }} />
                                        <Tooltip
                                            formatter={(value: number, name: string, item) => {
                                                if (name === HIRED_METRIC_KEY) {
                                                    return [`${value} contratación${value !== 1 ? 'es' : ''} en la semana`, name];
                                                }
                                                if (name === 'Registros contactados') {
                                                    return [
                                                        `${value} de ${item.payload.Registros} registro${item.payload.Registros !== 1 ? 's' : ''} contactado${value !== 1 ? 's' : ''}`,
                                                        name,
                                                    ];
                                                }
                                                if (name === FIRST_CONTACT_LINE_LABEL) {
                                                    return [
                                                        item.payload.contactedCount > 0
                                                            ? item.payload.tiempoLabel
                                                            : 'Sin contactos en la cohorte',
                                                        name,
                                                    ];
                                                }
                                                return [value, name];
                                            }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                        <Bar yAxisId="count" dataKey="Contactados" name="Registros contactados" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                        <Bar yAxisId="count" dataKey="Contratados" name={HIRED_METRIC_KEY} fill={HIRED_METRIC_COLOR} radius={[4, 4, 0, 0]} />
                                        <Line
                                            yAxisId="time"
                                            type="monotone"
                                            dataKey="tiempoHoras"
                                            name={FIRST_CONTACT_LINE_LABEL}
                                            stroke="#2563eb"
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                            connectNulls
                                        />
                                    </ComposedChart>
                                </ChartContainer>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <ChartContainer
                                    title="Resultado de llamadas con respuesta"
                                    description={CONTACTOLOGY_DEFS.resultadoLlamadas}
                                    hasData={contactologyAdvanced.effectiveCallOutcomeBreakdown.length > 0}
                                    height={260}
                                >
                                    <BarChart
                                        data={contactologyAdvanced.effectiveCallOutcomeBreakdown}
                                        layout="vertical"
                                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                                        <Tooltip formatter={(value: number) => [`${value} llamada${value !== 1 ? 's' : ''}`, 'Cantidad']} />
                                        <Bar dataKey="count" name="Cantidad" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ChartContainer>

                                <ChartContainer
                                    title="Intentos hasta lograr contacto"
                                    description={CONTACTOLOGY_DEFS.intentosHastaContactoDist}
                                    hasData={contactologyAdvanced.attemptsUntilResponseDistribution.length > 0}
                                    height={260}
                                >
                                    <BarChart
                                        data={contactologyAdvanced.attemptsUntilResponseDistribution}
                                        margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip formatter={(value: number) => [`${value} candidato${value !== 1 ? 's' : ''}`, 'Cantidad']} />
                                        <Bar dataKey="count" name="Candidatos" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ChartContainer>
                            </div>
                        </div>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                <div className="mb-4">
                    <h2 className="text-xl font-semibold text-gray-800 mb-1">Generación de registros</h2>
                    <p className="text-sm text-gray-500">
                        Tiempos y franjas horarias de creación de candidatos según el filtro de postulación actual
                        ({filteredCandidates.length} registro{filteredCandidates.length !== 1 ? 's' : ''} en alcance).
                    </p>
                </div>

                {registrationCreationStats.totalWithTimestamp === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">
                        Sin fechas de creación disponibles para los candidatos del filtro actual.
                    </p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                            <StatCard
                                icon={Users}
                                title="Origen de los registros"
                                value={`${registrationCreationStats.formSubmissionCount} formulario · ${registrationCreationStats.atsManualCount} ATS`}
                                subtitle={
                                    registrationCreationStats.avgFormToRecordMinutes !== null
                                        ? `Sincronización Tally→ATS: ${registrationCreationStats.avgFormToRecordLabel} (${registrationCreationStats.formToRecordSampleCount} caso${registrationCreationStats.formToRecordSampleCount !== 1 ? 's' : ''})`
                                        : registrationCreationStats.formSubmissionCount === 0
                                            ? 'Sin postulaciones Tally en este filtro — no aplica latencia'
                                            : 'Hay formularios Tally pero faltan fechas para latencia'
                                }
                                definition={REGISTRATION_DEFS.origenRegistros}
                                color="bg-violet-500"
                            />
                            <StatCard
                                icon={TrendingUp}
                                title="Intervalo entre altas"
                                value={registrationCreationStats.avgIntervalBetweenRecordsLabel}
                                subtitle="Tiempo promedio entre registros consecutivos según fecha de alta"
                                definition={REGISTRATION_DEFS.intervaloAltas}
                                color="bg-sky-500"
                            />
                            <StatCard
                                icon={Calendar}
                                title="Franja con más postulaciones"
                                value={registrationCreationStats.peakFormTimeBand?.label ?? 'N/D'}
                                subtitle={
                                    registrationCreationStats.peakFormTimeBand
                                        ? `${registrationCreationStats.peakFormTimeBand.count} por formulario · hora Lima`
                                        : registrationCreationStats.formSubmissionCount === 0
                                            ? 'Sin postulaciones por formulario en el filtro'
                                            : 'Sin datos'
                                }
                                definition={REGISTRATION_DEFS.franjaMayor}
                                color="bg-teal-500"
                            />
                        </div>

                        <ChartContainer
                            title="Registros por franja horaria"
                            description={REGISTRATION_DEFS.graficoFranjas}
                            hasData={registrationTimeBandChart.some(
                                b => b.formCount > 0 || b.manualCount > 0 || b.hiredCount > 0
                            )}
                            height={280}
                        >
                            <BarChart
                                data={registrationTimeBandChart}
                                margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                <YAxis allowDecimals={false} />
                                <Tooltip
                                    formatter={(value: number, name: string, item) => {
                                        const payload = item.payload as {
                                            formPct?: number;
                                            manualPct?: number;
                                        };
                                        if (name === HIRED_METRIC_KEY) {
                                            return [`${value} contratación${value !== 1 ? 'es' : ''} en esta franja (fecha de contrato)`, name];
                                        }
                                        const pct =
                                            name === 'Formulario'
                                                ? payload.formPct
                                                : payload.manualPct;
                                        return [
                                            `${value} registro${value !== 1 ? 's' : ''}${pct != null ? ` (${pct}%)` : ''}`,
                                            name,
                                        ];
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="formCount" name="Formulario" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="manualCount" name="Manual (ATS)" fill="#64748b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="hiredCount" name={HIRED_METRIC_KEY} fill={HIRED_METRIC_COLOR} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ChartContainer>
                    </>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800 mb-1">Agendamiento de citas</h2>
                        <p className="text-sm text-gray-500">
                            Cuenta agendas, reagendas y asistencias. Incluye la columna Próxima entrevista, el icono verde
                            de asistencia y columnas personalizadas clasificadas como «Asistencia a cita» o «Fecha de cita».
                        </p>
                    </div>
                    <p className="text-xs text-gray-400 shrink-0">{schedulingStats.periodLabel}</p>
                </div>

                {schedulingStatsLoading ? (
                    <p className="text-sm text-gray-500 py-6 text-center">Cargando datos de agendamiento…</p>
                ) : schedulingStats.totalSchedulingActions === 0 &&
                  schedulingStats.funnel.uniqueAttended === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">
                        Sin agendas registradas en {schedulingStats.periodLabel.toLowerCase()}.
                        Ejecute la migración SQL de seguimiento de citas si acaba de desplegar esta función.
                    </p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <StatCard
                                icon={Calendar}
                                title="Total agendas + reagendas"
                                value={String(schedulingStats.totalSchedulingActions)}
                                subtitle={`${schedulingStats.totalReschedules} reagenda${schedulingStats.totalReschedules !== 1 ? 's' : ''}`}
                                definition={SCHEDULING_DEFS.totalAgendas}
                                color="bg-sky-500"
                            />
                            <StatCard
                                icon={UserCheck}
                                title="Citas con asistencia"
                                value={String(schedulingStats.totalAttended)}
                                subtitle={`${schedulingStats.openCycles} ciclo${schedulingStats.openCycles !== 1 ? 's' : ''} abierto${schedulingStats.openCycles !== 1 ? 's' : ''}`}
                                definition={SCHEDULING_DEFS.citasAsistencia}
                                color="bg-emerald-500"
                            />
                            <StatCard
                                icon={TrendingUp}
                                title="Promedio hasta asistir"
                                value={
                                    schedulingStats.avgActionsUntilAttendance !== null
                                        ? String(schedulingStats.avgActionsUntilAttendance)
                                        : 'N/D'
                                }
                                subtitle="Acciones (agenda + reagendas) por candidato que asistió"
                                definition={SCHEDULING_DEFS.promedioHastaAsistir}
                                color="bg-amber-500"
                            />
                            <StatCard
                                icon={Headphones}
                                title="Quién más agenda"
                                value={schedulingStats.topScheduler?.userName ?? 'N/D'}
                                subtitle={
                                    schedulingStats.topScheduler
                                        ? `${schedulingStats.topScheduler.count} acción${schedulingStats.topScheduler.count !== 1 ? 'es' : ''}`
                                        : 'Sin datos'
                                }
                                definition={SCHEDULING_DEFS.quienMasAgenda}
                                color="bg-violet-500"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <StatCard
                                icon={UserCheck}
                                title="Tasa de asistencia"
                                value={
                                    schedulingStats.funnel.attendanceRatePct !== null
                                        ? `${schedulingStats.funnel.attendanceRatePct}%`
                                        : 'N/D'
                                }
                                subtitle={`${schedulingStats.funnel.uniqueAttended} asistieron de ${schedulingStats.funnel.uniqueScheduled} agendados (únicos)`}
                                definition={SCHEDULING_DEFS.tasaAsistencia}
                                color="bg-emerald-500"
                            />
                            <StatCard
                                icon={CheckCircle}
                                title="Contratados tras asistir"
                                value={
                                    schedulingStats.funnel.hireRateFromAttendedPct !== null
                                        ? `${schedulingStats.funnel.hireRateFromAttendedPct}%`
                                        : 'N/D'
                                }
                                subtitle={`${schedulingStats.funnel.uniqueHiredAmongAttended} contratados de ${schedulingStats.funnel.uniqueAttended} que asistieron`}
                                definition={SCHEDULING_DEFS.contratadosTrasAsistir}
                                color="bg-teal-500"
                            />
                            <StatCard
                                icon={Clock}
                                title="Días agenda → asistencia"
                                value={
                                    schedulingStats.funnel.avgDaysScheduleToAttendance !== null
                                        ? `${schedulingStats.funnel.avgDaysScheduleToAttendance} d`
                                        : 'N/D'
                                }
                                subtitle="Promedio desde la primera agenda hasta marcar asistencia"
                                definition={SCHEDULING_DEFS.diasAgendaAsistencia}
                                color="bg-amber-500"
                            />
                            <StatCard
                                icon={TrendingUp}
                                title="Días agenda → contratación"
                                value={
                                    schedulingStats.funnel.avgDaysScheduleToHire !== null
                                        ? `${schedulingStats.funnel.avgDaysScheduleToHire} d`
                                        : 'N/D'
                                }
                                subtitle={
                                    schedulingStats.funnel.avgDaysAttendanceToHire !== null
                                        ? `Incl. ${schedulingStats.funnel.avgDaysAttendanceToHire} d prom. desde asistencia`
                                        : 'Promedio hasta contratación entre agendados'
                                }
                                definition={SCHEDULING_DEFS.diasAgendaContratacion}
                                color="bg-violet-500"
                            />
                        </div>

                        {schedulingEffectiveness.totals.total > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                                <ChartContainer
                                    title="Efectividad de las agendas"
                                    description={SCHEDULING_DEFS.efectividadAgendas}
                                    hasData={schedulingEffectiveness.pieData.length > 0}
                                    height={280}
                                >
                                    <BarChart
                                        data={schedulingEffectiveness.pieData}
                                        layout="vertical"
                                        margin={{ top: 10, right: 24, left: 8, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                                        <Tooltip
                                            formatter={(value: number, _name, item) => {
                                                const pct = schedulingEffectiveness.totals.total
                                                    ? Math.round((value / schedulingEffectiveness.totals.total) * 1000) / 10
                                                    : 0;
                                                return [`${value} candidato${value !== 1 ? 's' : ''} (${pct}%)`, 'Cantidad'];
                                            }}
                                        />
                                        <Bar dataKey="value" name="Candidatos" radius={[0, 4, 4, 0]}>
                                            {schedulingEffectiveness.pieData.map(entry => (
                                                <Cell
                                                    key={entry.kind}
                                                    fill={SCHEDULING_OUTCOME_COLORS[entry.kind]}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>

                                <ChartContainer
                                    title="Efectividad por quien agenda"
                                    description={SCHEDULING_DEFS.efectividadPorUsuario}
                                    hasData={schedulingEffectiveness.byScheduler.length > 0}
                                    height={Math.max(280, schedulingEffectiveness.byScheduler.length * 40)}
                                >
                                    <BarChart
                                        data={schedulingEffectiveness.byScheduler}
                                        layout="vertical"
                                        margin={{ top: 10, right: 24, left: 8, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" allowDecimals={false} />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            width={110}
                                            tick={{ fontSize: 10 }}
                                            tickFormatter={(v: string) => truncateLabel(v, 16)}
                                        />
                                        <Tooltip
                                            formatter={(value: number, name: string) => {
                                                const labels: Record<string, string> = {
                                                    effective: SCHEDULING_OUTCOME_LABELS.effective,
                                                    notEffective: SCHEDULING_OUTCOME_LABELS.not_effective,
                                                    noData: SCHEDULING_OUTCOME_LABELS.no_data,
                                                };
                                                return [`${value}`, labels[name] ?? name];
                                            }}
                                        />
                                        <Legend />
                                        <Bar
                                            stackId="outcome"
                                            dataKey="effective"
                                            name={SCHEDULING_OUTCOME_LABELS.effective}
                                            fill={SCHEDULING_OUTCOME_COLORS.effective}
                                        />
                                        <Bar
                                            stackId="outcome"
                                            dataKey="notEffective"
                                            name={SCHEDULING_OUTCOME_LABELS.not_effective}
                                            fill={SCHEDULING_OUTCOME_COLORS.not_effective}
                                        />
                                        <Bar
                                            stackId="outcome"
                                            dataKey="noData"
                                            name={SCHEDULING_OUTCOME_LABELS.no_data}
                                            fill={SCHEDULING_OUTCOME_COLORS.no_data}
                                            radius={[0, 4, 4, 0]}
                                        />
                                    </BarChart>
                                </ChartContainer>
                            </div>
                        )}

                        {schedulingStats.dailyTrend.some(
                            d => d.agendas > 0 || d.asistencias > 0 || d.contratados > 0
                        ) && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                                <ChartContainer
                                    title="Evolución diaria de agendas"
                                    description={SCHEDULING_DEFS.evolucionAgendas}
                                    hasData={schedulingStats.dailyTrend.some(d => d.agendas > 0)}
                                    height={280}
                                >
                                    <BarChart
                                        data={schedulingStats.dailyTrend}
                                        margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="label"
                                            tick={{ fontSize: 9 }}
                                            interval={contactConsultantPeriod === 'year' ? 0 : 'preserveStartEnd'}
                                        />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip
                                            formatter={(value: number) => [
                                                `${value} acción${value !== 1 ? 'es' : ''}`,
                                                'Agendas + reagendas',
                                            ]}
                                        />
                                        <Bar dataKey="agendas" name="Agendas + reagendas" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ChartContainer>

                                <ChartContainer
                                    title="Asistencias vs contratados por día"
                                    description={SCHEDULING_DEFS.asistenciasVsContratados}
                                    hasData={schedulingStats.dailyTrend.some(
                                        d => d.asistencias > 0 || d.contratados > 0
                                    )}
                                    height={280}
                                >
                                    <BarChart
                                        data={schedulingStats.dailyTrend}
                                        margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="label"
                                            tick={{ fontSize: 9 }}
                                            interval={contactConsultantPeriod === 'year' ? 0 : 'preserveStartEnd'}
                                        />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="asistencias" name="Asistencias" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="contratados" name={HIRED_METRIC_KEY} fill={HIRED_METRIC_COLOR} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ChartContainer>
                            </div>
                        )}

                        {(schedulingStats.funnel.uniqueScheduled > 0 ||
                            schedulingStats.funnel.uniqueAttended > 0) && (
                            <ChartContainer
                                title="Embudo: agendados → asistieron → contratados"
                                description={SCHEDULING_DEFS.embudo}
                                hasData
                                height={260}
                                className="mb-6"
                            >
                                <BarChart
                                    data={[
                                        {
                                            name: 'Agendados',
                                            cantidad: schedulingStats.funnel.uniqueScheduled,
                                        },
                                        {
                                            name: 'Asistieron',
                                            cantidad: schedulingStats.funnel.uniqueAttended,
                                        },
                                        {
                                            name: 'Contratados',
                                            cantidad: schedulingStats.funnel.uniqueHiredAmongScheduled,
                                        },
                                    ]}
                                    margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip
                                        formatter={(value: number) => [
                                            `${value} candidato${value !== 1 ? 's' : ''}`,
                                            'Cantidad',
                                        ]}
                                    />
                                    <Bar dataKey="cantidad" name="Candidatos únicos" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ChartContainer>
                        )}

                        {schedulingStats.schedulerRankings.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">Por quien agenda / reagenda</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-gray-500 border-b">
                                                <th className="py-2 pr-4">Trabajador</th>
                                                <th className="py-2 pr-4">Agendas + reagendas</th>
                                                <th className="py-2">Reagendas</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {schedulingStats.schedulerRankings.slice(0, 10).map(row => (
                                                <tr key={row.name} className="border-b border-gray-100">
                                                    <td className="py-2 pr-4 font-medium text-gray-800">{row.name}</td>
                                                    <td className="py-2 pr-4">{row.agendas}</td>
                                                    <td className="py-2">{row.reagendas}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {schedulingStats.interviewerRankings.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">Por entrevistador asignado</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-gray-500 border-b">
                                                <th className="py-2 pr-4">Entrevistador</th>
                                                <th className="py-2 pr-4">Agendas + reagendas</th>
                                                <th className="py-2">Reagendas</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {schedulingStats.interviewerRankings.slice(0, 10).map(row => (
                                                <tr key={row.name} className="border-b border-gray-100">
                                                    <td className="py-2 pr-4 font-medium text-gray-800">{row.name}</td>
                                                    <td className="py-2 pr-4">{row.agendas}</td>
                                                    <td className="py-2">{row.reagendas}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-1">Ingresos a contratación</h2>
                <p className="text-sm text-gray-500 mb-4">
                    Usuarios del equipo que movieron candidatos a la etapa de contratación (etapa «Contratado» o la última del pipeline), según historial de etapas o etapa actual en procesos masivos.
                </p>

                {hiringConsultantStats.totalHires === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">
                        Sin ingresos registrados a la etapa final para los candidatos del filtro actual.
                    </p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                            <StatCard
                                icon={UserPlus}
                                title="Usuario con más ingresos"
                                value={hiringConsultantStats.topConsultant?.userName ?? 'N/D'}
                                subtitle={
                                    hiringConsultantStats.topConsultant
                                        ? `${hiringConsultantStats.topConsultant.hires} ingreso${hiringConsultantStats.topConsultant.hires !== 1 ? 's' : ''} a contratación`
                                        : 'Sin datos'
                                }
                                color="bg-indigo-500"
                            />
                            <StatCard
                                icon={TrendingUp}
                                title="Participación del líder"
                                value={
                                    hiringConsultantStats.topConsultant
                                        ? `${hiringConsultantStats.topConsultant.sharePct}%`
                                        : 'N/D'
                                }
                                subtitle={
                                    hiringConsultantStats.topConsultant
                                        ? `Del total de ${hiringConsultantStats.totalHires} ingreso${hiringConsultantStats.totalHires !== 1 ? 's' : ''} en el filtro`
                                        : 'Sin ingresos en el filtro'
                                }
                                color="bg-teal-500"
                            />
                            <StatCard
                                icon={CheckCircle}
                                title="Total ingresos"
                                value={hiringConsultantStats.totalHires}
                                subtitle="Candidatos movidos a la etapa final del proceso"
                                color="bg-blue-500"
                            />
                            <StatCard
                                icon={Users}
                                title="Usuarios activos"
                                value={hiringConsultantStats.rankings.length}
                                subtitle="Consultores y administrador con al menos un ingreso"
                                color="bg-violet-500"
                            />
                        </div>

                        <ChartContainer
                            title="Ingresos por usuario"
                            description="Candidatos que cada consultor o administrador movió a la etapa de contratación."
                            hasData={hiringConsultantStats.rankings.length > 0}
                            height={Math.max(280, hiringConsultantStats.rankings.length * 44)}
                        >
                            <BarChart
                                data={hiringConsultantStats.rankings}
                                layout="vertical"
                                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" allowDecimals={false} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={120}
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={(v: string) => truncateLabel(v, 18)}
                                />
                                <Tooltip
                                    formatter={(value: number, _name, item) => [
                                        `${value} ingreso${value !== 1 ? 's' : ''} (${item.payload.share}% del total)`,
                                        'Contratación',
                                    ]}
                                />
                                <Bar dataKey="ingresos" name="Ingresos" fill="#6366f1" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ChartContainer>
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 min-w-0">
                <ChartContainer
                    title="Candidatos por etapa"
                    description={
                        (processFilter !== 'all'
                            ? 'Distribución actual según el pipeline del proceso seleccionado.'
                            : 'Agrupado por nombre de etapa. Al filtrar un proceso se respeta el orden del pipeline.') +
                        ` ${HIRED_CHART_HINT}`
                    }
                    hasData={candidatesByStageChart.some(d => d.Candidatos > 0 || d.Contratados > 0)}
                    height={stageChartHeight}
                >
                    <BarChart data={candidatesByStageChart} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                        <Tooltip
                            formatter={(value: number, name: string) => [
                                `${value} candidato${value !== 1 ? 's' : ''}`,
                                name,
                            ]}
                        />
                        <Legend />
                        <Bar dataKey="Candidatos" name="Total" fill="#6366f1" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="Contratados" name={HIRED_METRIC_KEY} fill={HIRED_METRIC_COLOR} radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ChartContainer>

                <ChartContainer
                    title={getLabel('dashboard_candidate_source', 'Fuentes de candidatos')}
                    description={`Origen de postulación. ${HIRED_CHART_HINT}`}
                    hasData={candidateSourcesChart.length > 0}
                >
                    <BarChart data={candidateSourcesChart} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip
                            formatter={(value: number, name: string) => [
                                `${value} candidato${value !== 1 ? 's' : ''}`,
                                name === 'value' ? 'Total' : name,
                            ]}
                        />
                        <Legend />
                        <Bar dataKey="value" name="Total" fill="#8884d8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Contratados" name={HIRED_METRIC_KEY} fill={HIRED_METRIC_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ChartContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 min-w-0">
                <ChartContainer
                    title="Candidatos por puesto"
                    description={`Cantidad de candidatos según el proceso o puesto. ${HIRED_CHART_HINT}`}
                    hasData={candidatesByPositionChart.some(d => d.Candidatos > 0 || d.Contratados > 0)}
                    height={Math.max(280, candidatesByPositionChart.length * 44)}
                >
                    <BarChart data={candidatesByPositionChart} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis
                            type="category"
                            dataKey="name"
                            width={150}
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v: string) => truncateLabel(v, 22)}
                        />
                        <Tooltip
                            formatter={(value: number, name: string) => [
                                `${value} candidato${value !== 1 ? 's' : ''}`,
                                name,
                            ]}
                        />
                        <Legend />
                        <Bar dataKey="Candidatos" name="Total" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="Contratados" name={HIRED_METRIC_KEY} fill={HIRED_METRIC_COLOR} radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ChartContainer>

                <ChartContainer
                    title={getLabel('dashboard_age_distribution', 'Distribución por edad')}
                    description={`Rangos etarios. ${HIRED_CHART_HINT}`}
                    hasData={ageDistributionChart.some(d => d.Candidatos > 0 || d.Contratados > 0)}
                >
                    <BarChart data={ageDistributionChart} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip
                            formatter={(value: number, name: string) => [
                                `${value} candidato${value !== 1 ? 's' : ''}`,
                                name,
                            ]}
                        />
                        <Legend />
                        <Bar dataKey="Candidatos" name="Total" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Contratados" name={HIRED_METRIC_KEY} fill={HIRED_METRIC_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ChartContainer>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 md:gap-8 mb-8 min-w-0">
                <ChartContainer
                    className="xl:col-span-2"
                    title="Candidatos por distrito"
                    description={`Distrito de residencia. ${HIRED_CHART_HINT}`}
                    hasData={candidateDistrictsChart.some(d => d.Candidatos > 0 || d.Contratados > 0)}
                    height={Math.max(420, candidateDistrictsChart.length * 36)}
                >
                    <BarChart data={candidateDistrictsChart} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                        <Tooltip
                            formatter={(value: number, name: string) => [
                                `${value} candidato${value !== 1 ? 's' : ''}`,
                                name,
                            ]}
                        />
                        <Legend />
                        <Bar dataKey="Candidatos" name="Total" fill="#9333ea" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="Contratados" name={HIRED_METRIC_KEY} fill={HIRED_METRIC_COLOR} radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ChartContainer>

                <ChartContainer
                    className="xl:col-span-3"
                    title="Mapa de candidatos (Lima y Callao)"
                    description="Zona limítrofe por distrito con zoom. Rueda del ratón o botones +/−; arrastre para desplazar; ícono de expandir para pantalla completa."
                    hasData={[...candidateDistrictCounts.entries()].some(
                        ([name, n]) => n > 0 && name !== 'Sin distrito' && name !== 'Otros'
                    )}
                    height={520}
                    fillContent
                >
                    <LimaDistrictMap countsByLabel={candidateDistrictCounts} height={500} />
                </ChartContainer>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-1">Perfil promedio del contratado</h2>
                <p className="text-sm text-gray-500 mb-6">{HIRED_PROFILE_DEF}</p>

                {hiredProfileSummary.totalHired === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">
                        Sin contratados en el filtro actual para calcular el perfil promedio.
                    </p>
                ) : (
                    <div className="space-y-8">
                        {(
                            ['demografia', 'origen', 'proceso', 'tiempos', 'citas'] as const
                        ).map(group => {
                            const items = hiredProfileSummary.indicators.filter(i => i.group === group);
                            if (items.length === 0) return null;
                            return (
                                <div key={group}>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                                        {HIRED_PROFILE_GROUP_LABELS[group]}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {items.map(ind => (
                                            <StatCard
                                                key={ind.id}
                                                icon={CheckCircle}
                                                title={ind.label}
                                                value={ind.value}
                                                subtitle={ind.detail ?? ''}
                                                color="bg-teal-500"
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 min-w-0">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-2">
                    <h2 className="text-xl font-semibold text-gray-800 mb-1 flex items-center">
                        <Calendar className="w-5 h-5 mr-2 text-primary-500" />
                        {getLabel('dashboard_upcoming_interviews', 'Próximas entrevistas')}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">Entrevistas programadas de candidatos incluidos en el filtro actual.</p>
                    <div className="space-y-3">
                        {upcomingInterviews.length > 0 ? (
                            upcomingInterviews.map(event => {
                                const candidate = analyticsCandidates.find(c => c.id === event.candidateId);
                                const process = candidate ? processMap.get(candidate.processId) : undefined;
                                const interviewer = users.find(u => u.id === event.interviewerId);
                                return (
                                    <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="min-w-0">
                                            <p className="font-medium text-gray-900 truncate">{candidate?.name || 'Candidato desconocido'}</p>
                                            <p className="text-sm text-gray-500 truncate">
                                                {process?.title || 'Sin proceso'} · con {interviewer?.name || 'Entrevistador'}
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-4">
                                            <p className="text-sm font-medium text-gray-700">
                                                {event.start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-center text-gray-500 py-8">No hay entrevistas próximas para los candidatos filtrados.</p>
                        )}
                    </div>
                </div>
            </div>

            {(processScopeFilter === 'bulk' || bulkCandidates > 0) && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
                    <Grid3x3 className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-indigo-900">Procesos masivos incluidos en el análisis</p>
                        <p className="text-xs text-indigo-700 mt-1">
                            {bulkCandidates} candidato{bulkCandidates !== 1 ? 's' : ''} de procesos masivos en el filtro actual.
                            Fuente, distrito y edad usan columnas personalizadas: edite cada columna y elija «Clasificación para el Panel» si los gráficos salen vacíos o agrupados en «Otro».
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
