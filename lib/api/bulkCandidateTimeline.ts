import { supabase } from '../supabase';
import { APP_NAME } from '../appConfig';
import {
    bulkProcessActivityApi,
    BulkProcessActivityEntry,
    BulkActivityActionType,
} from './bulkProcessActivity';
import { workerHandoffApi } from './workerHandoff';
import type { Process, DocumentCategory, Attachment, PsycholaboralEvaluation } from '../../types';
import type { ContactAttempt } from '../contactTracking';
import {
    CONTACT_OUTCOME_LABELS,
    CONTACT_STATUS_META,
    isSyncedContactAttempt,
    normalizeContactStatus,
} from '../contactTracking';
import { DELIVERY_STATUS_LABELS } from '../workerHandoffFields';
import { formatRegistrationOrigin } from '../candidateRegistrationOrigin';

export type BulkTimelineEventKind =
    | 'incorporation'
    | 'stage_change'
    | 'edit'
    | 'contact'
    | 'document'
    | 'interview'
    | 'psycholaboral'
    | 'opsflow'
    | 'discard'
    | 'archive'
    | 'approval'
    | 'import'
    | 'other';

export interface BulkTimelineEvent {
    id: string;
    kind: BulkTimelineEventKind;
    timestamp: string;
    title: string;
    description?: string;
    userName?: string;
}

export interface BulkChecklistSummary {
    totalCategories: number;
    completeRequired: number;
    requiredTotal: number;
    canAdvanceStage: boolean;
    missingForStage: string[];
    items: Array<{
        categoryId: string;
        categoryName: string;
        required: boolean;
        complete: boolean;
        documentCount: number;
    }>;
}

export interface BulkCandidateTimelineResult {
    events: BulkTimelineEvent[];
    checklist: BulkChecklistSummary | null;
    currentStageName?: string;
    statusLabel?: string;
}

const ACTION_LABELS: Record<BulkActivityActionType, string> = {
    cell_edit: 'Campo actualizado',
    stage_change: 'Cambio de etapa',
    bulk_stage_change: 'Cambio de etapa',
    bulk_discard: 'Candidato descartado',
    bulk_archive: 'Candidato archivado',
    bulk_approve: 'Candidato aprobado',
    candidate_delete: 'Candidato eliminado',
    import: 'Importado al proceso',
    config_change: 'Configuración del proceso',
    cell_meta: 'Nota o color en celda',
    paste: 'Datos pegados en tabla',
    contact_attempt: 'Intento de contacto',
    contact_status: 'Estado de contacto actualizado',
    contact_reset: 'Contacto reiniciado',
    add_row: 'Registro creado manualmente',
    opsflow_send: 'Enviado a OpsFlow',
};

const CHANNEL_LABELS: Record<string, string> = {
    call: 'Llamada',
    whatsapp: 'WhatsApp',
    email: 'Email',
};

function describeActivityEntry(entry: BulkProcessActivityEntry): { title: string; description?: string; kind: BulkTimelineEventKind } {
    const baseTitle = ACTION_LABELS[entry.actionType] || entry.actionType;
    const parts: string[] = [];

    if (entry.fieldName) parts.push(`«${entry.fieldName}»`);
    if (entry.oldValue != null || entry.newValue != null) {
        const from = entry.oldValue != null && entry.oldValue !== '' ? entry.oldValue : '(vacío)';
        const to = entry.newValue != null && entry.newValue !== '' ? entry.newValue : '(vacío)';
        parts.push(`${from} → ${to}`);
    } else if (entry.details?.summary) {
        parts.push(String(entry.details.summary));
    } else if (entry.details?.channel) {
        parts.push(CHANNEL_LABELS[String(entry.details.channel)] || String(entry.details.channel));
    }

    let kind: BulkTimelineEventKind = 'other';
    switch (entry.actionType) {
        case 'cell_edit':
        case 'cell_meta':
        case 'paste':
            kind = 'edit';
            break;
        case 'stage_change':
        case 'bulk_stage_change':
            kind = 'stage_change';
            break;
        case 'contact_attempt':
        case 'contact_status':
        case 'contact_reset':
            kind = 'contact';
            break;
        case 'bulk_discard':
            kind = 'discard';
            break;
        case 'bulk_archive':
            kind = 'archive';
            break;
        case 'bulk_approve':
            kind = 'approval';
            break;
        case 'opsflow_send':
            kind = 'opsflow';
            break;
        case 'import':
        case 'add_row':
            kind = 'import';
            break;
        default:
            kind = 'other';
    }

    return {
        title: baseTitle,
        description: parts.length > 0 ? parts.join(' · ') : undefined,
        kind,
    };
}

function buildChecklistSummary(
    process: Process | undefined,
    stageId: string | undefined,
    attachments: Attachment[]
): BulkChecklistSummary | null {
    const categories = process?.documentCategories || [];
    if (categories.length === 0) return null;

    const byCategory = attachments.reduce((acc, att) => {
        const key = att.category || 'sin_categoria';
        if (!acc[key]) acc[key] = [];
        acc[key].push(att);
        return acc;
    }, {} as Record<string, Attachment[]>);

    const currentStage = process?.stages.find(s => s.id === stageId);
    const requiredForStage = currentStage?.requiredDocuments || [];

    const items = categories.map((cat: DocumentCategory) => {
        const docs = byCategory[cat.id] || [];
        return {
            categoryId: cat.id,
            categoryName: cat.name,
            required: cat.required,
            complete: docs.length > 0,
            documentCount: docs.length,
        };
    });

    const requiredTotal = categories.filter(c => c.required).length;
    const completeRequired = items.filter(i => i.required && i.complete).length;
    const missingForStage = requiredForStage
        .filter(catId => !(byCategory[catId]?.length))
        .map(catId => categories.find(c => c.id === catId)?.name || catId);

    return {
        totalCategories: categories.length,
        completeRequired,
        requiredTotal,
        canAdvanceStage: missingForStage.length === 0,
        missingForStage,
        items,
    };
}

function resolveStageName(process: Process | undefined, stageId: string): string {
    return process?.stages.find(s => s.id === stageId)?.name || 'Etapa desconocida';
}

function resolveUserName(movedBy: string | null | undefined, userMap: Map<string, string>): string {
    if (!movedBy) return 'Sistema';
    if (userMap.has(movedBy)) return userMap.get(movedBy)!;
    const isLikelyId = movedBy.length > 20 || movedBy.includes('-');
    return isLikelyId ? 'Usuario' : movedBy;
}

export const bulkCandidateTimelineApi = {
    async getTimeline(
        candidateId: string,
        process: Process | undefined,
        userNameById: Map<string, string> = new Map()
    ): Promise<BulkCandidateTimelineResult> {
        const events: BulkTimelineEvent[] = [];

        const [candidateRes, activityEntries, contactRes, interviewRes, opsflowEntries] = await Promise.all([
            supabase
                .from('candidates')
                .select(`
                    id, name, source, registration_origin, created_at, stage_id, process_id,
                    discarded, discarded_at, discard_reason,
                    archived, archived_at,
                    hire_date, offer_accepted_date,
                    psycholaboral_evaluation,
                    attachments:attachments!candidate_id(id, name, category, uploaded_at, type),
                    history:candidate_history!candidate_id(stage_id, moved_at, moved_by)
                `)
                .eq('id', candidateId)
                .eq('app_name', APP_NAME)
                .single(),
            bulkProcessActivityApi.getByCandidate(candidateId).catch(() => [] as BulkProcessActivityEntry[]),
            supabase
                .from('candidate_contact_attempts')
                .select('*')
                .eq('candidate_id', candidateId)
                .eq('app_name', APP_NAME)
                .order('created_at', { ascending: false })
                .limit(100),
            supabase
                .from('interview_events')
                .select('id, title, start_time, end_time, interviewer_id, notes')
                .eq('candidate_id', candidateId)
                .eq('app_name', APP_NAME)
                .order('start_time', { ascending: false })
                .limit(50),
            workerHandoffApi.getCandidateHandoffHistory(candidateId).catch(() => []),
        ]);

        if (candidateRes.error) throw candidateRes.error;
        const candidate = candidateRes.data;
        const attachments: Attachment[] = (candidate.attachments || []).map((att: Record<string, unknown>) => ({
            id: att.id as string,
            name: att.name as string,
            url: '',
            type: (att.type as string) || '',
            size: 0,
            category: (att.category as string) || undefined,
            uploadedAt: (att.uploaded_at as string) || undefined,
        }));

        const checklist = buildChecklistSummary(process, candidate.stage_id, attachments);
        const currentStageName = resolveStageName(process, candidate.stage_id);

        let statusLabel: string | undefined;
        if (candidate.discarded) statusLabel = 'Descartado';
        else if (candidate.archived) statusLabel = 'Archivado';
        else if (candidate.hire_date || candidate.offer_accepted_date) statusLabel = 'Contratado / Oferta aceptada';
        else statusLabel = currentStageName;

        if (candidate.created_at) {
            events.push({
                id: `inc-${candidate.id}`,
                kind: 'incorporation',
                timestamp: candidate.created_at,
                title: 'Incorporación al ATS',
                description: [
                    candidate.registration_origin
                        ? `Alta: ${formatRegistrationOrigin(candidate.registration_origin as 'formulario' | 'manual' | 'masivo')}`
                        : null,
                    candidate.source ? `Fuente: ${candidate.source}` : null,
                ]
                    .filter(Boolean)
                    .join(' · ') || 'Postulante registrado en el proceso masivo',
            });
        }

        const historyRows = (candidate.history || []) as Array<{ stage_id: string; moved_at: string; moved_by?: string }>;
        for (const h of historyRows) {
            events.push({
                id: `hist-${h.stage_id}-${h.moved_at}`,
                kind: 'stage_change',
                timestamp: h.moved_at,
                title: `Avanzó a «${resolveStageName(process, h.stage_id)}»`,
                userName: resolveUserName(h.moved_by, userNameById),
            });
        }

        for (const att of attachments) {
            if (!att.uploadedAt) continue;
            events.push({
                id: `doc-${att.id}`,
                kind: 'document',
                timestamp: att.uploadedAt,
                title: 'Documento adjuntado',
                description: att.category
                    ? `${att.name} (${att.category})`
                    : att.name,
            });
        }

        const contactAttempts: ContactAttempt[] = (contactRes.data || []).map((row: Record<string, unknown>) => ({
            id: row.id as string,
            candidateId: row.candidate_id as string,
            processId: row.process_id as string,
            userId: (row.user_id as string) || undefined,
            userName: (row.user_name as string) || undefined,
            channel: row.channel as ContactAttempt['channel'],
            outcome: row.outcome as ContactAttempt['outcome'],
            attemptNumber: (row.attempt_number as number) || 1,
            statusAfter: row.status_after as ContactAttempt['statusAfter'],
            notes: (row.notes as string) || undefined,
            createdAt: row.created_at as string,
        }));

        for (const attempt of contactAttempts) {
            const channel = CHANNEL_LABELS[attempt.channel] || attempt.channel;
            const outcome = CONTACT_OUTCOME_LABELS[attempt.outcome] || attempt.outcome;
            const statusAfter = attempt.statusAfter
                ? CONTACT_STATUS_META[normalizeContactStatus(attempt.statusAfter)].label
                : undefined;
            const synced = isSyncedContactAttempt(attempt);
            events.push({
                id: `contact-${attempt.id}`,
                kind: 'contact',
                timestamp: attempt.createdAt,
                title: synced ? `Contacto por ${channel} (sincronizado)` : `Contacto por ${channel}`,
                description: [
                    outcome,
                    statusAfter ? `Estado: ${statusAfter}` : null,
                    synced ? 'Registro reconstruido automáticamente desde la tabla' : null,
                ]
                    .filter(Boolean)
                    .join(' · '),
                userName: attempt.userName,
            });
        }

        for (const entry of activityEntries) {
            if (entry.actionType === 'stage_change') continue;
            const { title, description, kind } = describeActivityEntry(entry);
            events.push({
                id: `act-${entry.id}`,
                kind,
                timestamp: entry.createdAt,
                title,
                description,
                userName: entry.userName,
            });
        }

        for (const ev of interviewRes.data || []) {
            events.push({
                id: `int-${ev.id}`,
                kind: 'interview',
                timestamp: ev.start_time,
                title: ev.title || 'Entrevista programada',
                description: ev.notes || undefined,
            });
        }

        const psych = candidate.psycholaboral_evaluation as PsycholaboralEvaluation | null;
        if (psych?.evaluatedAt || psych?.reportDate) {
            events.push({
                id: `psych-${candidate.id}`,
                kind: 'psycholaboral',
                timestamp: psych.evaluatedAt || psych.reportDate!,
                title: 'Informe psicolaboral',
                description: psych.suitabilityStatus
                    ? `Idoneidad: ${psych.suitabilityStatus.replace('_', ' ')}`
                    : undefined,
            });
        }

        for (const entry of opsflowEntries) {
            events.push({
                id: `ops-${entry.itemId}`,
                kind: 'opsflow',
                timestamp: entry.sentAt,
                title: 'Envío a OpsFlow',
                description: [
                    DELIVERY_STATUS_LABELS[entry.deliveryStatus || ''] || entry.deliveryStatus,
                    entry.senderNote,
                ].filter(Boolean).join(' · '),
                userName: entry.createdByName,
            });
        }

        if (candidate.discarded && candidate.discarded_at) {
            events.push({
                id: `discard-${candidate.id}`,
                kind: 'discard',
                timestamp: candidate.discarded_at,
                title: 'Candidato descartado',
                description: candidate.discard_reason || undefined,
            });
        }

        if (candidate.archived && candidate.archived_at) {
            events.push({
                id: `archive-${candidate.id}`,
                kind: 'archive',
                timestamp: candidate.archived_at,
                title: 'Candidato archivado',
            });
        }

        if (candidate.offer_accepted_date) {
            events.push({
                id: `offer-${candidate.id}`,
                kind: 'approval',
                timestamp: candidate.offer_accepted_date,
                title: 'Oferta aceptada',
            });
        } else if (candidate.hire_date) {
            events.push({
                id: `hire-${candidate.id}`,
                kind: 'approval',
                timestamp: candidate.hire_date,
                title: 'Contratación registrada',
            });
        }

        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return { events, checklist, currentStageName, statusLabel };
    },
};
