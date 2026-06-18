import React, { useState, useEffect, useRef } from 'react';
import { useAppState } from '../App';
import { Process, Stage, ProcessStatus, BulkProcessConfig, KillerQuestion, PsycholaboralInventory, Attachment, Client } from '../types';
import { X, Plus, Trash2, GripVertical, Settings, Filter, Brain, MessageCircle, Upload, FileText } from 'lucide-react';
import { processesApi } from '../lib/api/processes';
import { clientsApi } from '../lib/api/clients';
import { isScoreIaColumnVisible, pickBulkTableLayoutConfig } from '../lib/bulkTableColumns';
import { psycholaboralApi } from '../lib/api/psycholaboral';
import { createDefaultPsycholaboralInventory } from '../lib/psycholaboralDefaults';
import { PsycholaboralConfigSection } from './PsycholaboralConfigSection';
import { PsycholaboralInventoryModal } from './PsycholaboralInventoryModal';
import { googleDriveService } from '../lib/googleDrive';
import { StageColorPicker } from './StageColorPicker';
import { suggestStageColor, buildStageColorMaps } from '../lib/stageColors';

const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
    });

interface BulkProcessEditorModalProps {
    process: Process | null;
    onClose: () => void;
    onSave: () => void;
    /** Solo actualiza bulkConfig y etapas; no convierte el proceso en masivo */
    configOnly?: boolean;
}

export const BulkProcessEditorModal: React.FC<BulkProcessEditorModalProps> = ({ process, onClose, onSave, configOnly = false }) => {
    const { state, actions } = useAppState();
    const [title, setTitle] = useState(process?.title || '');
    const [description, setDescription] = useState(process?.description || '');
    const [stages, setStages] = useState<Stage[]>(process?.stages || [{ id: `new-${Date.now()}`, name: 'Postulación Inicial' }]);
    const [status, setStatus] = useState<ProcessStatus>(process?.status || 'en_proceso');
    const [vacancies, setVacancies] = useState<number>(process?.vacancies || 1);
    const [startDate, setStartDate] = useState(process?.startDate || '');
    const [publishedDate, setPublishedDate] = useState(process?.publishedDate || '');
    const [needIdentifiedDate, setNeedIdentifiedDate] = useState(process?.needIdentifiedDate || '');
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'basic' | 'config'>('basic');
    
    // Configuración avanzada
    const [bulkConfig, setBulkConfig] = useState<BulkProcessConfig>(process?.bulkConfig || {
        killerQuestions: [],
        aiPrompt: '',
        scoreThreshold: 70,
        whatsappEnabled: true,
        whatsappMessageTemplate: 'Hola {nombre}, nos interesa tu perfil para el puesto de {puesto}. ¿Tienes disponibilidad para una entrevista?',
        autoFilterEnabled: true,
    });
    
    const [killerQuestions, setKillerQuestions] = useState<KillerQuestion[]>(process?.bulkConfig?.killerQuestions || []);
    const [psychInventory, setPsychInventory] = useState<PsycholaboralInventory>(createDefaultPsycholaboralInventory());
    const [showPsychInventory, setShowPsychInventory] = useState(false);
    const [flyerUrl, setFlyerUrl] = useState(process?.flyerUrl || '');
    const [flyerPosition, setFlyerPosition] = useState(process?.flyerPosition || 'center center');
    const [attachments, setAttachments] = useState<Attachment[]>(process?.attachments || []);
    const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string | undefined>(process?.clientId);
    const [isLoadingClients, setIsLoadingClients] = useState(false);
    const flyerInputRef = useRef<HTMLInputElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);

    const scoreIaColumnVisible = isScoreIaColumnVisible(bulkConfig);

    useEffect(() => {
        psycholaboralApi.getInventory().then(setPsychInventory).catch(() => {});
    }, []);

    useEffect(() => {
        setIsLoadingClients(true);
        clientsApi.getAll()
            .then(setClients)
            .catch(err => console.warn('Error cargando clientes:', err))
            .finally(() => setIsLoadingClients(false));
    }, []);

    useEffect(() => {
        if (!process?.id) {
            setTitle('');
            setDescription('');
            setSelectedClientId(undefined);
            setStages([{ id: `new-${Date.now()}`, name: 'Postulación Inicial' }]);
            setStatus('en_proceso');
            setVacancies(1);
            setStartDate('');
            setPublishedDate('');
            setNeedIdentifiedDate('');
            setBulkConfig({
                killerQuestions: [],
                aiPrompt: '',
                scoreThreshold: 70,
                whatsappEnabled: true,
                whatsappMessageTemplate:
                    'Hola {nombre}, nos interesa tu perfil para el puesto de {puesto}. ¿Tienes disponibilidad para una entrevista?',
                autoFilterEnabled: true,
            });
            setKillerQuestions([]);
            setFlyerUrl('');
            setFlyerPosition('center center');
            setAttachments([]);
            return;
        }

        let cancelled = false;
        processesApi.getById(process.id).then(fresh => {
            if (cancelled || !fresh) return;
            setTitle(fresh.title);
            setDescription(fresh.description);
            setSelectedClientId(fresh.clientId);
            setStatus(fresh.status || 'en_proceso');
            setVacancies(fresh.vacancies || 1);
            setStartDate(fresh.startDate || '');
            setPublishedDate(fresh.publishedDate || '');
            setNeedIdentifiedDate(fresh.needIdentifiedDate || '');
            setBulkConfig(
                fresh.bulkConfig || {
                    killerQuestions: [],
                    aiPrompt: '',
                    scoreThreshold: 70,
                    whatsappEnabled: true,
                    whatsappMessageTemplate:
                        'Hola {nombre}, nos interesa tu perfil para el puesto de {puesto}. ¿Tienes disponibilidad para una entrevista?',
                    autoFilterEnabled: true,
                }
            );
            setKillerQuestions(fresh.bulkConfig?.killerQuestions || []);
            setFlyerUrl(fresh.flyerUrl || '');
            setFlyerPosition(fresh.flyerPosition || 'center center');
            setAttachments(fresh.attachments || []);
            setStages(prev => {
                const loaded = fresh.stages?.length
                    ? fresh.stages
                    : [{ id: `new-${Date.now()}`, name: 'Postulación Inicial' }];
                return loaded.map(fs => {
                    const local = prev.find(
                        s =>
                            s.id === fs.id ||
                            s.name.trim().toLowerCase() === fs.name.trim().toLowerCase()
                    );
                    return local?.color ? { ...fs, color: local.color } : fs;
                });
            });
        }).catch(err => {
            console.warn('No se pudo recargar el proceso masivo desde la BD:', err);
        });

        return () => { cancelled = true; };
    }, [process?.id]);

    useEffect(() => {
        if (!process?.id) return;
        processesApi.getAttachments(process.id).then(setAttachments).catch(() => {});
    }, [process?.id]);

    const handleAddStage = () => {
        setStages([...stages, { id: `new-${Date.now()}`, name: '', color: suggestStageColor(stages.length) }]);
    };

    const handleRemoveStage = (index: number) => {
        if (stages.length > 1) {
            setStages(stages.filter((_, i) => i !== index));
        }
    };

    const handleStageChange = (index: number, name: string) => {
        const newStages = [...stages];
        newStages[index] = { ...newStages[index], name };
        setStages(newStages);
    };

    const handleStageColorChange = (index: number, color: Stage['color']) => {
        const newStages = [...stages];
        newStages[index] = { ...newStages[index], color: color || undefined };
        setStages(newStages);
    };

    const handleFlyerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file?.type.startsWith('image/')) {
            const dataUrl = await fileToBase64(file);
            setFlyerUrl(dataUrl);
            setFlyerPosition('center center');
        }
        if (e.target) e.target.value = '';
    };

    const handleFlyerAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!flyerUrl) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setFlyerPosition(`${Math.max(0, Math.min(100, x))}% ${Math.max(0, Math.min(100, y))}%`);
    };

    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (isUploadingAttachment) {
            if (e.target) e.target.value = '';
            return;
        }

        setIsUploadingAttachment(true);
        const loadingToastId = actions.showToast(`Subiendo ${file.name}...`, 'loading', 0);

        try {
            let attachmentUrl: string;
            const gdc = state.settings?.googleDrive;
            const folderId = process?.googleDriveFolderId;
            if (gdc?.connected && gdc?.accessToken && folderId) {
                try {
                    googleDriveService.initialize(gdc);
                    const uploaded = await googleDriveService.uploadFile(
                        file,
                        folderId,
                        `proceso_masivo_${title || 'sin_titulo'}_${file.name}`
                    );
                    attachmentUrl =
                        uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/preview`;
                } catch {
                    attachmentUrl = await fileToBase64(file);
                }
            } else {
                attachmentUrl = await fileToBase64(file);
            }

            const isExistingProcess =
                !!process?.id && !process.id.startsWith('temp-');

            if (isExistingProcess) {
                const { attachmentsApi } = await import('../lib/api');
                const saved = await attachmentsApi.create(
                    {
                        name: file.name,
                        url: attachmentUrl,
                        type: file.type,
                        size: file.size,
                        processId: process!.id,
                    } as any,
                    state.currentUser?.id
                );
                setAttachments(prev => [
                    ...prev,
                    {
                        id: saved.id,
                        name: saved.name,
                        url: saved.url,
                        type: saved.type,
                        size: saved.size,
                        uploadedAt: saved.uploadedAt,
                    },
                ]);
                actions.showToast(`Documento "${file.name}" guardado`, 'success', 3000);
            } else {
                setAttachments(prev => [
                    ...prev,
                    {
                        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        name: file.name,
                        url: attachmentUrl,
                        type: file.type,
                        size: file.size,
                        uploadedAt: new Date().toISOString(),
                    },
                ]);
                actions.showToast(
                    `Documento agregado — se guardará al crear el proceso`,
                    'success',
                    3500
                );
            }
        } catch (error: any) {
            console.error(error);
            actions.showToast(error.message || 'Error al subir el documento', 'error', 5000);
        } finally {
            actions.hideToast(loadingToastId);
            setIsUploadingAttachment(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleDeleteAttachment = async (id: string) => {
        const isPersisted = !!process?.id && !id.startsWith('temp-');
        if (isPersisted) {
            try {
                const { attachmentsApi } = await import('../lib/api');
                await attachmentsApi.delete(id);
            } catch (error: any) {
                actions.showToast(error.message || 'Error al eliminar documento', 'error', 4000);
                return;
            }
        }
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    const handleSave = async () => {
        if (!title.trim()) {
            actions.showToast('El título es requerido', 'error', 3000);
            return;
        }

        if (stages.some(s => !s.name.trim())) {
            actions.showToast('Todas las etapas deben tener un nombre', 'error', 3000);
            return;
        }

        setIsSaving(true);
        try {
            const stagesPayload = stages.map((s, index) => ({
                id: s.id.startsWith('new-') ? `stage-${Date.now()}-${index}` : s.id,
                name: s.name.trim(),
                color: s.color,
                isCritical: s.isCritical,
                requiredDocuments: s.requiredDocuments,
            }));

            const stageColorMaps = buildStageColorMaps(stagesPayload);

            const mergedBulkConfig: BulkProcessConfig = {
                ...pickBulkTableLayoutConfig(process?.bulkConfig),
                ...bulkConfig,
                ...stageColorMaps,
                killerQuestions: killerQuestions,
                ...(configOnly ? { highDensityTableEnabled: true } : {}),
            };

            if (process?.id && configOnly) {
                await processesApi.update(process.id, {
                    stages: stagesPayload,
                    bulkConfig: mergedBulkConfig,
                });
                actions.showToast('Configuración de tabla actualizada', 'success', 3000);
            } else {
                const processPayload: Omit<Process, 'id'> = {
                    title: title.trim(),
                    description: description.trim(),
                    stages: stagesPayload,
                    status,
                    vacancies,
                    startDate: startDate || undefined,
                    publishedDate: publishedDate || undefined,
                    needIdentifiedDate: needIdentifiedDate || undefined,
                    attachments,
                    flyerUrl: flyerUrl || undefined,
                    flyerPosition: flyerPosition || undefined,
                    clientId: selectedClientId || undefined,
                    isBulkProcess: true,
                    bulkConfig: mergedBulkConfig,
                };

                if (process?.id) {
                    await processesApi.update(process.id, processPayload);
                    actions.showToast('Proceso masivo actualizado', 'success', 3000);
                } else {
                    await processesApi.create(processPayload);
                    actions.showToast('Proceso masivo creado', 'success', 3000);
                }
            }

            onSave();
            onClose();
        } catch (error: any) {
            console.error('Error guardando proceso masivo:', error);
            actions.showToast(`Error: ${error.message || 'Error desconocido'}`, 'error', 5000);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {configOnly
                            ? 'Configuración de tabla'
                            : process
                              ? 'Editar Proceso Masivo'
                              : 'Nuevo Proceso Masivo'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 mb-6">
                        <button
                            onClick={() => setActiveTab('basic')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'basic'
                                    ? 'border-primary-600 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Settings className="w-4 h-4 inline mr-2" />
                            Básico
                        </button>
                        <button
                            onClick={() => setActiveTab('config')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'config'
                                    ? 'border-primary-600 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Filter className="w-4 h-4 inline mr-2" />
                            Configuración Avanzada
                        </button>
                    </div>

                    {activeTab === 'basic' ? (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Título del Proceso *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej: Reclutamiento Masivo - Desarrolladores"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Descripción
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Descripción del proceso masivo..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Cliente
                                </label>
                                {isLoadingClients ? (
                                    <p className="text-sm text-gray-500">Cargando clientes...</p>
                                ) : (
                                    <select
                                        value={selectedClientId || ''}
                                        onChange={(e) => setSelectedClientId(e.target.value || undefined)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="">Sin cliente</option>
                                        {clients.map(client => (
                                            <option key={client.id} value={client.id}>
                                                {client.razonSocial} (RUC: {client.ruc})
                                            </option>
                                        ))}
                                    </select>
                                )}
                                <p className="mt-1 text-xs text-gray-500">
                                    Selecciona el cliente al que pertenece este proceso. Puedes gestionar clientes en Configuración.
                                </p>
                            </div>

                            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                                <label className="block text-sm font-medium text-gray-700">
                                    Imagen de portada (tarjeta del proceso)
                                </label>
                                <p className="text-xs text-gray-500">
                                    Como en procesos normales: se muestra en la tarjeta del proceso masivo. Clic en la vista previa para ajustar el encuadre.
                                </p>
                                {flyerUrl ? (
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={handleFlyerAreaClick}
                                        onKeyDown={ev => ev.key === 'Enter' && flyerInputRef.current?.click()}
                                        className="h-36 rounded-lg border-2 border-dashed border-gray-300 cursor-crosshair overflow-hidden bg-gray-100"
                                        style={{
                                            backgroundImage: `url(${flyerUrl})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: flyerPosition,
                                        }}
                                    />
                                ) : (
                                    <div className="h-24 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-400">
                                        Sin imagen — se usará una imagen predeterminada
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        ref={flyerInputRef}
                                        onChange={handleFlyerUpload}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => flyerInputRef.current?.click()}
                                        className="flex items-center gap-2 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                    >
                                        <Upload className="w-4 h-4" />
                                        {flyerUrl ? 'Cambiar imagen' : 'Subir imagen'}
                                    </button>
                                    {flyerUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setFlyerUrl('')}
                                            className="px-3 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
                                        >
                                            Quitar
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                                <label className="block text-sm font-medium text-gray-700">
                                    Documentación de consulta
                                </label>
                                <p className="text-xs text-gray-500">
                                    Archivos que el equipo puede abrir o descargar desde la tarjeta del proceso (requisitos, formatos, etc.).
                                    {state.settings?.googleDrive?.connected && process?.googleDriveFolderId
                                        ? ' Se subirán a la carpeta de Google Drive del proceso cuando sea posible.'
                                        : ''}
                                </p>
                                <input
                                    type="file"
                                    ref={attachmentInputRef}
                                    onChange={handleAttachmentUpload}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => attachmentInputRef.current?.click()}
                                    disabled={isUploadingAttachment}
                                    className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <FileText className="w-4 h-4" />
                                    {isUploadingAttachment ? 'Subiendo...' : 'Agregar documento'}
                                </button>
                                {attachments.length > 0 && (
                                    <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg max-h-40 overflow-y-auto">
                                        {attachments.map(att => (
                                            <li
                                                key={att.id}
                                                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                                            >
                                                <a
                                                    href={att.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary-600 truncate hover:underline"
                                                >
                                                    {att.name}
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteAttachment(att.id)}
                                                    className="p-1 text-red-600 hover:bg-red-50 rounded shrink-0"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Etapas del Proceso *
                                </label>
                                <div className="space-y-2">
                                    {stages.map((stage, index) => (
                                        <div key={stage.id} className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <GripVertical className="w-5 h-5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={stage.name}
                                                    onChange={(e) => handleStageChange(index, e.target.value)}
                                                    placeholder={`Etapa ${index + 1}`}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                />
                                                {stages.length > 1 && (
                                                    <button
                                                        onClick={() => handleRemoveStage(index)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="ml-7">
                                                <StageColorPicker
                                                    compact
                                                    value={stage.color}
                                                    onChange={(color) => handleStageColorChange(index, color)}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={handleAddStage}
                                    className="mt-2 flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                                >
                                    <Plus className="w-4 h-4" />
                                    Agregar Etapa
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Estado
                                    </label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as ProcessStatus)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="en_proceso">En Proceso</option>
                                        <option value="standby">Standby</option>
                                        <option value="terminado">Terminado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Vacantes
                                    </label>
                                    <input
                                        type="number"
                                        value={vacancies}
                                        onChange={(e) => setVacancies(parseInt(e.target.value) || 1)}
                                        min="1"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="text-sm font-medium text-gray-800 mb-1">Indicadores del Panel</h3>
                                <p className="text-xs text-gray-500 mb-3">
                                    Estas fechas permiten calcular Time to Hire y Time to Fill en el Panel de estadísticas.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Fecha de inicio del proceso
                                        </label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            title="Respaldo para Time to Hire si no hay fecha de publicación"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Fecha de publicación de la oferta
                                        </label>
                                        <input
                                            type="date"
                                            value={publishedDate}
                                            onChange={(e) => setPublishedDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            title="Inicio del cómputo de Time to Hire"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Fecha de identificación de necesidad
                                        </label>
                                        <input
                                            type="date"
                                            value={needIdentifiedDate}
                                            onChange={(e) => setNeedIdentifiedDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            title="Inicio del cómputo de Time to Fill"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Score Threshold — solo si la columna Score IA está visible en la tabla */}
                            {scoreIaColumnVisible && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Puntaje de Corte (Score Threshold)
                                </label>
                                <p className="text-xs text-gray-500 mb-2">
                                    Solo los candidatos con Score IA mayor o igual a este valor aparecerán en la vista principal
                                </p>
                                <input
                                    type="number"
                                    value={bulkConfig.scoreThreshold || 70}
                                    onChange={(e) => setBulkConfig({ ...bulkConfig, scoreThreshold: parseInt(e.target.value) || 0 })}
                                    min="0"
                                    max="100"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                            )}

                            {/* Prompt de IA */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Brain className="w-4 h-4 inline mr-1" />
                                    Prompt de IA para Análisis de CV
                                </label>
                                <p className="text-xs text-gray-500 mb-2">
                                    Instrucciones específicas para OpenAI al analizar los CVs de los candidatos
                                </p>
                                <textarea
                                    value={bulkConfig.aiPrompt || ''}
                                    onChange={(e) => setBulkConfig({ ...bulkConfig, aiPrompt: e.target.value })}
                                    placeholder="Ej: Busca experiencia en ventas de tangibles. Prioriza candidatos que dominen Excel avanzado. Evalúa habilidades de comunicación y trabajo en equipo."
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>

                            {/* Killer Questions */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Killer Questions Automáticas
                                </label>
                                <p className="text-xs text-gray-500 mb-3">
                                    Preguntas que filtran automáticamente a los candidatos. Si no cumplen, se marcan como "No Aptos"
                                </p>
                                <div className="space-y-3">
                                    {killerQuestions.map((q, index) => (
                                        <div key={q.id} className="p-4 border border-gray-200 rounded-lg">
                                            <div className="flex items-start justify-between mb-2">
                                                <span className="text-sm font-medium text-gray-700">Pregunta {index + 1}</span>
                                                <button
                                                    onClick={() => setKillerQuestions(killerQuestions.filter((_, i) => i !== index))}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                value={q.question}
                                                onChange={(e) => {
                                                    const updated = [...killerQuestions];
                                                    updated[index] = { ...updated[index], question: e.target.value };
                                                    setKillerQuestions(updated);
                                                }}
                                                placeholder="Ej: ¿Tienes disponibilidad para trabajar en Surco?"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                                <select
                                                    value={q.type}
                                                    onChange={(e) => {
                                                        const updated = [...killerQuestions];
                                                        updated[index] = { ...updated[index], type: e.target.value as 'yes_no' | 'multiple_choice' };
                                                        setKillerQuestions(updated);
                                                    }}
                                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                >
                                                    <option value="yes_no">Sí/No</option>
                                                    <option value="multiple_choice">Opción Múltiple</option>
                                                </select>
                                                <label className="flex items-center gap-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={q.required}
                                                        onChange={(e) => {
                                                            const updated = [...killerQuestions];
                                                            updated[index] = { ...updated[index], required: e.target.checked };
                                                            setKillerQuestions(updated);
                                                        }}
                                                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                                    />
                                                    Requerida
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setKillerQuestions([...killerQuestions, {
                                            id: `kq-${Date.now()}`,
                                            question: '',
                                            type: 'yes_no',
                                            correctAnswer: '',
                                            required: true,
                                        }])}
                                        className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Agregar Killer Question
                                    </button>
                                </div>
                            </div>

                            {/* WhatsApp */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <MessageCircle className="w-4 h-4 inline mr-1" />
                                    Acceso rápido a WhatsApp
                                </label>
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={bulkConfig.whatsappEnabled ?? true}
                                            onChange={(e) => setBulkConfig({ ...bulkConfig, whatsappEnabled: e.target.checked })}
                                            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                        />
                                        Habilitar acceso rápido a WhatsApp en la tabla
                                    </label>
                                </div>
                            </div>

                            <PsycholaboralConfigSection
                                bulkConfig={bulkConfig}
                                setBulkConfig={setBulkConfig}
                                inventory={psychInventory}
                                onOpenInventory={() => setShowPsychInventory(true)}
                            />

                            {/* Filtrado Automático */}
                            {scoreIaColumnVisible && (
                            <div>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={bulkConfig.autoFilterEnabled ?? true}
                                        onChange={(e) => setBulkConfig({ ...bulkConfig, autoFilterEnabled: e.target.checked })}
                                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">
                                        Activar filtrado automático por Score IA
                                    </span>
                                </label>
                                <p className="text-xs text-gray-500 mt-1 ml-6">
                                    Los candidatos se filtrarán automáticamente según el Score Threshold configurado
                                </p>
                            </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? 'Guardando...' : process ? 'Actualizar' : 'Crear'}
                    </button>
                </div>
            </div>

            <PsycholaboralInventoryModal
                isOpen={showPsychInventory}
                onClose={() => setShowPsychInventory(false)}
                onSaved={setPsychInventory}
            />
        </div>
    );
};
