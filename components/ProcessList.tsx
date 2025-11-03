
import React, { useState } from 'react';
import { useAppState } from '../App';
import { Plus, MoreVertical, Edit, Trash2, Eye } from 'lucide-react';
import { ProcessEditorModal } from './ProcessEditorModal';
import { Process } from '../types';

export const ProcessList: React.FC = () => {
    const { state, actions } = useAppState();
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingProcess, setEditingProcess] = useState<Process | null>(null);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    const handleOpenEditor = (process: Process | null = null) => {
        setEditingProcess(process);
        setIsEditorOpen(true);
        setActiveDropdown(null);
    };

    const handleCloseEditor = () => {
        setIsEditorOpen(false);
        setEditingProcess(null);
    };

    const handleDelete = (processId: string) => {
        if (window.confirm('Are you sure you want to delete this process and all its candidates?')) {
            actions.deleteProcess(processId);
        }
        setActiveDropdown(null);
    };
    
    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Hiring Processes</h1>
                <button
                    onClick={() => handleOpenEditor()}
                    className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700"
                >
                    <Plus className="w-5 h-5 mr-2" /> New Process
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {state.processes.map(process => (
                    <div key={process.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start">
                                <h2 className="text-xl font-semibold text-gray-800 mb-2">{process.title}</h2>
                                <div className="relative">
                                    <button onClick={() => setActiveDropdown(activeDropdown === process.id ? null : process.id)} className="p-2 rounded-full hover:bg-gray-100">
                                        <MoreVertical className="w-5 h-5 text-gray-500" />
                                    </button>
                                    {activeDropdown === process.id && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                                            <button onClick={() => actions.setView('process-view', process.id)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"><Eye className="w-4 h-4 mr-2" /> View Board</button>
                                            <button onClick={() => handleOpenEditor(process)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"><Edit className="w-4 h-4 mr-2" /> Edit</button>
                                            <button onClick={() => handleDelete(process.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"><Trash2 className="w-4 h-4 mr-2" /> Delete</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p className="text-gray-600 mb-4 line-clamp-2">{process.description}</p>
                        </div>
                        <div className="flex justify-between items-center text-sm text-gray-500">
                            <span>{process.stages.length} Stages</span>
                            <span>{state.candidates.filter(c => c.processId === process.id).length} Candidates</span>
                        </div>
                    </div>
                ))}
            </div>

            {isEditorOpen && (
                <ProcessEditorModal process={editingProcess} onClose={handleCloseEditor} />
            )}
        </div>
    );
};
