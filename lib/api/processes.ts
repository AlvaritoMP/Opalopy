import { supabase } from '../supabase';
import { Process, Stage, DocumentCategory, Attachment } from '../../types';

// Convertir de DB a tipo de aplicación
function dbToProcess(dbProcess: any, stages: any[] = [], documentCategories: any[] = [], attachments: any[] = []): Process {
    return {
        id: dbProcess.id,
        title: dbProcess.title,
        description: dbProcess.description || '',
        stages: stages.map(s => ({
            id: s.id,
            name: s.name,
            requiredDocuments: s.required_documents || undefined,
        })),
        salaryRange: dbProcess.salary_range,
        experienceLevel: dbProcess.experience_level,
        seniority: dbProcess.seniority,
        flyerUrl: dbProcess.flyer_url,
        flyerPosition: dbProcess.flyer_position || undefined,
        attachments: attachments.map(att => ({
            id: att.id,
            name: att.name,
            url: att.url,
            type: att.type,
            size: att.size,
            category: att.category,
            uploadedAt: att.uploaded_at,
        })),
        serviceOrderCode: dbProcess.service_order_code,
        startDate: dbProcess.start_date,
        endDate: dbProcess.end_date,
        status: dbProcess.status,
        vacancies: dbProcess.vacancies || 0,
        documentCategories: documentCategories.length > 0 ? documentCategories.map(dc => ({
            id: dc.id,
            name: dc.name,
            description: dc.description,
            required: dc.required || false,
        })) : undefined,
        googleDriveFolderId: dbProcess.google_drive_folder_id,
        googleDriveFolderName: dbProcess.google_drive_folder_name,
    };
}

// Convertir de tipo de aplicación a DB
function processToDb(process: Partial<Process>): any {
    const dbProcess: any = {};
    if (process.title !== undefined) dbProcess.title = process.title;
    if (process.description !== undefined) dbProcess.description = process.description;
    if (process.salaryRange !== undefined) dbProcess.salary_range = process.salaryRange;
    if (process.experienceLevel !== undefined) dbProcess.experience_level = process.experienceLevel;
    if (process.seniority !== undefined) dbProcess.seniority = process.seniority;
    if (process.flyerUrl !== undefined) dbProcess.flyer_url = process.flyerUrl;
    if (process.flyerPosition !== undefined) dbProcess.flyer_position = process.flyerPosition;
    if (process.serviceOrderCode !== undefined) dbProcess.service_order_code = process.serviceOrderCode;
    if (process.startDate !== undefined) dbProcess.start_date = process.startDate && process.startDate.trim() !== '' ? process.startDate : null;
    if (process.endDate !== undefined) dbProcess.end_date = process.endDate && process.endDate.trim() !== '' ? process.endDate : null;
    if (process.status !== undefined) dbProcess.status = process.status;
    if (process.vacancies !== undefined) dbProcess.vacancies = process.vacancies;
    if (process.googleDriveFolderId !== undefined) dbProcess.google_drive_folder_id = process.googleDriveFolderId;
    if (process.googleDriveFolderName !== undefined) dbProcess.google_drive_folder_name = process.googleDriveFolderName;
    return dbProcess;
}

export const processesApi = {
    // Obtener todos los procesos con sus stages y categorías
    async getAll(): Promise<Process[]> {
        const { data: processes, error } = await supabase
            .from('processes')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        if (!processes) return [];

        // Obtener stages, categorías y attachments para cada proceso
        const processesWithRelations = await Promise.all(
            processes.map(async (process) => {
                const [stages, categories, attachments] = await Promise.all([
                    supabase.from('stages').select('*').eq('process_id', process.id).order('order_index'),
                    supabase.from('document_categories').select('*').eq('process_id', process.id),
                    supabase.from('attachments').select('*').eq('process_id', process.id).is('candidate_id', null),
                ]);

                return dbToProcess(
                    process,
                    stages.data || [],
                    categories.data || [],
                    attachments.data || []
                );
            })
        );

        return processesWithRelations;
    },

    // Obtener un proceso por ID
    async getById(id: string): Promise<Process | null> {
        const { data: process, error } = await supabase
            .from('processes')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        if (!process) return null;

        const [stages, categories, attachments] = await Promise.all([
            supabase.from('stages').select('*').eq('process_id', id).order('order_index'),
            supabase.from('document_categories').select('*').eq('process_id', id),
            supabase.from('attachments').select('*').eq('process_id', id).is('candidate_id', null),
        ]);

        return dbToProcess(process, stages.data || [], categories.data || [], attachments.data || []);
    },

    // Crear proceso con sus stages y categorías
    async create(processData: Omit<Process, 'id'>, createdBy?: string): Promise<Process> {
        const dbData = processToDb(processData);
        if (createdBy) dbData.created_by = createdBy;

        const { data: process, error } = await supabase
            .from('processes')
            .insert(dbData)
            .select()
            .single();
        
        if (error) throw error;

        // Crear stages
        if (processData.stages && processData.stages.length > 0) {
            const stagesToInsert = processData.stages.map((stage, index) => ({
                process_id: process.id,
                name: stage.name,
                order_index: index,
                required_documents: stage.requiredDocuments || null,
            }));

            const { error: stagesError } = await supabase
                .from('stages')
                .insert(stagesToInsert);
            
            if (stagesError) throw stagesError;
        }

        // Crear categorías de documentos
        if (processData.documentCategories && processData.documentCategories.length > 0) {
            const categoriesToInsert = processData.documentCategories.map(cat => ({
                process_id: process.id,
                name: cat.name,
                description: cat.description || null,
                required: cat.required || false,
            }));

            const { error: categoriesError } = await supabase
                .from('document_categories')
                .insert(categoriesToInsert);
            
            if (categoriesError) throw categoriesError;
        }

        // Crear attachments del proceso si se proporcionan
        // Filtrar attachments temporales (los que tienen IDs que empiezan con "temp-")
        if (processData.attachments && processData.attachments.length > 0) {
            const attachmentsToInsert = processData.attachments
                .filter(att => att.id.startsWith('temp-') || !att.id) // Solo los temporales o sin ID
                .map(att => ({
                    process_id: process.id,
                    name: att.name,
                    url: att.url,
                    type: att.type,
                    size: att.size,
                    category: att.category || null,
                    candidate_id: null, // Estos son attachments del proceso, no de candidatos
                }));

            if (attachmentsToInsert.length > 0) {
                const { error: attachmentsError } = await supabase
                    .from('attachments')
                    .insert(attachmentsToInsert);
                
                if (attachmentsError) {
                    console.error('Error guardando attachments del proceso:', attachmentsError);
                    // No lanzar error crítico, pero loguear para debugging
                } else {
                    console.log(`✅ ${attachmentsToInsert.length} attachment(s) guardado(s) para el proceso nuevo`);
                }
            }
        }

        return await this.getById(process.id) as Process;
    },

    // Actualizar proceso
    async update(id: string, processData: Partial<Process>): Promise<Process> {
        const dbData = processToDb(processData);
        const { error } = await supabase
            .from('processes')
            .update(dbData)
            .eq('id', id);
        
        if (error) throw error;

        // Actualizar stages si se proporcionan
        if (processData.stages) {
            // Eliminar stages existentes
            await supabase.from('stages').delete().eq('process_id', id);
            
            // Insertar nuevos stages
            if (processData.stages.length > 0) {
                const stagesToInsert = processData.stages.map((stage, index) => ({
                    process_id: id,
                    name: stage.name,
                    order_index: index,
                    required_documents: stage.requiredDocuments || null,
                }));

                const { error: stagesError } = await supabase
                    .from('stages')
                    .insert(stagesToInsert);
                
                if (stagesError) throw stagesError;
            }
        }

        // Actualizar categorías si se proporcionan
        if (processData.documentCategories !== undefined) {
            // Eliminar categorías existentes
            await supabase.from('document_categories').delete().eq('process_id', id);
            
            // Insertar nuevas categorías
            if (processData.documentCategories.length > 0) {
                const categoriesToInsert = processData.documentCategories.map(cat => ({
                    process_id: id,
                    name: cat.name,
                    description: cat.description || null,
                    required: cat.required || false,
                }));

                const { error: categoriesError } = await supabase
                    .from('document_categories')
                    .insert(categoriesToInsert);
                
                if (categoriesError) throw categoriesError;
            }
        }

        // Actualizar attachments si se proporcionan
        // NOTA: Los attachments ahora se guardan inmediatamente cuando se suben,
        // así que aquí solo sincronizamos la lista (eliminar los que ya no están)
        if (processData.attachments !== undefined) {
            // Obtener attachments existentes del proceso (solo los que no son de candidatos)
            const { data: existingAttachments } = await supabase
                .from('attachments')
                .select('id')
                .eq('process_id', id)
                .is('candidate_id', null);
            
            if (existingAttachments) {
                const currentAttachmentIds = new Set(processData.attachments.map(att => att.id).filter(Boolean));
                const attachmentsToDelete = existingAttachments
                    .map(a => a.id)
                    .filter(existingId => !currentAttachmentIds.has(existingId));
                
                // Eliminar attachments que ya no están en la lista
                if (attachmentsToDelete.length > 0) {
                    const { error: deleteError } = await supabase
                        .from('attachments')
                        .delete()
                        .in('id', attachmentsToDelete);
                    
                    if (deleteError) {
                        console.warn('Error eliminando attachments antiguos:', deleteError);
                        // No lanzar error, continuar
                    } else {
                        console.log(`✅ ${attachmentsToDelete.length} attachment(s) eliminado(s) del proceso`);
                    }
                }
            }
            
            // Los attachments nuevos ya se guardaron inmediatamente cuando se subieron,
            // así que no necesitamos insertarlos aquí
        }

        return await this.getById(id) as Process;
    },

    // Eliminar proceso
    async delete(id: string): Promise<void> {
        // IMPORTANTE: Orden de eliminación para respetar foreign keys
        // 1. Primero eliminar candidatos (que referencian stages y process)
        const { data: candidates } = await supabase
            .from('candidates')
            .select('id')
            .eq('process_id', id);
        
        if (candidates && candidates.length > 0) {
            const candidateIds = candidates.map(c => c.id);
            
            // Eliminar relaciones de candidatos primero
            // Eliminar attachments de candidatos
            const { error: candidateAttachmentsError } = await supabase
                .from('attachments')
                .delete()
                .in('candidate_id', candidateIds);
            
            if (candidateAttachmentsError) {
                console.warn('Error eliminando attachments de candidatos:', candidateAttachmentsError);
            }
            
            // Eliminar post-its de candidatos
            const { error: postItsError } = await supabase
                .from('post_its')
                .delete()
                .in('candidate_id', candidateIds);
            
            if (postItsError) {
                console.warn('Error eliminando post-its:', postItsError);
            }
            
            // Eliminar comentarios de candidatos
            const { error: commentsError } = await supabase
                .from('comments')
                .delete()
                .in('candidate_id', candidateIds);
            
            if (commentsError) {
                console.warn('Error eliminando comentarios:', commentsError);
            }
            
            // Eliminar historial de candidatos
            const { error: historyError } = await supabase
                .from('candidate_history')
                .delete()
                .in('candidate_id', candidateIds);
            
            if (historyError) {
                console.warn('Error eliminando historial:', historyError);
            }
            
            // Eliminar eventos de entrevistas
            const { error: interviewsError } = await supabase
                .from('interview_events')
                .delete()
                .in('candidate_id', candidateIds);
            
            if (interviewsError) {
                console.warn('Error eliminando entrevistas:', interviewsError);
            }
            
            // Ahora eliminar los candidatos
            const { error: candidatesError } = await supabase
                .from('candidates')
                .delete()
                .eq('process_id', id);
            
            if (candidatesError) {
                console.error('Error eliminando candidatos:', candidatesError);
                throw new Error(`Error al eliminar candidatos del proceso: ${candidatesError.message}`);
            }
            
            console.log(`✅ ${candidates.length} candidatos eliminados`);
        }
        
        // 2. Eliminar stages (ahora que no hay candidatos que las referencien)
        const { error: stagesError } = await supabase
            .from('stages')
            .delete()
            .eq('process_id', id);
        
        if (stagesError) {
            console.error('Error eliminando stages:', stagesError);
            throw new Error(`Error al eliminar etapas del proceso: ${stagesError.message}`);
        }
        
        // 3. Eliminar document_categories
        const { error: categoriesError } = await supabase
            .from('document_categories')
            .delete()
            .eq('process_id', id);
        
        if (categoriesError) {
            console.error('Error eliminando categorías:', categoriesError);
            throw new Error(`Error al eliminar categorías del proceso: ${categoriesError.message}`);
        }
        
        // 4. Eliminar attachments del proceso (que no son de candidatos)
        const { error: attachmentsError } = await supabase
            .from('attachments')
            .delete()
            .eq('process_id', id);
        
        if (attachmentsError) {
            console.warn('Error eliminando attachments del proceso:', attachmentsError);
            // No lanzar error, continuar con la eliminación
        }
        
        // 5. Eliminar form_integrations
        const { error: formsError } = await supabase
            .from('form_integrations')
            .delete()
            .eq('process_id', id);
        
        if (formsError) {
            console.warn('Error eliminando integraciones de formularios:', formsError);
        }
        
        // 6. Finalmente eliminar el proceso
        const { error, data } = await supabase
            .from('processes')
            .delete()
            .eq('id', id)
            .select();
        
        if (error) {
            console.error('Error eliminando proceso:', error);
            throw new Error(`Error al eliminar proceso: ${error.message} (Código: ${error.code})`);
        }
        
        if (!data || data.length === 0) {
            throw new Error('El proceso no se encontró o ya fue eliminado');
        }
        
        console.log(`✅ Proceso eliminado correctamente: ${id}`);
    },
};

