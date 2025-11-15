import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppState } from '../App';
import { Download, Users, Briefcase, ChevronDown } from 'lucide-react';
import { Candidate } from '../types';

const candidateReportOptions: { key: keyof Candidate | 'process' | 'stage'; label: string }[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'email', label: 'Correo' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'process', label: 'Proceso' },
    { key: 'stage', label: 'Etapa actual' },
    { key: 'source', label: 'Fuente' },
    { key: 'salaryExpectation', label: 'Expectativa salarial' },
    { key: 'age', label: 'Edad' },
    { key: 'dni', label: 'DNI' },
    { key: 'linkedinUrl', label: 'LinkedIn' },
    { key: 'address', label: 'Dirección' },
];


export const ReportsView: React.FC = () => {
    const { state, getLabel } = useAppState();
    const { processes, candidates } = state;
    const [selectedColumns, setSelectedColumns] = useState<string[]>(['name', 'process', 'stage', 'email']);
    const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
    const selectorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
                setIsColumnSelectorOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleColumnToggle = (columnKey: string) => {
        setSelectedColumns(prev =>
            prev.includes(columnKey) ? prev.filter(key => key !== columnKey) : [...prev, columnKey]
        );
    };
    
    const getCandidateValue = (candidate: Candidate, colKey: string): string | number | undefined => {
        switch(colKey) {
            case 'process':
                return processes.find(p => p.id === candidate.processId)?.title || 'N/D';
            case 'stage':
                const process = processes.find(p => p.id === candidate.processId);
                return process?.stages.find(s => s.id === candidate.stageId)?.name || 'N/D';
            default:
                return candidate[colKey as keyof Candidate] as string | number | undefined;
        }
    };

    const handleExport = (data: any[], fileName: string) => {
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
            <h1 className="text-3xl font-bold text-gray-800 mb-8">{getLabel('sidebar_reports', 'Reportes')}</h1>

            <div className="space-y-8">
                {/* Candidates Report */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold flex items-center"><Users className="mr-2" /> Todos los candidatos</h2>
                        <div className="flex items-center space-x-4">
                             <div className="relative" ref={selectorRef}>
                                <button
                                    onClick={() => setIsColumnSelectorOpen(prev => !prev)}
                                    className="flex items-center text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm px-4 py-2 hover:bg-gray-50"
                                >
                                    Seleccionar columnas <ChevronDown className="w-4 h-4 ml-2" />
                                </button>
                                {isColumnSelectorOpen && (
                                    <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                                        <div className="p-2 max-h-60 overflow-y-auto">
                                            {candidateReportOptions.map(option => (
                                                <label key={option.key} className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedColumns.includes(option.key)}
                                                        onChange={() => handleColumnToggle(option.key)}
                                                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                    />
                                                    <span className="text-sm text-gray-700">{option.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button onClick={() => {
                                const dataToExport = candidates.map(candidate => {
                                    const row: Record<string, any> = {};
                                    selectedColumns.forEach(key => {
                                        row[key] = getCandidateValue(candidate, key) || '';
                                    });
                                    return row;
                                });
                                handleExport(dataToExport, 'reporte_candidatos');
                            }} className="flex items-center text-sm font-medium text-primary-600 hover:text-primary-800">
                                <Download className="w-4 h-4 mr-1" /> Exportar JSON
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    {selectedColumns.map(key => (
                                        <th scope="col" key={key} className="px-6 py-3">
                                            {candidateReportOptions.find(opt => opt.key === key)?.label || key}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {candidates.map(candidate => (
                                    <tr key={candidate.id} className="bg-white border-b hover:bg-gray-50">
                                        {selectedColumns.map(key => (
                                             <td key={key} className="px-6 py-4">
                                                {/* FIX: Explicitly convert value to string to handle number types and prevent potential errors. */}
                                                {String(getCandidateValue(candidate, key) || 'N/D')}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Processes Report */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold flex items-center"><Briefcase className="mr-2" /> Todos los procesos</h2>
                        {/* Fix: Corrected the onClick handler to export a summary of process data, resolving the original type error. */}
                        <button onClick={() => {
                            const dataToExport = processes.map(process => ({
                                title: process.title,
                                description: process.description,
                                stageCount: process.stages.length,
                                candidateCount: candidates.filter(c => c.processId === process.id).length
                            }));
                            handleExport(dataToExport, 'reporte_procesos');
                        }} className="flex items-center text-sm font-medium text-primary-600 hover:text-primary-800">
                            <Download className="w-4 h-4 mr-1" /> Exportar JSON
                        </button>
                    </div>
                     <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Título</th>
                                    <th scope="col" className="px-6 py-3">Descripción</th>
                                    <th scope="col" className="px-6 py-3">N.º etapas</th>
                                    <th scope="col" className="px-6 py-3">N.º candidatos</th>
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