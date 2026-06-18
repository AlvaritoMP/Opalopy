import React from 'react';
import { Target, Loader2, TrendingUp, Users } from 'lucide-react';
import { IdealProfileConfig } from '../types';
import { ProfileMatchSummary, getProfileMatchThresholds } from '../lib/bulkIdealProfileMatch';

interface Props {
    summary: ProfileMatchSummary | null;
    config?: IdealProfileConfig;
    loading?: boolean;
    /** Vista compacta dentro del modal de perfil ideal */
    compact?: boolean;
}

export const BulkIdealProfileSummaryPanel: React.FC<Props> = ({
    summary,
    config,
    loading,
    compact = false,
}) => {
    if (!config?.enabled) return null;

    const { green, yellow } = getProfileMatchThresholds(config);

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800">
                <Loader2 className="w-4 h-4 animate-spin" />
                Calculando cumplimiento de toda la base de datos…
            </div>
        );
    }

    if (!summary) return null;

    const pct = (n: number) =>
        summary.totalCandidates > 0
            ? Math.round((n / summary.totalCandidates) * 100)
            : 0;

    return (
        <div className={`border border-indigo-200 rounded-lg bg-gradient-to-r from-indigo-50 to-white overflow-hidden ${compact ? '' : ''}`}>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-indigo-100 bg-indigo-50/80">
                <Target className="w-4 h-4 text-indigo-600 shrink-0" />
                <h3 className="text-sm font-semibold text-indigo-900">
                    {compact ? 'Cumplimiento con el perfil guardado' : 'Cumplimiento vs perfil ideal — base completa'}
                </h3>
                <span className="text-xs text-indigo-600 ml-auto whitespace-nowrap">
                    {summary.totalCandidates} candidato{summary.totalCandidates !== 1 ? 's' : ''}
                </span>
            </div>

            <div className={`grid gap-2 p-3 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 md:grid-cols-5 gap-3 p-4'}`}>
                <div className={`flex flex-col items-center bg-white rounded-lg border border-gray-100 shadow-sm ${compact ? 'p-2' : 'p-3'}`}>
                    <TrendingUp className={`text-indigo-500 mb-1 ${compact ? 'w-4 h-4' : 'w-5 h-5'}`} />
                    <span className={`font-bold text-indigo-700 ${compact ? 'text-lg' : 'text-2xl'}`}>{summary.averageScore}%</span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">Promedio</span>
                </div>

                <div className={`flex flex-col items-center bg-green-50 rounded-lg border border-green-100 ${compact ? 'p-2' : 'p-3'}`}>
                    <span className={`font-bold text-green-700 ${compact ? 'text-lg' : 'text-2xl'}`}>{summary.greenCount}</span>
                    <span className="text-[10px] text-green-600 uppercase text-center">≥ {green}% ({pct(summary.greenCount)}%)</span>
                </div>

                <div className={`flex flex-col items-center bg-yellow-50 rounded-lg border border-yellow-100 ${compact ? 'p-2' : 'p-3'}`}>
                    <span className={`font-bold text-yellow-700 ${compact ? 'text-lg' : 'text-2xl'}`}>{summary.yellowCount}</span>
                    <span className="text-[10px] text-yellow-700 uppercase text-center">{yellow}–{green - 1}% ({pct(summary.yellowCount)}%)</span>
                </div>

                <div className={`flex flex-col items-center bg-red-50 rounded-lg border border-red-100 ${compact ? 'p-2' : 'p-3'}`}>
                    <span className={`font-bold text-red-700 ${compact ? 'text-lg' : 'text-2xl'}`}>{summary.redCount}</span>
                    <span className="text-[10px] text-red-600 uppercase text-center">&lt; {yellow}% ({pct(summary.redCount)}%)</span>
                </div>

                {!compact && (
                <div className="flex flex-col items-center p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                    <Users className="w-5 h-5 text-gray-400 mb-1" />
                    <span className="text-2xl font-bold text-gray-800">{summary.totalCandidates}</span>
                    <span className="text-[10px] text-gray-500 uppercase">Evaluados</span>
                </div>
                )}
            </div>

            {summary.fieldAverages.length > 0 && (
                <div className={compact ? 'px-3 pb-3' : 'px-4 pb-4'}>
                    <p className="text-xs font-medium text-gray-600 mb-2">Cumplimiento por campo (promedio)</p>
                    <div className="flex flex-wrap gap-2">
                        {summary.fieldAverages.map(f => (
                            <div
                                key={f.fieldId}
                                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs border border-gray-200 bg-white"
                                title={`${f.label}: ${f.averageScore}% de cumplimiento promedio`}
                            >
                                <span className="text-gray-700 truncate max-w-[120px]">{f.label}</span>
                                <span
                                    className="font-semibold px-1.5 py-0.5 rounded"
                                    style={{
                                        backgroundColor: `hsl(${Math.round((f.averageScore / 100) * 120)}, 72%, 90%)`,
                                        color: `hsl(${Math.round((f.averageScore / 100) * 120)}, 65%, 28%)`,
                                    }}
                                >
                                    {f.averageScore}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
