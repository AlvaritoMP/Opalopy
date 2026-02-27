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
    async get(): Promise<AppSettings> {
        const { data, error } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', SETTINGS_ID)
            .eq('app_name', APP_NAME)
            .single();
        
        if (error) {
            // Si no existe, crear con valores por defecto
            if (error.code === 'PGRST116') {
                return await this.create({
                    database: { apiUrl: '', apiToken: '' },
                    fileStorage: { provider: 'None', connected: false },
                    currencySymbol: '$',
                    appName: 'ATS Pro',
                    logoUrl: '',
                    customLabels: {},
                });
            }
            throw error;
        }
        const settings = dbToSettings(data);
        // Log detallado para debuggear el problema de candidateSources
        console.log('📋 Settings loaded - candidateSources:', settings.candidateSources);
        console.log('📋 Raw candidate_sources from DB:', data.candidate_sources);
        console.log('📋 Type:', typeof settings.candidateSources, 'IsArray:', Array.isArray(settings.candidateSources));
        if (Array.isArray(settings.candidateSources)) {
            console.log('📋 Length:', settings.candidateSources.length, 'Items:', settings.candidateSources);
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
            .select()
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
        const current = await this.get();
        console.log('settingsApi.update - Current candidateSources:', current.candidateSources);
        const mergedSettings = { ...current, ...settings };
        console.log('settingsApi.update - Merged candidateSources:', mergedSettings.candidateSources);
        const mergedDbData = settingsToDb(mergedSettings);
        delete mergedDbData.app_name; // No permitir cambiar app_name
        console.log('settingsApi.update - mergedDbData candidate_sources:', mergedDbData.candidate_sources);
        console.log('settingsApi.update - mergedDbData:', JSON.stringify(mergedDbData, null, 2));
        
        // Separar campos opcionales que pueden no existir en el esquema
        const { candidate_sources, provinces, districts, powered_by_logo_url, ...standardFields } = mergedDbData;
        
        // Primero actualizar campos estándar
        const { error: standardError } = await supabase
            .from('app_settings')
            .update(standardFields)
            .eq('id', SETTINGS_ID)
            .eq('app_name', APP_NAME);
        
        if (standardError) {
            console.error('Error updating standard settings fields:', standardError);
            throw standardError;
        }
        
        // Actualizar campos opcionales por separado (si existen)
        const optionalFields: any = {};
        if (candidate_sources !== undefined) {
            optionalFields.candidate_sources = candidate_sources;
            console.log('💾 Saving candidate_sources to DB:', candidate_sources, 'Type:', typeof candidate_sources, 'IsArray:', Array.isArray(candidate_sources), 'Length:', Array.isArray(candidate_sources) ? candidate_sources.length : 'N/A');
        }
        if (provinces !== undefined) optionalFields.provinces = provinces;
        if (districts !== undefined) optionalFields.districts = districts;
        if (powered_by_logo_url !== undefined) optionalFields.powered_by_logo_url = powered_by_logo_url;
        
        if (Object.keys(optionalFields).length > 0) {
            console.log('💾 Updating optional fields:', JSON.stringify(optionalFields, null, 2));
            const { error: optionalError, data: updateData } = await supabase
                .from('app_settings')
                .update(optionalFields)
                .eq('id', SETTINGS_ID)
                .eq('app_name', APP_NAME)
                .select('candidate_sources');
            
            if (optionalError) {
                const errorMsg = optionalError.message || '';
                if (errorMsg.includes('schema cache') || errorMsg.includes("Could not find") || errorMsg.includes("column") || errorMsg.includes("powered_by_logo_url")) {
                    console.warn('⚠️ Algunas columnas opcionales no existen en la base de datos. Por favor, ejecuta la migración SQL: MIGRATION_ADD_POWERED_BY_LOGO.sql. Error:', optionalError.message);
                    // No lanzar error, permitir que continúe
                } else {
                    console.error('Error updating optional settings fields:', optionalError);
                    throw optionalError;
                }
            } else {
                console.log('✅ Optional fields updated. Response:', updateData);
            }
        }
        
        // Obtener configuración actualizada
        const { data, error: fetchError } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', SETTINGS_ID)
            .eq('app_name', APP_NAME)
            .single();
        
        if (fetchError) {
            console.error('Error fetching updated settings:', fetchError);
            throw fetchError;
        }
        
        const result = dbToSettings(data);
        console.log('✅ Settings updated - candidateSources in result:', result.candidateSources);
        console.log('✅ Settings updated - candidateSources length:', Array.isArray(result.candidateSources) ? result.candidateSources.length : 'N/A');
        console.log('✅ Settings updated - raw candidate_sources from DB after update:', data.candidate_sources);
        return result;
    },
};

