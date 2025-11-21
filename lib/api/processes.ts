import { supabase } from '../supabase';
import { Process, Stage, DocumentCategory } from '../../types';

// Convertir de DB a tipo de aplicación
function dbToProcess(dbProcess: any, stages: any[] = [], documentCategories: any[] = []): Process {
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
        attachments: [], // Se cargan por separado
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
    if (process.serviceOrderCode !== undefined) dbProcess.service_order_code = process.serviceOrderCode;
    if (process.startDate !== undefined) dbProcess.start_date = process.startDate;
    if (process.endDate !== undefined) dbProcess.end_date = process.endDate;
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

        // Obtener stages y categorías para cada proceso
        const processesWithRelations = await Promise.all(
            processes.map(async (process) => {
                const [stages, categories] = await Promise.all([
                    supabase.from('stages').select('*').eq('process_id', process.id).order('order_index'),
                    supabase.from('document_categories').select('*').eq('process_id', process.id),
                ]);

                return dbToProcess(
                    process,
                    stages.data || [],
                    categories.data || []
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

        const [stages, categories] = await Promise.all([
            supabase.from('stages').select('*').eq('process_id', id).order('order_index'),
            supabase.from('document_categories').select('*').eq('process_id', id),
        ]);

        return dbToProcess(process, stages.data || [], categories.data || []);
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

        return await this.getById(id) as Process;
    },

    // Eliminar proceso
    async delete(id: string): Promise<void> {
        // Primero eliminar las relaciones dependientes
        // Eliminar stages
        const { error: stagesError } = await supabase
            .from('stages')
            .delete()
            .eq('process_id', id);
        
        if (stagesError) {
            console.error('Error eliminando stages:', stagesError);
            throw new Error(`Error al eliminar etapas del proceso: ${stagesError.message}`);
        }
        
        // Eliminar document_categories
        const { error: categoriesError } = await supabase
            .from('document_categories')
            .delete()
            .eq('process_id', id);
        
        if (categoriesError) {
            console.error('Error eliminando categorías:', categoriesError);
            throw new Error(`Error al eliminar categorías del proceso: ${categoriesError.message}`);
        }
        
        // Eliminar attachments del proceso
        const { error: attachmentsError } = await supabase
            .from('attachments')
            .delete()
            .eq('process_id', id);
        
        if (attachmentsError) {
            console.error('Error eliminando attachments:', attachmentsError);
            // No lanzar error, continuar con la eliminación
        }
        
        // Finalmente eliminar el proceso
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

