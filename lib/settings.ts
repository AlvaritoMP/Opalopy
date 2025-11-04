import { AppSettings } from '../types';

const SETTINGS_KEY = 'ats_pro_settings';

export const getSettings = (): AppSettings | null => {
    try {
        const rawSettings = localStorage.getItem(SETTINGS_KEY);
        if (rawSettings) {
            return JSON.parse(rawSettings) as AppSettings;
        }
        return null;
    } catch (error) {
        console.error("Failed to parse settings from localStorage", error);
        return null;
    }
};

export const saveSettings = (settings: AppSettings) => {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
        console.error("Failed to save settings to localStorage", error);
    }
};