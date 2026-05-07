import { supabase } from '../supabase';
import { FormIntegration, FieldMapping } from '../../types';
import { APP_NAME } from '../appConfig';

// Convertir de DB a tipo de aplicación
function dbToFormIntegration(dbIntegration: any): FormIntegration {
    let fieldMapping: FieldMapping | undefined = undefined;
    
    // Manejar field_mapping que puede venir como JSONB (objeto) o JSON (string)
    if (dbIntegration.field_mapping) {
        try {
            if (typeof dbIntegration.field_mapping === 'string') {
                fieldMapping = JSON.parse(dbIntegration.field_mapping);
            } else if (typeof dbIntegration.field_mapping === 'object') {
                fieldMapping = dbIntegration.field_mapping;
            }
        } catch (err) {
            console.warn('Error parseando field_mapping:', err);
            fieldMapping = undefined;
        }
    }
    
    return {
        id: dbIntegration.id,
        platform: dbIntegration.platform || 'Tally',
        formName: dbIntegration.form_name || '',
        formIdOrUrl: dbIntegration.form_id_or_url || '',
        processId: dbIntegration.process_id || '',
        webhookUrl: dbIntegration.webhook_url || '',
        fieldMapping,
    };
}

// Convertir de tipo de aplicación a DB
function formIntegrationToDb(integration: Partial<FormIntegration>): any {
    const dbIntegration: any = {};
    if (integration.platform !== undefined) dbIntegration.platform = integration.platform;
    if (integration.formName !== undefined) dbIntegration.form_name = integration.formName;
    if (integration.formIdOrUrl !== undefined) dbIntegration.form_id_or_url = integration.formIdOrUrl;
    if (integration.processId !== undefined) dbIntegration.process_id = integration.processId;
    if (integration.webhookUrl !== undefined) dbIntegration.webhook_url = integration.webhookUrl;
    // Incluir field_mapping incluso si viene vacío para permitir limpiar mapeos existentes.
    if (integration.fieldMapping !== undefined) {
        dbIntegration.field_mapping =
            integration.fieldMapping &&
            typeof integration.fieldMapping === 'object' &&
            Object.keys(integration.fieldMapping).length > 0
                ? integration.fieldMapping
                : null;
    }
    return dbIntegration;
}

export const formIntegrationsApi = {
    // Obtener todas las integraciones
    async getAll(): Promise<FormIntegration[]> {
        const { data, error } = await supabase
            .from('form_integrations')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        if (!data) return [];
        
        return data.map(dbToFormIntegration);
    },

    // Obtener una integración por ID
    async getById(id: string): Promise<FormIntegration | null> {
        const { data, error } = await supabase
            .from('form_integrations')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        
        if (error) throw error;
        if (!data) return null;
        
        return dbToFormIntegration(data);
    },

    // Obtener integración por webhook URL (para procesar webhooks)
    async getByWebhookUrl(webhookUrl: string): Promise<FormIntegration | null> {
        const { data, error } = await supabase
            .from('form_integrations')
            .select('*')
            .eq('webhook_url', webhookUrl)
            .maybeSingle();
        
        if (error) throw error;
        if (!data) return null;
        
        return dbToFormIntegration(data);
    },

    // Crear nueva integración
    async create(integrationData: Omit<FormIntegration, 'id'>): Promise<FormIntegration> {
        const dbData = formIntegrationToDb(integrationData);
        dbData.app_name = APP_NAME;
        
        // Generar ID único para el webhook
        const webhookId = crypto.randomUUID();
        // Construir URL del webhook usando Edge Function de Supabase
        // Esto es más confiable que usar el backend de Easypanel
        // La URL de Supabase viene de VITE_SUPABASE_URL (ej: https://afhiiplxqtodqxvmswor.supabase.co)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
            throw new Error('VITE_SUPABASE_URL no está configurada. No se puede crear la integración.');
        }
        dbData.webhook_url = `${supabaseUrl}/functions/v1/tally-webhook/${webhookId}`;
        
        // Separar field_mapping para manejarlo por separado (puede no existir la columna)
        const { field_mapping, ...standardFields } = dbData;
        
        // Validar campos requeridos
        if (!standardFields.platform || !standardFields.form_name || !standardFields.form_id_or_url || !standardFields.process_id) {
            throw new Error('Faltan campos requeridos: platform, formName, formIdOrUrl, processId');
        }
        
        console.log('🔍 Datos a insertar (sin field_mapping):', standardFields);
        
        // Intentar insertar primero sin field_mapping
        let { data, error } = await supabase
            .from('form_integrations')
            .insert(standardFields)
            .select()
            .single();
        
        if (error) {
            console.error('❌ Error al crear integración:', error);
            console.error('❌ Código de error:', error.code);
            console.error('❌ Mensaje:', error.message);
            console.error('❌ Detalles:', error.details);
            console.error('❌ Hint:', error.hint);
            
            // Si el error es por columnas faltantes, intentar sin field_mapping
            const errorMsg = error.message || '';
            if (errorMsg.includes('field_mapping') || errorMsg.includes('column') || error.code === '42703') {
                console.warn('⚠️ Columna field_mapping no existe, intentando sin ella...');
                // Ya intentamos sin field_mapping, así que el error es otro
                throw new Error(`Error de base de datos: ${error.message}. Verifica que la columna field_mapping existe o ejecuta MIGRATION_ADD_FIELD_MAPPING.sql`);
            }
            throw new Error(`Error al crear integración: ${error.message || 'Error desconocido'}`);
        }
        
        if (!data) throw new Error('No se creó la integración');
        
        // Si hay field_mapping y se creó correctamente, intentar actualizarlo
        if (field_mapping && data.id) {
            try {
                // field_mapping viene como string JSON de formIntegrationToDb, parsearlo a objeto para JSONB
                const fieldMappingObj = typeof field_mapping === 'string' ? JSON.parse(field_mapping) : field_mapping;
                // Intentar actualizar con field_mapping como JSONB
                const { error: updateError } = await supabase
                    .from('form_integrations')
                    .update({ field_mapping: fieldMappingObj })
                    .eq('id', data.id);
                
                if (updateError) {
                    const updateErrorMsg = updateError.message || '';
                    if (updateErrorMsg.includes('field_mapping') || updateErrorMsg.includes('column')) {
                        console.warn('⚠️ Columna field_mapping no existe. Ejecuta MIGRATION_ADD_FIELD_MAPPING.sql para habilitar esta funcionalidad.');
                    } else {
                        console.warn('⚠️ Error actualizando field_mapping:', updateError);
                    }
                    // No lanzar error, la integración se creó correctamente
                }
            } catch (err) {
                console.warn('⚠️ Error procesando field_mapping:', err);
                // No lanzar error, la integración se creó correctamente
            }
        }
        
        // Recargar la integración completa
        const fullIntegration = await this.getById(data.id);
        if (!fullIntegration) throw new Error('No se pudo recargar la integración');
        
        return fullIntegration;
    },

    // Actualizar integración
    async update(id: string, integrationData: Partial<FormIntegration>): Promise<FormIntegration> {
        const dbData = formIntegrationToDb(integrationData);
        // No permitir cambiar app_name
        delete dbData.app_name;
        
        // Separar field_mapping para manejarlo por separado
        const { field_mapping, ...standardFields } = dbData;
        const updateData = { ...standardFields, app_name: APP_NAME };
        
        // Actualizar campos estándar primero
        const { data, error } = await supabase
            .from('form_integrations')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        if (!data) throw new Error('No se actualizó la integración');
        
        // Si hay field_mapping, intentar actualizarlo por separado
        if (field_mapping !== undefined && data.id) {
            try {
                const fieldMappingValue = typeof field_mapping === 'string' 
                    ? JSON.parse(field_mapping) 
                    : field_mapping;
                
                const { error: updateError } = await supabase
                    .from('form_integrations')
                    .update({ field_mapping: fieldMappingValue })
                    .eq('id', data.id);
                
                if (updateError) {
                    const updateErrorMsg = updateError.message || '';
                    if (updateErrorMsg.includes('field_mapping') || updateErrorMsg.includes('column')) {
                        console.warn('⚠️ Columna field_mapping no existe. Ejecuta MIGRATION_ADD_FIELD_MAPPING.sql para habilitar esta funcionalidad.');
                    } else {
                        console.warn('⚠️ Error actualizando field_mapping:', updateError);
                    }
                    // No lanzar error, los otros campos se actualizaron correctamente
                }
            } catch (err) {
                console.warn('⚠️ Error procesando field_mapping:', err);
                // No lanzar error, los otros campos se actualizaron correctamente
            }
        }
        
        // Recargar la integración completa
        const fullIntegration = await this.getById(data.id);
        if (!fullIntegration) throw new Error('No se pudo recargar la integración');
        
        return fullIntegration;
    },

    // Eliminar integración
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('form_integrations')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    },
};
