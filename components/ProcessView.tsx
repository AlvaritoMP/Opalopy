
import React, { useState } from 'react';
import { useAppState } from '../App';
import { Plus, ArrowLeft } from 'lucide-react';
import { CandidateCard } from './CandidateCard';
import { CandidateDetailsModal } from './CandidateDetailsModal';
import { AddCandidateModal } from './AddCandidateModal';
import { Candidate, Stage } from '../types';

interface ProcessViewProps {
    processId: string;
}

export const ProcessView: React.FC<ProcessViewProps> = ({ processId }) => {
    const { state, actions } = useAppState();
    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

    const process = state.processes.find(p => p.id === processId);
    
    if (!process) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-bold">Process not found.</h1>
                <button onClick={() => actions.setView('processes')} className="mt-4 text-primary-600">
                    Back to Processes
                </button>
            </div>
        );
    }
    
    const candidatesByStage = (stageId: string) => {
        return state.candidates.filter(c => c.processId === processId && c.stageId === stageId);
    };

    const handleDrop = (candidateId: string, newStageId: string) => {
        const candidate = state.candidates.find(c => c.id === candidateId);
        if (candidate && candidate.stageId !== newStageId) {
            const updatedCandidate = {
                ...candidate,
                stageId: newStageId,
                history: [...candidate.history, { stageId: newStageId, movedAt: new Date().toISOString() }]
            };
            actions.updateCandidate(updatedCandidate);
        }
    };

    const StageColumn: React.FC<{ stage: Stage }> = ({ stage }) => {
        const [isOver, setIsOver] = useState(false);

        const handleDragOver = (e: React.DragEvent) => {
            e.preventDefault();
            setIsOver(true);
        };
        const handleDragLeave = (e: React.DragEvent) => {
            e.preventDefault();
            setIsOver(false);
        };
        const handleDropEvent = (e: React.DragEvent) => {
            e.preventDefault();
            setIsOver(false);
            const candidateId = e.dataTransfer.getData('candidateId');
            handleDrop(candidateId, stage.id);
        };

        return (
            <div 
                className={`flex-shrink-0 w-72 bg-gray-100 rounded-lg ${isOver ? 'bg-primary-100' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDropEvent}
            >
                <div className="p-4 border-b font-semibold text-gray-700">
                    {stage.name} ({candidatesByStage(stage.id).length})
                </div>
                <div className="p-2 space-y-2 h-full overflow-y-auto">
                    {candidatesByStage(stage.id).map(candidate => (
                        <CandidateCard key={candidate.id} candidate={candidate} onClick={() => setSelectedCandidate(candidate)} />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 sm:p-6 border-b bg-white">
                <div className="flex justify-between items-center">
                    <div>
                         <button onClick={() => actions.setView('processes')} className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2">
                            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Processes
                        </button>
                        <h1 className="text-2xl font-bold text-gray-800">{process.title}</h1>
                        <p className="text-gray-500">{process.description}</p>
                    </div>
                    <button
                        onClick={() => setAddModalOpen(true)}
                        className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700"
                    >
                        <Plus className="w-5 h-5 mr-2" /> Add Candidate
                    </button>
                </div>
            </div>
            <div className="flex-1 flex p-4 sm:p-6 space-x-4 overflow-x-auto">
                {process.stages.map(stage => (
                    <StageColumn key={stage.id} stage={stage} />
                ))}
            </div>
            {isAddModalOpen && <AddCandidateModal process={process} onClose={() => setAddModalOpen(false)} />}
            {selectedCandidate && <CandidateDetailsModal candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} />}
        </div>
    );
};
