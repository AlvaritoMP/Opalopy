
import React from 'react';
import { useAppState } from '../App';
import { Users, Briefcase, CheckCircle, Clock, BarChart, PieChart, TrendingUp } from 'lucide-react';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Tooltip as PieTooltip } from 'recharts';

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType; color: string; }> = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-xl border border-gray-200 flex items-center shadow-sm">
        <div className={`p-3 rounded-full ${color}`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="ml-4">
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-semibold text-gray-800">{value}</p>
        </div>
    </div>
);

export const Dashboard: React.FC = () => {
    const { state } = useAppState();
    const { processes, candidates } = state;

    const totalProcesses = processes.length;
    const totalCandidates = candidates.length;
    const hiredCandidates = candidates.filter(c => {
        const process = processes.find(p => p.id === c.processId);
        if(!process) return false;
        const lastStage = process.stages[process.stages.length - 1];
        return c.stageId === lastStage?.id;
    }).length;

    const avgTimeInStage = () => {
        let totalDays = 0;
        let transitions = 0;
        candidates.forEach(c => {
            for (let i = 1; i < c.history.length; i++) {
                const start = new Date(c.history[i-1].movedAt).getTime();
                const end = new Date(c.history[i].movedAt).getTime();
                totalDays += (end - start) / (1000 * 3600 * 24);
                transitions++;
            }
        });
        return transitions > 0 ? (totalDays / transitions).toFixed(1) : 'N/A';
    };

    const candidatesPerStageData = processes.flatMap(p => p.stages).map(stage => ({
        name: stage.name,
        candidates: candidates.filter(c => c.stageId === stage.id).length
    })).reduce((acc, curr) => {
        const existing = acc.find(item => item.name === curr.name);
        if (existing) {
            existing.candidates += curr.candidates;
        } else {
            acc.push(curr);
        }
        return acc;
    }, [] as {name: string, candidates: number}[]).filter(d => d.candidates > 0);

    const processesData = processes.map(process => ({
        name: process.title,
        candidates: candidates.filter(c => c.processId === process.id).length
    }));
    
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    return (
        <div className="p-8 bg-gray-50/50">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Active Processes" value={totalProcesses} icon={Briefcase} color="bg-blue-500" />
                <StatCard title="Total Candidates" value={totalCandidates} icon={Users} color="bg-indigo-500" />
                <StatCard title="Candidates Hired" value={hiredCandidates} icon={CheckCircle} color="bg-green-500" />
                <StatCard title="Avg. Time per Stage (Days)" value={avgTimeInStage()} icon={Clock} color="bg-yellow-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-700 flex items-center mb-4"><BarChart className="w-5 h-5 mr-2" />Candidates per Stage</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <ReBarChart data={candidatesPerStageData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="candidates" fill="#3b82f6" />
                        </ReBarChart>
                    </ResponsiveContainer>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-700 flex items-center mb-4"><PieChart className="w-5 h-5 mr-2" />Candidates per Process</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <RePieChart>
                            <Pie data={processesData} dataKey="candidates" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
                                {processesData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <PieTooltip />
                            <Legend />
                        </RePieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
