import { supabase } from '../supabase';
import { InterviewEvent } from '../../types';
import { APP_NAME } from '../appConfig';

// Convertir de DB a tipo de aplicación
function dbToInterviewEvent(dbEvent: any): InterviewEvent {
    return {
        id: dbEvent.id,
        title: dbEvent.title,
        start: new Date(dbEvent.start_time),
        end: new Date(dbEvent.end_time),
        candidateId: dbEvent.candidate_id,
        interviewerId: dbEvent.interviewer_id,
        notes: dbEvent.notes,
        attendeeEmails: dbEvent.attendee_emails || undefined,
    };
}

// Convertir de tipo de aplicación a DB
function interviewEventToDb(event: Partial<InterviewEvent>): any {
    const dbEvent: any = {};
    if (event.title !== undefined) dbEvent.title = event.title;
    if (event.start !== undefined) dbEvent.start_time = event.start instanceof Date ? event.start.toISOString() : event.start;
    if (event.end !== undefined) dbEvent.end_time = event.end instanceof Date ? event.end.toISOString() : event.end;
    if (event.candidateId !== undefined) dbEvent.candidate_id = event.candidateId;
    if (event.interviewerId !== undefined) dbEvent.interviewer_id = event.interviewerId;
    if (event.notes !== undefined) dbEvent.notes = event.notes;
    if (event.attendeeEmails !== undefined) dbEvent.attendee_emails = event.attendeeEmails;
    return dbEvent;
}

export const interviewsApi = {
    // Obtener todos los eventos
    async getAll(): Promise<InterviewEvent[]> {
        const { data, error } = await supabase
            .from('interview_events')
            .select('*')
            .eq('app_name', APP_NAME)
            .order('start_time', { ascending: true });
        
        if (error) throw error;
        return (data || []).map(dbToInterviewEvent);
    },

    // Obtener eventos por rango de fechas
    async getByDateRange(start: Date, end: Date): Promise<InterviewEvent[]> {
        const { data, error } = await supabase
            .from('interview_events')
            .select('*')
            .eq('app_name', APP_NAME)
            .gte('start_time', start.toISOString())
            .lte('start_time', end.toISOString())
            .order('start_time', { ascending: true });
        
        if (error) throw error;
        return (data || []).map(dbToInterviewEvent);
    },

    // Crear evento
    async create(eventData: Omit<InterviewEvent, 'id'>, createdBy?: string): Promise<InterviewEvent> {
        const dbData = interviewEventToDb(eventData);
        if (createdBy) dbData.created_by = createdBy;
        dbData.app_name = APP_NAME;

        const { data, error } = await supabase
            .from('interview_events')
            .insert(dbData)
            .select()
            .single();
        
        if (error) throw error;
        return dbToInterviewEvent(data);
    },

    // Actualizar evento
    async update(id: string, eventData: Partial<InterviewEvent>): Promise<InterviewEvent> {
        const dbData = interviewEventToDb(eventData);
        delete dbData.app_name; // No permitir cambiar app_name
        const { data, error } = await supabase
            .from('interview_events')
            .update(dbData)
            .eq('id', id)
            .eq('app_name', APP_NAME)
            .select()
            .single();
        
        if (error) throw error;
        return dbToInterviewEvent(data);
    },

    // Eliminar evento
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('interview_events')
            .delete()
            .eq('id', id)
            .eq('app_name', APP_NAME);
        
        if (error) throw error;
    },
};

