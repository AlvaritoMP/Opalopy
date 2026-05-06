import React, { useState } from 'react';
import { X, Calendar, Clock, User } from 'lucide-react';
import { useAppState } from '../App';

interface QuickScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidateId: string;
    candidateName: string;
    onSchedule: (date: string, time: string, interviewerId: string, notes?: string) => Promise<void>;
}

export const QuickScheduleModal: React.FC<QuickScheduleModalProps> = ({
    isOpen,
    onClose,
    candidateId,
    candidateName,
    onSchedule,
}) => {
    const { state } = useAppState();
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [interviewerId, setInterviewerId] = useState('');
    const [notes, setNotes] = useState('');
    const [isScheduling, setIsScheduling] = useState(false);

    // Obtener usuarios que pueden ser entrevistadores (admin o recruiter)
    const interviewers = state.users.filter(u => 
        u.role === 'admin' || u.role === 'recruiter'
    );

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!date || !time || !interviewerId) {
            alert('Por favor, completa todos los campos requeridos');
            return;
        }

        setIsScheduling(true);
        try {
            await onSchedule(date, time, interviewerId, notes);
            // Reset form
            setDate('');
            setTime('');
            setInterviewerId('');
            setNotes('');
            onClose();
        } catch (error) {
            console.error('Error agendando cita:', error);
            alert('Error al agendar la cita. Por favor, inténtalo de nuevo.');
        } finally {
            setIsScheduling(false);
        }
    };

    // Establecer fecha mínima como hoy
    const today = new Date().toISOString().split('T')[0];
    // Establecer hora por defecto (1 hora desde ahora)
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000).toTimeString().slice(0, 5);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-6 h-6 text-primary-600" />
                        <h2 className="text-xl font-semibold text-gray-900">
                            Agendar Entrevista
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Candidato
                        </label>
                        <p className="text-gray-900 font-medium">{candidateName}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Fecha <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            min={today}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Hora <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            defaultValue={defaultTime}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Entrevistador <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={interviewerId}
                            onChange={(e) => setInterviewerId(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                            <option value="">Seleccionar entrevistador...</option>
                            {interviewers.map(interviewer => (
                                <option key={interviewer.id} value={interviewer.id}>
                                    {interviewer.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notas (opcional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notas adicionales sobre la entrevista..."
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            disabled={isScheduling}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isScheduling}
                            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isScheduling ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Agendando...
                                </>
                            ) : (
                                <>
                                    <Calendar className="w-4 h-4" />
                                    Agendar
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
