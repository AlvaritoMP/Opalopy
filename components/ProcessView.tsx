import React, { useState } from 'react';
import { useAppState } from '../App';
import { CandidateCard } from './CandidateCard';
import { Plus, Edit, Briefcase, DollarSign, BarChart, Clock, Paperclip, X, FileText } from 'lucide-react';
import { AddCandidateModal } from './AddCandidateModal';
import { ProcessEditorModal } from './ProcessEditorModal';
import { Attachment } from '../types';

interface ProcessViewProps {
    processId: string;
}

const ProcessAttachmentsModal: React.FC<{ attachments: Attachment[]; onClose: () => void }> = ({ attachments, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b flex justify-between items-center"><h2 className="text-xl font-bold text-gray-800">Process Attachments</h2><button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><X /></button></div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
                {attachments.length > 0 ? attachments.map(att => (
                    <a href={att.url} target="_blank" rel="noopener noreferrer" key={att.id} className="flex items-center p-2 rounded-md hover:bg-gray-100">
                        <FileText className="w-5 h-5 mr-3 text-gray-500"/>
                        <span className="text-sm font-medium text-primary-600">{att.name}</span>
                    </a>
                )) : <p className="text-sm text-gray-500 text-center">No documents attached to this process.</p>}
            </div>
        </div>
    </div>
);


export const ProcessView: React.FC<ProcessViewProps> = ({ processId }) => {
    const { state, actions } = useAppState();
    const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
    const [isProcessEditorOpen, setIsProcessEditorOpen] = useState(false);
    const [isAttachmentsModalOpen, setIsAttachmentsModalOpen] = useState(false);
    const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
    const dragPayload = React.useRef<{ candidateId: string; isBulk: boolean } | null>(null);

    const process = state.processes.find(p => p.id === processId);
    const candidates = state.candidates.filter(c => c.processId === processId);

    const handleSelectCandidate = (candidateId: string) => {
        setSelectedCandidates(prev =>
            prev.includes(candidateId) ? prev.filter(id => id !== candidateId) : [...prev, candidateId]
        );
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, candidateId: string) => {
        const isBulk = selectedCandidates.includes(candidateId);
        dragPayload.current = { candidateId, isBulk };
        e.dataTransfer.setData("text/plain", candidateId); // Necessary for Firefox
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, stageId: string) => {
        if (!dragPayload.current) return;
        const { candidateId, isBulk } = dragPayload.current;

        const movedBy = state.currentUser?.name || 'System';

        if (isBulk) {
            selectedCandidates.forEach(id => {
                const candidate = state.candidates.find(c => c.id === id);
                if (candidate && candidate.stageId !== stageId) {
                    actions.updateCandidate({ ...candidate, stageId }, movedBy);
                }
            });
            setSelectedCandidates([]);
        } else {
            const candidate = state.candidates.find(c => c.id === candidateId);
            if (candidate && candidate.stageId !== stageId) {
                actions.updateCandidate({ ...candidate, stageId }, movedBy);
            }
        }
        
        dragPayload.current = null;
        e.currentTarget.classList.remove('bg-primary-50');
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-primary-50');
    };
    
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('bg-primary-50');
    };

    if (!process) return <div className="p-8 text-center">Process not found.</div>;
    
    const InfoChip: React.FC<{icon: React.ElementType, text: string}> = ({ icon: Icon, text }) => (
        <div className="flex items-center bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
            <Icon className="w-4 h-4 mr-1.5" /> {text}
        </div>
    );

    return (
        <div className="flex flex-col h-full">
            <header className="p-4 border-b bg-white flex-shrink-0">
                <div className="flex justify-between items-center mb-3">
                     <h1 className="text-2xl font-bold text-gray-800">{process.title}</h1>
                     <div className="flex items-center space-x-3">
                        <button onClick={() => setIsAttachmentsModalOpen(true)} className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50" disabled={!process.attachments?.length}>
                           <Paperclip className="w-4 h-4 mr-2"/> View Docs ({process.attachments?.length || 0})
                        </button>
                        <button onClick={() => setIsProcessEditorOpen(true)} className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                            <Edit className="w-4 h-4 mr-2"/> Edit Process
                        </button>
                        <button onClick={() => setIsAddCandidateOpen(true)} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700">
                            <Plus className="w-5 h-5 mr-2" /> Add Candidate
                        </button>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    {process.seniority && <InfoChip icon={Briefcase} text={process.seniority} />}
                    {process.salaryRange && <InfoChip icon={DollarSign} text={process.salaryRange} />}
                    {process.experienceLevel && <InfoChip icon={BarChart} text={process.experienceLevel} />}
                    {process.startDate && process.endDate && <InfoChip icon={Clock} text={`${process.startDate} to ${process.endDate}`} />}
                </div>
            </header>
            <main className="flex-1 flex overflow-x-auto p-4 bg-gray-50/50 space-x-4">
                {process.stages.map(stage => (
                    <div
                        key={stage.id}
                        onDrop={(e) => handleDrop(e, stage.id)}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className="flex-shrink-0 w-80 bg-gray-100 rounded-lg p-3 transition-colors"
                    >
                        <h3 className="font-semibold text-gray-700 mb-3 px-1 flex justify-between">
                            <span>{stage.name}</span>
                            <span>({candidates.filter(c => c.stageId === stage.id).length})</span>
                        </h3>
                        <div className="space-y-3 min-h-[50px]">
                            {candidates
                                .filter(c => c.stageId === stage.id)
                                .map(candidate => (
                                    <div key={candidate.id} draggable onDragStart={(e) => handleDragStart(e, candidate.id)}>
                                        <CandidateCard 
                                            candidate={candidate}
                                            isSelected={selectedCandidates.includes(candidate.id)}
                                            onSelect={handleSelectCandidate}
                                        />
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                ))}
            </main>
            {isAddCandidateOpen && <AddCandidateModal process={process} onClose={() => setIsAddCandidateOpen(false)} />}
            {isProcessEditorOpen && <ProcessEditorModal process={process} onClose={() => setIsProcessEditorOpen(false)} />}
            {isAttachmentsModalOpen && <ProcessAttachmentsModal attachments={process.attachments} onClose={() => setIsAttachmentsModalOpen(false)} />}
        </div>
    );
};