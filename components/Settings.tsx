import React, { useState, useEffect, useRef } from 'react';
import { useAppState } from '../App';
import { AppSettings } from '../types';
import { Save, Database, HardDrive, Globe, Brush, Type } from 'lucide-react';
import { GoogleDriveSettings } from './GoogleDriveSettings';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};


export const Settings: React.FC = () => {
    const { state, actions } = useAppState();
    const [settings, setSettings] = useState<AppSettings | null>(state.settings);
    const [isSaving, setIsSaving] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setSettings(state.settings);
    }, [state.settings]);

    if (!settings) {
        return null; // Or a loading state
    }

    // Solo superadmin puede ver y configurar Google Drive
    const isSuperAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'superadmin';
    
    const handleDbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings({
            ...settings,
            database: {
                ...settings.database,
                [e.target.name]: e.target.value,
            }
        });
    };

    const handleFileStorageToggle = () => {
        setSettings({
            ...settings,
            fileStorage: {
                ...settings.fileStorage,
                connected: !settings.fileStorage.connected,
            }
        });
    };

    const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!settings) return;
        setSettings({
            ...settings,
            [e.target.name]: e.target.value
        });
    };
    
    const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!settings) return;
        setSettings({
            ...settings,
            customLabels: {
                ...settings.customLabels,
                [e.target.name]: e.target.value,
            }
        });
    };
    
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const dataUrl = await fileToBase64(file);
            if (!settings) return;
            setSettings({ ...settings, logoUrl: dataUrl });
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        setIsSaving(true);
        await actions.saveSettings(settings);
        setIsSaving(false);
        // Maybe show a toast notification here
    };

    return (
        <div className="p-8 h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700 disabled:bg-primary-300"
                >
                    <Save className="w-5 h-5 mr-2" /> {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
            <div className="space-y-8 max-w-4xl">
                 {/* Branding Settings */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-xl font-semibold mb-1 flex items-center"><Brush className="mr-2"/> Branding</h2>
                    <p className="text-sm text-gray-500 mb-6">Customize the look and feel of your application.</p>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="appName" className="block text-sm font-medium text-gray-700">Application Name</label>
                            <input type="text" id="appName" name="appName" value={settings.appName || ''} onChange={handleSettingChange} className="mt-1 block w-full max-w-xs input"/>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Company Logo</label>
                            <div className="mt-1 flex items-center space-x-4">
                                {settings.logoUrl && <img src={settings.logoUrl} alt="Logo preview" className="h-10 object-contain rounded-md bg-gray-100 p-1" />}
                                <button type="button" onClick={() => logoInputRef.current?.click()} className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">{settings.logoUrl ? 'Change Logo' : 'Upload Logo'}</button>
                                <input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Report Theme Settings */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-xl font-semibold mb-1 flex items-center"><Brush className="mr-2"/> Informe (PDF)</h2>
                    <p className="text-sm text-gray-500 mb-6">Personaliza colores y textos del informe del comparador.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Color primario (hex)</label>
                            <input
                                type="text"
                                value={settings.reportTheme?.primaryColor || '#2563eb'}
                                onChange={e => setSettings({ ...settings, reportTheme: { ...(settings.reportTheme || {}), primaryColor: e.target.value } })}
                                className="mt-1 block w-full input"
                                placeholder="#2563eb"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Color acento (hex)</label>
                            <input
                                type="text"
                                value={settings.reportTheme?.accentColor || '#16a34a'}
                                onChange={e => setSettings({ ...settings, reportTheme: { ...(settings.reportTheme || {}), accentColor: e.target.value } })}
                                className="mt-1 block w-full input"
                                placeholder="#16a34a"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Título de portada</label>
                            <input
                                type="text"
                                value={settings.reportTheme?.coverTitle || ''}
                                onChange={e => setSettings({ ...settings, reportTheme: { ...(settings.reportTheme || {}), coverTitle: e.target.value } })}
                                className="mt-1 block w-full input"
                                placeholder="Informe comparativo de candidatos"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Texto de pie de página</label>
                            <input
                                type="text"
                                value={settings.reportTheme?.footerText || ''}
                                onChange={e => setSettings({ ...settings, reportTheme: { ...(settings.reportTheme || {}), footerText: e.target.value } })}
                                className="mt-1 block w-full input"
                                placeholder="Confidencial - Solo para uso interno"
                            />
                        </div>
                    </div>
                </div>

                {/* UI Labels Settings */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-xl font-semibold mb-1 flex items-center"><Type className="mr-2"/> UI Labels</h2>
                    <p className="text-sm text-gray-500 mb-6">Customize the text for main sections and titles.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="sidebar_dashboard" className="block text-sm font-medium text-gray-700">Sidebar: Dashboard</label>
                            <input type="text" id="sidebar_dashboard" name="sidebar_dashboard" value={settings.customLabels?.sidebar_dashboard || ''} onChange={handleLabelChange} placeholder="Dashboard" className="mt-1 block w-full input"/>
                        </div>
                         <div>
                            <label htmlFor="sidebar_processes" className="block text-sm font-medium text-gray-700">Sidebar: Processes</label>
                            <input type="text" id="sidebar_processes" name="sidebar_processes" value={settings.customLabels?.sidebar_processes || ''} onChange={handleLabelChange} placeholder="Processes" className="mt-1 block w-full input"/>
                        </div>
                        <div>
                            <label htmlFor="modal_add_candidate" className="block text-sm font-medium text-gray-700">Modal: Add Candidate</label>
                            <input type="text" id="modal_add_candidate" name="modal_add_candidate" value={settings.customLabels?.modal_add_candidate || ''} onChange={handleLabelChange} placeholder="Add Candidate to..." className="mt-1 block w-full input"/>
                        </div>
                        <div>
                            <label htmlFor="modal_edit_process" className="block text-sm font-medium text-gray-700">Modal: Edit Process</label>
                            <input type="text" id="modal_edit_process" name="modal_edit_process" value={settings.customLabels?.modal_edit_process || ''} onChange={handleLabelChange} placeholder="Edit Process" className="mt-1 block w-full input"/>
                        </div>
                        <div>
                            <label htmlFor="dashboard_recent_candidates" className="block text-sm font-medium text-gray-700">Dashboard: Recent Candidates</label>
                            <input type="text" id="dashboard_recent_candidates" name="dashboard_recent_candidates" value={settings.customLabels?.dashboard_recent_candidates || ''} onChange={handleLabelChange} placeholder="Recent Candidates" className="mt-1 block w-full input"/>
                        </div>
                        <div>
                            <label htmlFor="dashboard_candidate_source" className="block text-sm font-medium text-gray-700">Dashboard: Candidate Source</label>
                            <input type="text" id="dashboard_candidate_source" name="dashboard_candidate_source" value={settings.customLabels?.dashboard_candidate_source || ''} onChange={handleLabelChange} placeholder="Candidate Source" className="mt-1 block w-full input"/>
                        </div>
                        <div>
                            <label htmlFor="dashboard_candidate_locations" className="block text-sm font-medium text-gray-700">Dashboard: Candidate Locations</label>
                            <input type="text" id="dashboard_candidate_locations" name="dashboard_candidate_locations" value={settings.customLabels?.dashboard_candidate_locations || ''} onChange={handleLabelChange} placeholder="Candidate Locations" className="mt-1 block w-full input"/>
                        </div>
                        <div>
                            <label htmlFor="dashboard_age_distribution" className="block text-sm font-medium text-gray-700">Dashboard: Age Distribution</label>
                            <input type="text" id="dashboard_age_distribution" name="dashboard_age_distribution" value={settings.customLabels?.dashboard_age_distribution || ''} onChange={handleLabelChange} placeholder="Age Distribution" className="mt-1 block w-full input"/>
                        </div>
                        <div>
                            <label htmlFor="dashboard_upcoming_interviews" className="block text-sm font-medium text-gray-700">Dashboard: Upcoming Interviews</label>
                            <input type="text" id="dashboard_upcoming_interviews" name="dashboard_upcoming_interviews" value={settings.customLabels?.dashboard_upcoming_interviews || ''} onChange={handleLabelChange} placeholder="Upcoming Interviews" className="mt-1 block w-full input"/>
                        </div>
                    </div>
                </div>


                {/* Localization Settings */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-xl font-semibold mb-1 flex items-center"><Globe className="mr-2"/> Localization</h2>
                    <p className="text-sm text-gray-500 mb-6">Set your preferred currency symbol.</p>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="currencySymbol" className="block text-sm font-medium text-gray-700">Currency Symbol</label>
                            <input 
                                type="text" 
                                id="currencySymbol" 
                                name="currencySymbol" 
                                value={settings.currencySymbol || ''} 
                                onChange={handleSettingChange} 
                                placeholder="$" 
                                className="mt-1 block w-full max-w-xs input" 
                            />
                        </div>
                    </div>
                </div>

                {/* Database Settings */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-xl font-semibold mb-1 flex items-center"><Database className="mr-2"/> Database Connection</h2>
                    <p className="text-sm text-gray-500 mb-6">Configure the connection to your database (e.g., Baserow).</p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Database Type</label>
                            <input type="text" value="Baserow" disabled className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label htmlFor="apiUrl" className="block text-sm font-medium text-gray-700">API URL</label>
                            <input type="text" id="apiUrl" name="apiUrl" value={settings.database.apiUrl} onChange={handleDbChange} placeholder="https://api.baserow.io" className="mt-1 block w-full input" />
                        </div>
                        <div>
                            <label htmlFor="apiToken" className="block text-sm font-medium text-gray-700">API Token</label>
                            <input type="password" id="apiToken" name="apiToken" value={settings.database.apiToken} onChange={handleDbChange} placeholder="••••••••••••••••••••" className="mt-1 block w-full input" />
                        </div>
                    </div>
                </div>
                {/* File Storage Settings - Solo para superadmin */}
                {isSuperAdmin ? (
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="text-xl font-semibold mb-1 flex items-center"><HardDrive className="mr-2"/> Almacenamiento de Archivos</h2>
                        <p className="text-sm text-gray-500 mb-6">Conecta Google Drive para almacenar documentos de candidatos y procesos. Solo el superadministrador puede configurar esta opción.</p>
                        <GoogleDriveSettings
                        config={settings.googleDrive}
                        onConfigChange={async (googleDriveConfig) => {
                            const updatedSettings = {
                                ...settings,
                                googleDrive: googleDriveConfig,
                                fileStorage: {
                                    ...settings.fileStorage,
                                    connected: googleDriveConfig.connected,
                                    provider: googleDriveConfig.connected ? 'google-drive' : settings.fileStorage.provider,
                                },
                            };
                            setSettings(updatedSettings);
                            
                            // Guardar automáticamente cuando se conecta/desconecta Google Drive
                            setIsSaving(true);
                            try {
                                console.log('Guardando configuración de Google Drive:', {
                                    connected: googleDriveConfig.connected,
                                    hasAccessToken: !!googleDriveConfig.accessToken,
                                    userEmail: googleDriveConfig.userEmail,
                                });
                                await actions.saveSettings(updatedSettings);
                                console.log('✓ Configuración de Google Drive guardada exitosamente en Supabase');
                            } catch (error) {
                                console.error('✗ Error guardando configuración de Google Drive:', error);
                                alert('Error al guardar la configuración de Google Drive. Por favor, intenta de nuevo.');
                            } finally {
                                setIsSaving(false);
                            }
                        }}
                    />
                    </div>
                ) : (
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm">
                        <h2 className="text-xl font-semibold mb-1 flex items-center"><HardDrive className="mr-2"/> Almacenamiento de Archivos</h2>
                        <p className="text-sm text-blue-800 mb-4">
                            Google Drive está configurado por el administrador. Los archivos que subas se guardarán automáticamente en Google Drive si el proceso tiene una carpeta configurada.
                        </p>
                        {settings.googleDrive?.connected && (
                            <div className="mt-4 p-3 bg-white rounded-md border border-blue-200">
                                <p className="text-sm text-blue-900">
                                    <strong>Estado:</strong> Conectado a {settings.googleDrive.userEmail || 'Google Drive'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <style>{`.input { padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }`}</style>
        </div>
    );
};