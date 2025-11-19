import { supabase } from '../supabase';
import { AppSettings } from '../../types';

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

// Convertir de DB a tipo de aplicación
function dbToSettings(dbSettings: any): AppSettings {
    return {
        database: dbSettings.database_config || { apiUrl: '', apiToken: '' },
        fileStorage: dbSettings.file_storage_config || { provider: 'None', connected: false },
        googleDrive: dbSettings.google_drive_config || undefined,
        currencySymbol: dbSettings.currency_symbol || '$',
        appName: dbSettings.app_name || 'ATS Pro',
        logoUrl: dbSettings.logo_url || '',
        customLabels: dbSettings.custom_labels || {},
        dashboardLayout: dbSettings.dashboard_layout,
        templates: dbSettings.templates,
        reportTheme: dbSettings.report_theme,
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
    if (settings.customLabels !== undefined) dbSettings.custom_labels = settings.customLabels;
    if (settings.dashboardLayout !== undefined) dbSettings.dashboard_layout = settings.dashboardLayout;
    if (settings.templates !== undefined) dbSettings.templates = settings.templates;
    if (settings.reportTheme !== undefined) dbSettings.report_theme = settings.reportTheme;
    return dbSettings;
}

export const settingsApi = {
    // Obtener configuración
    async get(): Promise<AppSettings> {
        const { data, error } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', SETTINGS_ID)
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
        return dbToSettings(data);
    },

    // Crear configuración (solo si no existe)
    async create(settings: AppSettings): Promise<AppSettings> {
        const dbData = settingsToDb(settings);
        dbData.id = SETTINGS_ID;

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
        const { data, error } = await supabase
            .from('app_settings')
            .update(dbData)
            .eq('id', SETTINGS_ID)
            .select()
            .single();
        
        if (error) throw error;
        return dbToSettings(data);
    },
};

