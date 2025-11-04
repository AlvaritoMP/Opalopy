import React, { useState } from 'react';
import { Candidate } from '../types';
import { User } from 'lucide-react';
import { CandidateDetailsModal } from './CandidateDetailsModal';

interface CandidateCardProps {
    candidate: Candidate;
    isSelected: boolean;
    onSelect: (candidateId: string) => void;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, isSelected, onSelect }) => {
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const handleCardClick = (e: React.MouseEvent) => {
        // Prevent opening modal if the click was on the checkbox or its label
        if ((e.target as HTMLElement).closest('.selection-control')) {
            return;
        }
        setIsDetailsOpen(true);
    };
    
    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent card click
        onSelect(candidate.id);
    };

    return (
        <>
            <div
                onClick={handleCardClick}
                className={`bg-white p-3 rounded-lg border shadow-sm hover:shadow-md cursor-pointer transition-all flex items-start space-x-3 ${isSelected ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200'}`}
            >
                <div className="selection-control" onClick={handleSelect}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // onClick handles the logic
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                </div>
                <div className="flex-1">
                    <div className="flex items-center space-x-3">
                        {candidate.avatarUrl ? (
                            <img src={candidate.avatarUrl} alt={candidate.name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <User className="w-5 h-5 text-gray-500" />
                            </div>
                        )}
                        <div>
                            <p className="font-semibold text-sm text-gray-800 truncate">{candidate.name}</p>
                            <p className="text-xs text-gray-500 truncate">{candidate.email}</p>
                        </div>
                    </div>
                </div>
            </div>
            {isDetailsOpen && <CandidateDetailsModal candidate={candidate} onClose={() => setIsDetailsOpen(false)} />}
        </>
    );
};