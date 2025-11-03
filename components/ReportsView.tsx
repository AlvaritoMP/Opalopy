
import React from 'react';
import { useAppState } from '../App';
import { Download, Users, Briefcase } from 'lucide-react';

export const ReportsView: React.FC = () => {
    const { state } = useAppState();
    const { processes, candidates } = state;

    const handleExport = (data: unknown[], fileName: string) => {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">Reports</h1>

            <div className="space-y-8">
                {/* Candidates Report */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold flex items-center"><Users className="mr-2" /> All Candidates</h2>
                        <button onClick={() => handleExport(candidates, 'all_candidates')} className="flex items-center text-sm font-medium text-primary-600 hover:text-primary-800">
                            <Download className="w-4 h-4 mr-1" /> Export as JSON
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Name</th>
                                    <th scope="col" className="px-6 py-3">Process</th>
                                    <th scope="col" className="px-6 py-3">Current Stage</th>
                                    <th scope="col" className="px-6 py-3">Email</th>
                                </tr>
                            </thead>
                            <tbody>
                                {candidates.map(candidate => {
                                    const process = processes.find(p => p.id === candidate.processId);
                                    const stage = process?.stages.find(s => s.id === candidate.stageId);
                                    return (
                                        <tr key={candidate.id} className="bg-white border-b hover:bg-gray-50">
                                            <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{candidate.name}</th>
                                            <td className="px-6 py-4">{process?.title || 'N/A'}</td>
                                            <td className="px-6 py-4">{stage?.name || 'N/A'}</td>
                                            <td className="px-6 py-4">{candidate.email}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Processes Report */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold flex items-center"><Briefcase className="mr-2" /> All Processes</h2>
                        <button onClick={() => handleExport(processes, 'all_processes')} className="flex items-center text-sm font-medium text-primary-600 hover:text-primary-800">
                            <Download className="w-4 h-4 mr-1" /> Export as JSON
                        </button>
                    </div>
                     <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Title</th>
                                    <th scope="col" className="px-6 py-3">Description</th>
                                    <th scope="col" className="px-6 py-3">No. of Stages</th>
                                    <th scope="col" className="px-6 py-3">No. of Candidates</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processes.map(process => (
                                    <tr key={process.id} className="bg-white border-b hover:bg-gray-50">
                                        <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{process.title}</th>
                                        <td className="px-6 py-4">{process.description}</td>
                                        <td className="px-6 py-4">{process.stages.length}</td>
                                        <td className="px-6 py-4">{candidates.filter(c => c.processId === process.id).length}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
