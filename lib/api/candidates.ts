import { supabase } from '../supabase';
import { Candidate, CandidateHistory, PostIt, Comment, Attachment } from '../../types';

// Convertir de DB a tipo de aplicación
async function dbToCandidate(dbCandidate: any): Promise<Candidate> {
    // Obtener historial
    const { data: history } = await supabase
        .from('candidate_history')
        .select('*')
        .eq('candidate_id', dbCandidate.id)
        .order('moved_at', { ascending: true });

    // Obtener post-its
    const { data: postIts } = await supabase
        .from('post_its')
        .select('*')
        .eq('candidate_id', dbCandidate.id)
        .order('created_at', { ascending: false });

    // Obtener comentarios
    const { data: comments } = await supabase
        .from('comments')
        .select('*')
        .eq('candidate_id', dbCandidate.id)
        .order('created_at', { ascending: false });

    // Obtener adjuntos
    const { data: attachments } = await supabase
        .from('attachments')
        .select('*')
        .eq('candidate_id', dbCandidate.id)
        .order('uploaded_at', { ascending: false });

    // Obtener adjuntos de comentarios
    const commentIds = (comments || []).map(c => c.id);
    let commentAttachments: any[] = [];
    if (commentIds.length > 0) {
        const { data: commentAtts } = await supabase
            .from('attachments')
            .select('*')
            .in('comment_id', commentIds);
        commentAttachments = commentAtts || [];
    }

    // Mapear comentarios con sus adjuntos
    const commentsWithAttachments = (comments || []).map(comment => ({
        id: comment.id,
        text: comment.text,
        userId: comment.user_id,
        createdAt: comment.created_at,
        attachments: commentAttachments
            .filter(att => att.comment_id === comment.id)
            .map(att => ({
                id: att.id,
                name: att.name,
                url: att.url,
                type: att.type,
                size: att.size,
                category: att.category,
                uploadedAt: att.uploaded_at,
            })),
    }));

    return {
        id: dbCandidate.id,
        name: dbCandidate.name,
        email: dbCandidate.email,
        phone: dbCandidate.phone,
        processId: dbCandidate.process_id,
        stageId: dbCandidate.stage_id,
        description: dbCandidate.description,
        history: (history || []).map(h => ({
            stageId: h.stage_id,
            movedAt: h.moved_at,
            movedBy: h.moved_by || 'System',
        })),
        avatarUrl: dbCandidate.avatar_url,
        attachments: (attachments || []).map(att => ({
            id: att.id,
            name: att.name,
            url: att.url,
            type: att.type,
            size: att.size,
            category: att.category,
            uploadedAt: att.uploaded_at,
        })),
        source: dbCandidate.source,
        salaryExpectation: dbCandidate.salary_expectation,
        agreedSalary: dbCandidate.agreed_salary,
        age: dbCandidate.age,
        dni: dbCandidate.dni,
        linkedinUrl: dbCandidate.linkedin_url,
        address: dbCandidate.address,
        province: dbCandidate.province,
        district: dbCandidate.district,
        postIts: (postIts || []).map(p => ({
            id: p.id,
            text: p.text,
            color: p.color,
            createdBy: p.created_by,
            createdAt: p.created_at,
        })),
        comments: commentsWithAttachments,
        archived: dbCandidate.archived || false,
        archivedAt: dbCandidate.archived_at,
        hireDate: dbCandidate.hire_date,
        googleDriveFolderId: dbCandidate.google_drive_folder_id,
        googleDriveFolderName: dbCandidate.google_drive_folder_name,
        visibleToClients: dbCandidate.visible_to_clients ?? false,
        offerAcceptedDate: dbCandidate.offer_accepted_date,
        applicationStartedDate: dbCandidate.application_started_date,
        applicationCompletedDate: dbCandidate.application_completed_date,
    };
}

// Convertir de tipo de aplicación a DB
function candidateToDb(candidate: Partial<Candidate>): any {
    const dbCandidate: any = {};
    if (candidate.name !== undefined) dbCandidate.name = candidate.name;
    if (candidate.email !== undefined) dbCandidate.email = candidate.email;
    if (candidate.phone !== undefined) dbCandidate.phone = candidate.phone;
    if (candidate.processId !== undefined) dbCandidate.process_id = candidate.processId;
    if (candidate.stageId !== undefined) dbCandidate.stage_id = candidate.stageId;
    if (candidate.description !== undefined) dbCandidate.description = candidate.description;
    if (candidate.avatarUrl !== undefined) dbCandidate.avatar_url = candidate.avatarUrl;
    if (candidate.source !== undefined) dbCandidate.source = candidate.source;
    if (candidate.salaryExpectation !== undefined) dbCandidate.salary_expectation = candidate.salaryExpectation;
    if (candidate.agreedSalary !== undefined) dbCandidate.agreed_salary = candidate.agreedSalary;
    if (candidate.age !== undefined) dbCandidate.age = candidate.age;
    if (candidate.dni !== undefined) dbCandidate.dni = candidate.dni;
    if (candidate.linkedinUrl !== undefined) dbCandidate.linkedin_url = candidate.linkedinUrl;
    if (candidate.address !== undefined) dbCandidate.address = candidate.address;
    if (candidate.province !== undefined) dbCandidate.province = candidate.province && candidate.province.trim() ? candidate.province.trim() : null;
    // El distrito puede quedar en blanco - se guarda como null si está vacío
    if (candidate.district !== undefined) dbCandidate.district = candidate.district && candidate.district.trim() ? candidate.district.trim() : null;
    if (candidate.archived !== undefined) dbCandidate.archived = candidate.archived;
    if (candidate.archivedAt !== undefined) dbCandidate.archived_at = candidate.archivedAt;
    if (candidate.hireDate !== undefined) dbCandidate.hire_date = candidate.hireDate;
    if (candidate.googleDriveFolderId !== undefined) dbCandidate.google_drive_folder_id = candidate.googleDriveFolderId;
    if (candidate.googleDriveFolderName !== undefined) dbCandidate.google_drive_folder_name = candidate.googleDriveFolderName;
    if (candidate.visibleToClients !== undefined) dbCandidate.visible_to_clients = candidate.visibleToClients;
    if (candidate.offerAcceptedDate !== undefined) dbCandidate.offer_accepted_date = candidate.offerAcceptedDate;
    if (candidate.applicationStartedDate !== undefined) dbCandidate.application_started_date = candidate.applicationStartedDate;
    if (candidate.applicationCompletedDate !== undefined) dbCandidate.application_completed_date = candidate.applicationCompletedDate;
    return dbCandidate;
}

export const candidatesApi = {
    // Obtener todos los candidatos
    async getAll(includeArchived: boolean = false): Promise<Candidate[]> {
        let query = supabase
            .from('candidates')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!includeArchived) {
            query = query.eq('archived', false);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data) return [];

        return Promise.all(data.map(dbToCandidate));
    },

    // Obtener candidatos por proceso
    async getByProcess(processId: string, includeArchived: boolean = false): Promise<Candidate[]> {
        let query = supabase
            .from('candidates')
            .select('*')
            .eq('process_id', processId)
            .order('created_at', { ascending: false });
        
        if (!includeArchived) {
            query = query.eq('archived', false);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data) return [];

        return Promise.all(data.map(dbToCandidate));
    },

    // Obtener un candidato por ID
    async getById(id: string): Promise<Candidate | null> {
        const { data, error } = await supabase
            .from('candidates')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        return data ? await dbToCandidate(data) : null;
    },

    // Crear candidato
    async create(candidateData: Omit<Candidate, 'id' | 'history'>, createdBy?: string): Promise<Candidate> {
        const dbData = candidateToDb(candidateData);
        if (createdBy) dbData.created_by = createdBy;
        // Set application_started_date if not provided
        if (!dbData.application_started_date) {
            dbData.application_started_date = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('candidates')
            .insert(dbData)
            .select()
            .single();
        
        if (error) throw error;

        // Crear entrada inicial en historial
        if (candidateData.stageId) {
            await supabase.from('candidate_history').insert({
                candidate_id: data.id,
                stage_id: candidateData.stageId,
                moved_at: new Date().toISOString(),
                moved_by: createdBy || null,
            });
        }

        // Guardar attachments si existen
        if (candidateData.attachments && candidateData.attachments.length > 0) {
            const attachmentsToInsert = candidateData.attachments.map(att => {
                // Generar UUID si el ID no es un UUID válido
                let attachmentId = att.id;
                if (!attachmentId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                    attachmentId = crypto.randomUUID();
                }
                
                return {
                    id: attachmentId,
                    candidate_id: data.id,
                    name: att.name,
                    url: att.url,
                    type: att.type,
                    size: att.size,
                    category: att.category || null,
                    uploaded_at: att.uploadedAt || new Date().toISOString(),
                    comment_id: null,
                };
            });

            const { error: attError } = await supabase
                .from('attachments')
                .insert(attachmentsToInsert);

            if (attError) {
                console.error('Error guardando attachments al crear candidato:', attError);
            } else {
                console.log(`✅ ${attachmentsToInsert.length} attachments guardados al crear candidato`);
            }
        }

        return await this.getById(data.id) as Candidate;
    },

    // Actualizar candidato
    async update(id: string, candidateData: Partial<Candidate>, movedBy?: string): Promise<Candidate> {
        // Obtener candidato actual para comparar stage
        const current = await this.getById(id);
        if (!current) throw new Error('Candidate not found');

        const dbData = candidateToDb(candidateData);
        const { error } = await supabase
            .from('candidates')
            .update(dbData)
            .eq('id', id);
        
        if (error) throw error;

        // Si cambió el stage, agregar al historial
        if (candidateData.stageId && candidateData.stageId !== current.stageId) {
            await supabase.from('candidate_history').insert({
                candidate_id: id,
                stage_id: candidateData.stageId,
                moved_at: new Date().toISOString(),
                moved_by: movedBy || null,
            });
        }

        // Sincronizar attachments: guardar en la tabla attachments
        if (candidateData.attachments !== undefined) {
            // Obtener attachments actuales de la BD
            const { data: currentAttachments } = await supabase
                .from('attachments')
                .select('id')
                .eq('candidate_id', id)
                .is('comment_id', null);

            const currentAttachmentIds = new Set((currentAttachments || []).map(a => a.id));
            const newAttachmentIds = new Set(candidateData.attachments.map(a => a.id));

            // Eliminar attachments que ya no están en la lista
            const toDelete = Array.from(currentAttachmentIds).filter(id => !newAttachmentIds.has(id));
            if (toDelete.length > 0) {
                await supabase
                    .from('attachments')
                    .delete()
                    .in('id', toDelete);
            }

            // Insertar o actualizar attachments
            for (const attachment of candidateData.attachments) {
                // Generar UUID si el ID no es un UUID válido
                let attachmentId = attachment.id;
                if (!attachmentId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                    // Si no es UUID, generar uno nuevo
                    attachmentId = crypto.randomUUID();
                }
                
                const attachmentData = {
                    id: attachmentId,
                    candidate_id: id,
                    name: attachment.name,
                    url: attachment.url,
                    type: attachment.type,
                    size: attachment.size,
                    category: attachment.category || null,
                    uploaded_at: attachment.uploadedAt || new Date().toISOString(),
                    comment_id: null, // Attachments de candidato no tienen comment_id
                };

                // Usar upsert para insertar o actualizar
                const { error: attError } = await supabase
                    .from('attachments')
                    .upsert(attachmentData, { onConflict: 'id' });

                if (attError) {
                    console.error('Error guardando attachment:', attError);
                    console.error('Attachment data:', attachmentData);
                } else {
                    console.log(`✅ Attachment guardado en BD: ${attachment.name} (ID: ${attachmentId})`);
                }
            }
        }

        return await this.getById(id) as Candidate;
    },

    // Eliminar candidato
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('candidates')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    },

    // Archivar candidato
    async archive(id: string): Promise<Candidate> {
        const { error } = await supabase
            .from('candidates')
            .update({
                archived: true,
                archived_at: new Date().toISOString(),
            })
            .eq('id', id);
        
        if (error) throw error;
        return await this.getById(id) as Candidate;
    },

    // Restaurar candidato
    async restore(id: string): Promise<Candidate> {
        const { error } = await supabase
            .from('candidates')
            .update({
                archived: false,
                archived_at: null,
            })
            .eq('id', id);
        
        if (error) throw error;
        return await this.getById(id) as Candidate;
    },
};

