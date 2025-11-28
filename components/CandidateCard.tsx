import React, { useState } from 'react';
import { Candidate } from '../types';
import { User, StickyNote, Copy, Phone, MessageCircle, PhoneCall, X } from 'lucide-react';
import { CandidateDetailsModal } from './CandidateDetailsModal';
import { PostItModal } from './PostItModal';
import { DiscardCandidateModal } from './DiscardCandidateModal';
import { useAppState } from '../App';

interface CandidateCardProps {
    candidate: Candidate;
    isSelected: boolean;
    onSelect: (candidateId: string) => void;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, isSelected, onSelect }) => {
    const { actions } = useAppState();
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isPostItOpen, setIsPostItOpen] = useState(false);
    const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);

    const handleCardClick = (e: React.MouseEvent) => {
        // Prevent opening modal if the click was on the checkbox, post-it button, or its label
        if ((e.target as HTMLElement).closest('.selection-control') || 
            (e.target as HTMLElement).closest('.postit-control')) {
            return;
        }
        setIsDetailsOpen(true);
    };
    
    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent card click
        onSelect(candidate.id);
    };

    const handlePostItClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent card click
        setIsPostItOpen(true);
    };

    const postIts = candidate.postIts || [];
    const hasPostIts = postIts.length > 0;

    const normalizedPhone = candidate.phone ? candidate.phone.replace(/[^\d]/g, '') : '';

    const handleCopyPhone = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!candidate.phone) return;
        navigator.clipboard.writeText(candidate.phone).then(() => {
            // Optionally add toast later
        });
    };

    const colorClasses = {
        yellow: 'bg-yellow-200',
        pink: 'bg-pink-200',
        blue: 'bg-blue-200',
        green: 'bg-green-200',
        orange: 'bg-orange-200',
    };

    return (
        <>
            <div
                onClick={handleCardClick}
                className={`bg-white p-3 rounded-lg border shadow-sm hover:shadow-md cursor-pointer transition-all ${isSelected ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200'} ${hasPostIts ? 'border-l-4 border-l-yellow-400' : ''}`}
            >
                <div className="flex items-start space-x-2">
                    <div className="selection-control" onClick={handleSelect}>
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // onClick handles the logic
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                            {candidate.avatarUrl ? (
                                <img src={candidate.avatarUrl} alt={candidate.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                    <User className="w-4 h-4 text-gray-500" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-gray-800 truncate">{candidate.name}</p>
                                <p className="text-xs text-gray-500 truncate">{candidate.email}</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handlePostItClick}
                                    className={`postit-control flex-shrink-0 p-1.5 rounded hover:bg-gray-100 transition-colors ${hasPostIts ? 'text-yellow-600' : 'text-gray-400'}`}
                                    title={hasPostIts ? `${postIts.length} post-it(s)` : 'Agregar post-it'}
                                >
                                    <StickyNote className="w-4 h-4" />
                                    {hasPostIts && (
                                        <span className="ml-1 text-xs font-semibold">{postIts.length}</span>
                                    )}
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsDiscardModalOpen(true);
                                    }}
                                    className="flex-shrink-0 p-1.5 rounded hover:bg-red-100 transition-colors text-gray-400 hover:text-red-600"
                                    title="Descartar candidato"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {candidate.phone && (
                            <div className="flex items-center space-x-2 mt-1">
                                <p className="text-xs text-gray-600 truncate flex-1">{candidate.phone}</p>
                                <div className="flex items-center space-x-1 text-gray-500">
                                    <button
                                        onClick={handleCopyPhone}
                                        className="p-1 rounded hover:bg-gray-100"
                                        title="Copiar teléfono"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <a
                                        href={`tel:${candidate.phone}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-1 rounded hover:bg-gray-100"
                                        title="Llamar"
                                    >
                                        <Phone className="w-3.5 h-3.5" />
                                    </a>
                                    <a
                                        href={`https://wa.me/${normalizedPhone}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-1 rounded hover:bg-gray-100"
                                        title="Mensaje WhatsApp"
                                    >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                    </a>
                                    <a
                                        href={`whatsapp://call?phone=${normalizedPhone}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-1 rounded hover:bg-gray-100"
                                        title="Llamada WhatsApp"
                                    >
                                        <PhoneCall className="w-3.5 h-3.5" />
                                    </a>
                                </div>
                            </div>
                        )}
                        
                        {/* Mostrar post-its en miniatura */}
                        {hasPostIts && (
                            <div className="mt-2 space-y-1">
                                {postIts.slice(0, 2).map((postIt) => (
                                    <div
                                        key={postIt.id}
                                        className={`${colorClasses[postIt.color]} px-2 py-1 rounded text-xs truncate`}
                                        title={postIt.text}
                                    >
                                        {postIt.text}
                                    </div>
                                ))}
                                {postIts.length > 2 && (
                                    <p className="text-xs text-gray-500">+{postIts.length - 2} más</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {isDetailsOpen && <CandidateDetailsModal candidate={candidate} onClose={() => setIsDetailsOpen(false)} />}
            {isPostItOpen && <PostItModal candidateId={candidate.id} onClose={() => setIsPostItOpen(false)} />}
            {isDiscardModalOpen && (
                <DiscardCandidateModal
                    candidateId={candidate.id}
                    candidateName={candidate.name}
                    onClose={() => setIsDiscardModalOpen(false)}
                    onDiscard={async (reason) => {
                        await actions.discardCandidate(candidate.id, reason);
                        setIsDiscardModalOpen(false);
                    }}
                />
            )}
        </>
    );
};