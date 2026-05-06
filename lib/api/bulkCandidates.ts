import { supabase } from '../supabase';
import { APP_NAME } from '../appConfig';

// Tipo ligero para la vista masiva (solo campos necesarios)
export interface BulkCandidate {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    dni?: string;
    scoreIa?: number;
    metadataIa?: string;
    stageId: string;
    processId: string;
    lastWhatsAppInteractionAt?: string; // Fecha de última interacción por WhatsApp
    nextInterviewAt?: string; // Fecha/hora de la próxima entrevista
    nextInterviewerId?: string; // ID del entrevistador de la próxima entrevista
    // Campos adicionales para el drawer (se cargan bajo demanda)
    description?: string;
    attachments?: any[];
    history?: any[];
}

// Resultado de la query paginada
export interface BulkCandidatesResult {
    candidates: BulkCandidate[];
    total: number;
    hasMore: boolean;
}

export const bulkCandidatesApi = {
    /**
     * Obtener candidatos con paginación optimizada (solo campos ligeros)
     * @param processId - ID del proceso (opcional, si no se proporciona trae todos)
     * @param page - Número de página (0-indexed)
     * @param pageSize - Tamaño de página (default: 50)
     * @param filters - Filtros opcionales (stageId, search, etc.)
     * @param bulkConfig - Configuración del proceso masivo para filtrado automático
     */
    async getCandidates(
        processId?: string,
        page: number = 0,
        pageSize: number = 50,
        filters?: {
            stageId?: string;
            search?: string;
            archived?: boolean;
            discarded?: boolean;
        },
        bulkConfig?: {
            scoreThreshold?: number;
            autoFilterEnabled?: boolean;
        }
    ): Promise<BulkCandidatesResult> {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        // Construir query base
        let query = supabase
            .from('candidates')
            .select('id, name, email, phone, dni, score_ia, metadata_ia, stage_id, process_id, last_whatsapp_interaction_at', { count: 'exact' })
            .eq('app_name', APP_NAME)
            .eq('archived', filters?.archived ?? false)
            .eq('discarded', filters?.discarded ?? false)
            .order('created_at', { ascending: false })
            .range(from, to);

        // Aplicar filtros
        if (processId) {
            query = query.eq('process_id', processId);
        }

        if (filters?.stageId) {
            query = query.eq('stage_id', filters.stageId);
        }

        if (filters?.search) {
            // Búsqueda en nombre, email o teléfono
            query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
        }

        // Aplicar filtrado automático si está habilitado
        if (bulkConfig?.autoFilterEnabled && bulkConfig?.scoreThreshold !== undefined) {
            // Solo traer candidatos con score >= threshold
            // Si score_ia es NULL, no se incluyen (solo candidatos evaluados)
            query = query.gte('score_ia', bulkConfig.scoreThreshold);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        // Obtener próximas entrevistas para los candidatos
        const candidateIds = (data || []).map(c => c.id);
        let nextInterviews: Map<string, { start: string; interviewerId: string }> = new Map();
        
        if (candidateIds.length > 0) {
            const now = new Date().toISOString();
            const { data: interviews } = await supabase
                .from('interview_events')
                .select('candidate_id, start_time, interviewer_id')
                .in('candidate_id', candidateIds)
                .eq('app_name', APP_NAME)
                .gte('start_time', now)
                .order('start_time', { ascending: true });

            if (interviews) {
                // Obtener solo la próxima entrevista de cada candidato
                interviews.forEach(interview => {
                    if (!nextInterviews.has(interview.candidate_id)) {
                        nextInterviews.set(interview.candidate_id, {
                            start: interview.start_time,
                            interviewerId: interview.interviewer_id,
                        });
                    }
                });
            }
        }

        const candidates: BulkCandidate[] = (data || []).map(c => {
            const nextInterview = nextInterviews.get(c.id);
            return {
                id: c.id,
                name: c.name,
                email: c.email || undefined,
                phone: c.phone || undefined,
                dni: c.dni || undefined,
                scoreIa: c.score_ia || undefined,
                metadataIa: c.metadata_ia || undefined,
                stageId: c.stage_id,
                processId: c.process_id,
                lastWhatsAppInteractionAt: c.last_whatsapp_interaction_at || undefined,
                nextInterviewAt: nextInterview?.start || undefined,
                nextInterviewerId: nextInterview?.interviewerId || undefined,
            };
        });

        return {
            candidates,
            total: count || 0,
            hasMore: (count || 0) > to + 1,
        };
    },

    /**
     * Registrar interacción por WhatsApp
     * @param candidateId - ID del candidato
     */
    async recordWhatsAppInteraction(candidateId: string): Promise<void> {
        const { error } = await supabase
            .from('candidates')
            .update({ 
                last_whatsapp_interaction_at: new Date().toISOString() 
            })
            .eq('id', candidateId)
            .eq('app_name', APP_NAME);

        if (error) throw error;
    },

    /**
     * Actualizar estado de un candidato (optimistic update)
     * @param candidateId - ID del candidato
     * @param updates - Campos a actualizar
     */
    async updateCandidate(candidateId: string, updates: {
        stageId?: string;
        discarded?: boolean;
        discardReason?: string;
        archived?: boolean;
    }): Promise<void> {
        const dbUpdates: any = {};
        
        if (updates.stageId !== undefined) dbUpdates.stage_id = updates.stageId;
        if (updates.discarded !== undefined) dbUpdates.discarded = updates.discarded;
        if (updates.discardReason !== undefined) dbUpdates.discard_reason = updates.discardReason;
        if (updates.archived !== undefined) dbUpdates.archived = updates.archived;

        if (updates.discarded) {
            dbUpdates.discarded_at = new Date().toISOString();
        }

        if (updates.archived) {
            dbUpdates.archived_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from('candidates')
            .update(dbUpdates)
            .eq('id', candidateId)
            .eq('app_name', APP_NAME);

        if (error) throw error;
    },

    /**
     * Actualizar múltiples candidatos en lote
     * @param candidateIds - Array de IDs de candidatos
     * @param updates - Campos a actualizar
     */
    async updateCandidatesBatch(
        candidateIds: string[],
        updates: {
            stageId?: string;
            discarded?: boolean;
            discardReason?: string;
            archived?: boolean;
        }
    ): Promise<void> {
        if (candidateIds.length === 0) return;

        const dbUpdates: any = {};
        
        if (updates.stageId !== undefined) dbUpdates.stage_id = updates.stageId;
        if (updates.discarded !== undefined) dbUpdates.discarded = updates.discarded;
        if (updates.discardReason !== undefined) dbUpdates.discard_reason = updates.discardReason;
        if (updates.archived !== undefined) dbUpdates.archived = updates.archived;

        if (updates.discarded) {
            dbUpdates.discarded_at = new Date().toISOString();
        }

        if (updates.archived) {
            dbUpdates.archived_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from('candidates')
            .update(dbUpdates)
            .in('id', candidateIds)
            .eq('app_name', APP_NAME);

        if (error) throw error;
    },

    /**
     * Cargar detalles completos de un candidato (para el drawer)
     * @param candidateId - ID del candidato
     */
    async getCandidateDetails(candidateId: string): Promise<BulkCandidate> {
        const { data, error } = await supabase
            .from('candidates')
            .select(`
                id,
                name,
                email,
                phone,
                description,
                score_ia,
                metadata_ia,
                stage_id,
                process_id,
                attachments:attachments!candidate_id(id, name, url, type, size, category, uploaded_at),
                history:candidate_history!candidate_id(stage_id, moved_at, moved_by)
            `)
            .eq('id', candidateId)
            .eq('app_name', APP_NAME)
            .single();

        if (error) throw error;

        return {
            id: data.id,
            name: data.name,
            email: data.email,
            phone: data.phone || undefined,
            description: data.description || undefined,
            scoreIa: data.score_ia || undefined,
            metadataIa: data.metadata_ia || undefined,
            stageId: data.stage_id,
            processId: data.process_id,
            attachments: data.attachments || [],
            history: data.history || [],
        };
    },

    /**
     * Eliminar candidato permanentemente
     * @param candidateId - ID del candidato
     */
    async deleteCandidate(candidateId: string): Promise<void> {
        const { error } = await supabase
            .from('candidates')
            .delete()
            .eq('id', candidateId)
            .eq('app_name', APP_NAME);
        
        if (error) throw error;
    },

    /**
     * Eliminar múltiples candidatos en lote
     * @param candidateIds - Array de IDs de candidatos
     */
    async deleteCandidatesBatch(candidateIds: string[]): Promise<void> {
        if (candidateIds.length === 0) return;
        
        const { error } = await supabase
            .from('candidates')
            .delete()
            .in('id', candidateIds)
            .eq('app_name', APP_NAME);
        
        if (error) throw error;
    },
};
