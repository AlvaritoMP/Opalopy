import React, { useState, useEffect, useRef } from 'react';
import { useAppState } from '../App';
import { AppSettings, Client, InterviewLocation } from '../types';
import { Save, Database, HardDrive, Globe, Brush, Type, Building2, Plus, Trash2, Edit2, MapPin } from 'lucide-react';
import { GoogleDriveSettings } from './GoogleDriveSettings';
import { clientsApi } from '../lib/api';

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
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);
    const [showClientModal, setShowClientModal] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [clientRazonSocial, setClientRazonSocial] = useState('');
    const [clientRuc, setClientRuc] = useState('');
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [editingInterviewLocation, setEditingInterviewLocation] = useState<InterviewLocation | null>(null);
    const [interviewLocationName, setInterviewLocationName] = useState('');
    const [interviewLocationAddress, setInterviewLocationAddress] = useState('');
    const [showInterviewLocationForm, setShowInterviewLocationForm] = useState(false);

    useEffect(() => {
        setSettings(state.settings);
    }, [state.settings]);

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        setIsLoadingClients(true);
        try {
            const allClients = await clientsApi.getAll();
            setClients(allClients);
        } catch (error: any) {
            console.error('Error cargando clientes:', error);
            alert('Error al cargar clientes: ' + error.message);
        } finally {
            setIsLoadingClients(false);
        }
    };

    const handleOpenClientModal = (client?: Client) => {
        if (client) {
            setEditingClient(client);
            setClientRazonSocial(client.razonSocial);
            setClientRuc(client.ruc);
        } else {
            setEditingClient(null);
            setClientRazonSocial('');
            setClientRuc('');
        }
        setShowClientModal(true);
    };

    const handleCloseClientModal = () => {
        setShowClientModal(false);
        setEditingClient(null);
        setClientRazonSocial('');
        setClientRuc('');
    };

    const handleSaveClient = async () => {
        if (!clientRazonSocial.trim() || !clientRuc.trim()) {
            alert('Por favor completa todos los campos');
            return;
        }

        try {
            if (editingClient) {
                await clientsApi.update(editingClient.id, {
                    razonSocial: clientRazonSocial.trim(),
                    ruc: clientRuc.trim(),
                });
            } else {
                await clientsApi.create({
                    razonSocial: clientRazonSocial.trim(),
                    ruc: clientRuc.trim(),
                });
            }
            await loadClients();
            handleCloseClientModal();
        } catch (error: any) {
            console.error('Error guardando cliente:', error);
            alert('Error al guardar cliente: ' + error.message);
        }
    };

    const handleDeleteClient = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este cliente?')) {
            return;
        }

        try {
            await clientsApi.delete(id);
            await loadClients();
        } catch (error: any) {
            console.error('Error eliminando cliente:', error);
            alert('Error al eliminar cliente: ' + error.message);
        }
    };

    const resetInterviewLocationForm = () => {
        setEditingInterviewLocation(null);
        setInterviewLocationName('');
        setInterviewLocationAddress('');
        setShowInterviewLocationForm(false);
    };

    const handleOpenInterviewLocationForm = (location?: InterviewLocation) => {
        if (location) {
            setEditingInterviewLocation(location);
            setInterviewLocationName(location.name);
            setInterviewLocationAddress(location.address);
        } else {
            setEditingInterviewLocation(null);
            setInterviewLocationName('');
            setInterviewLocationAddress('');
        }
        setShowInterviewLocationForm(true);
    };

    const handleSaveInterviewLocation = () => {
        if (!settings) return;
        if (!interviewLocationName.trim() || !interviewLocationAddress.trim()) {
            alert('Complete el nombre y la dirección de la sede');
            return;
        }

        const locations = [...(settings.interviewLocations || [])];
        if (editingInterviewLocation) {
            const index = locations.findIndex(l => l.id === editingInterviewLocation.id);
            if (index >= 0) {
                locations[index] = {
                    ...editingInterviewLocation,
                    name: interviewLocationName.trim(),
                    address: interviewLocationAddress.trim(),
                };
            }
        } else {
            locations.push({
                id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: interviewLocationName.trim(),
                address: interviewLocationAddress.trim(),
            });
        }

        setSettings({ ...settings, interviewLocations: locations });
        resetInterviewLocationForm();
    };

    const handleDeleteInterviewLocation = (id: string) => {
        if (!settings) return;
        if (!confirm('¿Eliminar esta sede de entrevista?')) return;
        setSettings({
            ...settings,
            interviewLocations: (settings.interviewLocations || []).filter(l => l.id !== id),
        });
    };

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
                        <div>
                            <label className="block text-sm font-medium text-gray-700">POWERED BY Logo</label>
                            <p className="text-xs text-gray-500 mb-2">Logo que se mostrará en el footer del sidebar con el texto "POWERED BY"</p>
                            <div className="mt-1 flex items-center space-x-4">
                                {settings.poweredByLogoUrl && <img src={settings.poweredByLogoUrl} alt="Powered By Logo preview" className="h-12 object-contain rounded-md bg-gray-100 p-1" />}
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.accept = 'image/*';
                                        input.onchange = async (e) => {
                                            const file = (e.target as HTMLInputElement).files?.[0];
                                            if (file && file.type.startsWith('image/')) {
                                                const dataUrl = await fileToBase64(file);
                                                if (!settings) return;
                                                setSettings({ ...settings, poweredByLogoUrl: dataUrl });
                                            }
                                        };
                                        input.click();
                                    }} 
                                    className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    {settings.poweredByLogoUrl ? 'Change POWERED BY Logo' : 'Upload POWERED BY Logo'}
                                </button>
                                {settings.poweredByLogoUrl && (
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            if (!settings) return;
                                            setSettings({ ...settings, poweredByLogoUrl: undefined });
                                        }}
                                        className="px-3 py-2 bg-red-50 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 hover:bg-red-100"
                                    >
                                        Remove
                                    </button>
                                )}
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
                        <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-2">
                            <h3 className="text-sm font-semibold text-gray-800 mb-2">Informe psicolaboral (PDF)</h3>
                            <p className="text-xs text-gray-500 mb-3">
                                Personalice la portada visual y el mensaje de apertura. Si no sube imagen, se usa la foto del proceso masivo o una imagen profesional predeterminada.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Imagen de portada (opcional)</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="mt-1 block w-full text-sm"
                                        onChange={async e => {
                                            const f = e.target.files?.[0];
                                            if (!f || !f.type.startsWith('image/')) return;
                                            const reader = new FileReader();
                                            reader.onload = () => {
                                                const dataUrl = reader.result as string;
                                                setSettings({
                                                    ...settings,
                                                    reportTheme: {
                                                        ...(settings.reportTheme || {}),
                                                        psycholaboralHeroImageUrl: dataUrl,
                                                    },
                                                });
                                            };
                                            reader.readAsDataURL(f);
                                            e.target.value = '';
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="mt-2 text-xs text-red-600 hover:underline"
                                        onClick={() =>
                                            setSettings({
                                                ...settings,
                                                reportTheme: {
                                                    ...(settings.reportTheme || {}),
                                                    psycholaboralHeroImageUrl: undefined,
                                                },
                                            })
                                        }
                                    >
                                        Quitar imagen de portada
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Mensaje de apertura (opcional)</label>
                                    <textarea
                                        rows={4}
                                        value={settings.reportTheme?.psycholaboralIntroText || ''}
                                        onChange={e =>
                                            setSettings({
                                                ...settings,
                                                reportTheme: {
                                                    ...(settings.reportTheme || {}),
                                                    psycholaboralIntroText: e.target.value || undefined,
                                                },
                                            })
                                        }
                                        className="mt-1 block w-full input text-sm"
                                        placeholder="Texto breve que invita a leer el informe completo..."
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Mensaje de cierre (opcional)</label>
                                    <textarea
                                        rows={2}
                                        value={settings.reportTheme?.psycholaboralClosingText || ''}
                                        onChange={e =>
                                            setSettings({
                                                ...settings,
                                                reportTheme: {
                                                    ...(settings.reportTheme || {}),
                                                    psycholaboralClosingText: e.target.value || undefined,
                                                },
                                            })
                                        }
                                        className="mt-1 block w-full input text-sm"
                                        placeholder="Frase breve antes del pie legal..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Candidate Sources Settings */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-xl font-semibold mb-1 flex items-center"><Type className="mr-2"/> Fuentes de Candidatos</h2>
                    <p className="text-sm text-gray-500 mb-6">Configura las opciones disponibles para el campo "Fuente" cuando agregas o editas candidatos.</p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Opciones de fuentes (una por línea)</label>
                            <textarea
                                rows={6}
                                value={settings.candidateSources?.join('\n') || 'LinkedIn\nReferencia\nSitio web\nOtro'}
                                onChange={e => {
                                    const sources = e.target.value.split('\n').filter(s => s.trim() !== '');
                                    setSettings({ ...settings, candidateSources: sources.length > 0 ? sources : ['Otro'] });
                                }}
                                className="mt-1 block w-full input font-mono"
                                placeholder="LinkedIn&#10;Referencia&#10;Sitio web&#10;Otro"
                            />
                            <p className="mt-1 text-xs text-gray-500">Escribe una opción por línea. Puedes agregar, editar o eliminar opciones. Para eliminar una opción, simplemente bórrala de la lista.</p>
                        </div>
                    </div>
                </div>

                {/* Clients Management */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-semibold mb-1 flex items-center"><Building2 className="mr-2"/> Clientes</h2>
                            <p className="text-sm text-gray-500">Gestiona los clientes que pueden ser asignados a los procesos.</p>
                        </div>
                        <button
                            onClick={() => handleOpenClientModal()}
                            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Nuevo Cliente
                        </button>
                    </div>
                    {isLoadingClients ? (
                        <div className="text-center py-8 text-gray-500">Cargando clientes...</div>
                    ) : clients.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Building2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p>No hay clientes registrados</p>
                            <p className="text-sm">Haz clic en "Nuevo Cliente" para agregar uno</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {clients.map(client => (
                                <div key={client.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50">
                                    <div>
                                        <div className="font-medium text-gray-900">{client.razonSocial}</div>
                                        <div className="text-sm text-gray-500">RUC: {client.ruc}</div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => handleOpenClientModal(client)}
                                            className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-md"
                                            title="Editar"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClient(client.id)}
                                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sedes de entrevista (rutas en transporte público) */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-semibold mb-1 flex items-center"><MapPin className="mr-2"/> Sedes de entrevista</h2>
                            <p className="text-sm text-gray-500">
                                Puntos de destino para generar rutas en transporte público desde la ficha de candidatos en procesos normales.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleOpenInterviewLocationForm()}
                            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Nueva sede
                        </button>
                    </div>

                    {showInterviewLocationForm && (
                        <div className="mb-4 p-4 border border-primary-100 bg-primary-50/40 rounded-lg space-y-3">
                            <h3 className="text-sm font-semibold text-gray-800">
                                {editingInterviewLocation ? 'Editar sede' : 'Nueva sede'}
                            </h3>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={interviewLocationName}
                                    onChange={(e) => setInterviewLocationName(e.target.value)}
                                    placeholder="Ej: Sede Miraflores"
                                    className="w-full input"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                                <input
                                    type="text"
                                    value={interviewLocationAddress}
                                    onChange={(e) => setInterviewLocationAddress(e.target.value)}
                                    placeholder="Ej: Av. Javier Prado 4200, San Isidro, Lima"
                                    className="w-full input"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleSaveInterviewLocation}
                                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                                >
                                    {editingInterviewLocation ? 'Guardar' : 'Agregar'}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetInterviewLocationForm}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {(settings.interviewLocations || []).length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <MapPin className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p>No hay sedes configuradas</p>
                            <p className="text-sm">Agregue los puntos donde se realizan entrevistas</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {(settings.interviewLocations || []).map(location => (
                                <div key={location.id} className="flex items-start justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50">
                                    <div>
                                        <div className="font-medium text-gray-900">{location.name}</div>
                                        <div className="text-sm text-gray-500">{location.address}</div>
                                    </div>
                                    <div className="flex items-center space-x-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenInterviewLocationForm(location)}
                                            className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-md"
                                            title="Editar"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteInterviewLocation(location.id)}
                                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Provinces and Districts Settings */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-xl font-semibold mb-1 flex items-center"><Type className="mr-2"/> Provincias y Distritos</h2>
                    <p className="text-sm text-gray-500 mb-6">Configura las opciones disponibles para los campos "Provincia" y "Distrito" cuando agregas o editas candidatos. Los distritos están organizados por provincia.</p>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Provincias (una por línea)</label>
                            <textarea
                                rows={6}
                                value={settings.provinces?.join('\n') || 'Lima\nArequipa\nCusco'}
                                onChange={e => {
                                    const provinces = e.target.value.split('\n').filter(s => s.trim() !== '');
                                    // Limpiar distritos de provincias eliminadas
                                    const currentDistricts = settings.districts || {};
                                    const newDistricts: { [key: string]: string[] } = {};
                                    provinces.forEach(prov => {
                                        if (currentDistricts[prov]) {
                                            newDistricts[prov] = currentDistricts[prov];
                                        }
                                    });
                                    setSettings({ 
                                        ...settings, 
                                        provinces: provinces.length > 0 ? provinces : ['Lima'],
                                        districts: newDistricts
                                    });
                                }}
                                className="mt-1 block w-full input font-mono"
                                placeholder="Lima&#10;Arequipa&#10;Cusco"
                            />
                            <p className="mt-1 text-xs text-gray-500">Escribe una provincia por línea. Los distritos de provincias eliminadas también se eliminarán.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Distritos por Provincia</label>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {(settings.provinces && settings.provinces.length > 0 ? settings.provinces : ['Lima']).map(province => (
                                    <div key={province} className="p-3 border border-gray-200 rounded-md">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{province}</label>
                                        <textarea
                                            rows={3}
                                            value={(settings.districts?.[province] || []).join('\n')}
                                            onChange={e => {
                                                const districts = e.target.value.split('\n').filter(s => s.trim() !== '');
                                                setSettings({ 
                                                    ...settings, 
                                                    districts: { 
                                                        ...(settings.districts || {}), 
                                                        [province]: districts.length > 0 ? districts : []
                                                    }
                                                });
                                            }}
                                            className="mt-1 block w-full input font-mono text-sm"
                                            placeholder={`Distritos de ${province}...`}
                                        />
                                        <p className="mt-1 text-xs text-gray-500">Escribe un distrito por línea para {province}.</p>
                                    </div>
                                ))}
                            </div>
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

            {/* Modal para crear/editar cliente */}
            {showClientModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                        <div className="p-6">
                            <h3 className="text-xl font-semibold mb-4">
                                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Razón Social *
                                    </label>
                                    <input
                                        type="text"
                                        value={clientRazonSocial}
                                        onChange={e => setClientRazonSocial(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                        placeholder="Ej: Empresa S.A.C."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        RUC *
                                    </label>
                                    <input
                                        type="text"
                                        value={clientRuc}
                                        onChange={e => setClientRuc(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                        placeholder="Ej: 20123456789"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    onClick={handleCloseClientModal}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveClient}
                                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                                >
                                    {editingClient ? 'Actualizar' : 'Crear'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`.input { padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }`}</style>
        </div>
    );
};