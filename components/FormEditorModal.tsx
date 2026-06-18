import React, { useState, useMemo, useEffect } from 'react';
import { useAppState } from '../App';
import { FormIntegration, Process, FieldMapping } from '../types';
import {
    filterTallyFieldMapping,
    getTallyIntegrationMappingFields,
    normalizeTallyFieldMapping,
} from '../lib/bulkTableColumns';
import { X, Copy, ChevronDown, ChevronUp, Settings } from 'lucide-react';

interface FormIntegrationModalProps {
    integration: FormIntegration | null; // null = crear nueva, objeto = editar existente
    onClose: () => void;
    availableProcesses?: Process[]; // opcional para mantener retrocompatibilidad si se usa en otro lado
}

export const FormEditorModal: React.FC<FormIntegrationModalProps> = ({ integration, onClose, availableProcesses }) => {
    const { state, actions, getLabel } = useAppState();
    const isEditing = integration !== null;
    
    // Usar los procesos pasados por prop o los del estado por defecto
    const processesList = availableProcesses || state.processes;
    
    const [platform, setPlatform] = useState<'Tally' | 'Google Forms' | 'Microsoft Forms'>(
        integration?.platform as any || 'Tally'
    );
    const [formName, setFormName] = useState(integration?.formName || '');
    const [formIdOrUrl, setFormIdOrUrl] = useState(integration?.formIdOrUrl || '');
    const [processId, setProcessId] = useState(integration?.processId || processesList[0]?.id || '');
    const [showWebhook, setShowWebhook] = useState(false);
    const [webhookUrl, setWebhookUrl] = useState(integration?.webhookUrl || '');
    const [isSaving, setIsSaving] = useState(false);
    const [showFieldMapping, setShowFieldMapping] = useState(false);
    const [fieldMapping, setFieldMapping] = useState<FieldMapping>(() =>
        normalizeTallyFieldMapping(integration?.fieldMapping || {})
    );

    // Proceso seleccionado
    const selectedProcessDetails = useMemo(() => {
        return processesList.find(p => p.id === processId);
    }, [processId, processesList]);

    // Campos del proceso (simple o masivo según bulkConfig del proceso vinculado)
    const candidateFields = useMemo(
        () => getTallyIntegrationMappingFields(selectedProcessDetails),
        [selectedProcessDetails]
    );

    const allowedFieldKeys = useMemo(
        () => new Set(candidateFields.map(f => f.key)),
        [candidateFields]
    );

    // Al cambiar de proceso, quitar mapeos de campos que ya no aplican
    useEffect(() => {
        setFieldMapping(prev => filterTallyFieldMapping(prev, allowedFieldKeys));
    }, [allowedFieldKeys]);

    const buildFieldMappingPayload = (): FieldMapping | undefined => {
        const trimmed: FieldMapping = {};
        for (const [key, val] of Object.entries(fieldMapping)) {
            if (!allowedFieldKeys.has(key)) continue;
            const t = typeof val === 'string' ? val.trim() : '';
            if (t) trimmed[key] = t;
        }
        const normalized = normalizeTallyFieldMapping(trimmed);
        return Object.keys(normalized).length > 0 ? normalized : undefined;
    };

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
                    fieldMapping: buildFieldMappingPayload(),
                });
                onClose();
            } else {
                // Crear nueva integración
                const newIntegration = await actions.addFormIntegration({
                    platform,
                    formName: formName.trim(),
                    formIdOrUrl: formIdOrUrl.trim(),
                    processId,
                    fieldMapping: buildFieldMappingPayload(),
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
    
    const stopSpaceScrollInInputs = (e: React.KeyboardEvent) => {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
        e.stopPropagation();
        if (e.key === ' ') {
            e.nativeEvent.stopImmediatePropagation();
        }
    };

    return (
         <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto"
            onKeyDownCapture={stopSpaceScrollInInputs}
         >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[min(90vh,calc(100vh-2rem))] flex flex-col overflow-hidden my-auto">
                <form
                    onSubmit={handleSubmit}
                    onKeyDownCapture={stopSpaceScrollInInputs}
                    className="flex flex-col min-h-0 flex-1 overflow-hidden"
                >
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
                    <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
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
                                {processesList.length === 0 ? (
                                    <option value="">No hay procesos disponibles</option>
                                ) : (
                                    processesList.map(p => <option key={p.id} value={p.id}>{p.title}{p.isBulkProcess ? ' (Masivo)' : ''}</option>)
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
                                <div className="mt-4 flex flex-col min-h-0 bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
                                    <div className="flex-shrink-0 p-4 pb-2 space-y-2">
                                        <p className="text-sm font-medium text-blue-900">
                                            ¿Cómo funciona el mapeo?
                                        </p>
                                        <p className="text-xs text-blue-800">
                                            Si los nombres de tus campos en Tally son diferentes a los estándar, 
                                            puedes mapearlos aquí. Por ejemplo, si en Tally tu campo se llama 
                                            <strong> &quot;Nombre Completo del Candidato&quot;</strong> en lugar de <strong>&quot;name&quot;</strong>, 
                                            ingresa ese nombre exacto en el campo correspondiente de abajo.
                                        </p>
                                        <p className="text-xs text-blue-800">
                                            <strong>Deja en blanco</strong> para usar el mapeo automático.
                                        </p>
                                        <p className="text-xs text-blue-700 font-medium pt-1">
                                            {candidateFields.length} campos del proceso — desplázate para ver todos
                                        </p>
                                    </div>
                                    <div
                                        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4"
                                        style={{ maxHeight: 'min(50vh, 420px)' }}
                                        onKeyDownCapture={stopSpaceScrollInInputs}
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2 bg-white rounded border border-blue-100">
                                            {candidateFields.map(field => (
                                                <div key={field.key} className="space-y-1">
                                                    <label className="block text-xs font-semibold text-gray-700">
                                                        {field.label} <span className="text-gray-400 font-normal">→</span>
                                                    </label>
                                                <input
                                                    type="text"
                                                    autoComplete="off"
                                                    spellCheck={false}
                                                    value={fieldMapping[field.key] ?? ''}
                                                    onChange={e => {
                                                        const v = e.target.value;
                                                        setFieldMapping(prev => {
                                                            const next = { ...prev };
                                                            if (v) next[field.key] = v;
                                                            else delete next[field.key];
                                                            return next;
                                                        });
                                                    }}
                                                    onKeyDown={stopSpaceScrollInInputs}
                                                    onKeyDownCapture={stopSpaceScrollInInputs}
                                                    placeholder={field.placeholder}
                                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                                <p className="text-xs text-gray-500">
                                                    Label exacto del campo en Tally (respete mayúsculas y espacios)
                                                </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {Object.keys(fieldMapping).length > 0 && (
                                        <div className="flex-shrink-0 px-4 py-3 border-t border-blue-200 bg-blue-50">
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