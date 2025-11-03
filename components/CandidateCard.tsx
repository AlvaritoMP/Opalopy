
import React from 'react';
import { Candidate } from '../types';
import { User } from 'lucide-react';

interface CandidateCardProps {
    candidate: Candidate;
    onClick: () => void;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, onClick }) => {
    
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('candidateId', candidate.id);
    };

    return (
        <div 
            draggable
            onDragStart={handleDragStart}
            onClick={onClick}
            className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        >
            <div className="flex items-center space-x-3">
                {candidate.avatarUrl ? (
                    <img src={candidate.avatarUrl} alt={candidate.name} className="w-10 h-10 rounded-full" />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-500" />
                    </div>
                )}
                <div>
                    <p className="font-semibold text-gray-800">{candidate.name}</p>
                    <p className="text-sm text-gray-500">{candidate.email}</p>
                </div>
            </div>
        </div>
    );
};
