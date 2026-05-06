import React, { useState } from 'react';
import { X, Calendar, Clock, User, Check } from 'lucide-react';
import { useAppState } from '../App';

interface QuickScheduleInlineProps {
    candidateId: string;
    candidateName: string;
    onSchedule: (date: string, time: string, interviewerId: string) => Promise<void>;
    onCancel: () => void;
}

export const QuickScheduleInline: React.FC<QuickScheduleInlineProps> = ({
    candidateId,
    candidateName,
    onSchedule,
    onCancel,
}) => {
    const { state } = useAppState();
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [interviewerId, setInterviewerId] = useState('');
    const [isScheduling, setIsScheduling] = useState(false);

    // Obtener usuarios que pueden ser entrevistadores (admin o recruiter)
    const interviewers = state.users.filter(u => 
        u.role === 'admin' || u.role === 'recruiter'
    );

    // Establecer fecha mínima como hoy y hora por defecto (1 hora desde ahora)
    const today = new Date().toISOString().split('T')[0];
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000).toTimeString().slice(0, 5);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!date || !time || !interviewerId) {
            alert('Por favor, completa todos los campos requeridos');
            return;
        }

        setIsScheduling(true);
        try {
            await onSchedule(date, time, interviewerId);
        } catch (error) {
            console.error('Error agendando cita:', error);
            alert('Error al agendar la cita. Por favor, inténtalo de nuevo.');
        } finally {
            setIsScheduling(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Agendar Entrevista</h3>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Fecha <span className="text-red-500">*</span>
                </label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={today}
                    required
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Hora <span className="text-red-500">*</span>
                </label>
                <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    defaultValue={defaultTime}
                    required
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Entrevistador <span className="text-red-500">*</span>
                </label>
                <select
                    value={interviewerId}
                    onChange={(e) => setInterviewerId(e.target.value)}
                    required
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                    <option value="">Seleccionar...</option>
                    {interviewers.map(interviewer => (
                        <option key={interviewer.id} value={interviewer.id}>
                            {interviewer.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex gap-2 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-3 py-1.5 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                    disabled={isScheduling}
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={isScheduling || !date || !time || !interviewerId}
                    className="flex-1 px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                    {isScheduling ? (
                        <>
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Agendando...
                        </>
                    ) : (
                        <>
                            <Check className="w-3 h-3" />
                            Agendar
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};
