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
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center">
        <div className={`p-3 rounded-full mr-4 ${color}`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const ChartContainer: React.FC<{title: string, children: React.ReactNode, hasData: boolean, className?: string}> = ({title, children, hasData, className=""}) => (
    <div className={`bg-white p-6 rounded-xl border border-gray-200 shadow-sm ${className}`}>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">{title}</h2>
        {hasData ? (
            <ResponsiveContainer width="100%" height={250}>
                {children}
            </ResponsiveContainer>
        ) : (
             <div className="flex items-center justify-center h-[250px] text-gray-500">No data for selected filters.</div>
        )}
    </div>
);

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

export const Dashboard: React.FC = () => {
    const { state, getLabel } = useAppState();
    const { processes, candidates: allCandidates, applications, interviewEvents, users } = state;

    const [processFilter, setProcessFilter] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });

    const filteredCandidates = useMemo(() => {
        return allCandidates.filter(candidate => {
            const processMatch = processFilter === 'all' || candidate.processId === processFilter;
            
            const applicationDate = new Date(candidate.history[0]?.movedAt);
            const startDate = dateFilter.start ? new Date(dateFilter.start) : null;
            const endDate = dateFilter.end ? new Date(dateFilter.end) : null;
            if(startDate) startDate.setHours(0,0,0,0);
            if(endDate) endDate.setHours(23,59,59,999);

            const dateMatch = (!startDate || applicationDate >= startDate) && (!endDate || applicationDate <= endDate);

            return processMatch && dateMatch;
        });
    }, [allCandidates, processFilter, dateFilter]);

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
            const source = c.source || 'Other';
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
        return Array.from(locationMap, ([name, value]) => ({ name, Candidates: value }));
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
        return Object.entries(ageBrackets).map(([name, value]) => ({ name, Candidates: value }));
    }, [filteredCandidates]);

    const upcomingInterviews = useMemo(() => {
        const now = new Date();
        return interviewEvents
            .filter(event => event.start > now)
            .sort((a, b) => a.start.getTime() - b.start.getTime())
            .slice(0, 4);
    }, [interviewEvents]);


    return (
        <div className="p-8 bg-gray-50/50 min-h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">{getLabel('sidebar_dashboard', 'Dashboard')}</h1>
            </div>
            
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-8 flex items-center space-x-4">
                <div>
                    <label htmlFor="processFilter" className="text-sm font-medium text-gray-700">Filter by Process:</label>
                    <select 
                        id="processFilter"
                        value={processFilter}
                        onChange={(e) => setProcessFilter(e.target.value)}
                        className="ml-2 border-gray-300 rounded-md shadow-sm"
                    >
                        <option value="all">All Processes</option>
                        {processes.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="startDate" className="text-sm font-medium text-gray-700">From:</label>
                    <input 
                        type="date" 
                        id="startDate"
                        value={dateFilter.start}
                        onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                        className="ml-2 border-gray-300 rounded-md shadow-sm"
                    />
                </div>
                 <div>
                    <label htmlFor="endDate" className="text-sm font-medium text-gray-700">To:</label>
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
                <StatCard icon={Briefcase} title="Active Processes" value={totalProcesses} color="bg-blue-500" />
                <StatCard icon={Users} title="Filtered Candidates" value={totalCandidates} color="bg-green-500" />
                <StatCard icon={FileText} title="Total Applications" value={totalApplications} color="bg-purple-500" />
                <StatCard icon={CheckCircle} title="Filtered Hired" value={hiredCandidates} color="bg-teal-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                 <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Candidates</h2>
                    <div className="space-y-3">
                        {filteredCandidates.slice(-5).reverse().map(candidate => {
                            const process = processes.find(p => p.id === candidate.processId);
                            return (
                                <div key={candidate.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-900">{candidate.name}</p>
                                        <p className="text-sm text-gray-500">{process?.title || 'No Process'}</p>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {candidate.history.length > 0 && new Date(candidate.history[0].movedAt).toLocaleDateString()}
                                    </span>
                                </div>
                            );
                        })}
                         {filteredCandidates.length === 0 && <p className="text-center text-gray-500 py-8">No recent candidates match the filters.</p>}
                    </div>
                </div>

                <ChartContainer title="Candidate Source" hasData={candidateSources.length > 0} className="lg:col-span-1">
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
                 <ChartContainer title="Candidate Locations" hasData={candidateLocations.length > 0}>
                    <BarChart data={candidateLocations} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={100} />
                        <Tooltip />
                        <Bar dataKey="Candidates" fill="#8884d8" />
                    </BarChart>
                </ChartContainer>
                
                <ChartContainer title="Age Distribution" hasData={ageDistribution.some(d => d.Candidates > 0)}>
                    <BarChart data={ageDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="Candidates" fill="#82ca9d" />
                    </BarChart>
                </ChartContainer>
            </div>
            
            <div className="mt-8">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Calendar className="w-5 h-5 mr-3 text-primary-500" /> Upcoming Interviews</h2>
                    <div className="space-y-3">
                        {upcomingInterviews.length > 0 ? (
                            upcomingInterviews.map(event => {
                                const candidate = allCandidates.find(c => c.id === event.candidateId);
                                const interviewer = users.find(u => u.id === event.interviewerId);
                                return (
                                    <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-gray-900">{candidate?.name || 'Unknown Candidate'}</p>
                                            <p className="text-sm text-gray-500">with {interviewer?.name || 'Unknown Interviewer'}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-4">
                                            <p className="text-sm font-medium text-gray-700">{event.start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                                            <p className="text-xs text-gray-500">{event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-center text-gray-500 py-8">No upcoming interviews scheduled.</p>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
};