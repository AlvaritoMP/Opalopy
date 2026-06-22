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

function isMissingInterviewColumnError(error: { message?: string; code?: string } | null): boolean {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return error.code === '42703' || msg.includes('created_by') || msg.includes('schema cache');
}

const CALENDAR_MONTHS_BACK = 6;
const CALENDAR_MONTHS_FORWARD = 12;

export function getInterviewCalendarWindow(): { start: Date; end: Date } {
    const start = new Date();
    start.setMonth(start.getMonth() - CALENDAR_MONTHS_BACK);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setMonth(end.getMonth() + CALENDAR_MONTHS_FORWARD);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

export const interviewsApi = {
    // Obtener todos los eventos (solo de esta app)
    async getAll(): Promise<InterviewEvent[]> {
        const { data, error } = await supabase
            .from('interview_events')
            .select('*')
            .eq('app_name', APP_NAME) // Filtrar solo eventos de esta app
            .order('start_time', { ascending: true });
        
        if (error) throw error;
        return (data || []).map(dbToInterviewEvent);
    },

    // Obtener eventos por rango de fechas (solo de esta app)
    async getByDateRange(start: Date, end: Date, abortSignal?: AbortSignal): Promise<InterviewEvent[]> {
        let query = supabase
            .from('interview_events')
            .select('*')
            .eq('app_name', APP_NAME) // Filtrar solo eventos de esta app
            .gte('start_time', start.toISOString())
            .lte('start_time', end.toISOString())
            .order('start_time', { ascending: true });

        if (abortSignal) query = query.abortSignal(abortSignal);

        const { data, error } = await query;
        
        if (error) throw error;
        return (data || []).map(dbToInterviewEvent);
    },

    /** Ventana ±6/12 meses para arranque y calendario (no tabla completa) */
    async getForAppWindow(abortSignal?: AbortSignal): Promise<InterviewEvent[]> {
        const { start, end } = getInterviewCalendarWindow();
        return this.getByDateRange(start, end, abortSignal);
    },

    // Crear evento (con app_name automático)
    async create(eventData: Omit<InterviewEvent, 'id'>, createdBy?: string): Promise<InterviewEvent> {
        const dbData = interviewEventToDb(eventData);
        dbData.app_name = APP_NAME;
        if (createdBy) dbData.created_by = createdBy;

        let { data, error } = await supabase
            .from('interview_events')
            .insert(dbData)
            .select()
            .single();

        if (error && createdBy && isMissingInterviewColumnError(error)) {
            const retryPayload = { ...dbData };
            delete retryPayload.created_by;
            ({ data, error } = await supabase
                .from('interview_events')
                .insert(retryPayload)
                .select()
                .single());
        }

        if (error) throw error;
        return dbToInterviewEvent(data);
    },

    // Actualizar evento (solo de esta app)
    async update(id: string, eventData: Partial<InterviewEvent>): Promise<InterviewEvent> {
        const dbData = interviewEventToDb(eventData);
        // No permitir cambiar app_name
        delete dbData.app_name;
        const { data, error } = await supabase
            .from('interview_events')
            .update(dbData)
            .eq('id', id)
            .eq('app_name', APP_NAME) // Asegurar que solo se actualicen eventos de esta app
            .select()
            .single();
        
        if (error) throw error;
        return dbToInterviewEvent(data);
    },

    // Eliminar evento (solo de esta app)
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('interview_events')
            .delete()
            .eq('id', id)
            .eq('app_name', APP_NAME); // Asegurar que solo se eliminen eventos de esta app
        
        if (error) throw error;
    },
};

