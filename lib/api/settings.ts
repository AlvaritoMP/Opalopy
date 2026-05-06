import { supabase } from '../supabase';
import { AppSettings } from '../../types';
import { APP_NAME } from '../appConfig';
import { getSettings } from '../settings';

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

// Convertir de DB a tipo de aplicación
function dbToSettings(dbSettings: any): AppSettings {
    return {
        database: dbSettings.database_config || { apiUrl: '', apiToken: '' },
        fileStorage: dbSettings.file_storage_config || { provider: 'None', connected: false },
        googleDrive: dbSettings.google_drive_config || undefined,
        currencySymbol: dbSettings.currency_symbol || '$',
        appName: dbSettings.app_name || 'Opalopy',
        logoUrl: dbSettings.logo_url || '',
        poweredByLogoUrl: dbSettings.powered_by_logo_url || undefined,
        customLabels: dbSettings.custom_labels || {},
        dashboardLayout: dbSettings.dashboard_layout,
        templates: dbSettings.templates,
        reportTheme: dbSettings.report_theme,
        candidateSources: dbSettings.candidate_sources || undefined,
        provinces: dbSettings.provinces || undefined,
        districts: dbSettings.districts || undefined,
    };
}

// Mezclar settings obtenidos de la BD con el backup local (localStorage)
// para evitar que, si la BD no guarda bien algún campo (ej. currencySymbol),
// se vuelva siempre al valor por defecto.
function mergeWithLocalSettings(settingsFromRemote: AppSettings): AppSettings {
    const local = getSettings();
    if (!local) return settingsFromRemote;

    return {
        ...settingsFromRemote,
        ...local,
        customLabels: {
            ...(settingsFromRemote.customLabels || {}),
            ...(local.customLabels || {}),
        },
    };
}

// Convertir de tipo de aplicación a DB
function settingsToDb(settings: Partial<AppSettings>): any {
    const dbSettings: any = {};
    if (settings.database !== undefined) dbSettings.database_config = settings.database;
    if (settings.fileStorage !== undefined) dbSettings.file_storage_config = settings.fileStorage;
    if (settings.googleDrive !== undefined) dbSettings.google_drive_config = settings.googleDrive;
    if (settings.currencySymbol !== undefined) dbSettings.currency_symbol = settings.currencySymbol;
    if (settings.appName !== undefined) dbSettings.app_name = settings.appName;
    if (settings.logoUrl !== undefined) dbSettings.logo_url = settings.logoUrl;
    if (settings.poweredByLogoUrl !== undefined) dbSettings.powered_by_logo_url = settings.poweredByLogoUrl;
    if (settings.customLabels !== undefined) dbSettings.custom_labels = settings.customLabels;
    if (settings.dashboardLayout !== undefined) dbSettings.dashboard_layout = settings.dashboardLayout;
    if (settings.templates !== undefined) dbSettings.templates = settings.templates;
    if (settings.reportTheme !== undefined) dbSettings.report_theme = settings.reportTheme;
    if (settings.candidateSources !== undefined) dbSettings.candidate_sources = settings.candidateSources;
    if (settings.provinces !== undefined) dbSettings.provinces = settings.provinces;
    if (settings.districts !== undefined) dbSettings.districts = settings.districts;
    return dbSettings;
}

export const settingsApi = {
    // Obtener configuración (solo de esta app)
    async get(): Promise<AppSettings> {
        try {
            // Intentar primero con filtro por app_name
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .eq('app_name', APP_NAME) // Filtrar solo settings de esta app
                .maybeSingle();
            
            if (error) {
                // Si el error es 406 o relacionado con app_name, intentar sin filtro
                if (error.code === 'PGRST116' || error.message?.includes('app_name') || error.message?.includes('406')) {
                    console.warn('⚠️ Error al cargar settings con filtro app_name, intentando sin filtro:', error.message);
                    
                    // Intentar sin filtro (para compatibilidad con tablas sin app_name)
                    const { data: allData, error: allError } = await supabase
                        .from('app_settings')
                        .select('*')
                        .maybeSingle();
                    
                    if (allError) {
                        // Si tampoco funciona sin filtro, intentar usar settings locales
                        if (allError.code === 'PGRST116') {
                            console.warn('⚠️ No hay settings en la BD, intentando usar backup local');
                            const local = getSettings();
                            if (local) {
                                return local;
                            }
                            console.warn('⚠️ No hay backup local, usando valores por defecto');
                            return {
                                database: { apiUrl: '', apiToken: '' },
                                fileStorage: { provider: 'None', connected: false },
                                currencySymbol: '$',
                                appName: APP_NAME,
                                logoUrl: '',
                                customLabels: {},
                            } as AppSettings;
                        }
                        throw allError;
                    }
                    
                    // Si hay datos sin filtro, usar esos (puede ser de otra app, pero es mejor que nada)
                    if (allData) {
                        return mergeWithLocalSettings(dbToSettings(allData));
                    }
                } else {
                    throw error;
                }
            }
            
            // Si encontramos datos con filtro, usarlos
            if (data) {
                return mergeWithLocalSettings(dbToSettings(data));
            }
            
            // Si no hay datos, intentar usar backup local antes de valores por defecto
            console.warn('⚠️ No hay settings para esta app, intentando usar backup local');
            const local = getSettings();
            if (local) {
                return local;
            }
            console.warn('⚠️ No hay backup local, usando valores por defecto');
            return {
                database: { apiUrl: '', apiToken: '' },
                fileStorage: { provider: 'None', connected: false },
                currencySymbol: '$',
                appName: APP_NAME,
                logoUrl: '',
                customLabels: {},
            } as AppSettings;
        } catch (error: any) {
            console.error('❌ Error al obtener settings:', error);
            // Si todo falla, intentar usar settings locales antes de valores por defecto
            const local = getSettings();
            if (local) {
                console.warn('⚠️ Usando backup local de settings tras error');
                return local;
            }
            // Retornar valores por defecto si tampoco hay backup local
            return {
                database: { apiUrl: '', apiToken: '' },
                fileStorage: { provider: 'None', connected: false },
                currencySymbol: '$',
                appName: APP_NAME,
                logoUrl: '',
                customLabels: {},
            } as AppSettings;
        }
    },

    // Crear configuración (solo si no existe, con app_name automático)
    // NOTA: La tabla tiene un constraint que solo permite un registro con ID específico
    // Por eso usamos UPSERT (INSERT ... ON CONFLICT DO UPDATE)
    async create(settings: AppSettings): Promise<AppSettings> {
        try {
            const dbData = settingsToDb(settings);
            dbData.app_name = APP_NAME;
            // Usar el ID específico que requiere el constraint
            dbData.id = SETTINGS_ID;

            // Usar UPSERT para insertar o actualizar
            const { data, error } = await supabase
                .from('app_settings')
                .upsert(dbData, { 
                    onConflict: 'id',
                    ignoreDuplicates: false 
                })
                .select()
                .single();
            
            if (error) {
                // Si el error es que app_name no existe, intentar sin app_name
                if (error.message?.includes('app_name') || error.message?.includes('column') || error.code === 'PGRST106') {
                    console.warn('⚠️ Error al crear settings con app_name, intentando sin app_name:', error.message);
                    delete dbData.app_name;
                    
                    const { data: retryData, error: retryError } = await supabase
                        .from('app_settings')
                        .upsert(dbData, { 
                            onConflict: 'id',
                            ignoreDuplicates: false 
                        })
                        .select()
                        .single();
                    
                    if (retryError) throw retryError;
                    if (retryData) return dbToSettings(retryData);
                }
                throw error;
            }
            
            if (!data) {
                throw new Error('No se creó/actualizó el registro de settings');
            }
            
            return dbToSettings(data);
        } catch (error: any) {
            console.error('❌ Error al crear settings:', error);
            // Retornar settings originales si la creación falla
            return settings;
        }
    },

    // Actualizar configuración
    async update(settings: Partial<AppSettings>): Promise<AppSettings> {
        const dbData = settingsToDb(settings);
        console.log('settingsApi.update - dbData:', JSON.stringify(dbData, null, 2));
        
        // Primero obtener la configuración actual para hacer merge
        const current = await this.get();
        const mergedSettings = { ...current, ...settings };
        const mergedDbData = settingsToDb(mergedSettings);
        console.log('settingsApi.update - mergedDbData:', JSON.stringify(mergedDbData, null, 2));
        
        // Verificar si existe un registro (la tabla solo permite uno con ID específico)
        const { data: existingData, error: checkError } = await supabase
            .from('app_settings')
            .select('id, app_name')
            .maybeSingle();
        
        // Si no existe ningún registro, crear uno
        if (!existingData || checkError?.code === 'PGRST116') {
            console.log('⚠️ No existe registro de settings, creando uno nuevo...');
            try {
                const created = await this.create(mergedSettings);
                console.log('✅ Settings creados exitosamente');
                return created;
            } catch (createError: any) {
                console.error('Error creating settings:', createError);
                // Si falla la creación, intentar actualizar de todas formas
            }
        } else if (existingData.app_name !== APP_NAME) {
            // Si existe pero tiene app_name diferente, actualizarlo
            console.log(`⚠️ Registro existe pero con app_name = '${existingData.app_name}', actualizando a '${APP_NAME}'...`);
        }
        
        // Separar campos opcionales que pueden no existir en el esquema
        const { candidate_sources, provinces, districts, powered_by_logo_url, ...standardFields } = mergedDbData;
        
        // No permitir cambiar app_name
        delete standardFields.app_name;
        
        // Primero actualizar campos estándar
        const { error: standardError, data: updatedData } = await supabase
            .from('app_settings')
            .update(standardFields)
            .eq('app_name', APP_NAME)
            .select('id');
        
        if (standardError) {
            console.error('Error updating standard settings fields:', standardError);
            // Si el error es que no existe el registro, intentar crear
            if (standardError.code === 'PGRST116' || standardError.message?.includes('No rows')) {
                console.log('⚠️ No se encontró registro para actualizar, creando uno nuevo...');
                try {
                    const created = await this.create(mergedSettings);
                    return created;
                } catch (createError: any) {
                    console.error('Error creating settings after failed update:', createError);
                    throw standardError;
                }
            }
            throw standardError;
        }
        
        // Verificar que se actualizó al menos una fila
        if (!updatedData || updatedData.length === 0) {
            console.warn('⚠️ No se actualizó ninguna fila, creando registro nuevo...');
            try {
                const created = await this.create(mergedSettings);
                return created;
            } catch (createError: any) {
                console.error('Error creating settings after zero update count:', createError);
                // Continuar para intentar actualizar campos opcionales
            }
        }
        
        // Actualizar campos opcionales por separado (si existen)
        const optionalFields: any = {};
        if (candidate_sources !== undefined) optionalFields.candidate_sources = candidate_sources;
        if (provinces !== undefined) optionalFields.provinces = provinces;
        if (districts !== undefined) optionalFields.districts = districts;
        if (powered_by_logo_url !== undefined) optionalFields.powered_by_logo_url = powered_by_logo_url;
        
        if (Object.keys(optionalFields).length > 0) {
                const { error: optionalError } = await supabase
                    .from('app_settings')
                    .update(optionalFields)
                    .eq('app_name', APP_NAME);
            
            if (optionalError) {
                const errorMsg = optionalError.message || '';
                if (errorMsg.includes('schema cache') || errorMsg.includes("Could not find") || errorMsg.includes("column") || errorMsg.includes("powered_by_logo_url")) {
                    console.warn('⚠️ Algunas columnas opcionales no existen en la base de datos. Por favor, ejecuta la migración SQL: MIGRATION_ADD_POWERED_BY_LOGO.sql. Error:', optionalError.message);
                    // No lanzar error, permitir que continúe
                } else {
                    console.error('Error updating optional settings fields:', optionalError);
                    throw optionalError;
                }
            }
        }
        
        // Obtener configuración actualizada
        const { data, error: fetchError } = await supabase
            .from('app_settings')
            .select('*')
            .eq('app_name', APP_NAME)
            .single();
        
        if (fetchError) {
            console.error('Error fetching updated settings:', fetchError);
            // Si no se encuentra, intentar crear
            if (fetchError.code === 'PGRST116') {
                console.log('⚠️ No se encontró registro después de actualizar, creando uno nuevo...');
                try {
                    const created = await this.create(mergedSettings);
                    return created;
                } catch (createError: any) {
                    console.error('Error creating settings after fetch error:', createError);
                    throw fetchError;
                }
            }
            throw fetchError;
        }
        
        const result = dbToSettings(data);
        console.log('✅ Settings actualizados exitosamente:', JSON.stringify(result.googleDrive, null, 2));
        return result;
    },
};

