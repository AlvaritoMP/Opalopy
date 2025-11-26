import React, { useState, useMemo } from 'react';
import { useAppState } from '../App';
import { Briefcase, Users, FileText, CheckCircle, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, CartesianGrid, XAxis, YAxis, Bar } from 'recharts';

const StatCard: React.FC<{
    icon: React.ElementType;
    title: string;
    value: number | string;
    color: string;
}> = ({ icon: Icon, title, value, color }) => (
    <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-200 shadow-sm flex items-center">
        <div className={`p-2 md:p-3 rounded-full mr-3 md:mr-4 flex-shrink-0 ${color}`}>
            <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </div>
        <div className="min-w-0">
            <p className="text-xs md:text-sm text-gray-500 truncate">{title}</p>
            <p className="text-xl md:text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const ChartContainer: React.FC<{title: string, children: React.ReactNode, hasData: boolean, className?: string}> = ({title, children, hasData, className=""}) => (
    <div className={`bg-white p-4 md:p-6 rounded-xl border border-gray-200 shadow-sm ${className}`}>
        <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3 md:mb-4">{title}</h2>
        {hasData ? (
            <ResponsiveContainer width="100%" height={250}>
                {children}
            </ResponsiveContainer>
        ) : (
             <div className="flex items-center justify-center h-[250px] text-gray-500 text-sm md:text-base">Sin datos para los filtros seleccionados.</div>
        )}
    </div>
);

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

const translateSource = (source: string) => {
    switch (source.toLowerCase()) {
        case 'linkedin': return 'LinkedIn';
        case 'referral': return 'Referido';
        case 'website': return 'Sitio web';
        case 'other': return 'Otro';
        default: return source;
    }
};

export const Dashboard: React.FC = () => {
    const { state, getLabel } = useAppState();
    const { processes, candidates: allCandidates, applications, interviewEvents, users } = state;

    const [processFilter, setProcessFilter] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });

    const filteredCandidates = useMemo(() => {
        const userRole = state.currentUser?.role;
        const isClientOrViewer = userRole === 'client' || userRole === 'viewer';
        
        return allCandidates.filter(candidate => {
            // Filtrar por visibilidad según el rol
            if (isClientOrViewer && !candidate.visibleToClients) return false;
            
            const processMatch = processFilter === 'all' || candidate.processId === processFilter;
            
            const applicationDate = new Date(candidate.history[0]?.movedAt);
            const startDate = dateFilter.start ? new Date(dateFilter.start) : null;
            const endDate = dateFilter.end ? new Date(dateFilter.end) : null;
            if(startDate) startDate.setHours(0,0,0,0);
            if(endDate) endDate.setHours(23,59,59,999);

            const dateMatch = (!startDate || applicationDate >= startDate) && (!endDate || applicationDate <= endDate);

            return processMatch && dateMatch;
        });
    }, [allCandidates, processFilter, dateFilter, state.currentUser?.role]);

    const totalCandidates = filteredCandidates.length;
    const totalProcesses = processes.length; // This stat is not filtered
    const totalApplications = applications.length; // This stat is not filtered
    
    const hiredCandidates = filteredCandidates.filter(c => {
        const process = processes.find(p => p.id === c.processId);
        if (!process || process.stages.length === 0) return false;
        const lastStageId = process.stages[process.stages.length - 1].id;
        return c.stageId === lastStageId;
    }).length;

    const candidateSources = useMemo(() => {
        const sourceMap = new Map<string, number>();
        filteredCandidates.forEach(c => {
            const source = translateSource(c.source || 'Other');
            sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
        });
        return Array.from(sourceMap, ([name, value]) => ({ name, value }));
    }, [filteredCandidates]);
    
    const candidateLocations = useMemo(() => {
        const locationMap = new Map<string, number>();
        filteredCandidates.forEach(c => {
            if (c.address) {
                locationMap.set(c.address, (locationMap.get(c.address) || 0) + 1);
            }
        });
        return Array.from(locationMap, ([name, value]) => ({ name, Candidatos: value }));
    }, [filteredCandidates]);
    
    const ageDistribution = useMemo(() => {
        const ageBrackets = { '20-29': 0, '30-39': 0, '40-49': 0, '50+': 0, 'Unknown': 0 };
        filteredCandidates.forEach(c => {
            if (c.age) {
                if (c.age >= 20 && c.age <= 29) ageBrackets['20-29']++;
                else if (c.age >= 30 && c.age <= 39) ageBrackets['30-39']++;
                else if (c.age >= 40 && c.age <= 49) ageBrackets['40-49']++;
                else if (c.age >= 50) ageBrackets['50+']++;
                else ageBrackets['Unknown']++;
            } else {
                 ageBrackets['Unknown']++;
            }
        });
        return Object.entries(ageBrackets).map(([name, value]) => ({ name, Candidatos: value }));
    }, [filteredCandidates]);

    const upcomingInterviews = useMemo(() => {
        const now = new Date();
        return interviewEvents
            .filter(event => event.start > now)
            .sort((a, b) => a.start.getTime() - b.start.getTime())
            .slice(0, 4);
    }, [interviewEvents]);

    // Indicadores de Eficiencia
    const timeToHire = useMemo(() => {
        const hiredCandidatesWithDates = filteredCandidates
            .filter(c => {
                const process = processes.find(p => p.id === c.processId);
                if (!process || !process.stages || process.stages.length === 0) return false;
                const lastStageId = process.stages[process.stages.length - 1]?.id;
                return c.stageId === lastStageId && (c.offerAcceptedDate || c.hireDate);
            })
            .map(c => {
                const process = processes.find(p => p.id === c.processId);
                const publishedDate = process?.publishedDate || process?.startDate;
                const acceptedDate = c.offerAcceptedDate || c.hireDate;
                
                if (!publishedDate || !acceptedDate) return null;
                
                const published = new Date(publishedDate);
                const accepted = new Date(acceptedDate);
                const days = Math.ceil((accepted.getTime() - published.getTime()) / (1000 * 60 * 60 * 24));
                return days >= 0 ? days : null;
            })
            .filter((days): days is number => days !== null);
        
        if (hiredCandidatesWithDates.length === 0) return null;
        const average = hiredCandidatesWithDates.reduce((sum, days) => sum + days, 0) / hiredCandidatesWithDates.length;
        return Math.round(average * 10) / 10; // Redondear a 1 decimal
    }, [filteredCandidates, processes]);

    const timeToFill = useMemo(() => {
        const filledProcesses = processes
            .filter(p => {
                if (!p.needIdentifiedDate) return false;
                const processCandidates = filteredCandidates.filter(c => c.processId === p.id);
                if (!p.stages || p.stages.length === 0) return false;
                const lastStageId = p.stages[p.stages.length - 1]?.id;
                const hiredCount = processCandidates.filter(c => c.stageId === lastStageId).length;
                return hiredCount >= p.vacancies;
            })
            .map(p => {
                const processCandidates = filteredCandidates.filter(c => c.processId === p.id);
                if (!p.stages || p.stages.length === 0) return null;
                const lastStageId = p.stages[p.stages.length - 1]?.id;
                const lastHired = processCandidates
                    .filter(c => c.stageId === lastStageId)
                    .sort((a, b) => {
                        const dateA = a.offerAcceptedDate || a.hireDate || '';
                        const dateB = b.offerAcceptedDate || b.hireDate || '';
                        return dateB.localeCompare(dateA);
                    })[0];
                
                if (!lastHired || !p.needIdentifiedDate) return null;
                
                const needDate = new Date(p.needIdentifiedDate);
                const fillDate = new Date(lastHired.offerAcceptedDate || lastHired.hireDate || '');
                const days = Math.ceil((fillDate.getTime() - needDate.getTime()) / (1000 * 60 * 60 * 24));
                return days >= 0 ? days : null;
            })
            .filter((days): days is number => days !== null);
        
        if (filledProcesses.length === 0) return null;
        const average = filledProcesses.reduce((sum, days) => sum + days, 0) / filledProcesses.length;
        return Math.round(average * 10) / 10;
    }, [filteredCandidates, processes]);

    const stageDuration = useMemo(() => {
        const stageDurations: { [stageId: string]: number[] } = {};
        
        filteredCandidates.forEach(candidate => {
            if (!candidate.history || candidate.history.length < 2) return;
            
            for (let i = 1; i < candidate.history.length; i++) {
                const prevStage = candidate.history[i - 1];
                const currentStage = candidate.history[i];
                
                const prevDate = new Date(prevStage.movedAt);
                const currentDate = new Date(currentStage.movedAt);
                const days = Math.ceil((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (days >= 0) {
                    if (!stageDurations[prevStage.stageId]) {
                        stageDurations[prevStage.stageId] = [];
                    }
                    stageDurations[prevStage.stageId].push(days);
                }
            }
        });
        
        const averages: { stageName: string; averageDays: number }[] = [];
        processes.forEach(process => {
            if (!process.stages) return;
            process.stages.forEach(stage => {
                const durations = stageDurations[stage.id];
                if (durations && durations.length > 0) {
                    const average = durations.reduce((sum, days) => sum + days, 0) / durations.length;
                    averages.push({
                        stageName: stage.name,
                        averageDays: Math.round(average * 10) / 10
                    });
                }
            });
        });
        
        return averages;
    }, [filteredCandidates, processes]);

    const applicationCompletionRate = useMemo(() => {
        const started = filteredCandidates.filter(c => c.applicationStartedDate).length;
        const completed = filteredCandidates.filter(c => c.applicationCompletedDate).length;
        
        if (started === 0) return null;
        const rate = (completed / started) * 100;
        return Math.round(rate * 10) / 10;
    }, [filteredCandidates]);




    return (
        <div className="p-4 md:p-8 bg-gray-50/50 min-h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-4 md:mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{getLabel('sidebar_dashboard', 'Panel')}</h1>
            </div>
            
            {/* Filters */}
            <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-200 shadow-sm mb-6 md:mb-8 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 md:space-x-4">
                <div>
                    <label htmlFor="processFilter" className="text-sm font-medium text-gray-700">Filtrar por proceso:</label>
                    <select 
                        id="processFilter"
                        value={processFilter}
                        onChange={(e) => setProcessFilter(e.target.value)}
                        className="ml-2 border-gray-300 rounded-md shadow-sm"
                    >
                        <option value="all">Todos los procesos</option>
                        {processes.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="startDate" className="text-sm font-medium text-gray-700">Desde:</label>
                    <input 
                        type="date" 
                        id="startDate"
                        value={dateFilter.start}
                        onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                        className="ml-2 border-gray-300 rounded-md shadow-sm"
                    />
                </div>
                 <div>
                    <label htmlFor="endDate" className="text-sm font-medium text-gray-700">Hasta:</label>
                    <input 
                        type="date" 
                        id="endDate"
                        value={dateFilter.end}
                        onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                        className="ml-2 border-gray-300 rounded-md shadow-sm"
                    />
                </div>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard icon={Briefcase} title="Procesos activos" value={totalProcesses} color="bg-blue-500" />
                <StatCard icon={Users} title="Candidatos filtrados" value={totalCandidates} color="bg-green-500" />
                <StatCard icon={FileText} title="Aplicaciones totales" value={totalApplications} color="bg-purple-500" />
                <StatCard icon={CheckCircle} title="Contratados filtrados" value={hiredCandidates} color="bg-teal-500" />
            </div>

            {/* Indicadores de Eficiencia */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Indicadores de Eficiencia</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h3 className="text-sm font-medium text-blue-800 mb-1">Time to Hire</h3>
                        <p className="text-2xl font-bold text-blue-900">
                            {timeToHire !== null ? `${timeToHire} días` : 'N/D'}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">Promedio desde publicación hasta aceptación</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h3 className="text-sm font-medium text-green-800 mb-1">Time to Fill</h3>
                        <p className="text-2xl font-bold text-green-900">
                            {timeToFill !== null ? `${timeToFill} días` : 'N/D'}
                        </p>
                        <p className="text-xs text-green-600 mt-1">Promedio desde necesidad hasta llenado</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <h3 className="text-sm font-medium text-purple-800 mb-1">Tasa de Finalización</h3>
                        <p className="text-2xl font-bold text-purple-900">
                            {applicationCompletionRate !== null ? `${applicationCompletionRate}%` : 'N/D'}
                        </p>
                        <p className="text-xs text-purple-600 mt-1">% de solicitudes completadas</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <h3 className="text-sm font-medium text-orange-800 mb-1">Etapas con datos</h3>
                        <p className="text-2xl font-bold text-orange-900">
                            {stageDuration.length}
                        </p>
                        <p className="text-xs text-orange-600 mt-1">Etapas con duración calculada</p>
                    </div>
                </div>
                
                {/* Duración por Etapa */}
                {stageDuration.length > 0 && (
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Duración Promedio por Etapa</h3>
                        <div className="space-y-2">
                            {stageDuration.map((stage, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="font-medium text-gray-700">{stage.stageName}</span>
                                    <span className="text-lg font-bold text-gray-900">{stage.averageDays} días</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                 <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">{getLabel('dashboard_recent_candidates', 'Candidatos recientes')}</h2>
                    <div className="space-y-3">
                        {filteredCandidates.slice(-5).reverse().map(candidate => {
                            const process = processes.find(p => p.id === candidate.processId);
                            return (
                                <div key={candidate.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-900">{candidate.name}</p>
                                        <p className="text-sm text-gray-500">{process?.title || 'Sin proceso'}</p>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {candidate.history.length > 0 && new Date(candidate.history[0].movedAt).toLocaleDateString()}
                                    </span>
                                </div>
                            );
                        })}
                        {filteredCandidates.length === 0 && <p className="text-center text-gray-500 py-8">No hay candidatos recientes que coincidan con los filtros.</p>}
                    </div>
                </div>

                <ChartContainer title={getLabel('dashboard_candidate_source', 'Fuentes de candidatos')} hasData={candidateSources.length > 0} className="lg:col-span-1">
                    <PieChart>
                        <Pie
                            data={candidateSources}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                        >
                            {candidateSources.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ChartContainer>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ChartContainer title={getLabel('dashboard_candidate_locations', 'Ubicación de candidatos')} hasData={candidateLocations.length > 0}>
                    <BarChart data={candidateLocations} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={100} />
                        <Tooltip />
                        <Bar dataKey="Candidatos" fill="#8884d8" />
                    </BarChart>
                </ChartContainer>
                
                <ChartContainer title={getLabel('dashboard_age_distribution', 'Distribución por edad')} hasData={ageDistribution.some(d => d.Candidatos > 0)}>
                    <BarChart data={ageDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="Candidatos" fill="#82ca9d" />
                    </BarChart>
                </ChartContainer>
            </div>
            
            <div className="mt-8">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Calendar className="w-5 h-5 mr-3 text-primary-500" /> {getLabel('dashboard_upcoming_interviews', 'Próximas entrevistas')}</h2>
                    <div className="space-y-3">
                        {upcomingInterviews.length > 0 ? (
                            upcomingInterviews.map(event => {
                                const candidate = allCandidates.find(c => c.id === event.candidateId);
                                const interviewer = users.find(u => u.id === event.interviewerId);
                                return (
                                    <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-gray-900">{candidate?.name || 'Candidato desconocido'}</p>
                                            <p className="text-sm text-gray-500">con {interviewer?.name || 'Entrevistador desconocido'}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-4">
                                            <p className="text-sm font-medium text-gray-700">{event.start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                                            <p className="text-xs text-gray-500">{event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-center text-gray-500 py-8">No hay entrevistas próximas programadas.</p>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
};