import { supabase } from '../supabase';
import { AppSettings } from '../../types';
import { APP_NAME } from '../appConfig';

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

// Convertir de DB a tipo de aplicación
function dbToSettings(dbSettings: any): AppSettings {
    // Parsear candidate_sources si viene como string (puede pasar con JSONB)
    let candidateSources: string[] | undefined = undefined;
    if (dbSettings.candidate_sources) {
        if (typeof dbSettings.candidate_sources === 'string') {
            try {
                candidateSources = JSON.parse(dbSettings.candidate_sources);
            } catch (e) {
                console.warn('Error parsing candidate_sources as JSON string:', e);
                candidateSources = undefined;
            }
        } else if (Array.isArray(dbSettings.candidate_sources)) {
            candidateSources = dbSettings.candidate_sources;
        }
    }
    
    // Parsear provinces si viene como string
    let provinces: string[] | undefined = undefined;
    if (dbSettings.provinces) {
        if (typeof dbSettings.provinces === 'string') {
            try {
                provinces = JSON.parse(dbSettings.provinces);
            } catch (e) {
                console.warn('Error parsing provinces as JSON string:', e);
                provinces = undefined;
            }
        } else if (Array.isArray(dbSettings.provinces)) {
            provinces = dbSettings.provinces;
        }
    }
    
    // Parsear districts si viene como string
    let districts: any | undefined = undefined;
    if (dbSettings.districts) {
        if (typeof dbSettings.districts === 'string') {
            try {
                districts = JSON.parse(dbSettings.districts);
            } catch (e) {
                console.warn('Error parsing districts as JSON string:', e);
                districts = undefined;
            }
        } else if (typeof dbSettings.districts === 'object') {
            districts = dbSettings.districts;
        }
    }
    
    return {
        database: dbSettings.database_config || { apiUrl: '', apiToken: '' },
        fileStorage: dbSettings.file_storage_config || { provider: 'None', connected: false },
        googleDrive: dbSettings.google_drive_config || undefined,
        currencySymbol: dbSettings.currency_symbol || '$',
        appName: dbSettings.app_name || 'ATS Pro',
        logoUrl: dbSettings.logo_url || '',
        poweredByLogoUrl: dbSettings.powered_by_logo_url || undefined,
        customLabels: dbSettings.custom_labels || {},
        dashboardLayout: dbSettings.dashboard_layout,
        templates: dbSettings.templates,
        reportTheme: dbSettings.report_theme,
        candidateSources,
        provinces,
        districts,
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
    // Obtener configuración
    async get(createIfNotExists: boolean = true): Promise<AppSettings> {
        // Usar select simple para evitar error 406
        let { data, error } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', SETTINGS_ID)
            .eq('app_name', APP_NAME)
            .single();
        
        // Si no se encuentra con app_name, NO intentar buscar por ID porque podría ser de otra app
        // En una base de datos compartida, cada app debe tener su propio registro con su app_name
        if (error && error.code === 'PGRST116') {
            console.warn('⚠️ No se encontró registro con app_name =', APP_NAME);
            console.warn('⚠️ Esto es normal si es la primera vez que se usa esta app o si los settings no se han guardado aún');
            console.warn('⚠️ El registro se creará automáticamente cuando se guarden los settings por primera vez');
        }
        
        if (error) {
            // Si no existe y se permite crear, crear con valores por defecto
            if (error.code === 'PGRST116' && createIfNotExists) {
                console.log('📝 Creando nuevo registro de settings con app_name =', APP_NAME);
                return await this.create({
                    database: { apiUrl: '', apiToken: '' },
                    fileStorage: { provider: 'None', connected: false },
                    currencySymbol: '$',
                    appName: 'ATS Pro',
                    logoUrl: '',
                    customLabels: {},
                });
            }
            // Si no se permite crear o es otro error, lanzarlo
            throw error;
        }
        
        const settings = dbToSettings(data);
        // Log detallado para debuggear el problema de candidateSources
        console.log('📋 Settings loaded - candidateSources:', settings.candidateSources);
        console.log('📋 Raw candidate_sources from DB:', data.candidate_sources);
        console.log('📋 Type:', typeof settings.candidateSources, 'IsArray:', Array.isArray(settings.candidateSources));
        if (Array.isArray(settings.candidateSources)) {
            console.log('📋 Length:', settings.candidateSources.length, 'Items:', settings.candidateSources);
        } else {
            console.warn('⚠️ candidateSources no es un array válido después de parsear');
        }
        return settings;
    },

    // Crear configuración (solo si no existe)
    async create(settings: AppSettings): Promise<AppSettings> {
        const dbData = settingsToDb(settings);
        dbData.id = SETTINGS_ID;
        dbData.app_name = APP_NAME;

        const { data, error } = await supabase
            .from('app_settings')
            .insert(dbData)
            .select('*, candidate_sources, provinces, districts')
            .single();
        
        if (error) throw error;
        return dbToSettings(data);
    },

    // Actualizar configuración
    async update(settings: Partial<AppSettings>): Promise<AppSettings> {
        const dbData = settingsToDb(settings);
        delete dbData.app_name; // No permitir cambiar app_name
        console.log('settingsApi.update - Input settings.candidateSources:', settings.candidateSources);
        console.log('settingsApi.update - dbData:', JSON.stringify(dbData, null, 2));
        
        // Primero obtener la configuración actual para hacer merge
        // Si no existe, usar valores por defecto
        let current: AppSettings;
        try {
            current = await this.get(false); // No crear si no existe
        } catch (error: any) {
            if (error.code === 'PGRST116') {
                // No existe, usar valores por defecto
                console.log('⚠️ No existe registro de settings, usando valores por defecto para merge');
                current = {
                    database: { apiUrl: '', apiToken: '' },
                    fileStorage: { provider: 'None', connected: false },
                    currencySymbol: '$',
                    appName: 'ATS Pro',
                    logoUrl: '',
                    customLabels: {},
                };
            } else {
                throw error;
            }
        }
        
        console.log('settingsApi.update - Current candidateSources:', current.candidateSources);
        const mergedSettings = { ...current, ...settings };
        console.log('settingsApi.update - Merged candidateSources:', mergedSettings.candidateSources);
        const mergedDbData = settingsToDb(mergedSettings);
        delete mergedDbData.app_name; // No permitir cambiar app_name
        console.log('settingsApi.update - mergedDbData candidate_sources:', mergedDbData.candidate_sources);
        console.log('settingsApi.update - mergedDbData:', JSON.stringify(mergedDbData, null, 2));
        
        // Separar campos opcionales que pueden no existir en el esquema
        const { candidate_sources, provinces, districts, powered_by_logo_url, ...standardFields } = mergedDbData;
        
        // Usar UPSERT (INSERT ... ON CONFLICT UPDATE) para simplificar y evitar errores
        // Esto crea el registro si no existe, o lo actualiza si ya existe
        const upsertData = settingsToDb(mergedSettings);
        upsertData.id = SETTINGS_ID;
        upsertData.app_name = APP_NAME;
        
        console.log('💾 Upserting settings with app_name =', APP_NAME);
        console.log('💾 candidate_sources:', upsertData.candidate_sources);
        
        // Usar upsert con onConflict en (id, app_name)
        const { data: upsertedData, error: upsertError } = await supabase
            .from('app_settings')
            .upsert(upsertData, {
                onConflict: 'id,app_name',
                ignoreDuplicates: false
            })
            .select()
            .single();
        
        if (upsertError) {
            console.error('Error upserting settings:', upsertError);
            throw upsertError;
        }
        
        const result = dbToSettings(upsertedData);
        console.log('✅ Settings upserted - candidateSources:', result.candidateSources);
        console.log('✅ Settings upserted - Length:', Array.isArray(result.candidateSources) ? result.candidateSources.length : 'N/A');
        return result;
    },
};

