import React, { useState, useRef, useEffect } from 'react';
import { useAppState } from '../App';
import { Process, Stage, Attachment, ProcessStatus, DocumentCategory } from '../types';
import { X, Plus, Trash2, GripVertical, Paperclip, Upload, FileText, CheckSquare, Folder, Cloud, Eye, Info } from 'lucide-react';
import { googleDriveService, GoogleDriveFolder } from '../lib/googleDrive';

interface ProcessEditorModalProps {
    process: Process | null;
    onClose: () => void;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export const ProcessEditorModal: React.FC<ProcessEditorModalProps> = ({ process, onClose }) => {
    const { state, actions, getLabel } = useAppState();
    const [title, setTitle] = useState(process?.title || '');
    const [description, setDescription] = useState(process?.description || '');
    const [serviceOrderCode, setServiceOrderCode] = useState(process?.serviceOrderCode || '');
    const [salaryRange, setSalaryRange] = useState(process?.salaryRange || '');
    const [experienceLevel, setExperienceLevel] = useState(process?.experienceLevel || '');
    const [seniority, setSeniority] = useState(process?.seniority || '');
    const [startDate, setStartDate] = useState(process?.startDate || '');
    const [endDate, setEndDate] = useState(process?.endDate || '');
    const [flyerUrl, setFlyerUrl] = useState(process?.flyerUrl || '');
    const [attachments, setAttachments] = useState<Attachment[]>(process?.attachments || []);
    const [stages, setStages] = useState<Stage[]>(process?.stages || [{ id: `new-${Date.now()}`, name: 'Applied' }]);
    const [status, setStatus] = useState<ProcessStatus>(process?.status || 'en_proceso');
    const [vacancies, setVacancies] = useState<number>(process?.vacancies || 1);
    const [documentCategories, setDocumentCategories] = useState<DocumentCategory[]>(process?.documentCategories || []);
    const [googleDriveFolderId, setGoogleDriveFolderId] = useState<string | undefined>(process?.googleDriveFolderId);
    const [googleDriveFolderName, setGoogleDriveFolderName] = useState<string | undefined>(process?.googleDriveFolderName);
    const [availableFolders, setAvailableFolders] = useState<GoogleDriveFolder[]>([]);
    const [isLoadingFolders, setIsLoadingFolders] = useState(false);
    const [showFolderSelector, setShowFolderSelector] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const flyerInputRef = useRef<HTMLInputElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);

    const statusLabels: Record<ProcessStatus, string> = {
        en_proceso: 'En Proceso',
        standby: 'Stand By',
        terminado: 'Terminado',
    };

    const googleDriveConfig = state.settings?.googleDrive;
    const isGoogleDriveConnected = googleDriveConfig?.connected && googleDriveConfig?.accessToken;

    useEffect(() => {
        if (isGoogleDriveConnected && googleDriveConfig) {
            googleDriveService.initialize(googleDriveConfig);
            loadFolders();
        }
    }, [isGoogleDriveConnected]);

    const loadFolders = async () => {
        if (!isGoogleDriveConnected || !googleDriveConfig) return;
        
        setIsLoadingFolders(true);
        try {
            const rootFolderId = googleDriveConfig.rootFolderId;
            const folders = await googleDriveService.listFolders(rootFolderId);
            setAvailableFolders(folders);
        } catch (error: any) {
            console.error('Error cargando carpetas:', error);
            alert('Error al cargar carpetas de Google Drive: ' + error.message);
        } finally {
            setIsLoadingFolders(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim() || !isGoogleDriveConnected || !googleDriveConfig) return;

        setIsCreatingFolder(true);
        try {
            googleDriveService.initialize(googleDriveConfig);
            const rootFolderId = googleDriveConfig.rootFolderId;
            const folder = await googleDriveService.createFolder(newFolderName.trim(), rootFolderId);
            setGoogleDriveFolderId(folder.id);
            setGoogleDriveFolderName(folder.name);
            setNewFolderName('');
            setShowFolderSelector(false);
            await loadFolders(); // Recargar lista
        } catch (error: any) {
            console.error('Error creando carpeta:', error);
            alert('Error al crear carpeta: ' + error.message);
        } finally {
            setIsCreatingFolder(false);
        }
    };

    const handleSelectFolder = (folder: GoogleDriveFolder) => {
        setGoogleDriveFolderId(folder.id);
        setGoogleDriveFolderName(folder.name);
        setShowFolderSelector(false);
    };

    const handleStageNameChange = (id: string, name: string) => {
        setStages(stages.map(stage => stage.id === id ? { ...stage, name } : stage));
    };
    
    const handleStageRequiredDocumentsChange = (stageId: string, categoryIds: string[]) => {
        setStages(stages.map(stage => 
            stage.id === stageId 
                ? { ...stage, requiredDocuments: categoryIds.length > 0 ? categoryIds : undefined }
                : stage
        ));
    };
    
    const addDocumentCategory = () => {
        setDocumentCategories([...documentCategories, {
            id: `cat-${Date.now()}`,
            name: '',
            description: '',
            required: false,
        }]);
    };
    
    const updateDocumentCategory = (id: string, updates: Partial<DocumentCategory>) => {
        setDocumentCategories(documentCategories.map(cat => 
            cat.id === id ? { ...cat, ...updates } : cat
        ));
    };
    
    const removeDocumentCategory = (id: string) => {
        setDocumentCategories(documentCategories.filter(cat => cat.id !== id));
        // También remover de los requisitos de las etapas
        setStages(stages.map(stage => ({
            ...stage,
            requiredDocuments: stage.requiredDocuments?.filter(catId => catId !== id)
        })));
    };

    const addStage = () => setStages([...stages, { id: `new-${Date.now()}`, name: '' }]);
    const removeStage = (id: string) => {
        if (stages.length > 1) setStages(stages.filter(stage => stage.id !== id));
        else alert("A process must have at least one stage.");
    };
    
    const dragItem = React.useRef<number | null>(null);
    const dragOverItem = React.useRef<number | null>(null);
    const handleSort = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        let _stages = [...stages];
        const draggedItemContent = _stages.splice(dragItem.current, 1)[0];
        _stages.splice(dragOverItem.current, 0, draggedItemContent);
        dragItem.current = null;
        dragOverItem.current = null;
        setStages(_stages);
    };

    const handleFlyerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const dataUrl = await fileToBase64(file);
            setFlyerUrl(dataUrl);
        }
    };
    
    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const googleDriveConfig = state.settings?.googleDrive;
        const isGoogleDriveConnected = googleDriveConfig?.connected && googleDriveConfig?.accessToken;
        const hasGoogleDriveFolder = googleDriveFolderId;

        let attachmentUrl: string;
        let attachmentId: string = `att-p-${Date.now()}`;

        // Si Google Drive está conectado y hay carpeta configurada, subir a Google Drive
        if (isGoogleDriveConnected && hasGoogleDriveFolder && googleDriveConfig) {
            try {
                googleDriveService.initialize(googleDriveConfig);
                
                // Subir archivo a Google Drive
                const uploadedFile = await googleDriveService.uploadFile(
                    file,
                    googleDriveFolderId,
                    `proceso_${title || 'sin_titulo'}_${file.name}`
                );
                
                // Usar URL de visualización de Google Drive
                attachmentUrl = googleDriveService.getFileViewUrl(uploadedFile.id);
                attachmentId = uploadedFile.id;
                console.log(`✅ Archivo del proceso subido a Google Drive: ${googleDriveFolderName || 'Carpeta del proceso'} - ${uploadedFile.name}`);
            } catch (error: any) {
                console.error('Error subiendo a Google Drive, usando almacenamiento local:', error);
                alert(`Error al subir a Google Drive: ${error.message}. El archivo se guardará localmente.`);
                // Fallback a Base64 si falla Google Drive
                attachmentUrl = await fileToBase64(file);
            }
        } else {
            // Usar Base64 si Google Drive no está configurado
            attachmentUrl = await fileToBase64(file);
        }

        const newAttachment: Attachment = {
            id: attachmentId,
            name: file.name,
            url: attachmentUrl,
            type: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString(),
        };
        setAttachments(prev => [...prev, newAttachment]);
    };

    const handleDeleteAttachment = (id: string) => {
        setAttachments(prev => prev.filter(att => att.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalStages = stages.filter(s => s.name.trim() !== '').map((s, i) => ({...s, id: s.id.startsWith('new-') ? `stage-${Date.now()}-${i}` : s.id}));
        if (finalStages.length === 0) { alert('Please add at least one valid stage.'); return; }

        const finalCategories = documentCategories.filter(cat => cat.name.trim() !== '');
        const processData = { 
            title, 
            description, 
            serviceOrderCode, 
            stages: finalStages, 
            salaryRange, 
            experienceLevel, 
            seniority, 
            startDate, 
            endDate, 
            flyerUrl, 
            attachments, 
            status, 
            vacancies,
            documentCategories: finalCategories.length > 0 ? finalCategories : undefined,
            googleDriveFolderId: googleDriveFolderId || undefined,
            googleDriveFolderName: googleDriveFolderName || undefined,
        };

        if (process) await actions.updateProcess({ ...process, ...processData });
        else await actions.addProcess(processData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b flex justify-between items-center"><h2 className="text-2xl font-bold text-gray-800">{process ? getLabel('modal_edit_process', 'Editar proceso') : getLabel('modal_create_process', 'Crear nuevo proceso')}</h2><button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><X className="w-6 h-6 text-gray-600" /></button></div>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        {/* Process Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-gray-700">Título del proceso</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="mt-1 block w-full input"/></div>
                            <div><label className="block text-sm font-medium text-gray-700">Código OS (orden de servicio)</label><input type="text" placeholder="Ej: OS-2024-001" value={serviceOrderCode} onChange={e => setServiceOrderCode(e.target.value)} className="mt-1 block w-full input"/></div>
                            <div><label className="block text-sm font-medium text-gray-700">Rango salarial</label><input type="text" placeholder={`${state.settings?.currencySymbol || '$'}100k - ${state.settings?.currencySymbol || '$'}120k`} value={salaryRange} onChange={e => setSalaryRange(e.target.value)} className="mt-1 block w-full input"/></div>
                            <div><label className="block text-sm font-medium text-gray-700">Nivel de experiencia</label><input type="text" placeholder="Ej: 5+ años" value={experienceLevel} onChange={e => setExperienceLevel(e.target.value)} className="mt-1 block w-full input"/></div>
                            <div><label className="block text-sm font-medium text-gray-700">Seniority</label><input type="text" placeholder="Ej: Senior, Mid-Level" value={seniority} onChange={e => setSeniority(e.target.value)} className="mt-1 block w-full input"/></div>
                            <div><label className="block text-sm font-medium text-gray-700">Fecha de inicio</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full input"/></div>
                            <div><label className="block text-sm font-medium text-gray-700">Fecha de fin</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full input"/></div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Estado del proceso</label>
                                <select value={status} onChange={e => setStatus(e.target.value as ProcessStatus)} className="mt-1 block w-full input">
                                    {Object.entries(statusLabels).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Vacantes</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={vacancies}
                                    onChange={e => setVacancies(Math.max(1, Number(e.target.value) || 1))}
                                    className="mt-1 block w-full input"
                                />
                            </div>
                        </div>
                        <div><label className="block text-sm font-medium text-gray-700">Descripción</label><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 block w-full input" /></div>
                        
                        {/* Google Drive Folder */}
                        {isGoogleDriveConnected && (
                            <div className="border-t pt-4">
                                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                    <Cloud className="w-4 h-4 mr-2" />
                                    Carpeta de Google Drive
                                </h3>
                                <p className="text-xs text-gray-500 mb-3">
                                    Selecciona o crea una carpeta en Google Drive donde se almacenarán los documentos de este proceso. 
                                    <strong className="block mt-1 text-orange-600">Si no configuras una carpeta, los archivos se guardarán localmente (Base64) en lugar de Google Drive.</strong>
                                </p>
                                <div className="space-y-2">
                                    {googleDriveFolderId && googleDriveFolderName ? (
                                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                                            <div className="flex items-center space-x-2">
                                                <Folder className="w-5 h-5 text-green-600" />
                                                <div>
                                                    <p className="text-sm font-medium text-green-900">{googleDriveFolderName}</p>
                                                    <p className="text-xs text-green-700">Carpeta configurada</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setGoogleDriveFolderId(undefined);
                                                    setGoogleDriveFolderName(undefined);
                                                }}
                                                className="text-sm text-red-600 hover:text-red-800"
                                            >
                                                Cambiar
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowFolderSelector(!showFolderSelector)}
                                                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                                            >
                                                <Folder className="w-4 h-4 mr-2" />
                                                {showFolderSelector ? 'Ocultar carpetas' : 'Seleccionar carpeta'}
                                            </button>
                                            
                                            {showFolderSelector && (
                                                <div className="border rounded-lg p-3 bg-gray-50 max-h-64 overflow-y-auto">
                                                    {isLoadingFolders ? (
                                                        <p className="text-sm text-gray-500 text-center py-4">Cargando carpetas...</p>
                                                    ) : availableFolders.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {availableFolders.map((folder) => (
                                                                <button
                                                                    key={folder.id}
                                                                    type="button"
                                                                    onClick={() => handleSelectFolder(folder)}
                                                                    className="w-full flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded-md hover:bg-blue-50 text-left"
                                                                >
                                                                    <Folder className="w-4 h-4 text-gray-500" />
                                                                    <span className="text-sm text-gray-700">{folder.name}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-500 text-center py-4">No hay carpetas disponibles</p>
                                                    )}
                                                    
                                                    <div className="mt-3 pt-3 border-t">
                                                        <p className="text-xs text-gray-600 mb-2">O crea una nueva carpeta:</p>
                                                        <div className="flex space-x-2">
                                                            <input
                                                                type="text"
                                                                value={newFolderName}
                                                                onChange={(e) => setNewFolderName(e.target.value)}
                                                                placeholder="Nombre de la carpeta"
                                                                className="flex-1 input text-sm"
                                                                onKeyPress={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        handleCreateFolder();
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={handleCreateFolder}
                                                                disabled={!newFolderName.trim() || isCreatingFolder}
                                                                className="px-3 py-1.5 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {isCreatingFolder ? 'Creando...' : 'Crear'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Flyer */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Flyer Image</label>
                            <div className="mt-1 flex items-center space-x-4">
                                {flyerUrl && <img src={flyerUrl} alt="Flyer preview" className="w-24 h-16 object-cover rounded-md" />}
                                <button type="button" onClick={() => flyerInputRef.current?.click()} className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">{flyerUrl ? 'Change Image' : 'Upload Image'}</button>
                                <input type="file" accept="image/*" ref={flyerInputRef} onChange={handleFlyerUpload} className="hidden" />
                            </div>
                        </div>

                        {/* Attachments */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center"><Paperclip className="w-4 h-4 mr-2"/> Documentos del proceso</h3>
                             <div className="space-y-2">
                                {attachments.map(att => (
                                    <div key={att.id} className="flex items-center justify-between p-2 rounded-md border bg-gray-50">
                                        <div className="flex items-center overflow-hidden flex-1">
                                            <FileText className="w-5 h-5 mr-3 text-gray-500 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{att.name}</p>
                                                {att.url && (
                                                    <a 
                                                        href={att.url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-primary-600 hover:underline"
                                                    >
                                                        {att.url.startsWith('https://drive.google.com') ? 'Ver en Google Drive' : 'Ver documento'}
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {att.url && (
                                                <a 
                                                    href={att.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="p-1 rounded-md hover:bg-gray-200" 
                                                    title="Abrir"
                                                >
                                                    <Eye className="w-4 h-4 text-gray-600" />
                                                </a>
                                            )}
                                            <button onClick={() => handleDeleteAttachment(att.id)} className="p-1 rounded-md hover:bg-red-100" title="Eliminar"><Trash2 className="w-4 h-4 text-red-500" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <input type="file" ref={attachmentInputRef} onChange={handleAttachmentUpload} className="hidden" />
                            <div className="mt-2 space-y-1">
                                <button type="button" onClick={() => attachmentInputRef.current?.click()} className="flex items-center text-sm font-medium text-primary-600 hover:text-primary-800"><Upload className="w-4 h-4 mr-1" /> Subir documento</button>
                                {(() => {
                                    const googleDriveConfig = state.settings?.googleDrive;
                                    const isGoogleDriveConnected = googleDriveConfig?.connected && googleDriveConfig?.accessToken;
                                    
                                    if (isGoogleDriveConnected && googleDriveFolderId) {
                                        return (
                                            <p className="text-xs text-green-600 flex items-center">
                                                <Info className="w-3 h-3 mr-1" />
                                                Los archivos se subirán a Google Drive: <strong>{googleDriveFolderName || 'Carpeta del proceso'}</strong>
                                            </p>
                                        );
                                    } else if (isGoogleDriveConnected && !googleDriveFolderId) {
                                        return (
                                            <p className="text-xs text-orange-600 flex items-center">
                                                <Info className="w-3 h-3 mr-1" />
                                                ⚠️ Configura una carpeta de Google Drive arriba para subir archivos a la nube
                                            </p>
                                        );
                                    } else {
                                        return (
                                            <p className="text-xs text-gray-500 flex items-center">
                                                <Info className="w-3 h-3 mr-1" />
                                                Los archivos se guardarán localmente
                                            </p>
                                        );
                                    }
                                })()}
                            </div>
                        </div>
                        
                        {/* Document Categories */}
                        <div className="border-t pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-medium text-gray-700 flex items-center">
                                    <CheckSquare className="w-4 h-4 mr-2" />
                                    Categorías de documentos
                                </h3>
                                <button type="button" onClick={addDocumentCategory} className="flex items-center text-sm font-medium text-primary-600 hover:text-primary-800">
                                    <Plus className="w-4 h-4 mr-1" /> Agregar categoría
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mb-3">
                                Define las categorías de documentos que los candidatos deben subir. Puedes marcar categorías como requeridas y definir requisitos por etapa.
                            </p>
                            <div className="space-y-3">
                                {documentCategories.map((cat, index) => (
                                    <div key={cat.id} className="border rounded-lg p-3 bg-gray-50">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                                            <div className="md:col-span-2">
                                                <input
                                                    type="text"
                                                    value={cat.name}
                                                    onChange={(e) => updateDocumentCategory(cat.id, { name: e.target.value })}
                                                    placeholder="Nombre de la categoría (ej: CV, DNI, Contrato)"
                                                    className="w-full input text-sm"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="flex items-center text-sm text-gray-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={cat.required}
                                                        onChange={(e) => updateDocumentCategory(cat.id, { required: e.target.checked })}
                                                        className="mr-2"
                                                    />
                                                    Requerido
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => removeDocumentCategory(cat.id)}
                                                    className="p-1 text-gray-500 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            value={cat.description || ''}
                                            onChange={(e) => updateDocumentCategory(cat.id, { description: e.target.value })}
                                            placeholder="Descripción (opcional)"
                                            className="w-full input text-sm text-gray-600"
                                        />
                                    </div>
                                ))}
                                {documentCategories.length === 0 && (
                                    <p className="text-sm text-gray-500 italic text-center py-4">
                                        No hay categorías definidas. Agrega categorías para organizar los documentos de los candidatos.
                                    </p>
                                )}
                            </div>
                        </div>
                        
                        {/* Stages */}
                        <div className="border-t pt-4">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Etapas del proceso</h3>
                            <div className="space-y-3">
                                {stages.map((stage, index) => (
                                    <div key={stage.id} className="border rounded-lg p-3 bg-gray-50">
                                        <div className="flex items-center space-x-2 mb-2" draggable onDragStart={() => dragItem.current = index} onDragEnter={() => dragOverItem.current = index} onDragEnd={handleSort} onDragOver={(e) => e.preventDefault()}>
                                            <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                                            <input 
                                                type="text" 
                                                value={stage.name} 
                                                onChange={(e) => handleStageNameChange(stage.id, e.target.value)} 
                                                placeholder={`Etapa ${index + 1}`} 
                                                className="flex-1 input" 
                                            />
                                            <button type="button" onClick={() => removeStage(stage.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                        {documentCategories.length > 0 && (
                                            <div className="ml-7">
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    Documentos requeridos para avanzar a esta etapa:
                                                </label>
                                                <div className="space-y-1">
                                                    {documentCategories.map(cat => (
                                                        <label key={cat.id} className="flex items-center text-sm text-gray-700">
                                                            <input
                                                                type="checkbox"
                                                                checked={stage.requiredDocuments?.includes(cat.id) || false}
                                                                onChange={(e) => {
                                                                    const current = stage.requiredDocuments || [];
                                                                    const updated = e.target.checked
                                                                        ? [...current, cat.id]
                                                                        : current.filter(id => id !== cat.id);
                                                                    handleStageRequiredDocumentsChange(stage.id, updated);
                                                                }}
                                                                className="mr-2"
                                                            />
                                                            {cat.name}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addStage} className="mt-3 flex items-center text-sm font-medium text-primary-600 hover:text-primary-800">
                                <Plus className="w-4 h-4 mr-1" /> Agregar etapa
                            </button>
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end space-x-3"><button type="button" onClick={onClose} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">{process ? 'Guardar cambios' : 'Crear proceso'}</button></div>
                </form>
            </div>
            <style>{`.input { padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); } .btn-primary { padding: 0.5rem 1rem; background-color: #2563eb; color: white; border-radius: 0.375rem; font-weight: 500;} .btn-primary:hover { background-color: #1d4ed8; } .btn-secondary { padding: 0.5rem 1rem; background-color: white; border: 1px solid #D1D5DB; color: #374151; border-radius: 0.375rem; font-weight: 500;} .btn-secondary:hover { background-color: #F9FAFB; }`}</style>
        </div>
    );
};