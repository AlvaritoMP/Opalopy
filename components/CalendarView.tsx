import React, { useState, useMemo } from 'react';
import { useAppState } from '../App';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { Plus, Calendar as CalendarIcon } from 'lucide-react';
import { ScheduleInterviewModal } from './ScheduleInterviewModal';
import { InterviewEvent } from '../types';

const localizer = momentLocalizer(moment);

export const CalendarView: React.FC = () => {
    const { state, getLabel } = useAppState();
    const [isScheduling, setIsScheduling] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<InterviewEvent | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const events = useMemo(() => {
        return state.interviewEvents.map(event => {
            const candidate = state.candidates.find(c => c.id === event.candidateId);
            const interviewer = state.users.find(u => u.id === event.interviewerId);
            return {
                ...event,
                title: `${candidate?.name || 'Candidato desconocido'} con ${interviewer?.name || 'Entrevistador desconocido'}`,
            };
        });
    }, [state.interviewEvents, state.candidates, state.users]);
    
    const handleSelectEvent = (event: InterviewEvent) => {
        setSelectedEvent(event);
        setIsScheduling(true);
    };

    const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
        setSelectedEvent(null);
        setSelectedDate(slotInfo.start);
        setIsScheduling(true);
    };

    return (
        <div className="p-8 h-full flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <CalendarIcon className="w-8 h-8 mr-3" />
                    {getLabel('sidebar_calendar', 'Calendario de entrevistas')}
                </h1>
                <button
                    onClick={() => { setSelectedEvent(null); setIsScheduling(true); }}
                    className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700"
                >
                    <Plus className="w-5 h-5 mr-2" /> Agendar entrevista
                </button>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex-1">
                <BigCalendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    onSelectEvent={handleSelectEvent}
                    onSelectSlot={handleSelectSlot}
                    selectable
                />
            </div>
            {isScheduling && (
                <ScheduleInterviewModal 
                    event={selectedEvent} 
                    defaultDate={selectedDate}
                    onClose={() => setIsScheduling(false)} 
                />
            )}
        </div>
    );
};