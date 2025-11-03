
import React, { useState } from 'react';
import { Candidate } from '../types';
import { useAppState } from '../App';
import { X, User, Mail, Phone, FileText, StickyNote } from 'lucide-react';

interface CandidateDetailsModalProps {
    candidate: Candidate;
    onClose: () => void;
}

export const CandidateDetailsModal: React.FC<CandidateDetailsModalProps> = ({ candidate, onClose }) => {
    const { state, actions } = useAppState();
    const process = state.processes.find(p => p.id === candidate.processId);
    const [notes, setNotes] = useState(candidate.notes || '');

    const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNotes(e.target.value);
    };

    const handleSaveNotes = () => {
        if(candidate.notes !== notes) {
            actions.updateCandidate({ ...candidate, notes });
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">{candidate.name}</h2>
                    <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                        <X className="w-6 h-6 text-gray-600" />
                    </button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column */}
                        <div className="space-y-4">
                             <div className="flex items-center text-gray-600">
                                <User className="w-5 h-5 mr-3" />
                                <span>{process?.title}</span>
                            </div>
                            <div className="flex items-center text-gray-600">
                                <Mail className="w-5 h-5 mr-3" />
                                <a href={`mailto:${candidate.email}`} className="text-primary-600 hover:underline">{candidate.email}</a>
                            </div>
                            {candidate.phone && (
                                <div className="flex items-center text-gray-600">
                                    <Phone className="w-5 h-5 mr-3" />
                                    <span>{candidate.phone}</span>
                                </div>
                            )}
                             {candidate.resumeUrl && (
                                <div className="flex items-center text-gray-600">
                                    <FileText className="w-5 h-5 mr-3" />
                                    <a href={candidate.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">View Resume</a>
                                </div>
                            )}
                        </div>
                        {/* Right Column */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-700">Stage History</h3>
                            <ul className="space-y-2">
                                {candidate.history.map((h, i) => {
                                    const stage = process?.stages.find(s => s.id === h.stageId);
                                    return (
                                        <li key={i} className="text-sm text-gray-600">
                                            <span className="font-medium">{stage?.name || 'Unknown Stage'}:</span> {new Date(h.movedAt).toLocaleDateString()}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>

                    <div>
                        <h3 className="font-semibold text-gray-700 flex items-center mb-2"><StickyNote className="w-5 h-5 mr-2" /> Notes</h3>
                        <textarea 
                            rows={5} 
                            value={notes}
                            onChange={handleNotesChange}
                            onBlur={handleSaveNotes}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                            placeholder="Add notes about this candidate..."
                        />
                    </div>

                </div>
                 <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
                </div>
            </div>
        </div>
    );
};
