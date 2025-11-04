import React, { useState, useEffect } from 'react';
import { useAppState } from '../App';
import { InterviewEvent } from '../types';
import { X, Calendar, Clock, User, Briefcase, FileText } from 'lucide-react';

interface ScheduleInterviewModalProps {
    event: InterviewEvent | null;
    defaultDate?: Date;
    defaultCandidateId?: string;
    onClose: () => void;
}

export const ScheduleInterviewModal: React.FC<ScheduleInterviewModalProps> = ({ event, defaultDate, defaultCandidateId, onClose }) => {
    const { state, actions } = useAppState();
    const [candidateId, setCandidateId] = useState(event?.candidateId || defaultCandidateId || '');
    const [interviewerId, setInterviewerId] = useState(event?.interviewerId || '');
    const [date, setDate] = useState(event ? event.start.toISOString().split('T')[0] : (defaultDate || new Date()).toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState(event ? event.start.toTimeString().substring(0, 5) : '10:00');
    const [endTime, setEndTime] = useState(event ? event.end.toTimeString().substring(0, 5) : '11:00');
    const [notes, setNotes] = useState(event?.notes || '');
    const [title, setTitle] = useState(event?.title || '');

    useEffect(() => {
        if (!event && candidateId && interviewerId) {
            const candidate = state.candidates.find(c => c.id === candidateId);
            const interviewer = state.users.find(u => u.id === interviewerId);
            setTitle(`Interview: ${candidate?.name} & ${interviewer?.name}`);
        }
    }, [candidateId, interviewerId, event, state.candidates, state.users]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!candidateId || !interviewerId) {
            alert("Please select a candidate and an interviewer.");
            return;
        }

        const startDateTime = new Date(`${date}T${startTime}`);
        const endDateTime = new Date(`${date}T${endTime}`);
        
        if (startDateTime >= endDateTime) {
            alert("End time must be after start time.");
            return;
        }

        const eventData = {
            title,
            start: startDateTime,
            end: endDateTime,
            candidateId,
            interviewerId,
            notes,
        };

        if (event) {
            await actions.updateInterviewEvent({ ...event, ...eventData });
        } else {
            await actions.addInterviewEvent(eventData);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-gray-800">{event ? 'Edit Interview' : 'Schedule Interview'}</h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                            <X className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        <div>
                            <label htmlFor="candidateId" className="block text-sm font-medium text-gray-700 flex items-center"><Briefcase className="w-4 h-4 mr-2"/> Candidate</label>
                            <select id="candidateId" value={candidateId} onChange={e => setCandidateId(e.target.value)} required disabled={!!defaultCandidateId} className="mt-1 block w-full input">
                                <option value="" disabled>Select a candidate</option>
                                {state.candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                         <div>
                            <label htmlFor="interviewerId" className="block text-sm font-medium text-gray-700 flex items-center"><User className="w-4 h-4 mr-2"/> Interviewer</label>
                            <select id="interviewerId" value={interviewerId} onChange={e => setInterviewerId(e.target.value)} required className="mt-1 block w-full input">
                                <option value="" disabled>Select an interviewer</option>
                                {state.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                         <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
                            <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} required className="mt-1 block w-full input"/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-1">
                                <label htmlFor="date" className="block text-sm font-medium text-gray-700 flex items-center"><Calendar className="w-4 h-4 mr-2"/> Date</label>
                                <input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} required className="mt-1 block w-full input"/>
                            </div>
                             <div className="md:col-span-1">
                                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 flex items-center"><Clock className="w-4 h-4 mr-2"/> Start Time</label>
                                <input type="time" id="startTime" value={startTime} onChange={e => setStartTime(e.target.value)} required className="mt-1 block w-full input"/>
                            </div>
                             <div className="md:col-span-1">
                                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 flex items-center"><Clock className="w-4 h-4 mr-2"/> End Time</label>
                                <input type="time" id="endTime" value={endTime} onChange={e => setEndTime(e.target.value)} required className="mt-1 block w-full input"/>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 flex items-center"><FileText className="w-4 h-4 mr-2"/> Notes</label>
                            <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 block w-full input" />
                        </div>
                    </div>
                     <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                        <button type="submit" className="btn-primary">{event ? 'Save Changes' : 'Schedule'}</button>
                    </div>
                </form>
            </div>
             <style>{`.input { padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); } .btn-primary { padding: 0.5rem 1rem; background-color: #2563eb; color: white; border-radius: 0.375rem; font-weight: 500;} .btn-primary:hover { background-color: #1d4ed8; } .btn-secondary { padding: 0.5rem 1rem; background-color: white; border: 1px solid #D1D5DB; color: #374151; border-radius: 0.375rem; font-weight: 500;} .btn-secondary:hover { background-color: #F9FAFB; }`}</style>
        </div>
    );
};