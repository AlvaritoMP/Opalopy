import React, { useState } from 'react';
import { useAppState } from '../App';
import { Plus, MoreVertical, Eye, Edit, Trash2, Users, FileText } from 'lucide-react';
import { ProcessEditorModal } from './ProcessEditorModal';
import { Process, UserRole } from '../types';

const ProcessCard: React.FC<{
    process: Process;
    candidateCount: number;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
    canEdit: boolean;
}> = ({ process, candidateCount, onView, onEdit, onDelete, canEdit }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const { state } = useAppState();

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col group">
            <div 
                className="h-40 bg-cover bg-center relative"
                style={{ backgroundImage: `url(${process.flyerUrl || 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800'})` }}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                {canEdit && (
                    <div className="absolute top-2 right-2">
                        <div className="relative">
                            <button onClick={() => setDropdownOpen(!dropdownOpen)} onBlur={() => setTimeout(() => setDropdownOpen(false), 100)} className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50">
                                <MoreVertical className="w-5 h-5" />
                            </button>
                            {dropdownOpen && (
                                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                                    <div className="py-1">
                                        <a href="#" onClick={(e) => { e.preventDefault(); onView(); }} className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <Eye className="w-4 h-4 mr-3" /> View Board
                                        </a>
                                        <a href="#" onClick={(e) => { e.preventDefault(); onEdit(); }} className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <Edit className="w-4 h-4 mr-3" /> Edit
                                        </a>
                                        <a href="#" onClick={(e) => { e.preventDefault(); onDelete(); }} className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                            <Trash2 className="w-4 h-4 mr-3" /> Delete
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <h3 className="absolute bottom-4 left-4 text-xl font-bold text-white">{process.title}</h3>
            </div>
            <div className="p-4 flex-grow flex flex-col justify-between">
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{process.description}</p>
                <div>
                    {process.serviceOrderCode && (
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                            <span className="font-medium text-gray-700">OS Code:</span>
                            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{process.serviceOrderCode}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                        <span className="font-medium text-gray-700">Salary Range:</span>
                        <span>{process.salaryRange ? `${state.settings?.currencySymbol || ''}${process.salaryRange.replace(/[$\€£S/]/g, '').trim()}` : 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                        <span className="font-medium text-gray-700">Candidates:</span>
                        <div className="flex items-center">
                            <Users className="w-4 h-4 mr-1"/>
                            <span>{candidateCount}</span>
                        </div>
                    </div>
                </div>
            </div>
             <div className="p-4 bg-gray-50 border-t">
                <button onClick={onView} className="w-full text-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700 text-sm font-medium">
                    View Board
                </button>
            </div>
        </div>
    );
};


export const ProcessList: React.FC = () => {
    const { state, actions, getLabel } = useAppState();
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingProcess, setEditingProcess] = useState<Process | null>(null);
    
    const canManageProcesses = ['admin', 'recruiter'].includes(state.currentUser?.role as UserRole);

    const handleEdit = (process: Process) => {
        setEditingProcess(process);
        setIsEditorOpen(true);
    };

    const handleAddNew = () => {
        setEditingProcess(null);
        setIsEditorOpen(true);
    };

    const handleDelete = (processId: string) => {
        if (window.confirm('Are you sure you want to delete this process and all its candidates? This action cannot be undone.')) {
            actions.deleteProcess(processId);
        }
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">{getLabel('sidebar_processes', 'Hiring Processes')}</h1>
                {canManageProcesses && (
                    <button
                        onClick={handleAddNew}
                        className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700"
                    >
                        <Plus className="w-5 h-5 mr-2" /> New Process
                    </button>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {state.processes.map(process => (
                    <ProcessCard
                        key={process.id}
                        process={process}
                        canEdit={canManageProcesses}
                        candidateCount={state.candidates.filter(c => c.processId === process.id).length}
                        onView={() => actions.setView('process-view', process.id)}
                        onEdit={() => handleEdit(process)}
                        onDelete={() => handleDelete(process.id)}
                    />
                ))}
            </div>
            {isEditorOpen && <ProcessEditorModal process={editingProcess} onClose={() => setIsEditorOpen(false)} />}
        </div>
    );
};