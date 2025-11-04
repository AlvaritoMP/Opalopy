

import React, { useState } from 'react';
import { useAppState } from '../App';
import { Upload, FileText, UserPlus } from 'lucide-react';
import { Candidate } from '../types';

// Simple CSV parser placeholder
const parseCSV = (csvText: string): Omit<Candidate, 'id' | 'history' | 'processId' | 'stageId' | 'attachments'>[] => {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const candidates: Omit<Candidate, 'id' | 'history' | 'processId' | 'stageId' | 'attachments'>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const candidate: any = {};
        headers.forEach((header, index) => {
            // A very basic transformation for numeric values
            if (header === 'age' && values[index] && !isNaN(Number(values[index]))) {
                 candidate[header] = Number(values[index]);
            } else {
                 candidate[header] = values[index];
            }
        });
        candidates.push(candidate);
    }
    return candidates;
};


export const BulkImportView: React.FC = () => {
    const { state, actions, getLabel } = useAppState();
    const [file, setFile] = useState<File | null>(null);
    const [processId, setProcessId] = useState<string>(state.processes[0]?.id || '');
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ success: number, failed: number } | null>(null);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setImportResult(null);
        }
    };

    const handleImport = async () => {
        if (!file || !processId) {
            alert('Please select a file and a process.');
            return;
        }

        setIsImporting(true);
        const process = state.processes.find(p => p.id === processId)
        const firstStageId = process?.stages[0]?.id;
        if (!firstStageId) {
            alert('Selected process has no stages configured.');
            setIsImporting(false);
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            // FIX: Moved `parsedCandidates` declaration out of the try block to widen its scope for the catch block.
            let parsedCandidates: Omit<Candidate, 'id' | 'history' | 'processId' | 'stageId' | 'attachments'>[] = [];
            try {
                parsedCandidates = parseCSV(text);
                let successCount = 0;
                
                for (const candidateData of parsedCandidates) {
                    if (candidateData.name && candidateData.email) {
                        await actions.addCandidate({
                            name: candidateData.name,
                            email: candidateData.email,
                            processId,
                            stageId: firstStageId,
                            attachments: [],
                            phone: candidateData.phone,
                            description: candidateData.description,
                            source: candidateData.source,
                            salaryExpectation: candidateData.salaryExpectation,
                            age: candidateData.age,
                            dni: candidateData.dni,
                            linkedinUrl: candidateData.linkedinUrl,
                            address: candidateData.address,
                        });
                        successCount++;
                    }
                }
                setImportResult({ success: successCount, failed: parsedCandidates.length - successCount });
            } catch (error) {
                console.error("Failed to parse or import CSV", error);
                alert("An error occurred during import. Check the console for details.");
                setImportResult({ success: 0, failed: parsedCandidates.length });
            } finally {
                setIsImporting(false);
                setFile(null);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">{getLabel('sidebar_bulk_import', 'Bulk Import Candidates')}</h1>
            
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm max-w-2xl mx-auto">
                 <h2 className="text-xl font-semibold text-gray-800 mb-2">Import from CSV</h2>
                 <p className="text-sm text-gray-500 mb-6">Upload a CSV file with candidate data. The first row must be a header with column names like `name`, `email`, `phone`, etc.</p>

                <div className="space-y-4">
                     <div>
                        <label htmlFor="process" className="block text-sm font-medium text-gray-700">Select Process to Import Into</label>
                        <select
                            id="process"
                            value={processId}
                            onChange={(e) => setProcessId(e.target.value)}
                            className="mt-1 block w-full input"
                            disabled={isImporting || state.processes.length === 0}
                        >
                            {state.processes.length === 0 && <option>No processes available</option>}
                            {state.processes.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                    </div>

                    <div>
                         <label className="block text-sm font-medium text-gray-700">CSV File</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                {file ? (
                                    <>
                                        <FileText className="mx-auto h-12 w-12 text-gray-400" />
                                        <p className="font-medium text-primary-600">{file.name}</p>
                                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                        <div className="flex text-sm text-gray-600">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none">
                                                <span>Upload a file</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".csv" onChange={handleFileChange} />
                                            </label>
                                            <p className="pl-1">or drag and drop</p>
                                        </div>
                                        <p className="text-xs text-gray-500">CSV up to 10MB</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                     <button
                        onClick={handleImport}
                        disabled={!file || !processId || isImporting}
                        className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700 disabled:bg-primary-300 disabled:cursor-not-allowed"
                    >
                        <UserPlus className="w-5 h-5 mr-2" /> {isImporting ? 'Importing...' : `Import ${file ? 'Candidates' : ''}`}
                    </button>
                </div>

                {importResult && (
                    <div className={`mt-6 p-4 rounded-md border ${importResult.failed > 0 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                        <h3 className="font-medium">Import Complete</h3>
                        <p>Successfully imported: {importResult.success} candidates.</p>
                        {importResult.failed > 0 && <p>Failed to import: {importResult.failed} candidates (likely missing name or email).</p>}
                    </div>
                )}
            </div>
             <style>{`.input { padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }`}</style>
        </div>
    );
};