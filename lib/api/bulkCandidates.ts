import { supabase } from '../supabase';
import { APP_NAME } from '../appConfig';
import type { CustomColumn } from '../../types';
import {
    enrichBulkColumnValuesForStorage,
    resolveColumnValueFromRow,
    hasBulkCellValue,
    bulkColumnNameKey,
    buildLegacyColumnIdToName,
    buildStandardFieldTextCasePatch,
    repairTextCaseColumnValues,
} from '../bulkTableColumns';
import type { BulkProcessConfig, CandidateHistory } from '../../types';
import { readChannelSummaryFromRow } from '../contactChannelConfig';
import type { ChannelContactSummary } from '../contactChannelConfig';
import { buildInterviewMapFromRows } from '../bulkInterviewUtils';
import { isMissingColumnError } from '../supabaseColumnErrors';

/** Select mínimo — siempre disponible */
const BULK_SELECT_BASE =
    'id, name, email, phone, dni, age, source, province, district, score_ia, metadata_ia, stage_id, process_id, last_whatsapp_interaction_at';

const BULK_SELECT_WITH_CONTACT = `${BULK_SELECT_BASE}, contact_status, contact_attempt_count, contact_last_attempt_at, contact_last_user_name,
    contact_phone_status, contact_phone_attempt_count, contact_phone_last_at, contact_phone_last_user_name,
    contact_whatsapp_status, contact_whatsapp_attempt_count, contact_whatsapp_last_at, contact_whatsapp_last_user_name,
    contact_email_status, contact_email_attempt_count, contact_email_last_at, contact_email_last_user_name`;

const BULK_SELECT_WITH_CREATED = `${BULK_SELECT_WITH_CONTACT}, created_at`;
const BULK_SELECT_WITH_APPLICATION = `${BULK_SELECT_WITH_CREATED}, application_count, first_application_at`;
const BULK_SELECT_WITH_REGISTRATION = `${BULK_SELECT_WITH_APPLICATION}, registration_origin, created_by, contact_lock_user_id, contact_lock_user_name, contact_lock_until, contact_lock_reason`;
const BULK_SELECT_FULL = `${BULK_SELECT_WITH_REGISTRATION}, bulk_column_values`;
const BULK_EFFICIENCY_FIELDS =
    'hire_date, offer_accepted_date, application_started_date, application_completed_date';
const BULK_SELECT_FULL_EFFICIENCY = `${BULK_SELECT_FULL}, ${BULK_EFFICIENCY_FIELDS}`;
const BULK_SELECT_WITH_REGISTRATION_EFFICIENCY = `${BULK_SELECT_WITH_REGISTRATION}, ${BULK_EFFICIENCY_FIELDS}`;
const BULK_SELECT_WITH_APPLICATION_EFFICIENCY = `${BULK_SELECT_WITH_APPLICATION}, ${BULK_EFFICIENCY_FIELDS}`;
const BULK_SELECT_WITH_CREATED_EFFICIENCY = `${BULK_SELECT_WITH_CREATED}, ${BULK_EFFICIENCY_FIELDS}`;
const BULK_SELECT_WITH_CONTACT_EFFICIENCY = `${BULK_SELECT_WITH_CONTACT}, ${BULK_EFFICIENCY_FIELDS}`;
const BULK_SELECT_BASE_EFFICIENCY = `${BULK_SELECT_BASE}, ${BULK_EFFICIENCY_FIELDS}`;

/** Cache del select que funcionó en este entorno (evita reintentos en cada página) */
let cachedBulkSelect: string | null = null;

/** PostgREST 406 cuando .single() no encuentra fila (p. ej. candidato borrado o id obsoleto en localStorage) */
function isNotFoundError(error: { message?: string; code?: string } | null): boolean {
    if (!error) return false;
    return error.code === 'PGRST116' || (error.message || '').includes('0 rows');
}

function getBulkSelectCandidates(): string[] {
    const allVariants = [
        BULK_SELECT_FULL_EFFICIENCY,
        BULK_SELECT_FULL,
        BULK_SELECT_WITH_REGISTRATION_EFFICIENCY,
        BULK_SELECT_WITH_REGISTRATION,
        BULK_SELECT_WITH_APPLICATION_EFFICIENCY,
        BULK_SELECT_WITH_APPLICATION,
        BULK_SELECT_WITH_CREATED_EFFICIENCY,
        BULK_SELECT_WITH_CREATED,
        BULK_SELECT_WITH_CONTACT_EFFICIENCY,
        BULK_SELECT_WITH_CONTACT,
        BULK_SELECT_BASE_EFFICIENCY,
        BULK_SELECT_BASE,
    ];
    if (!cachedBulkSelect) return allVariants;
    if (
        !cachedBulkSelect.includes('application_count') ||
        !cachedBulkSelect.includes('registration_origin')
    ) {
        return allVariants;
    }
    return [cachedBulkSelect, ...allVariants.filter(v => v !== cachedBulkSelect)];
}

function mapBulkCandidateRow(
    c: Record<string, unknown>,
    nextInterviews: Map<string, { start: string; interviewerId: string; eventId: string }>
): BulkCandidate {
    const nextInterview = nextInterviews.get(c.id as string);
    return {
        id: c.id as string,
        name: c.name as string,
        email: (c.email as string) || undefined,
        phone: (c.phone as string) || undefined,
        dni: (c.dni as string) || undefined,
        source: (c.source as string) || undefined,
        province: (c.province as string) || undefined,
        district: (c.district as string) || undefined,
        age: c.age != null ? (c.age as number) : undefined,
        scoreIa: (c.score_ia as number) || undefined,
        metadataIa: (c.metadata_ia as string) || undefined,
        stageId: c.stage_id as string,
        processId: c.process_id as string,
        contactPhone: readChannelSummaryFromRow(c, 'call'),
        contactWhatsapp: readChannelSummaryFromRow(c, 'whatsapp'),
        contactEmail: readChannelSummaryFromRow(c, 'email'),
        createdAt: (c.created_at as string) || undefined,
        applicationCount: c.application_count != null ? Number(c.application_count) : undefined,
        firstApplicationAt: (c.first_application_at as string) || undefined,
        registrationOrigin: (c.registration_origin as BulkCandidate['registrationOrigin']) || undefined,
        createdBy: (c.created_by as string) || undefined,
        contactLockUserId: (c.contact_lock_user_id as string) || undefined,
        contactLockUserName: (c.contact_lock_user_name as string) || undefined,
        contactLockUntil: (c.contact_lock_until as string) || undefined,
        contactLockReason: (c.contact_lock_reason as BulkCandidate['contactLockReason']) || undefined,
        nextInterviewAt: nextInterview?.start || undefined,
        nextInterviewerId: nextInterview?.interviewerId || undefined,
        nextInterviewEventId: nextInterview?.eventId || undefined,
        bulkColumnValues: (c.bulk_column_values as Record<string, unknown>) || undefined,
        hireDate: (c.hire_date as string) || undefined,
        offerAcceptedDate: (c.offer_accepted_date as string) || undefined,
        applicationStartedDate: (c.application_started_date as string) || undefined,
        applicationCompletedDate: (c.application_completed_date as string) || undefined,
    };
}

let bulkColumnValuesWriteSupported: boolean | null = null;

function isBulkColumnValuesWriteSupported(): boolean {
    return bulkColumnValuesWriteSupported !== false;
}

// Tipo ligero para la vista masiva (solo campos necesarios)
export interface BulkCandidate {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    dni?: string;
    source?: string;
    province?: string;
    district?: string;
    age?: number;
    scoreIa?: number;
    metadataIa?: string;
    stageId: string;
    processId: string;
    discarded?: boolean;
    archived?: boolean;
    contactPhone?: ChannelContactSummary;
    contactWhatsapp?: ChannelContactSummary;
    contactEmail?: ChannelContactSummary;
    createdAt?: string;
    /** Origen de incorporación: formulario, manual o carga masiva */
    registrationOrigin?: 'formulario' | 'manual' | 'masivo';
    createdBy?: string;
    contactLockUserId?: string;
    contactLockUserName?: string;
    contactLockUntil?: string;
    contactLockReason?: 'upload' | 'success';
    /** Última postulación por formulario (created_at se actualiza en re-postulaciones) */
    applicationCount?: number;
    firstApplicationAt?: string;
    nextInterviewAt?: string; // Fecha/hora de la próxima entrevista
    nextInterviewerId?: string; // ID del entrevistador de la próxima entrevista
    nextInterviewEventId?: string;
    /** Valores de columnas personalizadas (tabla alta densidad) */
    bulkColumnValues?: Record<string, unknown>;
    hireDate?: string;
    offerAcceptedDate?: string;
    applicationStartedDate?: string;
    applicationCompletedDate?: string;
    // Campos adicionales para el drawer (se cargan bajo demanda)
    description?: string;
    attachments?: any[];
    history?: CandidateHistory[];
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
        }
    ): Promise<BulkCandidatesResult> {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const applyFilters = (query: ReturnType<typeof supabase.from>) => {
            let q = query
                .eq('app_name', APP_NAME)
                .eq('archived', filters?.archived ?? false)
                .eq('discarded', filters?.discarded ?? false)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (processId) q = q.eq('process_id', processId);
            if (filters?.stageId) q = q.eq('stage_id', filters.stageId);
            if (filters?.search) {
                q = q.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
            }
            return q;
        };

        let data: Record<string, unknown>[] | null = null;
        let count: number | null = null;
        let lastError: { message?: string; code?: string } | null = null;

        for (const selectFields of getBulkSelectCandidates()) {
            const { data: rows, error, count: total } = await applyFilters(
                supabase.from('candidates').select(selectFields, { count: 'exact' })
            );
            if (!error) {
                data = (rows || []) as Record<string, unknown>[];
                count = total;
                if (
                    selectFields.includes('registration_origin') ||
                    selectFields.includes('application_count') ||
                    selectFields === BULK_SELECT_FULL
                ) {
                    cachedBulkSelect = selectFields;
                } else if (
                    !cachedBulkSelect?.includes('application_count') &&
                    !cachedBulkSelect?.includes('registration_origin')
                ) {
                    cachedBulkSelect = selectFields;
                }
                bulkColumnValuesWriteSupported = selectFields.includes('bulk_column_values');
                break;
            }
            lastError = error;
            if (!isMissingColumnError(error)) break;
            if (cachedBulkSelect === selectFields) cachedBulkSelect = null;
        }

        if (lastError && !data) throw lastError;

        if (data && data.length > 0 && data[0].application_count === undefined) {
            const ids = data.map(row => row.id as string);
            const countById = new Map<string, Record<string, unknown>>();
            for (let offset = 0; offset < ids.length; offset += 200) {
                const chunk = ids.slice(offset, offset + 200);
                const { data: countRows, error: countError } = await supabase
                    .from('candidates')
                    .select('id, application_count, first_application_at, created_at')
                    .in('id', chunk)
                    .eq('app_name', APP_NAME);
                if (countError) {
                    if (!isMissingColumnError(countError)) break;
                    continue;
                }
                for (const row of countRows || []) {
                    countById.set(row.id as string, row as Record<string, unknown>);
                }
            }
            if (countById.size > 0) {
                data = data.map(row => {
                    const extra = countById.get(row.id as string);
                    return extra ? { ...row, ...extra } : row;
                });
            }
        }

        if (data && data.length > 0 && data[0].registration_origin === undefined) {
            const ids = data.map(row => row.id as string);
            const originById = new Map<string, Record<string, unknown>>();
            for (let offset = 0; offset < ids.length; offset += 200) {
                const chunk = ids.slice(offset, offset + 200);
                const { data: originRows, error: originError } = await supabase
                    .from('candidates')
                    .select(
                        'id, registration_origin, email, application_count, first_application_at, created_by'
                    )
                    .in('id', chunk)
                    .eq('app_name', APP_NAME);
                if (originError) {
                    if (!isMissingColumnError(originError)) break;
                    continue;
                }
                for (const row of originRows || []) {
                    originById.set(row.id as string, row as Record<string, unknown>);
                }
            }
            if (originById.size > 0) {
                data = data.map(row => {
                    const extra = originById.get(row.id as string);
                    return extra ? { ...row, ...extra } : row;
                });
            }
        }

        // Obtener próximas entrevistas para los candidatos
        const candidateIds = (data || []).map(c => c.id as string);
        let nextInterviews: Map<string, { start: string; interviewerId: string; eventId: string }> = new Map();
        
        if (candidateIds.length > 0) {
            const { data: interviews, error: interviewsError } = await supabase
                .from('interview_events')
                .select('id, candidate_id, start_time, interviewer_id')
                .in('candidate_id', candidateIds)
                .eq('app_name', APP_NAME)
                .order('start_time', { ascending: true });

            if (interviewsError) {
                console.warn('No se pudieron cargar entrevistas de candidatos:', interviewsError.message);
            } else if (interviews) {
                const picked = buildInterviewMapFromRows(interviews);
                for (const [candidateId, slot] of picked) {
                    nextInterviews.set(candidateId, {
                        start: slot.start,
                        interviewerId: slot.interviewerId,
                        eventId: slot.eventId,
                    });
                }
            }
        }

        const candidates: BulkCandidate[] = (data || []).map(c =>
            mapBulkCandidateRow(c, nextInterviews)
        );

        return {
            candidates,
            total: count || 0,
            hasMore: (count || 0) > to + 1,
        };
    },

    /** Todas las páginas (para exportación masiva). Respeta los mismos filtros que getCandidates. */
    async getAllCandidates(
        processId: string,
        filters?: {
            stageId?: string;
            search?: string;
            archived?: boolean;
            discarded?: boolean;
        }
    ): Promise<BulkCandidate[]> {
        const pageSize = 400;
        const out: BulkCandidate[] = [];
        for (let page = 0; page < 500; page++) {
            const r = await this.getCandidates(processId, page, pageSize, filters);
            out.push(...r.candidates);
            if (!r.hasMore) break;
        }
        return out;
    },

    /** Historial de etapas por candidato (Panel de estadísticas en procesos masivos). */
    async loadCandidateHistoryByIds(
        candidateIds: string[]
    ): Promise<Record<string, CandidateHistory[]>> {
        const out: Record<string, CandidateHistory[]> = {};
        if (candidateIds.length === 0) return out;

        for (let offset = 0; offset < candidateIds.length; offset += 200) {
            const chunk = candidateIds.slice(offset, offset + 200);
            const { data, error } = await supabase
                .from('candidate_history')
                .select('candidate_id, stage_id, moved_at, moved_by')
                .in('candidate_id', chunk)
                .eq('app_name', APP_NAME)
                .order('moved_at', { ascending: true });

            if (error) throw error;

            for (const row of data || []) {
                const candidateId = row.candidate_id as string;
                if (!out[candidateId]) out[candidateId] = [];
                out[candidateId].push({
                    stageId: row.stage_id as string,
                    movedAt: row.moved_at as string,
                    movedBy: (row.moved_by as string) || 'System',
                });
            }
        }

        return out;
    },

    /** Carga bulk_column_values de TODOS los candidatos del proceso (sin paginación de tabla) */
    async loadAllBulkColumnValues(
        processId: string
    ): Promise<Record<string, Record<string, unknown>>> {
        const out: Record<string, Record<string, unknown>> = {};
        const pageSize = 500;

        for (let page = 0; page < 200; page++) {
            const from = page * pageSize;
            const to = from + pageSize - 1;

            const { data, error } = await supabase
                .from('candidates')
                .select('id, bulk_column_values')
                .eq('app_name', APP_NAME)
                .eq('process_id', processId)
                .eq('archived', false)
                .eq('discarded', false)
                .range(from, to);

            if (error) {
                if (isMissingColumnError(error)) return out;
                throw error;
            }

            for (const row of data || []) {
                const vals = row.bulk_column_values as Record<string, unknown> | null;
                out[row.id] = vals && Object.keys(vals).length > 0 ? vals : {};
            }

            if (!data || data.length < pageSize) break;
        }

        cachedBulkSelect = BULK_SELECT_FULL;
        bulkColumnValuesWriteSupported = true;
        return out;
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
    }, context?: { previousStageId?: string; movedBy?: string; lastStageId?: string }): Promise<void> {
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

        if (updates.stageId && context?.lastStageId && updates.stageId === context.lastStageId) {
            const { data: existing } = await supabase
                .from('candidates')
                .select('hire_date, offer_accepted_date, application_completed_date')
                .eq('id', candidateId)
                .eq('app_name', APP_NAME)
                .maybeSingle();
            const now = new Date().toISOString();
            if (!existing?.hire_date) dbUpdates.hire_date = now;
            if (!existing?.offer_accepted_date) dbUpdates.offer_accepted_date = now;
            if (!existing?.application_completed_date) dbUpdates.application_completed_date = now;
        }

        const { error } = await supabase
            .from('candidates')
            .update(dbUpdates)
            .eq('id', candidateId)
            .eq('app_name', APP_NAME);

        if (error) throw error;

        if (updates.stageId && context?.previousStageId && updates.stageId !== context.previousStageId) {
            await supabase.from('candidate_history').insert({
                candidate_id: candidateId,
                stage_id: updates.stageId,
                moved_at: new Date().toISOString(),
                moved_by: context.movedBy || null,
                app_name: APP_NAME,
            });
        }
    },

    /**
     * Actualización ligera de campos editables en la tabla (sin getById)
     */
    async patchFields(candidateId: string, updates: {
        name?: string;
        email?: string;
        phone?: string;
        dni?: string;
        source?: string;
        province?: string;
        district?: string;
        lastWhatsAppInteractionAt?: string | null;
    }): Promise<void> {
        const dbUpdates: Record<string, string | null> = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.email !== undefined) dbUpdates.email = updates.email;
        if (updates.phone !== undefined) dbUpdates.phone = updates.phone || null;
        if (updates.dni !== undefined) dbUpdates.dni = updates.dni || null;
        if (updates.source !== undefined) dbUpdates.source = updates.source || null;
        if (updates.lastWhatsAppInteractionAt !== undefined) {
            dbUpdates.last_whatsapp_interaction_at = updates.lastWhatsAppInteractionAt;
        }

        const locationFields: Record<string, string | null> = {};
        if (updates.province !== undefined) locationFields.province = updates.province || null;
        if (updates.district !== undefined) locationFields.district = updates.district || null;

        if (Object.keys(dbUpdates).length > 0) {
            const { error } = await supabase
                .from('candidates')
                .update(dbUpdates)
                .eq('id', candidateId)
                .eq('app_name', APP_NAME);
            if (error) throw error;
        }

        if (Object.keys(locationFields).length > 0) {
            const { error: locationError } = await supabase
                .from('candidates')
                .update(locationFields)
                .eq('id', candidateId)
                .eq('app_name', APP_NAME);
            if (locationError) {
                const msg = locationError.message || '';
                if (!msg.includes('schema cache') && !msg.includes('Could not find') && !msg.includes('column')) {
                    throw locationError;
                }
            }
        }
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
        },
        context?: {
            movedBy?: string;
            previousStageByCandidate?: Record<string, string | undefined>;
            lastStageId?: string;
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

        const isHiringMove =
            updates.stageId &&
            context?.lastStageId &&
            updates.stageId === context.lastStageId;

        if (isHiringMove) {
            const now = new Date().toISOString();
            const { data: existingRows } = await supabase
                .from('candidates')
                .select('id, hire_date, offer_accepted_date, application_completed_date')
                .in('id', candidateIds)
                .eq('app_name', APP_NAME);

            for (const row of existingRows || []) {
                const patch: Record<string, string> = {};
                if (!row.hire_date) patch.hire_date = now;
                if (!row.offer_accepted_date) patch.offer_accepted_date = now;
                if (!row.application_completed_date) patch.application_completed_date = now;
                if (Object.keys(patch).length === 0) continue;

                const { error: patchError } = await supabase
                    .from('candidates')
                    .update(patch)
                    .eq('id', row.id)
                    .eq('app_name', APP_NAME);
                if (patchError) {
                    console.warn('No se pudieron registrar fechas de contratación:', patchError.message);
                }
            }
        }

        const { error } = await supabase
            .from('candidates')
            .update(dbUpdates)
            .in('id', candidateIds)
            .eq('app_name', APP_NAME);

        if (error) throw error;

        if (updates.stageId && context?.previousStageByCandidate) {
            const now = new Date().toISOString();
            const rows = candidateIds
                .map(candidateId => {
                    const previousStageId = context.previousStageByCandidate?.[candidateId];
                    if (!previousStageId || previousStageId === updates.stageId) return null;
                    return {
                        candidate_id: candidateId,
                        stage_id: updates.stageId,
                        moved_at: now,
                        moved_by: context.movedBy || null,
                        app_name: APP_NAME,
                    };
                })
                .filter((row): row is NonNullable<typeof row> => row !== null);

            if (rows.length > 0) {
                const { error: historyError } = await supabase.from('candidate_history').insert(rows);
                if (historyError) {
                    console.warn('Historial de etapa no guardado en lote:', historyError.message);
                }
            }
        }
    },

    /**
     * Consultores que movieron candidatos a la etapa final (contratación) del proceso.
     */
    async getHiringStageActorsForProcess(
        processId: string,
        lastStageId: string
    ): Promise<Array<{ candidate_id: string; moved_at: string; moved_by: string | null }>> {
        const { data: candidates, error: candidatesError } = await supabase
            .from('candidates')
            .select('id')
            .eq('process_id', processId)
            .eq('app_name', APP_NAME);

        if (candidatesError) throw candidatesError;
        const candidateIds = (candidates || []).map(c => c.id as string);
        if (candidateIds.length === 0) return [];

        const { data, error } = await supabase
            .from('candidate_history')
            .select('candidate_id, moved_at, moved_by')
            .in('candidate_id', candidateIds)
            .eq('stage_id', lastStageId)
            .eq('app_name', APP_NAME)
            .order('moved_at', { ascending: false });

        if (error) throw error;
        return (data || []) as Array<{ candidate_id: string; moved_at: string; moved_by: string | null }>;
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
     * Fusiona valores de columnas personalizadas en bulk_column_values (JSONB).
     * @returns true si se escribió en BD; false si la columna no existe o no está soportada
     */
    async patchBulkColumnValues(
        candidateId: string,
        values: Record<string, unknown>,
        customColumns: CustomColumn[] = [],
        options?: { replace?: boolean }
    ): Promise<boolean> {
        if (Object.keys(values).length === 0) return true;
        if (!isBulkColumnValuesWriteSupported()) return false;

        const enriched = customColumns.length > 0
            ? enrichBulkColumnValuesForStorage(values, customColumns)
            : values;

        if (options?.replace) {
            const { error } = await supabase
                .from('candidates')
                .update({ bulk_column_values: enriched })
                .eq('id', candidateId)
                .eq('app_name', APP_NAME);

            if (error) {
                if (isMissingColumnError(error)) {
                    bulkColumnValuesWriteSupported = false;
                    return false;
                }
                throw error;
            }
            return true;
        }

        const { data, error: fetchError } = await supabase
            .from('candidates')
            .select('bulk_column_values')
            .eq('id', candidateId)
            .eq('app_name', APP_NAME)
            .maybeSingle();

        if (fetchError) {
            if (isMissingColumnError(fetchError)) {
                bulkColumnValuesWriteSupported = false;
                return false;
            }
            if (isNotFoundError(fetchError)) return false;
            throw fetchError;
        }
        if (!data) return false;

        const current = (data.bulk_column_values as Record<string, unknown>) || {};
        const merged = { ...current, ...enriched };

        const { error } = await supabase
            .from('candidates')
            .update({ bulk_column_values: merged })
            .eq('id', candidateId)
            .eq('app_name', APP_NAME);

        if (error) {
            if (isMissingColumnError(error)) {
                bulkColumnValuesWriteSupported = false;
                return false;
            }
            throw error;
        }
        return true;
    },

    /**
     * Solo rellena celdas vacías (importación aditiva — no pisa ediciones manuales).
     */
    async patchBulkColumnValuesFillEmpty(
        candidateId: string,
        values: Record<string, unknown>,
        customColumns: CustomColumn[] = []
    ): Promise<boolean> {
        if (Object.keys(values).length === 0) return true;
        if (!isBulkColumnValuesWriteSupported()) return false;

        const { data, error: fetchError } = await supabase
            .from('candidates')
            .select('bulk_column_values')
            .eq('id', candidateId)
            .eq('app_name', APP_NAME)
            .maybeSingle();

        if (fetchError) {
            if (isMissingColumnError(fetchError)) {
                bulkColumnValuesWriteSupported = false;
                return false;
            }
            if (isNotFoundError(fetchError)) return false;
            throw fetchError;
        }
        if (!data) return false;

        const current = (data?.bulk_column_values as Record<string, unknown>) || {};
        const patch: Record<string, unknown> = {};

        if (customColumns.length > 0) {
            for (const col of customColumns) {
                const incoming =
                    values[col.id] ?? values[bulkColumnNameKey(col.name)];
                if (!hasBulkCellValue(incoming)) continue;
                const currentVal = resolveColumnValueFromRow(current, col);
                if (!hasBulkCellValue(currentVal)) {
                    patch[col.id] = incoming;
                }
            }
        } else {
            for (const [key, val] of Object.entries(values)) {
                const existing = current[key];
                if (existing === undefined || existing === null || existing === '') {
                    patch[key] = val;
                }
            }
        }

        if (Object.keys(patch).length === 0) return true;
        return this.patchBulkColumnValues(candidateId, { ...current, ...patch }, customColumns);
    },

    async batchFillEmptyBulkColumnValues(
        updates: Record<string, Record<string, unknown>>,
        customColumns: CustomColumn[] = []
    ): Promise<void> {
        const entries = Object.entries(updates);
        if (entries.length === 0) return;

        const results = await Promise.all(
            entries.map(([candidateId, values]) =>
                this.patchBulkColumnValuesFillEmpty(candidateId, values, customColumns)
            )
        );

        const okCount = results.filter(Boolean).length;
        if (okCount === 0 && entries.length > 0 && bulkColumnValuesWriteSupported === false) {
            throw new Error(
                'No se pudieron guardar los valores de columnas. Ejecute MIGRATION_ADD_BULK_COLUMN_VALUES.sql en Supabase.'
            );
        }
    },

    /**
     * Establece bulk_column_values para varios candidatos (p. ej. importación Excel).
     */
    async batchSetBulkColumnValues(
        updates: Record<string, Record<string, unknown>>,
        customColumns: CustomColumn[] = [],
        options?: { replace?: boolean }
    ): Promise<void> {
        const entries = Object.entries(updates);
        if (entries.length === 0) return;

        const chunkSize = 20;
        for (let i = 0; i < entries.length; i += chunkSize) {
            const chunk = entries.slice(i, i + chunkSize);
            const results = await Promise.all(
                chunk.map(([candidateId, values]) =>
                    this.patchBulkColumnValues(candidateId, values, customColumns, options)
                )
            );
            const okCount = results.filter(Boolean).length;
            if (okCount === 0 && chunk.length > 0 && bulkColumnValuesWriteSupported === false) {
                throw new Error(
                    'No se pudieron guardar los valores de columnas. Ejecute MIGRATION_ADD_BULK_COLUMN_VALUES.sql en Supabase.'
                );
            }
        }
    },

    /**
     * Normaliza mayúsculas en todos los candidatos del proceso y persiste en Supabase.
     */
    async normalizeProcessTextCase(
        processId: string,
        customColumns: CustomColumn[] = [],
        bulkConfig?: BulkProcessConfig
    ): Promise<{ candidates: number; cells: number }> {
        const legacy = buildLegacyColumnIdToName(bulkConfig, customColumns);
        const candidates = await this.getAllCandidates(processId, {
            archived: false,
            discarded: false,
        });
        const fromDb = await this.loadAllBulkColumnValues(processId);

        const columnValues: Record<string, Record<string, unknown>> = {};
        for (const c of candidates) {
            const dbRow = fromDb[c.id] || (c.bulkColumnValues as Record<string, unknown> | undefined) || {};
            columnValues[c.id] = { ...dbRow };
        }

        const { repaired, changed: bulkChanged } = repairTextCaseColumnValues(
            columnValues as Record<string, Record<string, any>>,
            customColumns,
            legacy
        );

        const bulkUpdates: Record<string, Record<string, unknown>> = {};
        let cellCount = 0;

        if (bulkChanged) {
            for (const c of candidates) {
                const before = columnValues[c.id] || {};
                const after = repaired[c.id] || {};
                const enriched = enrichBulkColumnValuesForStorage(after, customColumns);
                const differs = customColumns.some(col => {
                    const b = resolveColumnValueFromRow(before as Record<string, unknown>, col, legacy);
                    const a = resolveColumnValueFromRow(enriched, col, legacy);
                    return String(b ?? '') !== String(a ?? '');
                });
                if (differs) {
                    bulkUpdates[c.id] = enriched;
                    cellCount += customColumns.filter(col => {
                        const b = resolveColumnValueFromRow(before as Record<string, unknown>, col, legacy);
                        const a = resolveColumnValueFromRow(enriched, col, legacy);
                        return String(b ?? '') !== String(a ?? '');
                    }).length;
                }
            }
        }

        const fieldPatches: { id: string; patch: ReturnType<typeof buildStandardFieldTextCasePatch> }[] = [];

        for (const c of candidates) {
            const patch = buildStandardFieldTextCasePatch(c);
            if (Object.keys(patch).length > 0) {
                fieldPatches.push({ id: c.id, patch });
            }
        }

        if (Object.keys(bulkUpdates).length > 0) {
            await this.batchSetBulkColumnValues(bulkUpdates, customColumns);
        }

        const chunkSize = 15;
        for (let i = 0; i < fieldPatches.length; i += chunkSize) {
            const chunk = fieldPatches.slice(i, i + chunkSize);
            await Promise.all(chunk.map(({ id, patch }) => this.patchFields(id, patch)));
        }

        return {
            candidates: new Set([...Object.keys(bulkUpdates), ...fieldPatches.map(p => p.id)]).size,
            cells: cellCount + fieldPatches.reduce((n, p) => n + Object.keys(p.patch).length, 0),
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
