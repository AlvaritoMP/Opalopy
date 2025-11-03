import React, { useState } from 'react';
import { Process, Stage } from '../types';
import { useAppState } from '../App';
import { X, Plus, Trash2 } from 'lucide-react';

interface ProcessEditorModalProps {
    process: Process | null;
    onClose: () => void;
}

export const ProcessEditorModal: React.FC<ProcessEditorModalProps> = ({ process, onClose }) => {
    const { actions } = useAppState();
    const [title, setTitle] = useState(process?.title || '');
    const [description, setDescription] = useState(process?.description || '');
    const [stages, setStages] = useState<Stage[]>(process?.stages || [{ id: `new-${Date.now()}`, name: 'Applied' }]);

    const handleStageChange = (index: number, value: string) => {
        const newStages = [...stages];
        newStages[index].name = value;
        setStages(newStages);
    };

    const addStage = () => {
        setStages([...stages, { id: `new-${Date.now()}`, name: '' }]);
    };
    
    const removeStage = (index: number) => {
        if(stages.length <= 1) return;
        setStages(stages.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalStages = stages.map(stage => ({...stage, id: stage.id.startsWith('new-') ? `${stage.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}` : stage.id }));

        if (process) {
            await actions.updateProcess({ ...process, title, description, stages: finalStages });
        } else {
            await actions.addProcess({ title, description, stages: finalStages });
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-gray-800">{process ? 'Edit Process' : 'New Process'}</h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                            <X className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                    <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
                            <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                            <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} required rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Stages</h3>
                            <div className="space-y-2">
                                {stages.map((stage, index) => (
                                    <div key={index} className="flex items-center space-x-2">
                                        <input type="text" value={stage.name} onChange={e => handleStageChange(index, e.target.value)} required placeholder={`Stage ${index + 1}`} className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                                        <button type="button" onClick={() => removeStage(index)} disabled={stages.length <= 1} className="p-2 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:hover:bg-transparent">
                                            <Trash2 className="w-5 h-5 text-red-500" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                             <button type="button" onClick={addStage} className="mt-2 flex items-center text-sm font-medium text-primary-600 hover:text-primary-800">
                                <Plus className="w-4 h-4 mr-1" /> Add Stage
                            </button>
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-primary-700">Save Process</button>
                    </div>
                </form>
            </div>
        </div>
    );
};