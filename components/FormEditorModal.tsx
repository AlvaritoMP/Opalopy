import React, { useState } from 'react';
import { useAppState } from '../App';
import { FormIntegration, Process, FieldMapping } from '../types';
import { X, Copy, ChevronDown, ChevronUp, Settings } from 'lucide-react';

interface FormIntegrationModalProps {
    integration: FormIntegration | null; // null = crear nueva, objeto = editar existente
    onClose: () => void;
}

export const FormEditorModal: React.FC<FormIntegrationModalProps> = ({ integration, onClose }) => {
    const { state, actions, getLabel } = useAppState();
    const isEditing = integration !== null;
    
    const [platform, setPlatform] = useState<'Tally' | 'Google Forms' | 'Microsoft Forms'>(
        integration?.platform as any || 'Tally'
    );
    const [formName, setFormName] = useState(integration?.formName || '');
    const [formIdOrUrl, setFormIdOrUrl] = useState(integration?.formIdOrUrl || '');
    const [processId, setProcessId] = useState(integration?.processId || state.processes[0]?.id || '');
    const [showWebhook, setShowWebhook] = useState(false);
    const [webhookUrl, setWebhookUrl] = useState(integration?.webhookUrl || '');
    const [isSaving, setIsSaving] = useState(false);
    const [showFieldMapping, setShowFieldMapping] = useState(
        isEditing || Object.keys(integration?.fieldMapping || {}).length > 0
    );
    const [fieldMapping, setFieldMapping] = useState<FieldMapping>(integration?.fieldMapping || {});
    
    // Campos disponibles en el candidato
    const candidateFields = [
        { key: 'name', label: 'Nombre', placeholder: 'nombre, name, nombre_completo' },
        { key: 'email', label: 'Email', placeholder: 'email, correo, e-mail' },
        { key: 'phone', label: 'Teléfono', placeholder: 'phone, telefono, teléfono' },
        { key: 'phone2', label: 'Teléfono 2', placeholder: 'phone2, telefono2, teléfono_secundario' },
        { key: 'description', label: 'Descripción', placeholder: 'description, descripcion, notas' },
        { key: 'source', label: 'Fuente', placeholder: 'source, fuente, origen' },
        { key: 'salaryExpectation', label: 'Expectativa salarial', placeholder: 'salaryExpectation, expectativa_salarial' },
        { key: 'dni', label: 'DNI', placeholder: 'dni, documento, documento_identidad' },
        { key: 'linkedinUrl', label: 'LinkedIn', placeholder: 'linkedinUrl, linkedin, perfil_linkedin' },
        { key: 'address', label: 'Dirección', placeholder: 'address, direccion, dirección' },
        { key: 'province', label: 'Provincia', placeholder: 'province, provincia' },
        { key: 'district', label: 'Distrito', placeholder: 'district, distrito' },
        { key: 'age', label: 'Edad', placeholder: 'age, edad' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!processId) {
            actions.showToast('Selecciona un proceso de contratación para vincular este formulario.', 'error', 3000);
            return;
        }
        if (!formName.trim()) {
            actions.showToast('Ingresa un nombre para el formulario.', 'error', 3000);
            return;
        }
        if (!formIdOrUrl.trim()) {
            actions.showToast('Ingresa la URL del formulario.', 'error', 3000);
            return;
        }
        
        setIsSaving(true);
        try {
            if (isEditing && integration) {
                // Actualizar integración existente
                await actions.updateFormIntegration(integration.id, {
                    platform,
                    formName: formName.trim(),
                    formIdOrUrl: formIdOrUrl.trim(),
                    processId,
                    fieldMapping,
                });
                onClose();
            } else {
                // Crear nueva integración
                const newIntegration = await actions.addFormIntegration({
                    platform,
                    formName: formName.trim(),
                    formIdOrUrl: formIdOrUrl.trim(),
                    processId,
                    fieldMapping: Object.keys(fieldMapping).length > 0 ? fieldMapping : undefined,
                });
                setWebhookUrl(newIntegration.webhookUrl);
                setShowWebhook(true);
            }
        } catch (error) {
            console.error(`Error ${isEditing ? 'updating' : 'creating'} integration:`, error);
            // El error ya se muestra en el toast desde las acciones
        } finally {
            setIsSaving(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(webhookUrl);
        actions.showToast('URL del webhook copiada al portapapeles', 'success', 2000);
    };

    if (showWebhook && !isEditing) {
         return (
             <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-8 text-center">
                    <h2 className="text-2xl font-bold text-gray-800">¡Integración creada!</h2>
                    <p className="mt-2 text-gray-600">
                        Para completar la configuración, copia esta URL de webhook y configúrala en {platform}.
                    </p>
                    {platform === 'Tally' && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
                            <p className="text-sm font-medium text-blue-900 mb-2">Instrucciones para Tally:</p>
                            <ol className="text-xs text-blue-800 list-decimal list-inside space-y-1">
                                <li>Ve a tu formulario en Tally</li>
                                <li>Haz clic en "Settings" → "Integrations"</li>
                                <li>Selecciona "Webhook"</li>
                                <li>Pega la URL del webhook en el campo correspondiente</li>
                                <li>Guarda los cambios</li>
                            </ol>
                        </div>
                    )}
                    <div className="mt-4 flex items-center bg-gray-100 border rounded-md p-2">
                        <input type="text" readOnly value={webhookUrl} className="flex-1 bg-transparent text-sm text-gray-700 outline-none" />
                        <button onClick={copyToClipboard} className="p-2 rounded-md hover:bg-gray-200">
                            <Copy className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                     <button onClick={onClose} className="mt-6 w-full px-4 py-2 bg-primary-600 text-white rounded-md">Listo</button>
                </div>
             </div>
         );
    }
    
    return (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="p-6 border-b flex justify-between items-center flex-shrink-0">
                        <h2 className="text-2xl font-bold text-gray-800">
                            {isEditing 
                                ? 'Editar integración de formulario' 
                                : getLabel('modal_new_form_integration', 'Nueva integración de formulario')
                            }
                        </h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                            <X className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        <div>
                            <label htmlFor="platform" className="block text-sm font-medium text-gray-700">Plataforma</label>
                            <select 
                                id="platform" 
                                value={platform} 
                                onChange={e => setPlatform(e.target.value as any)} 
                                disabled={isSaving || isEditing}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                                <option>Tally</option>
                                <option>Google Forms</option>
                                <option>Microsoft Forms</option>
                            </select>
                            {platform === 'Tally' && !isEditing && (
                                <p className="mt-1 text-xs text-gray-500">
                                    Configura el webhook en Tally después de crear la integración.
                                </p>
                            )}
                            {isEditing && (
                                <p className="mt-1 text-xs text-gray-500">
                                    La plataforma no se puede cambiar al editar.
                                </p>
                            )}
                        </div>
                        <div>
                            <label htmlFor="formName" className="block text-sm font-medium text-gray-700">Nombre del formulario</label>
                            <input 
                                type="text" 
                                id="formName" 
                                value={formName} 
                                onChange={e => setFormName(e.target.value)} 
                                required 
                                disabled={isSaving}
                                placeholder="Ej: Postulación Desarrollador Senior" 
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed" 
                            />
                        </div>
                        <div>
                            <label htmlFor="formIdOrUrl" className="block text-sm font-medium text-gray-700">URL del formulario</label>
                            <input 
                                type="text" 
                                id="formIdOrUrl" 
                                value={formIdOrUrl} 
                                onChange={e => setFormIdOrUrl(e.target.value)} 
                                required 
                                disabled={isSaving}
                                placeholder="https://tally.so/r/..." 
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed" 
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Pega la URL pública de tu formulario en {platform}
                            </p>
                        </div>
                         <div>
                            <label htmlFor="processId" className="block text-sm font-medium text-gray-700">Vincular a proceso</label>
                            <select 
                                id="processId" 
                                value={processId} 
                                onChange={e => setProcessId(e.target.value)} 
                                required 
                                disabled={isSaving}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                                {state.processes.length === 0 ? (
                                    <option value="">No hay procesos disponibles</option>
                                ) : (
                                    state.processes.map(p => <option key={p.id} value={p.id}>{p.title}</option>)
                                )}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
                                Los candidatos que completen este formulario se agregarán automáticamente a este proceso
                            </p>
                        </div>
                        
                        {/* Mapeo de campos personalizado */}
                        <div className="border-t pt-4 mt-4">
                            <button
                                type="button"
                                onClick={() => setShowFieldMapping(!showFieldMapping)}
                                className="flex items-center justify-between w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Settings className="w-5 h-5 text-primary-600" />
                                    <div className="text-left">
                                        <span className="text-sm font-semibold text-gray-900 block">
                                            Mapeo de campos personalizado
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {showFieldMapping ? 'Ocultar configuración' : 'Configurar cómo se mapean los campos de Tally (Opcional)'}
                                        </span>
                                    </div>
                                </div>
                                {showFieldMapping ? (
                                    <ChevronUp className="w-5 h-5 text-gray-500" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-gray-500" />
                                )}
                            </button>
                            {showFieldMapping && (
                                <div className="mt-4 space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="mb-4">
                                        <p className="text-sm font-medium text-blue-900 mb-2">
                                            ¿Cómo funciona el mapeo?
                                        </p>
                                        <p className="text-xs text-blue-800 mb-2">
                                            Si los nombres de tus campos en Tally son diferentes a los estándar, 
                                            puedes mapearlos aquí. Por ejemplo, si en Tally tu campo se llama 
                                            <strong>"Nombre Completo del Candidato"</strong> en lugar de <strong>"name"</strong>, 
                                            ingresa ese nombre exacto en el campo "Nombre" de abajo.
                                        </p>
                                        <p className="text-xs text-blue-800">
                                            <strong>Deja en blanco</strong> para usar el mapeo automático (el sistema intentará 
                                            encontrar el campo usando nombres comunes).
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-2 bg-white rounded border border-blue-100">
                                        {candidateFields.map(field => (
                                            <div key={field.key} className="space-y-1">
                                                <label className="block text-xs font-semibold text-gray-700">
                                                    {field.label} <span className="text-gray-400 font-normal">→</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={fieldMapping[field.key] || ''}
                                                    onChange={e => {
                                                        const newMapping = { ...fieldMapping };
                                                        if (e.target.value.trim()) {
                                                            newMapping[field.key] = e.target.value.trim();
                                                        } else {
                                                            delete newMapping[field.key];
                                                        }
                                                        setFieldMapping(newMapping);
                                                    }}
                                                    placeholder={field.placeholder}
                                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                                <p className="text-xs text-gray-500">
                                                    Nombre exacto del campo en Tally
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                    {Object.keys(fieldMapping).length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-blue-200">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-blue-800">
                                                    <strong>{Object.keys(fieldMapping).length}</strong> campo(s) mapeado(s) personalmente
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setFieldMapping({})}
                                                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                                                >
                                                    Limpiar todo
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                     <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end space-x-3 flex-shrink-0 border-t">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            disabled={isSaving}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSaving || !formName.trim() || !formIdOrUrl.trim() || !processId}
                            className="px-4 py-2 bg-primary-600 text-white rounded-md disabled:bg-primary-300 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    {isEditing ? 'Guardando...' : 'Creando...'}
                                </>
                            ) : (
                                isEditing ? 'Guardar cambios' : 'Crear integración'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};