import React, { useState, useRef } from 'react';
import { useAppState } from '../App';
import { Process, Stage, Attachment } from '../types';
import { X, Plus, Trash2, GripVertical, Paperclip, Upload, FileText } from 'lucide-react';

interface ProcessEditorModalProps {
    process: Process | null;
    onClose: () => void;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export const ProcessEditorModal: React.FC<ProcessEditorModalProps> = ({ process, onClose }) => {
    const { state, actions, getLabel } = useAppState();
    const [title, setTitle] = useState(process?.title || '');
    const [description, setDescription] = useState(process?.description || '');
    const [salaryRange, setSalaryRange] = useState(process?.salaryRange || '');
    const [experienceLevel, setExperienceLevel] = useState(process?.experienceLevel || '');
    const [seniority, setSeniority] = useState(process?.seniority || '');
    const [startDate, setStartDate] = useState(process?.startDate || '');
    const [endDate, setEndDate] = useState(process?.endDate || '');
    const [flyerUrl, setFlyerUrl] = useState(process?.flyerUrl || '');
    const [attachments, setAttachments] = useState<Attachment[]>(process?.attachments || []);
    const [stages, setStages] = useState<Stage[]>(process?.stages || [{ id: `new-${Date.now()}`, name: 'Applied' }]);
    const flyerInputRef = useRef<HTMLInputElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);

    const handleStageNameChange = (id: string, name: string) => {
        setStages(stages.map(stage => stage.id === id ? { ...stage, name } : stage));
    };

    const addStage = () => setStages([...stages, { id: `new-${Date.now()}`, name: '' }]);
    const removeStage = (id: string) => {
        if (stages.length > 1) setStages(stages.filter(stage => stage.id !== id));
        else alert("A process must have at least one stage.");
    };
    
    const dragItem = React.useRef<number | null>(null);
    const dragOverItem = React.useRef<number | null>(null);
    const handleSort = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        let _stages = [...stages];
        const draggedItemContent = _stages.splice(dragItem.current, 1)[0];
        _stages.splice(dragOverItem.current, 0, draggedItemContent);
        dragItem.current = null;
        dragOverItem.current = null;
        setStages(_stages);
    };

    const handleFlyerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const dataUrl = await fileToBase64(file);
            setFlyerUrl(dataUrl);
        }
    };
    
    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const dataUrl = await fileToBase64(file);
            const newAttachment: Attachment = {
                id: `att-p-${Date.now()}`,
                name: file.name,
                url: dataUrl,
                type: file.type,
                size: file.size,
            };
            setAttachments(prev => [...prev, newAttachment]);
        }
    };

    const handleDeleteAttachment = (id: string) => {
        setAttachments(prev => prev.filter(att => att.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalStages = stages.filter(s => s.name.trim() !== '').map((s, i) => ({...s, id: s.id.startsWith('new-') ? `stage-${Date.now()}-${i}` : s.id}));
        if (finalStages.length === 0) { alert('Please add at least one valid stage.'); return; }

        const processData = { title, description, stages: finalStages, salaryRange, experienceLevel, seniority, startDate, endDate, flyerUrl, attachments };

        if (process) await actions.updateProcess({ ...process, ...processData });
        else await actions.addProcess(processData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b flex justify-between items-center"><h2 className="text-2xl font-bold text-gray-800">{process ? getLabel('modal_edit_process', 'Edit Process') : getLabel('modal_create_process', 'Create New Process')}</h2><button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><X className="w-6 h-6 text-gray-600" /></button></div>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        {/* Process Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-gray-700">Process Title</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="mt-1 block w-full input"/></div>
                            <div><label className="block text-sm font-medium text-gray-700">Salary Range</label><input type="text" placeholder={`${state.settings?.currencySymbol || '$'}100k - ${state.settings?.currencySymbol || '$'}120k`} value={salaryRange} onChange={e => setSalaryRange(e.target.value)} className="mt-1 block w-full input"/></div>
                            <div><label className="block text-sm font-medium text-gray-700">Experience Level</label><input type="text" placeholder="e.g., 5+ Years" value={experienceLevel} onChange={e => setExperienceLevel(e.target.value)} className="mt-1 block w-full input"/></div>
                            <div><label className="block text-sm font-medium text-gray-700">Seniority</label><input type="text" placeholder="e.g., Senior, Mid-Level" value={seniority} onChange={e => setSeniority(e.target.value)} className="mt-1 block w-full input"/></div>
                            <div><label className="block text-sm font-medium text-gray-700">Start Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full input"/></div>
                            <div><label className="block text-sm font-medium text-gray-700">End Date</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full input"/></div>
                        </div>
                        <div><label className="block text-sm font-medium text-gray-700">Description</label><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 block w-full input" /></div>
                        
                        {/* Flyer */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Flyer Image</label>
                            <div className="mt-1 flex items-center space-x-4">
                                {flyerUrl && <img src={flyerUrl} alt="Flyer preview" className="w-24 h-16 object-cover rounded-md" />}
                                <button type="button" onClick={() => flyerInputRef.current?.click()} className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">{flyerUrl ? 'Change Image' : 'Upload Image'}</button>
                                <input type="file" accept="image/*" ref={flyerInputRef} onChange={handleFlyerUpload} className="hidden" />
                            </div>
                        </div>

                        {/* Attachments */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center"><Paperclip className="w-4 h-4 mr-2"/> Process Attachments</h3>
                             <div className="space-y-2">
                                {attachments.map(att => (
                                    <div key={att.id} className="flex items-center justify-between p-2 rounded-md border bg-gray-50">
                                        <div className="flex items-center overflow-hidden"><FileText className="w-5 h-5 mr-3 text-gray-500 flex-shrink-0" /><p className="text-sm font-medium text-gray-800 truncate">{att.name}</p></div>
                                        <button onClick={() => handleDeleteAttachment(att.id)} className="p-1 rounded-md hover:bg-red-100" title="Delete"><Trash2 className="w-4 h-4 text-red-500" /></button>
                                    </div>
                                ))}
                            </div>
                            <input type="file" ref={attachmentInputRef} onChange={handleAttachmentUpload} className="hidden" />
                            <button type="button" onClick={() => attachmentInputRef.current?.click()} className="mt-2 flex items-center text-sm font-medium text-primary-600 hover:text-primary-800"><Upload className="w-4 h-4 mr-1" /> Upload Document</button>
                        </div>
                        
                        {/* Stages */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Hiring Stages</h3>
                            <div className="space-y-2">{stages.map((stage, index) => (<div key={stage.id} className="flex items-center space-x-2" draggable onDragStart={() => dragItem.current = index} onDragEnter={() => dragOverItem.current = index} onDragEnd={handleSort} onDragOver={(e) => e.preventDefault()}><GripVertical className="w-5 h-5 text-gray-400 cursor-move" /><input type="text" value={stage.name} onChange={(e) => handleStageNameChange(stage.id, e.target.value)} placeholder={`Stage ${index + 1}`} className="flex-1 input" /><button type="button" onClick={() => removeStage(stage.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full"><Trash2 className="w-5 h-5" /></button></div>))}</div>
                             <button type="button" onClick={addStage} className="mt-3 flex items-center text-sm font-medium text-primary-600 hover:text-primary-800"><Plus className="w-4 h-4 mr-1" /> Add Stage</button>
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end space-x-3"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">{process ? 'Save Changes' : 'Create Process'}</button></div>
                </form>
            </div>
            <style>{`.input { padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); } .btn-primary { padding: 0.5rem 1rem; background-color: #2563eb; color: white; border-radius: 0.375rem; font-weight: 500;} .btn-primary:hover { background-color: #1d4ed8; } .btn-secondary { padding: 0.5rem 1rem; background-color: white; border: 1px solid #D1D5DB; color: #374151; border-radius: 0.375rem; font-weight: 500;} .btn-secondary:hover { background-color: #F9FAFB; }`}</style>
        </div>
    );
};