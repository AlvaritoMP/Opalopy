import { supabase } from '../supabase';
import { Candidate, CandidateHistory, PostIt, Comment, Attachment } from '../../types';
import { processesApi } from './processes';
import { convertirSalarioALetras } from '../numberToWords';

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
        phone2: dbCandidate.phone2,
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
        agreedSalaryInWords: dbCandidate.agreed_salary_in_words,
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
        criticalStageReviewedAt: dbCandidate.critical_stage_reviewed_at,
    };
}

// Convertir de tipo de aplicación a DB
function candidateToDb(candidate: Partial<Candidate>): any {
    const dbCandidate: any = {};
    if (candidate.name !== undefined) dbCandidate.name = candidate.name;
    if (candidate.email !== undefined) dbCandidate.email = candidate.email;
    if (candidate.phone !== undefined) dbCandidate.phone = candidate.phone;
    if (candidate.phone2 !== undefined) dbCandidate.phone2 = candidate.phone2;
    if (candidate.processId !== undefined) dbCandidate.process_id = candidate.processId;
    if (candidate.stageId !== undefined) dbCandidate.stage_id = candidate.stageId;
    if (candidate.description !== undefined) dbCandidate.description = candidate.description;
    if (candidate.avatarUrl !== undefined) dbCandidate.avatar_url = candidate.avatarUrl;
    if (candidate.source !== undefined) dbCandidate.source = candidate.source;
    if (candidate.salaryExpectation !== undefined) dbCandidate.salary_expectation = candidate.salaryExpectation;
    
    // Si se proporciona agreedSalary, generar automáticamente agreedSalaryInWords si no está presente
    if (candidate.agreedSalary !== undefined) {
        dbCandidate.agreed_salary = candidate.agreedSalary;
        // Generar salario en letras automáticamente si no se proporciona explícitamente
        if (candidate.agreedSalaryInWords === undefined) {
            const salarioEnLetras = convertirSalarioALetras(candidate.agreedSalary);
            dbCandidate.agreed_salary_in_words = salarioEnLetras || null;
        } else {
            dbCandidate.agreed_salary_in_words = candidate.agreedSalaryInWords || null;
        }
    } else if (candidate.agreedSalaryInWords !== undefined) {
        // Si solo se actualiza el campo de letras sin el salario, también guardarlo
        dbCandidate.agreed_salary_in_words = candidate.agreedSalaryInWords || null;
    }
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
    if (candidate.criticalStageReviewedAt !== undefined) dbCandidate.critical_stage_reviewed_at = candidate.criticalStageReviewedAt || null;
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

        // Intentar insertar TODOS los campos primero (incluyendo agreed_salary_in_words si existe)
        const { data, error } = await supabase
            .from('candidates')
            .insert(dbData)
            .select()
            .single();
        
        if (error) {
            // Si falla y es por una columna que no existe, intentar sin los campos opcionales
            const errorMsg = error.message || '';
            const isColumnError = errorMsg.includes('schema cache') || 
                                 errorMsg.includes("Could not find") ||
                                 errorMsg.includes("column") ||
                                 error.code === '42703';
            
            if (isColumnError) {
                // Separar campos opcionales y reintentar
                const { agreed_salary_in_words, province, district, critical_stage_reviewed_at, ...standardCreateFields } = dbData;
                
                const { data: data2, error: error2 } = await supabase
                    .from('candidates')
                    .insert(standardCreateFields)
                    .select()
                    .single();
                
                if (error2) throw error2;
                
                // Si hay campos opcionales, intentar actualizarlos por separado
                const optionalFields: any = {};
                if (agreed_salary_in_words !== undefined) optionalFields.agreed_salary_in_words = agreed_salary_in_words;
                if (province !== undefined) optionalFields.province = province;
                if (district !== undefined) optionalFields.district = district;
                if (critical_stage_reviewed_at !== undefined) optionalFields.critical_stage_reviewed_at = critical_stage_reviewed_at;
                
                if (Object.keys(optionalFields).length > 0 && data2) {
                    try {
                        const { error: optionalError } = await supabase
                            .from('candidates')
                            .update(optionalFields)
                            .eq('id', data2.id);
                        
                        if (optionalError) {
                            console.warn('⚠️ Algunos campos opcionales no se pudieron guardar. Ejecuta la migración SQL para habilitar todas las funcionalidades.');
                            console.warn('Campos afectados:', Object.keys(optionalFields).join(', '));
                        } else if (agreed_salary_in_words) {
                            console.log('✅ Salario en letras guardado correctamente:', agreed_salary_in_words.substring(0, 50) + '...');
                        }
                    } catch (err) {
                        console.warn('No se pudieron guardar algunos campos opcionales');
                    }
                }
                
                return await this.getById(data2.id) as Candidate;
            } else {
                throw error;
            }
        }
        
        // Si el insert fue exitoso, verificar que agreed_salary_in_words se guardó
        if (dbData.agreed_salary_in_words && data) {
            console.log('✅ Candidato creado con salario en letras:', dbData.agreed_salary_in_words.substring(0, 50) + '...');
        }

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

        // Si el candidato tiene salario acordado pero no tiene salario en letras, generarlo automáticamente
        // Esto se aplica tanto si se está actualizando el salario acordado como si ya existía
        const agreedSalaryToUse = candidateData.agreedSalary !== undefined ? candidateData.agreedSalary : current.agreedSalary;
        const currentSalaryInWords = candidateData.agreedSalaryInWords !== undefined ? candidateData.agreedSalaryInWords : current.agreedSalaryInWords;
        
        // Si tiene salario acordado pero no tiene salario en letras (o está vacío), generarlo automáticamente
        if (agreedSalaryToUse && agreedSalaryToUse.trim() !== '') {
            const needsGeneration = !currentSalaryInWords || currentSalaryInWords.trim() === '';
            // También regenerar si se está actualizando el salario acordado
            const isUpdatingSalary = candidateData.agreedSalary !== undefined && candidateData.agreedSalary !== current.agreedSalary;
            
            if (needsGeneration || isUpdatingSalary) {
                const salarioEnLetras = convertirSalarioALetras(agreedSalaryToUse);
                if (salarioEnLetras) {
                    candidateData.agreedSalaryInWords = salarioEnLetras;
                }
            }
        }

        const dbData = candidateToDb(candidateData);
        
        // Separar campos que pueden no existir en el esquema (province, district, critical_stage_reviewed_at, agreed_salary_in_words)
        // Si las columnas no existen en la BD, se omiten de la actualización
        const { province, district, critical_stage_reviewed_at, agreed_salary_in_words, ...standardFields } = dbData;
        
        // Primero intentar actualizar solo los campos estándar
        const { error: standardError } = await supabase
            .from('candidates')
            .update(standardFields)
            .eq('id', id);
        
        if (standardError) throw standardError;
        
        // Si hay province o district y no hay error, intentar actualizarlos por separado
        // Esto permite que funcione aunque las columnas no existan aún
        if (province !== undefined || district !== undefined) {
            const locationFields: any = {};
            if (province !== undefined) locationFields.province = province;
            if (district !== undefined) locationFields.district = district;
            
            // Intentar actualizar campos de ubicación - ignorar error si columnas no existen
            const { error: locationError } = await supabase
                .from('candidates')
                .update(locationFields)
                .eq('id', id);
            
            // Si hay error, verificar si es por columnas faltantes
            if (locationError) {
                const errorMsg = locationError.message || '';
                // Si el error es porque las columnas no existen, solo mostrar warning
                if (errorMsg.includes('schema cache') || errorMsg.includes("Could not find") || errorMsg.includes("column")) {
                    console.warn('⚠️ Las columnas province/district no existen en la base de datos. Los campos de ubicación no se guardaron. Por favor, agrega estas columnas a la tabla candidates en Supabase.');
                    // No lanzar error para no bloquear la actualización de otros campos
                } else {
                    // Para otros errores, sí lanzar
                    throw locationError;
                }
            }
        }
        
        // Manejar critical_stage_reviewed_at por separado (la columna puede no existir aún)
        if (critical_stage_reviewed_at !== undefined) {
            try {
                const { error: criticalError } = await supabase
                    .from('candidates')
                    .update({ critical_stage_reviewed_at })
                    .eq('id', id);
                
                if (criticalError) {
                    const errorMsg = criticalError.message || '';
                    const isColumnError = errorMsg.includes('schema cache') || 
                                         errorMsg.includes("Could not find") || 
                                         errorMsg.includes("column") ||
                                         criticalError.code === '42703';
                    
                    if (isColumnError) {
                        console.warn('⚠️ La columna critical_stage_reviewed_at no existe en la base de datos. Ejecuta la migración SQL para habilitar esta funcionalidad.');
                    } else {
                        console.warn('Error actualizando critical_stage_reviewed_at:', criticalError);
                    }
                }
            } catch (err: any) {
                // Ignorar errores de columna faltante
                console.warn('No se pudo actualizar critical_stage_reviewed_at');
            }
        }
        
        // Manejar agreed_salary_in_words por separado (la columna puede no existir aún)
        if (agreed_salary_in_words !== undefined) {
            // Solo intentar guardar si tiene un valor válido
            if (agreed_salary_in_words && agreed_salary_in_words.trim() !== '') {
                try {
                    console.log('💾 Intentando guardar salario en letras:', agreed_salary_in_words.substring(0, 50) + '...');
                    
                    const { error: salaryWordsError, data: updatedData } = await supabase
                        .from('candidates')
                        .update({ agreed_salary_in_words })
                        .eq('id', id)
                        .select('agreed_salary_in_words')
                        .single();
                    
                    if (salaryWordsError) {
                        const errorMsg = salaryWordsError.message || '';
                        const isColumnError = errorMsg.includes('schema cache') || 
                                             errorMsg.includes("Could not find") ||
                                             errorMsg.includes("column") ||
                                             errorMsg.includes("42703");
                        
                        if (isColumnError) {
                            console.error('❌ La columna agreed_salary_in_words NO EXISTE en la base de datos.');
                            console.error('⚠️ Ejecuta el script MIGRATION_COMPLETA_CANDIDATES.sql en Supabase para crear la columna.');
                            console.error('📝 Valor que no se pudo guardar:', agreed_salary_in_words.substring(0, 100) + '...');
                            // Mostrar alerta visual al usuario
                            throw new Error('La columna agreed_salary_in_words no existe en la base de datos. Por favor, ejecuta la migración SQL MIGRATION_COMPLETA_CANDIDATES.sql en Supabase para habilitar esta funcionalidad.');
                        } else {
                            console.error('❌ Error inesperado actualizando agreed_salary_in_words:', salaryWordsError);
                            throw salaryWordsError;
                        }
                    } else {
                        console.log('✅ Salario en letras guardado correctamente en la base de datos');
                        if (updatedData?.agreed_salary_in_words) {
                            console.log('✅ Verificado en BD:', updatedData.agreed_salary_in_words.substring(0, 50) + '...');
                        }
                    }
                } catch (err: any) {
                    const errorMsg = err?.message || '';
                    const isColumnError = errorMsg.includes('schema cache') || 
                                         errorMsg.includes("Could not find") ||
                                         errorMsg.includes("column") ||
                                         errorMsg.includes("42703");
                    
                    if (!isColumnError && !errorMsg.includes('columna')) {
                        // Solo relanzar si no es error de columna faltante
                        throw err;
                    }
                    // Si es error de columna, ya se mostró el mensaje arriba
                }
            } else {
                console.warn('⚠️ agreed_salary_in_words está vacío o null, no se guardará');
            }
        }

        // Si cambió el stage, agregar al historial y verificar si es etapa crítica
        if (candidateData.stageId && candidateData.stageId !== current.stageId) {
            await supabase.from('candidate_history').insert({
                candidate_id: id,
                stage_id: candidateData.stageId,
                moved_at: new Date().toISOString(),
                moved_by: movedBy || null,
            });
            
            // Verificar si la nueva etapa es crítica para resetear criticalStageReviewedAt
            try {
                const process = await processesApi.getById(current.processId);
                if (process) {
                    const newStage = process.stages.find(s => s.id === candidateData.stageId);
                    const isCriticalStage = newStage?.isCritical || false;
                    
                    // Si se mueve a una etapa crítica, resetear criticalStageReviewedAt
                    // para que la alerta vuelva a aparecer
                    if (isCriticalStage) {
                        try {
                            const { error: resetError } = await supabase
                                .from('candidates')
                                .update({ critical_stage_reviewed_at: null })
                                .eq('id', id);
                            
                            if (resetError) {
                                const errorMsg = resetError.message || '';
                                const isColumnError = errorMsg.includes('schema cache') || 
                                                     errorMsg.includes("Could not find") || 
                                                     errorMsg.includes("column") ||
                                                     resetError.code === '42703';
                                
                                if (!isColumnError) {
                                    console.warn('Error reseteando criticalStageReviewedAt:', resetError);
                                }
                            }
                        } catch (err) {
                            // Ignorar si la columna no existe
                            console.warn('No se pudo resetear criticalStageReviewedAt (columna puede no existir)');
                        }
                    }
                }
            } catch (error) {
                // Si no se puede verificar, continuar sin resetear (no crítico)
                console.warn('No se pudo verificar si la etapa es crítica:', error);
            }
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

