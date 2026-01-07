import { supabase } from '../supabase';
import { Process, Stage, DocumentCategory, Attachment } from '../../types';
import { APP_NAME } from '../appConfig';

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
            isCritical: s.is_critical === true || s.is_critical === 1 || s.is_critical === 'true',
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
        publishedDate: dbProcess.published_date,
        needIdentifiedDate: dbProcess.need_identified_date,
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
    if (process.publishedDate !== undefined) dbProcess.published_date = process.publishedDate && process.publishedDate.trim() !== '' ? process.publishedDate : null;
    if (process.needIdentifiedDate !== undefined) dbProcess.need_identified_date = process.needIdentifiedDate && process.needIdentifiedDate.trim() !== '' ? process.needIdentifiedDate : null;
    return dbProcess;
}

export const processesApi = {
    // Obtener solo el conteo de attachments de un proceso (sin cargar los datos)
    // Incluye archivos de la base de datos y archivos en Google Drive (excluyendo carpetas de candidatos)
    async getAttachmentsCount(processId: string, processFolderId?: string, googleDriveConfig?: any): Promise<number> {
        // Contar attachments en la base de datos
        const { count, error } = await supabase
            .from('attachments')
            .select('*', { count: 'exact', head: true })
            .eq('process_id', processId)
            .eq('app_name', APP_NAME)
            .is('candidate_id', null); // Solo attachments del proceso, no de candidatos
        
        if (error) throw error;
        let dbCount = count || 0;

        // Si Google Drive está conectado y el proceso tiene carpeta, contar archivos en Drive
        if (processFolderId && googleDriveConfig?.connected && googleDriveConfig?.accessToken) {
            try {
                const { googleDriveService } = await import('../googleDrive');
                googleDriveService.initialize(googleDriveConfig);
                
                // Listar todos los archivos y carpetas en la carpeta del proceso
                const allItems = await googleDriveService.listFilesInFolder(processFolderId);
                
                // Filtrar solo archivos (no carpetas) y excluir carpetas de candidatos
                // Las carpetas de candidatos generalmente tienen nombres que coinciden con nombres de candidatos
                const files = allItems.filter(item => {
                    // Excluir carpetas (mimeType = 'application/vnd.google-apps.folder')
                    if (item.mimeType === 'application/vnd.google-apps.folder') {
                        return false;
                    }
                    return true;
                });
                
                // Obtener IDs de archivos ya registrados en BD para evitar duplicados
                const { data: dbAttachments } = await supabase
                    .from('attachments')
                    .select('url')
                    .eq('process_id', processId)
                    .eq('app_name', APP_NAME)
                    .is('candidate_id', null);
                
                const dbDriveFileIds = new Set(
                    (dbAttachments || [])
                        .map(att => {
                            // Extraer ID de Google Drive de la URL
                            const match = att.url?.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                            return match ? match[1] : null;
                        })
                        .filter(id => id !== null)
                );
                
                // Contar solo archivos que no están en la BD
                const driveOnlyFiles = files.filter(file => !dbDriveFileIds.has(file.id));
                
                return dbCount + driveOnlyFiles.length;
            } catch (error) {
                console.warn('Error contando archivos de Google Drive para el proceso:', error);
                // Si falla, retornar solo el conteo de BD
                return dbCount;
            }
        }
        
        return dbCount;
    },

    // Cargar attachments de un proceso específico (lazy loading para reducir egress)
    async getAttachments(processId: string): Promise<Attachment[]> {
        const { data, error } = await supabase
            .from('attachments')
            .select('id, process_id, name, url, type, size, category, uploaded_at')
            .eq('process_id', processId)
            .eq('app_name', APP_NAME)
            .is('candidate_id', null) // Solo attachments del proceso, no de candidatos
            .order('uploaded_at', { ascending: false });
        
        if (error) throw error;
        if (!data) return [];

        return data.map(att => ({
            id: att.id,
            name: att.name,
            url: att.url,
            type: att.type,
            size: att.size,
            category: att.category,
            uploadedAt: att.uploaded_at,
        }));
    },

    // Obtener todos los procesos con sus stages y categorías
    // OPTIMIZADO: Carga todas las relaciones en batch en lugar de N+1 queries
    // OPTIMIZADO EGRESS: Selecciona solo campos necesarios, attachments se cargan lazy
    async getAll(includeAttachments: boolean = false): Promise<Process[]> {
        // 1. Cargar todos los procesos (solo campos necesarios para reducir egress)
        const { data: processes, error } = await supabase
            .from('processes')
            .select('id, title, description, salary_range, experience_level, seniority, flyer_url, flyer_position, service_order_code, start_date, end_date, status, vacancies, google_drive_folder_id, google_drive_folder_name, published_date, need_identified_date, created_at')
            .eq('app_name', APP_NAME)
            .order('created_at', { ascending: false })
            .limit(200); // Reducir límite para reducir egress
        
        if (error) throw error;
        if (!processes || processes.length === 0) return [];

        // 2. Obtener todos los IDs de procesos
        const processIds = processes.map(p => p.id);

        // 3. Cargar todas las relaciones en batch (solo campos necesarios)
        const queries: Promise<any>[] = [
            supabase
                .from('stages')
                .select('id, process_id, name, order_index, required_documents, is_critical')
                .in('process_id', processIds)
                .eq('app_name', APP_NAME)
                .order('order_index'),
            supabase
                .from('document_categories')
                .select('id, process_id, name, description, required')
                .in('process_id', processIds)
                .eq('app_name', APP_NAME),
        ];

        // Solo cargar attachments si se solicitan explícitamente (lazy loading)
        if (includeAttachments) {
            queries.push(
                supabase
                    .from('attachments')
                    .select('id, process_id, name, url, type, size, category, uploaded_at')
                    .in('process_id', processIds)
                    .eq('app_name', APP_NAME)
                    .is('candidate_id', null)
            );
        } else {
            queries.push(Promise.resolve({ data: [] }));
        }

        const [stagesResult, categoriesResult, attachmentsResult] = await Promise.all(queries);

        // 4. Agrupar relaciones por process_id en memoria
        const stagesByProcessId = new Map<string, any[]>();
        const categoriesByProcessId = new Map<string, any[]>();
        const attachmentsByProcessId = new Map<string, any[]>();

        (stagesResult.data || []).forEach(stage => {
            if (!stagesByProcessId.has(stage.process_id)) {
                stagesByProcessId.set(stage.process_id, []);
            }
            stagesByProcessId.get(stage.process_id)!.push(stage);
        });

        // Ordenar stages por order_index dentro de cada proceso
        stagesByProcessId.forEach((stages, processId) => {
            stages.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        });

        (categoriesResult.data || []).forEach(category => {
            if (!categoriesByProcessId.has(category.process_id)) {
                categoriesByProcessId.set(category.process_id, []);
            }
            categoriesByProcessId.get(category.process_id)!.push(category);
        });

        (attachmentsResult.data || []).forEach(attachment => {
            if (!attachmentsByProcessId.has(attachment.process_id)) {
                attachmentsByProcessId.set(attachment.process_id, []);
            }
            attachmentsByProcessId.get(attachment.process_id)!.push(attachment);
        });

        // 5. Mapear procesos con sus relaciones
        return processes.map(process => 
            dbToProcess(
                process,
                stagesByProcessId.get(process.id) || [],
                categoriesByProcessId.get(process.id) || [],
                attachmentsByProcessId.get(process.id) || []
            )
        );
    },

    // Obtener un proceso por ID
    async getById(id: string): Promise<Process | null> {
        const { data: process, error } = await supabase
            .from('processes')
            .select('*')
            .eq('id', id)
            .eq('app_name', APP_NAME)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        if (!process) return null;

        const [stages, categories, attachments] = await Promise.all([
            supabase.from('stages').select('*').eq('process_id', id).eq('app_name', APP_NAME).order('order_index'),
            supabase.from('document_categories').select('*').eq('process_id', id).eq('app_name', APP_NAME),
            supabase.from('attachments').select('*').eq('process_id', id).eq('app_name', APP_NAME).is('candidate_id', null),
        ]);

        return dbToProcess(process, stages.data || [], categories.data || [], attachments.data || []);
    },

    // Crear proceso con sus stages y categorías
    async create(processData: Omit<Process, 'id'>, createdBy?: string): Promise<Process> {
        const dbData = processToDb(processData);
        if (createdBy) dbData.created_by = createdBy;
        dbData.app_name = APP_NAME;

        // Separar flyer_position del resto de los datos para manejarlo por separado
        // ya que la columna puede no existir en la BD
        const { flyer_position, ...restDbData } = dbData;
        
        // Crear proceso sin flyer_position primero
        const { data: process, error } = await supabase
            .from('processes')
            .insert(restDbData)
            .select()
            .single();
        
        if (error) throw error;
        
        // Intentar actualizar flyer_position por separado si existe
        // Si la columna no existe, simplemente ignoramos el error
        if (flyer_position !== undefined && process) {
            try {
                const { error: positionError } = await supabase
                    .from('processes')
                    .update({ flyer_position })
                    .eq('id', process.id);
                
                if (positionError) {
                    // Si el error es porque la columna no existe, solo loguear y continuar
                    const isColumnError = positionError.message?.includes('flyer_position') || 
                                         positionError.message?.includes('column') || 
                                         positionError.message?.includes('schema cache') ||
                                         positionError.code === '42703'; // PostgreSQL error code for undefined column
                    
                    if (isColumnError) {
                        console.warn('⚠️ La columna flyer_position no existe en la base de datos.');
                        console.warn('📝 Para habilitar esta funcionalidad, ejecuta el script SQL: MIGRATION_ADD_FLYER_POSITION.sql');
                        console.warn('💡 La posición se aplicará visualmente pero no se guardará hasta agregar la columna.');
                    } else {
                        // Si es otro error, lanzarlo
                        throw positionError;
                    }
                }
            } catch (err: any) {
                // Si falla por cualquier razón relacionada con la columna, solo loguear
                const isColumnError = err.message?.includes('flyer_position') || 
                                     err.message?.includes('column') || 
                                     err.message?.includes('schema cache') ||
                                     err.code === '42703';
                
                if (isColumnError) {
                    console.warn('⚠️ No se pudo guardar flyer_position. La columna puede no existir en la base de datos.');
                    console.warn('📝 Ejecuta el script SQL: MIGRATION_ADD_FLYER_POSITION.sql para habilitar esta funcionalidad.');
                } else {
                    throw err;
                }
            }
        }

        // Crear stages
        if (processData.stages && processData.stages.length > 0) {
            // Insertar stages sin is_critical primero (campos estándar)
            const stagesToInsert = processData.stages.map((stage, index) => ({
                process_id: process.id,
                name: stage.name,
                order_index: index,
                required_documents: stage.requiredDocuments || null,
                app_name: APP_NAME,
            }));

            // Intentar insertar con is_critical primero (si la columna existe funcionará)
            const stagesWithCritical = processData.stages.map((stage, index) => ({
                process_id: process.id,
                name: stage.name,
                order_index: index,
                required_documents: stage.requiredDocuments || null,
                is_critical: stage.isCritical || false,
                app_name: APP_NAME,
            }));
            
            const { data: insertedStages, error: stagesError } = await supabase
                .from('stages')
                .insert(stagesWithCritical)
                .select('id, order_index');
            
            // Si falla y es porque la columna no existe, intentar sin is_critical
            if (stagesError) {
                const isColumnError = stagesError.message?.includes('is_critical') || 
                                     stagesError.message?.includes('schema cache') ||
                                     stagesError.message?.includes('column') ||
                                     stagesError.code === '42703';
                
                if (isColumnError) {
                    console.warn('⚠️ La columna is_critical no existe. Insertando stages sin este campo...');
                    // Insertar sin is_critical
                    const { error: stagesError2 } = await supabase
                        .from('stages')
                        .insert(stagesToInsert);
                    
                    if (stagesError2) throw stagesError2;
                    
                    // Intentar actualizar is_critical después
                    const { data: insertedStages2 } = await supabase
                        .from('stages')
                        .select('id, order_index')
                        .eq('process_id', process.id)
                        .order('order_index');
                    
                    if (insertedStages2) {
                        for (let i = 0; i < processData.stages.length && i < insertedStages2.length; i++) {
                            if (processData.stages[i].isCritical) {
                                try {
                                    await supabase
                                        .from('stages')
                                        .update({ is_critical: true })
                                        .eq('id', insertedStages2[i].id);
                                } catch (err) {
                                    // Ignorar si falla
                                }
                            }
                        }
                    }
                } else {
                    throw stagesError;
                }
            } else if (insertedStages) {
                // Si el insert funcionó pero algunos stages no tienen is_critical correcto, actualizar
                for (let i = 0; i < processData.stages.length && i < insertedStages.length; i++) {
                    const shouldBeCritical = processData.stages[i].isCritical || false;
                    const insertedStage = insertedStages.find(s => s.order_index === i);
                    if (insertedStage && shouldBeCritical) {
                        // Verificar y actualizar si es necesario
                        try {
                            await supabase
                                .from('stages')
                                .update({ is_critical: true })
                                .eq('id', insertedStage.id);
                        } catch (err) {
                            // Ignorar si falla
                        }
                    }
                }
            }
        }

        // Crear categorías de documentos
        if (processData.documentCategories && processData.documentCategories.length > 0) {
            const categoriesToInsert = processData.documentCategories.map(cat => ({
                process_id: process.id,
                name: cat.name,
                description: cat.description || null,
                required: cat.required || false,
                app_name: APP_NAME,
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
                    app_name: APP_NAME,
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
        delete dbData.app_name; // No permitir cambiar app_name
        
        // Separar flyer_position del resto de los datos para manejarlo por separado
        // ya que la columna puede no existir en la BD
        const { flyer_position, ...restDbData } = dbData;
        
        // Actualizar primero los campos principales
        const { error } = await supabase
            .from('processes')
            .update(restDbData)
            .eq('id', id)
            .eq('app_name', APP_NAME);
        
        if (error) throw error;
        
        // Intentar actualizar flyer_position por separado si existe
        // Si la columna no existe, simplemente ignoramos el error
        if (flyer_position !== undefined) {
            try {
                const { error: positionError } = await supabase
                    .from('processes')
                    .update({ flyer_position })
                    .eq('id', id)
                    .eq('app_name', APP_NAME);
                
                if (positionError) {
                    // Si el error es porque la columna no existe, solo loguear y continuar
                    const isColumnError = positionError.message?.includes('flyer_position') || 
                                         positionError.message?.includes('column') || 
                                         positionError.message?.includes('schema cache') ||
                                         positionError.code === '42703'; // PostgreSQL error code for undefined column
                    
                    if (isColumnError) {
                        console.warn('⚠️ La columna flyer_position no existe en la base de datos.');
                        console.warn('📝 Para habilitar esta funcionalidad, ejecuta el script SQL: MIGRATION_ADD_FLYER_POSITION.sql');
                        console.warn('💡 La posición se aplicará visualmente pero no se guardará hasta agregar la columna.');
                    } else {
                        // Si es otro error, lanzarlo
                        throw positionError;
                    }
                }
            } catch (err: any) {
                // Si falla por cualquier razón relacionada con la columna, solo loguear
                const isColumnError = err.message?.includes('flyer_position') || 
                                     err.message?.includes('column') || 
                                     err.message?.includes('schema cache') ||
                                     err.code === '42703';
                
                if (isColumnError) {
                    console.warn('⚠️ No se pudo guardar flyer_position. La columna puede no existir en la base de datos.');
                    console.warn('📝 Ejecuta el script SQL: MIGRATION_ADD_FLYER_POSITION.sql para habilitar esta funcionalidad.');
                } else {
                    throw err;
                }
            }
        }

        // Actualizar stages si se proporcionan
        if (processData.stages) {
            // Obtener stages existentes de la base de datos
            const { data: existingStages, error: fetchError } = await supabase
                .from('stages')
                .select('id, name, order_index, required_documents, is_critical')
                .eq('process_id', id)
                .eq('app_name', APP_NAME)
                .order('order_index');
            
            if (fetchError) {
                console.error('Error obteniendo stages existentes:', fetchError);
                throw fetchError;
            }
            
            const existingStagesMap = new Map((existingStages || []).map(s => [s.id, s]));
            const newStagesMap = new Map(processData.stages.map((s, index) => [s.id, { ...s, order_index: index }]));
            
            // Separar stages en: actualizar, insertar, y eliminar
            const stagesToUpdate: Array<{ id: string; name: string; order_index: number; required_documents: any; is_critical: boolean }> = [];
            const stagesToInsert: Array<{ process_id: string; name: string; order_index: number; required_documents: any; is_critical: boolean }> = [];
            const stagesToDelete: string[] = [];
            
            // Identificar qué hacer con cada stage existente
            existingStagesMap.forEach((existingStage, stageId) => {
                const newStage = newStagesMap.get(stageId);
                if (newStage) {
                    const existingIsCritical = existingStage.is_critical || false;
                    const newIsCritical = newStage.isCritical || false;
                    
                    // Stage existe en ambos, actualizar si cambió
                    if (newStage.name !== existingStage.name || 
                        JSON.stringify(newStage.requiredDocuments || []) !== JSON.stringify(existingStage.required_documents || []) ||
                        newIsCritical !== existingIsCritical) {
                        stagesToUpdate.push({
                            id: stageId,
                            name: newStage.name,
                            order_index: newStage.order_index,
                            required_documents: newStage.requiredDocuments || null,
                            is_critical: newIsCritical,
                        });
                    } else if (newStage.order_index !== existingStage.order_index) {
                        // Solo cambió el orden, pero mantener otros valores
                        stagesToUpdate.push({
                            id: stageId,
                            name: existingStage.name,
                            order_index: newStage.order_index,
                            required_documents: existingStage.required_documents,
                            is_critical: existingIsCritical,
                        });
                    }
                } else {
                    // Stage ya no está en la lista nueva, marcar para eliminar
                    stagesToDelete.push(stageId);
                }
            });
            
            // Identificar stages nuevos (que no tienen ID o tienen ID temporal)
            processData.stages.forEach((stage, index) => {
                // Si el ID empieza con "new-" o "temp-" o no existe en la BD, es nuevo
                // También verificar que no esté ya en stagesToUpdate para evitar duplicados
                const isInUpdateList = stagesToUpdate.some(s => s.id === stage.id);
                if ((!stage.id || stage.id.startsWith('new-') || stage.id.startsWith('temp-') || !existingStagesMap.has(stage.id)) && !isInUpdateList) {
                    stagesToInsert.push({
                        process_id: id,
                        name: stage.name,
                        order_index: index,
                        required_documents: stage.requiredDocuments || null,
                        is_critical: stage.isCritical || false,
                    });
                }
            });
            
            // Primero, actualizar todos los order_index a valores temporales negativos para evitar conflictos
            // Esto asegura que no haya conflictos de clave única durante la actualización
            const tempOrderUpdates = stagesToUpdate.map(stage => ({
                id: stage.id,
                temp_order: -1000 - stagesToUpdate.indexOf(stage) // Valores temporales únicos
            }));
            
            for (const tempUpdate of tempOrderUpdates) {
                const { error: tempError } = await supabase
                    .from('stages')
                    .update({ order_index: tempUpdate.temp_order })
                    .eq('id', tempUpdate.id)
                    .eq('app_name', APP_NAME);
                
                if (tempError) {
                    console.error(`Error actualizando order_index temporal para stage ${tempUpdate.id}:`, tempError);
                    throw tempError;
                }
            }
            
            // Ahora actualizar stages existentes con los valores finales
            for (const stage of stagesToUpdate) {
                // Primero actualizar campos estándar (que siempre existen)
                const standardUpdate: any = {
                    name: stage.name,
                    order_index: stage.order_index,
                    required_documents: stage.required_documents,
                };
                
                const { error: updateError } = await supabase
                    .from('stages')
                    .update(standardUpdate)
                    .eq('id', stage.id)
                    .eq('app_name', APP_NAME);
                
                if (updateError) {
                    console.error(`Error actualizando stage ${stage.id}:`, updateError);
                    throw updateError;
                }
                
                // Intentar actualizar is_critical por separado (la columna puede no existir aún)
                if (stage.is_critical !== undefined) {
                    try {
                        const { error: criticalError } = await supabase
                            .from('stages')
                            .update({ is_critical: stage.is_critical })
                            .eq('id', stage.id)
                            .eq('app_name', APP_NAME);
                        
                        if (criticalError) {
                            // Si el error es porque la columna no existe, solo loguear y continuar
                            const isColumnError = criticalError.message?.includes('is_critical') || 
                                                 criticalError.message?.includes('schema cache') ||
                                                 criticalError.message?.includes('column') ||
                                                 criticalError.code === '42703';
                            
                            if (isColumnError) {
                                console.warn(`⚠️ La columna is_critical no existe en la tabla stages. Agrega esta columna para que las etapas críticas persistan.`);
                            } else {
                                // Para otros errores, solo loguear pero continuar
                                console.warn(`Error actualizando is_critical para stage ${stage.id}:`, criticalError);
                            }
                        }
                    } catch (err: any) {
                        // Ignorar errores de columna faltante, continuar con el siguiente stage
                        console.warn(`No se pudo actualizar is_critical para stage ${stage.id}`);
                    }
                }
            }
            
            // Insertar nuevos stages (sin is_critical primero)
            if (stagesToInsert.length > 0) {
                const stagesWithoutCritical = stagesToInsert.map(s => ({
                    process_id: s.process_id,
                    name: s.name,
                    order_index: s.order_index,
                    required_documents: s.required_documents,
                    app_name: APP_NAME,
                }));
                
                const { data: insertedStages, error: insertError } = await supabase
                    .from('stages')
                    .insert(stagesWithoutCritical)
                    .select('id, order_index');
                
                if (insertError) {
                    console.error('Error insertando nuevos stages:', insertError);
                    throw insertError;
                }
                
                // Ahora intentar actualizar is_critical por separado para cada stage insertado
                if (insertedStages) {
                    for (const insertedStage of insertedStages) {
                        const originalStage = stagesToInsert.find(s => s.order_index === insertedStage.order_index);
                        if (originalStage && originalStage.is_critical) {
                            try {
                                const { error: criticalError } = await supabase
                                    .from('stages')
                                    .update({ is_critical: true })
                                    .eq('id', insertedStage.id)
                                    .eq('app_name', APP_NAME);
                                
                                if (criticalError) {
                                    const isColumnError = criticalError.message?.includes('is_critical') || 
                                                         criticalError.message?.includes('schema cache') ||
                                                         criticalError.message?.includes('column') ||
                                                         criticalError.code === '42703';
                                    if (isColumnError) {
                                        console.warn('⚠️ La columna is_critical no existe en la tabla stages.');
                                    }
                                }
                            } catch (err) {
                                // Ignorar errores de columna faltante
                                console.warn('No se pudo guardar is_critical para un stage nuevo');
                            }
                        }
                    }
                }
            }
            
            // Eliminar stages que ya no están en la lista nueva
            // IMPORTANTE: Solo eliminar si no tienen referencias en candidate_history
            // Si tienen referencias, no podemos eliminarlos (violaría foreign key constraint)
            for (const stageId of stagesToDelete) {
                // Verificar si hay referencias en candidate_history
                const { data: historyRefs, error: checkError } = await supabase
                    .from('candidate_history')
                    .select('id')
                    .eq('stage_id', stageId)
                    .eq('app_name', APP_NAME)
                    .limit(1);
                
                if (checkError) {
                    console.warn(`Error verificando referencias para stage ${stageId}:`, checkError);
                    // No eliminar si no podemos verificar
                    continue;
                }
                
                if (!historyRefs || historyRefs.length === 0) {
                    // No hay referencias, podemos eliminar
                    const { error: deleteError } = await supabase
                        .from('stages')
                        .delete()
                        .eq('id', stageId)
                        .eq('app_name', APP_NAME);
                    
                    if (deleteError) {
                        console.warn(`Error eliminando stage ${stageId}:`, deleteError);
                        // No lanzar error, solo loguear (puede tener referencias que no detectamos)
                    }
                } else {
                    console.log(`⚠️ No se puede eliminar stage ${stageId} porque tiene referencias en candidate_history`);
                }
            }
        }

        // Actualizar categorías si se proporcionan
        if (processData.documentCategories !== undefined) {
            // Eliminar categorías existentes
            await supabase.from('document_categories').delete().eq('process_id', id).eq('app_name', APP_NAME);
            
            // Insertar nuevas categorías
            if (processData.documentCategories.length > 0) {
                const categoriesToInsert = processData.documentCategories.map(cat => ({
                    process_id: id,
                    name: cat.name,
                    description: cat.description || null,
                    required: cat.required || false,
                    app_name: APP_NAME,
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
                .eq('app_name', APP_NAME)
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
                        .eq('app_name', APP_NAME)
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
            .eq('process_id', id)
            .eq('app_name', APP_NAME);
        
        if (candidates && candidates.length > 0) {
            const candidateIds = candidates.map(c => c.id);
            
            // Eliminar relaciones de candidatos primero
            // Eliminar attachments de candidatos
            const { error: candidateAttachmentsError } = await supabase
                .from('attachments')
                .delete()
                .eq('app_name', APP_NAME)
                .in('candidate_id', candidateIds);
            
            if (candidateAttachmentsError) {
                console.warn('Error eliminando attachments de candidatos:', candidateAttachmentsError);
            }
            
            // Eliminar post-its de candidatos
            const { error: postItsError } = await supabase
                .from('post_its')
                .delete()
                .eq('app_name', APP_NAME)
                .in('candidate_id', candidateIds);
            
            if (postItsError) {
                console.warn('Error eliminando post-its:', postItsError);
            }
            
            // Eliminar comentarios de candidatos
            const { error: commentsError } = await supabase
                .from('comments')
                .delete()
                .eq('app_name', APP_NAME)
                .in('candidate_id', candidateIds);
            
            if (commentsError) {
                console.warn('Error eliminando comentarios:', commentsError);
            }
            
            // Eliminar historial de candidatos
            const { error: historyError } = await supabase
                .from('candidate_history')
                .delete()
                .eq('app_name', APP_NAME)
                .in('candidate_id', candidateIds);
            
            if (historyError) {
                console.warn('Error eliminando historial:', historyError);
            }
            
            // Eliminar eventos de entrevistas
            const { error: interviewsError } = await supabase
                .from('interview_events')
                .delete()
                .eq('app_name', APP_NAME)
                .in('candidate_id', candidateIds);
            
            if (interviewsError) {
                console.warn('Error eliminando entrevistas:', interviewsError);
            }
            
            // Ahora eliminar los candidatos
            const { error: candidatesError } = await supabase
                .from('candidates')
                .delete()
                .eq('process_id', id)
                .eq('app_name', APP_NAME);
            
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
            .eq('process_id', id)
            .eq('app_name', APP_NAME);
        
        if (stagesError) {
            console.error('Error eliminando stages:', stagesError);
            throw new Error(`Error al eliminar etapas del proceso: ${stagesError.message}`);
        }
        
        // 3. Eliminar document_categories
        const { error: categoriesError } = await supabase
            .from('document_categories')
            .delete()
            .eq('process_id', id)
            .eq('app_name', APP_NAME);
        
        if (categoriesError) {
            console.error('Error eliminando categorías:', categoriesError);
            throw new Error(`Error al eliminar categorías del proceso: ${categoriesError.message}`);
        }
        
        // 4. Eliminar attachments del proceso (que no son de candidatos)
        const { error: attachmentsError } = await supabase
            .from('attachments')
            .delete()
            .eq('process_id', id)
            .eq('app_name', APP_NAME);
        
        if (attachmentsError) {
            console.warn('Error eliminando attachments del proceso:', attachmentsError);
            // No lanzar error, continuar con la eliminación
        }
        
        // 5. Eliminar form_integrations
        const { error: formsError } = await supabase
            .from('form_integrations')
            .delete()
            .eq('process_id', id)
            .eq('app_name', APP_NAME);
        
        if (formsError) {
            console.warn('Error eliminando integraciones de formularios:', formsError);
        }
        
        // 6. Finalmente eliminar el proceso
        const { error, data } = await supabase
            .from('processes')
            .delete()
            .eq('id', id)
            .eq('app_name', APP_NAME)
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

