import React, { useRef, useState } from 'react';
import { useAppState } from '../App';
import { Candidate, Attachment, InterviewEvent, UserRole, Process, DocumentCategory } from '../types';
import { X, Mail, Phone, Linkedin, User, FileText, Eye, Download, Upload, Trash2, Briefcase, DollarSign, Calendar, Info, MapPin, Edit, ArrowRightLeft, Copy, MessageCircle, PhoneCall, Archive, Undo2 } from 'lucide-react';
import { ScheduleInterviewModal } from './ScheduleInterviewModal';
import { ChangeProcessModal } from './ChangeProcessModal';
import { CandidateCommentsModal } from './CandidateCommentsModal';
import { DocumentChecklist } from './DocumentChecklist';
import { SearchableSelect } from './SearchableSelect';
import { DiscardCandidateModal } from './DiscardCandidateModal';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const DetailItem: React.FC<{icon: React.ElementType, label: string, value?: string | number, href?: string}> = ({icon: Icon, label, value, href}) => (
    <div className="flex items-start text-sm">
        <Icon className="w-4 h-4 mr-3 mt-0.5 text-gray-400 flex-shrink-0" />
        <div>
            <span className="font-medium text-gray-700">{label}: </span>
            {href ? (
                 <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 break-all hover:underline">{value}</a>
            ) : (
                <span className="text-gray-600">{value || 'N/D'}</span>
            )}
        </div>
    </div>
);

const addAttachmentToZip = async (folder: JSZip, attachment: Attachment) => {
    if (!attachment.url) return;
    const filename = attachment.name || `archivo-${Date.now()}`;
    if (attachment.url.startsWith('data:')) {
        const base64 = attachment.url.split(',')[1];
        folder.file(filename, base64, { base64: true });
    } else {
        const response = await fetch(attachment.url);
        const blob = await response.blob();
        folder.file(filename, blob);
    }
};


export const CandidateDetailsModal: React.FC<{ candidate: Candidate, onClose: () => void }> = ({ candidate: initialCandidate, onClose }) => {
    const { state, actions } = useAppState();
    const [isEditing, setIsEditing] = useState(false);
    const [editableCandidate, setEditableCandidate] = useState<Candidate>(initialCandidate);
    const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
    
    // Usar useRef para rastrear el último candidato procesado y evitar bucles infinitos
    const lastProcessedCandidateRef = React.useRef<string>('');
    
    // Marcar como revisado cuando se abre el modal y el candidato está en etapa crítica
    // SOLO si el usuario es cliente (client), no para admin/recruiter
    React.useEffect(() => {
        const checkAndMarkAsReviewed = async () => {
            const currentCandidate = state.candidates.find(c => c.id === initialCandidate.id);
            if (!currentCandidate) return;
            
            // Solo marcar si el usuario es cliente
            const userRole = state.currentUser?.role;
            if (userRole !== 'client') return; // Solo clientes pueden marcar como revisado
            
            // Solo marcar si no ha sido revisado antes
            if (currentCandidate.criticalStageReviewedAt) return;
            
            const process = state.processes.find(p => p.id === currentCandidate.processId);
            if (!process) return;
            
            const currentStage = process.stages.find(s => s.id === currentCandidate.stageId);
            const isInCriticalStage = currentStage?.isCritical || false;
            
            // Si está en etapa crítica y no ha sido revisado aún, marcarlo como revisado (solo para clientes)
            if (isInCriticalStage) {
                try {
                    await actions.updateCandidate({
                        ...currentCandidate,
                        criticalStageReviewedAt: new Date().toISOString()
                    }, state.currentUser?.name);
                } catch (error) {
                    console.error('Error marcando candidato como revisado en etapa crítica:', error);
                    // No bloquear la apertura del modal por este error
                }
            }
        };
        
        // Ejecutar cuando se monta el componente (se abre el modal)
        // Usar un pequeño delay para asegurar que el candidato esté actualizado
        const timer = setTimeout(() => {
            checkAndMarkAsReviewed();
        }, 100);
        
        return () => clearTimeout(timer);
    }, [initialCandidate.id, state.currentUser?.role]); // Solo cuando cambia el ID del candidato o el rol del usuario
    
    // Actualizar editableCandidate cuando el candidato se actualiza en el estado
    React.useEffect(() => {
        const updatedCandidate = state.candidates.find(c => c.id === initialCandidate.id);
        if (!updatedCandidate) return;
        
        // Crear un hash simple del candidato para detectar cambios reales (sin attachments para evitar bucles)
        const candidateHash = `${updatedCandidate.id}-${updatedCandidate.stageId}-${updatedCandidate.name}-${updatedCandidate.email}`;
        
        // Solo procesar si el candidato realmente cambió (no solo los attachments)
        if (lastProcessedCandidateRef.current === candidateHash && !isEditing) {
            return; // No hay cambios significativos, evitar actualización
        }
        
        lastProcessedCandidateRef.current = candidateHash;
        
        // Si no estamos editando, actualizar editableCandidate con los datos del estado
        if (!isEditing) {
            setEditableCandidate(prev => {
                // Si el ID es diferente, es un candidato completamente nuevo
                if (prev.id !== updatedCandidate.id) {
                    return updatedCandidate;
                }
                // Actualizar solo los campos principales, mantener attachments locales si están cargados
                const currentAttachmentsLoaded = prev.attachments && prev.attachments.length > 0;
                const updated = { 
                    ...prev, 
                    ...updatedCandidate,
                    // Mantener attachments locales si están cargados para evitar perder datos
                    attachments: currentAttachmentsLoaded 
                        ? prev.attachments 
                        : (updatedCandidate.attachments || [])
                };
                return updated;
            });
        }
    }, [state.candidates, initialCandidate.id, isEditing]); // Dependencias mínimas para evitar bucles
    
    // Actualizar preview solo una vez al inicio (separado para evitar bucles)
    React.useEffect(() => {
        if (!previewFile && editableCandidate.attachments && editableCandidate.attachments.length > 0) {
            setPreviewFile(editableCandidate.attachments[0]);
        }
    }, [editableCandidate.id]); // Solo cuando cambia el ID del candidato

    // Cargar conteo de attachments al abrir el modal (sin cargar los documentos)
    React.useEffect(() => {
        const loadAttachmentsCount = async () => {
            try {
                const { candidatesApi } = await import('../lib/api/candidates');
                const count = await candidatesApi.getAttachmentsCount(initialCandidate.id);
                setAttachmentsCount(count);
            } catch (error) {
                console.warn('Error cargando conteo de attachments:', error);
                // Si falla, usar el conteo de attachments existentes si hay
                if (initialCandidate.attachments && initialCandidate.attachments.length > 0) {
                    setAttachmentsCount(initialCandidate.attachments.length);
                }
            }
        };
        loadAttachmentsCount();
    }, [initialCandidate.id]);

    // Sincronizar archivos de Google Drive con attachments al abrir el modal
    // Usar useRef para evitar múltiples sincronizaciones y preservar categorías
    const hasSyncedDriveRef = React.useRef<boolean>(false);
    
    React.useEffect(() => {
        // Solo sincronizar una vez al abrir el modal, no cada vez que cambia el candidato
        if (hasSyncedDriveRef.current) return;
        
        const syncDriveFiles = async () => {
            const googleDriveConfig = state.settings?.googleDrive;
            const isGoogleDriveConnected = googleDriveConfig?.connected && googleDriveConfig?.accessToken;
            if (!isGoogleDriveConnected || !googleDriveConfig) return;

            const currentCandidate = state.candidates.find(c => c.id === initialCandidate.id);
            if (!currentCandidate) return;

            const process = state.processes.find(p => p.id === currentCandidate.processId);
            if (!process?.googleDriveFolderId) return;

            try {
                const { googleDriveService } = await import('../lib/googleDrive');
                googleDriveService.initialize(googleDriveConfig);

                // Verificar y corregir la carpeta del candidato
                const folder = await googleDriveService.getOrCreateCandidateFolder(
                    currentCandidate.name,
                    process.googleDriveFolderId,
                    currentCandidate.googleDriveFolderId
                );

                // Si la carpeta cambió, actualizar el candidato
                if (folder.id !== currentCandidate.googleDriveFolderId) {
                    await actions.updateCandidate({
                        ...currentCandidate,
                        googleDriveFolderId: folder.id,
                        googleDriveFolderName: folder.name,
                    }, state.currentUser?.name);
                    hasSyncedDriveRef.current = true; // Marcar como sincronizado
                    return; // El useEffect se ejecutará de nuevo cuando se actualice el candidato
                }

                // Si no hay carpeta, no hacer nada
                if (!folder.id) {
                    hasSyncedDriveRef.current = true;
                    return;
                }

                // Listar archivos de la carpeta de Google Drive
                const driveFiles = await googleDriveService.listFilesInFolder(folder.id);
                
                // Obtener los IDs de Google Drive de los attachments actuales (extraer de la URL)
                const existingDriveFileIds = new Set<string>();
                
                (currentCandidate.attachments || []).forEach(att => {
                    // Extraer ID de Google Drive de la URL (formato: .../file/d/{id}/...)
                    const match = att.url?.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                    if (match && match[1]) {
                        existingDriveFileIds.add(match[1]);
                    }
                });

                // Encontrar archivos de Drive que no están en los attachments
                const newFiles = driveFiles.filter(file => !existingDriveFileIds.has(file.id));

                // Si hay archivos nuevos, agregarlos como attachments (sin categoría por defecto)
                if (newFiles.length > 0) {
                    const newAttachments: Attachment[] = newFiles.map(file => ({
                        id: `att-${file.id}-${Date.now()}`,
                        name: file.name,
                        url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/preview`,
                        type: file.mimeType || 'application/octet-stream',
                        size: file.size ? parseInt(file.size) : 0,
                        uploadedAt: file.createdTime || new Date().toISOString(),
                        category: undefined, // Sin categoría por defecto, el usuario la asignará
                    }));

                    // Obtener el candidato más reciente del estado para preservar attachments existentes con sus categorías
                    const latestCandidate = state.candidates.find(c => c.id === initialCandidate.id) || currentCandidate;
                    
                    const updatedCandidate = {
                        ...latestCandidate,
                        attachments: [...(latestCandidate.attachments || []), ...newAttachments],
                    };

                    await actions.updateCandidate(updatedCandidate, state.currentUser?.name);
                    console.log(`✅ Sincronizados ${newFiles.length} archivos de Google Drive para ${currentCandidate.name}`);
                }
                
                hasSyncedDriveRef.current = true; // Marcar como sincronizado
            } catch (error) {
                console.warn('Error sincronizando archivos de Google Drive:', error);
                hasSyncedDriveRef.current = true; // Marcar como sincronizado incluso si hay error para evitar reintentos
                // No mostrar error al usuario, es una sincronización en background
            }
        };

        // Ejecutar después de un pequeño delay para asegurar que el modal esté completamente cargado
        const timer = setTimeout(() => {
            syncDriveFiles();
        }, 500);

        return () => {
            clearTimeout(timer);
            // Resetear el flag cuando se cierra el modal (cuando cambia el ID del candidato)
        };
    }, [initialCandidate.id]); // Solo cuando cambia el ID del candidato (al abrir un nuevo modal)
    
    // Resetear el flag cuando cambia el candidato
    React.useEffect(() => {
        hasSyncedDriveRef.current = false;
    }, [initialCandidate.id]);
    
    const [previewFile, setPreviewFile] = useState<Attachment | null>(initialCandidate.attachments?.[0] || null);
    const [activeTab, setActiveTab] = useState<'details' | 'history' | 'schedule' | 'comments' | 'documents'>('details');
    const [isScheduling, setIsScheduling] = useState(false);
    const [editingEvent, setEditingEvent] = useState<InterviewEvent | null>(null);
    const [isChangeProcessModalOpen, setIsChangeProcessModalOpen] = useState(false);
    const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
    const [attachmentsLoaded, setAttachmentsLoaded] = useState(false);
    const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
    const [attachmentsCount, setAttachmentsCount] = useState<number | null>(null);
    const [editingAttachmentCategory, setEditingAttachmentCategory] = useState<string | null>(null);
    const [selectedCategoryForEdit, setSelectedCategoryForEdit] = useState<string>('');

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    
    const process = state.processes.find(p => p.id === initialCandidate.processId);
    const candidateEvents = state.interviewEvents.filter(e => e.candidateId === initialCandidate.id);

    const canEdit = ['admin', 'recruiter'].includes(state.currentUser?.role as UserRole);
    // Usar el candidato actualizado del estado si está disponible, si no usar editableCandidate o initialCandidate
    const candidateFromState = state.candidates.find(c => c.id === initialCandidate.id);
    const currentCandidate = isEditing ? editableCandidate : (candidateFromState || initialCandidate);
    const isArchived = !!currentCandidate.archived;
    const processStages = process?.stages || [];
    const presentationStageIndex = processStages.findIndex(stage => stage.name.toLowerCase().includes('present'));
    const currentStageIndex = processStages.findIndex(stage => stage.id === currentCandidate.stageId);
    const canEditHireDate = presentationStageIndex !== -1 && currentStageIndex !== -1 && currentStageIndex >= presentationStageIndex;
    const normalizedPhone = currentCandidate.phone ? currentCandidate.phone.replace(/[^\d]/g, '') : '';
    const normalizedPhone2 = currentCandidate.phone2 ? currentCandidate.phone2.replace(/[^\d]/g, '') : '';

    const handleCopyPhone = () => {
        if (!currentCandidate.phone) return;
        navigator.clipboard.writeText(currentCandidate.phone);
    };

    const handleCopyPhone2 = () => {
        if (!currentCandidate.phone2) return;
        navigator.clipboard.writeText(currentCandidate.phone2);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setEditableCandidate(prev => ({
            ...prev,
            [name]: e.target.type === 'number' && value !== '' ? parseInt(value, 10) : value
        }));
    };

    const handleProvinceChange = (newProvince: string) => {
        const availableDistricts = state.settings?.districts?.[newProvince] || [];
        setEditableCandidate(prev => {
            // Resetear distrito si no está en la nueva provincia
            const currentDistrict = prev.district || '';
            const newDistrict = currentDistrict && availableDistricts.includes(currentDistrict) ? currentDistrict : '';
            return {
                ...prev,
                province: newProvince,
                district: newDistrict
            };
        });
    };

    const handleSaveChanges = async () => {
        await actions.updateCandidate(editableCandidate, state.currentUser?.name);
        // Recargar candidatos después de actualizar para asegurar sincronización
        if (actions.reloadCandidates && typeof actions.reloadCandidates === 'function') {
            try {
                await actions.reloadCandidates();
            } catch (reloadError) {
                console.warn('Error recargando candidatos después de actualizar (no crítico):', reloadError);
            }
        }
        setIsEditing(false);
    };
    
    const handleCancelEdit = () => {
        setEditableCandidate(initialCandidate);
        setIsEditing(false);
    };
    
    // Handler para cambiar la etapa directamente (sin modo edición)
    const handleStageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStageId = e.target.value;
        const updatedCandidate = { ...currentCandidate, stageId: newStageId };
        setEditableCandidate(updatedCandidate);
        await actions.updateCandidate(updatedCandidate, state.currentUser?.name);
    };
    
    // Handler para cambiar la visibilidad directamente (sin modo edición)
    const handleVisibilityToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVisibility = e.target.checked;
        const updatedCandidate = { ...currentCandidate, visibleToClients: newVisibility };
        setEditableCandidate(updatedCandidate);
        await actions.updateCandidate(updatedCandidate, state.currentUser?.name);
    };
    
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const dataUrl = await fileToBase64(file);
            const updatedCandidate = { ...editableCandidate, avatarUrl: dataUrl };
            setEditableCandidate(updatedCandidate);
            await actions.updateCandidate(updatedCandidate, state.currentUser?.name);
        }
    };
    
    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        // Prevenir duplicados: verificar si ya existe un archivo con el mismo nombre
        const existingAttachment = editableCandidate.attachments?.find(
            att => att.name.toLowerCase() === file.name.toLowerCase()
        );
        if (existingAttachment) {
            const confirmOverwrite = window.confirm(
                `Ya existe un documento con el nombre "${file.name}". ¿Deseas reemplazarlo?`
            );
            if (!confirmOverwrite) {
                // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
                if (e.target) e.target.value = '';
                return;
            }
        }
        
        // Prevenir múltiples uploads simultáneos
        if (isUploading) {
            actions.showToast('Ya hay un archivo subiéndose. Por favor espera...', 'info', 3000);
            if (e.target) e.target.value = '';
            return;
        }
        
        // Si hay categorías definidas, mostrar modal para seleccionar categoría
        if (process?.documentCategories && process.documentCategories.length > 0) {
            setPendingFile(file);
            setShowCategoryModal(true);
        } else {
            // Si no hay categorías, subir sin categoría
            await uploadFileWithCategory(file, '');
        }
    };
    
    const uploadFileWithCategory = async (file: File, categoryId: string) => {
        // Mostrar indicador de carga INMEDIATAMIENTE
        setIsUploading(true);
        setUploadingFileName(file.name);
        const loadingToastId = actions.showToast(`Subiendo ${file.name}...`, 'loading', 0);
        
        try {
            const googleDriveConfig = state.settings?.googleDrive;
            const isGoogleDriveConnected = googleDriveConfig?.connected && googleDriveConfig?.accessToken;
            const process = state.processes.find(p => p.id === editableCandidate.processId);
            const processHasFolder = process?.googleDriveFolderId;
            
            // Si Google Drive está conectado, DEBE usarse (no hay fallback a local)
            if (isGoogleDriveConnected && googleDriveConfig) {
                if (!processHasFolder) {
                    alert('⚠️ Google Drive está conectado pero este proceso no tiene una carpeta configurada. Ve a Procesos → Editar Proceso para configurar una carpeta de Google Drive.');
                    actions.hideToast(loadingToastId);
                    setIsUploading(false);
                    setUploadingFileName(null);
                    setPendingFile(null);
                    setShowCategoryModal(false);
                    setSelectedCategory('');
                    if (attachmentInputRef.current) {
                        attachmentInputRef.current.value = '';
                    }
                    return;
                }

                try {
                const { googleDriveService } = await import('../lib/googleDrive');
                googleDriveService.initialize(googleDriveConfig);
                
                // PASO 1: Asegurar que el candidato tenga carpeta (usar getOrCreateCandidateFolder para evitar duplicados)
                let finalFolderId: string;
                let finalFolderName: string;
                
                // Usar getOrCreateCandidateFolder que:
                // 1. Verifica si la carpeta guardada aún existe
                // 2. Si no existe, busca por nombre
                // 3. Si no encuentra ninguna, crea una nueva
                const candidateFolderName = editableCandidate.name || `Candidato_${Date.now()}`;
                const folder = await googleDriveService.getOrCreateCandidateFolder(
                    candidateFolderName,
                    process.googleDriveFolderId,
                    editableCandidate.googleDriveFolderId // Pasar la carpeta existente si hay una
                );
                finalFolderId = folder.id;
                finalFolderName = folder.name;
                
                // Si la carpeta encontrada es diferente a la guardada, actualizar el candidato
                if (editableCandidate.googleDriveFolderId !== folder.id) {
                    const candidateWithFolder = {
                        ...editableCandidate,
                        googleDriveFolderId: folder.id,
                        googleDriveFolderName: folder.name,
                    };
                    setEditableCandidate(candidateWithFolder);
                    await actions.updateCandidate(candidateWithFolder, state.currentUser?.name);
                    console.log(`✅ Carpeta del candidato actualizada: ${folder.name} (${folder.id})`);
                }
                
                // PASO 2: Verificar si el archivo ya existe antes de subir (evitar duplicados)
                const existingFile = await googleDriveService.findFileInFolder(file.name, finalFolderId);
                let uploadedFile;
                
                if (existingFile) {
                    // Si el archivo ya existe, usar el existente
                    console.log(`⚠️ Archivo ya existe en Drive: ${file.name}, usando el existente`);
                    uploadedFile = existingFile;
                } else {
                    // Subir archivo a Google Drive en la carpeta del candidato
                    uploadedFile = await googleDriveService.uploadFile(
                        file,
                        finalFolderId,
                        file.name
                    );
                }
                
                // Crear attachment con URL de visualización de Google Drive
                // Generar un UUID para el attachment (la tabla requiere UUID, no el ID de Google Drive)
                const attachmentId = `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                // Usar webViewLink si está disponible (mejor para preview), sino usar preview URL
                const attachmentUrl = uploadedFile.webViewLink || 
                    `https://drive.google.com/file/d/${uploadedFile.id}/preview`;
                // Guardar el ID de Google Drive en la URL para poder eliminarlo después
                const newAttachment: Attachment = {
                    id: attachmentId,
                    name: file.name,
                    url: attachmentUrl, // La URL contiene el ID de Google Drive
                    type: file.type,
                    size: file.size,
                    category: categoryId || undefined,
                    uploadedAt: new Date().toISOString(),
                };
                
                // PASO 3: Actualizar el candidato con el nuevo attachment
                // Usar el candidato más reciente (puede haber sido actualizado al crear la carpeta)
                const currentCandidateForUpdate = editableCandidate.googleDriveFolderId === finalFolderId 
                    ? editableCandidate 
                    : { ...editableCandidate, googleDriveFolderId: finalFolderId, googleDriveFolderName: finalFolderName };
                
                const updatedCandidate = { 
                    ...currentCandidateForUpdate, 
                    attachments: [...(currentCandidateForUpdate.attachments || []), newAttachment] 
                };
                
                // Actualizar estado local primero para reflejo inmediato
                setEditableCandidate(updatedCandidate);
                // Actualizar contador de attachments
                setAttachmentsCount(prev => (prev !== null ? prev + 1 : 1));
                // Si los attachments ya están cargados, asegurar que se muestren
                if (attachmentsLoaded) {
                    setEditableCandidate(updatedCandidate);
                }
                
                // Luego actualizar en la base de datos
                await actions.updateCandidate(updatedCandidate, state.currentUser?.name);
                
                // Ocultar toast de loading y mostrar éxito
                actions.hideToast(loadingToastId);
                actions.showToast(`Documento "${file.name}" guardado exitosamente`, 'success', 3000);
                
                console.log(`✅ Archivo subido a Google Drive: ${finalFolderName} - ${uploadedFile.name}`);
                console.log(`✅ Attachment guardado:`, newAttachment);
                console.log(`✅ Candidato actualizado con ${updatedCandidate.attachments.length} attachments`);
                
                // Actualizar preview si no hay uno seleccionado
                if (!previewFile) {
                    setPreviewFile(newAttachment);
                }
                
                // Recargar candidatos para sincronización
                if (actions.reloadCandidates && typeof actions.reloadCandidates === 'function') {
                    try {
                        await actions.reloadCandidates();
                    } catch (reloadError) {
                        console.warn('Error recargando candidatos (no crítico):', reloadError);
                    }
                }
                
                } catch (error: any) {
                    console.error('Error subiendo a Google Drive:', error);
                    actions.hideToast(loadingToastId);
                    actions.showToast(`Error al subir: ${error.message}`, 'error', 5000);
                    setIsUploading(false);
                    setUploadingFileName(null);
                    setPendingFile(null);
                    setShowCategoryModal(false);
                    setSelectedCategory('');
                    if (attachmentInputRef.current) {
                        attachmentInputRef.current.value = '';
                    }
                    return;
                }
            } else {
                // Solo usar Base64 si Google Drive NO está conectado
                const attachmentUrl = await fileToBase64(file);
                const attachmentId = `att-c-${Date.now()}`;
                
                const newAttachment: Attachment = {
                    id: attachmentId,
                    name: file.name,
                    url: attachmentUrl,
                    type: file.type,
                    size: file.size,
                    category: categoryId || undefined,
                    uploadedAt: new Date().toISOString(),
                };
                
                const updatedCandidate = { 
                    ...editableCandidate, 
                    attachments: [...(editableCandidate.attachments || []), newAttachment] 
                };
                setEditableCandidate(updatedCandidate);
                await actions.updateCandidate(updatedCandidate, state.currentUser?.name);
                
                // Ocultar toast de loading y mostrar éxito
                actions.hideToast(loadingToastId);
                actions.showToast(`Documento "${file.name}" guardado exitosamente`, 'success', 3000);
                
                // Actualizar preview si no hay uno seleccionado
                if (!previewFile) {
                    setPreviewFile(newAttachment);
                }
                
                // Recargar candidatos para sincronización
                if (actions.reloadCandidates && typeof actions.reloadCandidates === 'function') {
                    try {
                        await actions.reloadCandidates();
                    } catch (reloadError) {
                        console.warn('Error recargando candidatos (no crítico):', reloadError);
                    }
                }
            }
        } catch (error: any) {
            console.error('Error en uploadFileWithCategory:', error);
            actions.hideToast(loadingToastId);
            actions.showToast(`Error al subir archivo: ${error.message || 'Error desconocido'}`, 'error', 5000);
        } finally {
            setIsUploading(false);
            setUploadingFileName(null);
            setPendingFile(null);
            setShowCategoryModal(false);
            setSelectedCategory('');
            
            // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
            if (attachmentInputRef.current) {
                attachmentInputRef.current.value = '';
            }
        }
    };
    
    const handleConfirmCategory = async () => {
        if (pendingFile) {
            await uploadFileWithCategory(pendingFile, selectedCategory);
        }
    };
    
     const handleDeleteAttachment = async (id: string) => {
        const attachment = editableCandidate.attachments.find(att => att.id === id);
        
        // Si el archivo está en Google Drive, eliminarlo de allí también
        if (attachment?.url?.includes('drive.google.com') && state.settings?.googleDrive?.connected) {
            try {
                // Extraer el ID de Google Drive de la URL
                // La URL es: https://drive.google.com/file/d/{FILE_ID}/view
                const urlMatch = attachment.url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                if (urlMatch && urlMatch[1]) {
                    const googleDriveFileId = urlMatch[1];
                    const { googleDriveService } = await import('../lib/googleDrive');
                    googleDriveService.initialize(state.settings.googleDrive);
                    await googleDriveService.deleteFile(googleDriveFileId);
                    console.log(`✅ Archivo eliminado de Google Drive: ${attachment.name}`);
                }
            } catch (error: any) {
                console.error('Error eliminando archivo de Google Drive:', error);
                // Continuar con la eliminación del registro aunque falle la eliminación del archivo
            }
        }
        
        const updatedAttachments = editableCandidate.attachments.filter(att => att.id !== id);
        const updatedCandidate = { ...editableCandidate, attachments: updatedAttachments };
        setEditableCandidate(updatedCandidate);
        // Actualizar contador de attachments
        setAttachmentsCount(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
        await actions.updateCandidate(updatedCandidate, state.currentUser?.name);
        if(previewFile?.id === id) setPreviewFile(null);
    };
    
    const handleUpdateAttachmentCategory = async (attachmentId: string, newCategoryId: string) => {
        const loadingToastId = actions.showToast('Actualizando categoría...', 'loading', 0);
        try {
            // Obtener el candidato más reciente del estado para asegurar que tenemos los datos actualizados
            const currentCandidateFromState = state.candidates.find(c => c.id === initialCandidate.id) || editableCandidate;
            
            // Actualizar attachments localmente
            const updatedAttachments = (currentCandidateFromState.attachments || []).map(att => 
                att.id === attachmentId 
                    ? { ...att, category: newCategoryId || undefined }
                    : att
            );
            
            // Crear candidato actualizado con los attachments modificados
            const updatedCandidate = { 
                ...currentCandidateFromState, 
                attachments: updatedAttachments 
            };
            
            // Guardar en la base de datos (esto ya actualiza el estado global)
            await actions.updateCandidate(updatedCandidate, state.currentUser?.name);
            
            // Actualizar estado local inmediatamente para reflejar el cambio
            setEditableCandidate(updatedCandidate);
            
            // NO recargar candidatos del estado global aquí porque puede sobrescribir los cambios
            // actions.updateCandidate ya actualiza el estado global correctamente
            
            setEditingAttachmentCategory(null);
            setSelectedCategoryForEdit('');
            actions.hideToast(loadingToastId);
            actions.showToast('Categoría actualizada exitosamente', 'success', 3000);
        } catch (error: any) {
            console.error('Error actualizando categoría:', error);
            actions.hideToast(loadingToastId);
            actions.showToast(`Error al actualizar la categoría: ${error.message || 'Error desconocido'}`, 'error', 5000);
        }
    };
    
    const openScheduler = (event: InterviewEvent | null = null) => {
        setEditingEvent(event);
        setIsScheduling(true);
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (window.confirm('¿Seguro que deseas eliminar esta entrevista?')) {
            await actions.deleteInterviewEvent(eventId);
        }
    };

    const handleArchiveToggle = async () => {
        if (isArchived) {
            await actions.restoreCandidate(initialCandidate.id);
        } else {
            const confirmArchive = window.confirm('¿Deseas archivar a este candidato? No aparecerá en el board hasta que lo restaures.');
            if (!confirmArchive) return;
            await actions.archiveCandidate(initialCandidate.id);
        }
        onClose();
    };

    const handleDeleteCandidate = async () => {
        const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar a ${currentCandidate.name}? Esta acción no se puede deshacer y también se eliminará su carpeta en Google Drive si existe.`);
        if (!confirmDelete) return;
        
        try {
            // Si el candidato tiene carpeta en Google Drive, eliminarla
            if (currentCandidate.googleDriveFolderId && state.settings?.googleDrive?.connected) {
                try {
                    const { googleDriveService } = await import('../lib/googleDrive');
                    googleDriveService.initialize(state.settings.googleDrive);
                    await googleDriveService.deleteFolder(currentCandidate.googleDriveFolderId!);
                    console.log(`✅ Carpeta del candidato eliminada de Google Drive`);
                } catch (error: any) {
                    console.error('Error eliminando carpeta de Google Drive:', error);
                    // Continuar con la eliminación aunque falle la eliminación de la carpeta
                }
            }
            
            await actions.deleteCandidate(currentCandidate.id);
            onClose();
        } catch (error: any) {
            console.error('Error eliminando candidato:', error);
            alert(`Error al eliminar candidato: ${error.message}`);
        }
    };

    const handleExportZip = async () => {
        try {
            setIsExporting(true);
            const zip = new JSZip();
            const infoFolder = zip.folder('informacion');
            const attachmentsFolder = zip.folder('adjuntos');

            const stageName = processStages.find(stage => stage.id === currentCandidate.stageId)?.name || 'Etapa desconocida';
            const candidateInfo = {
                id: currentCandidate.id,
                name: currentCandidate.name,
                email: currentCandidate.email,
                phone: currentCandidate.phone,
                process: process?.title || '',
                stage: stageName,
                archived: currentCandidate.archived || false,
                archivedAt: currentCandidate.archivedAt,
                hireDate: currentCandidate.hireDate,
                description: currentCandidate.description,
                source: currentCandidate.source,
                salaryExpectation: currentCandidate.salaryExpectation,
                agreedSalary: currentCandidate.agreedSalary,
                age: currentCandidate.age,
                dni: currentCandidate.dni,
                linkedinUrl: currentCandidate.linkedinUrl,
                address: currentCandidate.address,
                province: currentCandidate.province,
                district: currentCandidate.district,
                history: currentCandidate.history,
                postIts: currentCandidate.postIts,
                comments: currentCandidate.comments?.map(comment => ({
                    ...comment,
                    attachments: comment.attachments?.map(att => ({
                        id: att.id,
                        name: att.name,
                        type: att.type,
                        size: att.size,
                        path: `adjuntos/comentarios/${comment.id}/${att.name}`
                    }))
                })),
                attachments: currentCandidate.attachments.map(att => ({
                    id: att.id,
                    name: att.name,
                    type: att.type,
                    size: att.size,
                    path: `adjuntos/${att.name}`
                })),
            };

            infoFolder?.file('candidate.json', JSON.stringify(candidateInfo, null, 2));

            // Candidate attachments
            if (currentCandidate.attachments.length && attachmentsFolder) {
                await Promise.all(
                    currentCandidate.attachments.map(att => addAttachmentToZip(attachmentsFolder, att))
                );
            }

            // Comment attachments
            if (currentCandidate.comments && attachmentsFolder) {
                for (const comment of currentCandidate.comments) {
                    if (!comment.attachments || !comment.attachments.length) continue;
                    const commentFolder = attachmentsFolder.folder(`comentarios/${comment.id}`);
                    if (!commentFolder) continue;
                    await Promise.all(comment.attachments.map(att => addAttachmentToZip(commentFolder, att)));
                }
            }

            const blob = await zip.generateAsync({ type: 'blob' });
            const safeName = currentCandidate.name.replace(/[^a-z0-9_-]/gi, '_');
            saveAs(blob, `${safeName || currentCandidate.id}_info.zip`);
        } catch (error) {
            console.error('Error exporting candidate ZIP:', error);
            alert('No se pudo exportar la información. Intenta nuevamente.');
        } finally {
            setIsExporting(false);
        }
    };

    if (!process) return null;
    
    const TabButton: React.FC<{tabId: 'details' | 'history' | 'schedule' | 'comments' | 'documents', children: React.ReactNode}> = ({tabId, children}) => (
        <button 
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tabId ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >{children}</button>
    );

    return (
        <>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto max-w-[1400px] flex flex-col max-h-screen md:max-h-[92vh]">
                <header className="p-3 md:p-4 border-b flex flex-col md:flex-row md:justify-between md:items-center gap-3 flex-shrink-0">
                    <div className="flex items-center space-x-4">
                        <div className="relative group">
                             {currentCandidate.avatarUrl ? (
                                <img src={currentCandidate.avatarUrl} alt={currentCandidate.name} className="w-16 h-16 rounded-full object-cover" />
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                                    <User className="w-8 h-8 text-gray-500" />
                                </div>
                            )}
                            <button onClick={() => avatarInputRef.current?.click()} className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload className="w-6 h-6" />
                            </button>
                            <input type="file" accept="image/*" ref={avatarInputRef} onChange={handleAvatarUpload} className="hidden" />
                        </div>
                        <div>
                            <div className="flex items-center space-x-2 md:space-x-3 flex-wrap">
                                <h2 className="text-xl md:text-2xl font-bold text-gray-800 break-words">{currentCandidate.name}</h2>
                                {isArchived && (
                                    <span className="px-2 md:px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold whitespace-nowrap">
                                        Archivado
                                    </span>
                                )}
                            </div>
                    <p className="text-xs md:text-sm text-gray-500 truncate">Postulado a: {process.title}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleExportZip}
                            disabled={isExporting}
                            className="flex items-center px-2 md:px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm text-xs md:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4 md:mr-2" />
                            <span className="hidden sm:inline">{isExporting ? 'Exportando...' : 'Exportar ZIP'}</span>
                            <span className="sm:hidden">ZIP</span>
                        </button>
                        {canEdit && (
                            <>
                                <button
                                    onClick={handleArchiveToggle}
                                    className={`flex items-center px-2 md:px-3 py-1.5 border rounded-md text-xs md:text-sm font-medium ${isArchived ? 'border-green-200 text-green-700 hover:bg-green-50' : 'border-amber-200 text-amber-700 hover:bg-amber-50'}`}
                                >
                                    {isArchived ? <Undo2 className="w-4 h-4 md:mr-2" /> : <Archive className="w-4 h-4 md:mr-2" />}
                                    <span className="hidden sm:inline">{isArchived ? 'Restaurar' : 'Archivar'}</span>
                                </button>
                                {!isArchived && (
                                    <button
                                        onClick={() => setIsDiscardModalOpen(true)}
                                        className="flex items-center px-2 md:px-3 py-1.5 border border-red-200 text-red-700 rounded-md text-xs md:text-sm font-medium hover:bg-red-50"
                                    >
                                        <X className="w-4 h-4 md:mr-2" />
                                        <span className="hidden sm:inline">Descartar</span>
                                    </button>
                                )}
                                <button
                                    onClick={handleDeleteCandidate}
                                    className="flex items-center px-2 md:px-3 py-1.5 bg-red-600 text-white border border-red-600 rounded-md text-xs md:text-sm font-medium hover:bg-red-700"
                                >
                                    <Trash2 className="w-4 h-4 md:mr-2" />
                                    <span className="hidden sm:inline">Eliminar</span>
                                </button>
                            </>
                        )}
                        {canEdit && !isEditing && (
                            <>
                        <button onClick={() => setIsChangeProcessModalOpen(true)} className="flex items-center px-2 md:px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm text-xs md:text-sm font-medium text-gray-700 hover:bg-gray-50" title="Mover o duplicar candidato">
                                    <ArrowRightLeft className="w-4 h-4" />
                                </button>
                                <button onClick={() => setIsEditing(true)} className="flex items-center px-2 md:px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm text-xs md:text-sm font-medium text-gray-700 hover:bg-gray-50">
                            <Edit className="w-4 h-4 md:mr-2" /> <span className="hidden sm:inline">Editar</span>
                                </button>
                            </>
                        )}
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 flex-shrink-0"><X className="w-5 h-5" /></button>
                    </div>
                </header>
                 <div className="border-b flex-shrink-0">
                    <nav className="flex space-x-2 md:space-x-4 px-3 md:px-6 overflow-x-auto scrollbar-hide">
                <TabButton tabId="details">Detalles</TabButton>
                <TabButton tabId="history">Historial</TabButton>
                <TabButton tabId="schedule">Agenda</TabButton>
                        <TabButton tabId="comments">
                            Comentarios
                            {initialCandidate.comments && initialCandidate.comments.length > 0 && (
                                <span className="ml-2 px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full">
                                    {initialCandidate.comments.length}
                                </span>
                            )}
                        </TabButton>
                        <TabButton tabId="documents">Documentos</TabButton>
                    </nav>
                </div>
                <main className="flex-1 overflow-y-auto">
                   {activeTab === 'details' && (
                        <div className="p-3 md:p-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[0.8fr_1.8fr] gap-4 md:gap-6">
                            {/* Left Column - Details */}
                            <div className="space-y-6">
                                {isEditing ? (
                                    <>
                                        {/* Edit Form */}
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div><label className="block text-sm font-medium text-gray-700">Nombre completo</label><input type="text" name="name" value={editableCandidate.name} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                                <div><label className="block text-sm font-medium text-gray-700">Correo</label><input type="email" name="email" value={editableCandidate.email} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                                <div><label className="block text-sm font-medium text-gray-700">Teléfono</label><input type="tel" name="phone" value={editableCandidate.phone || ''} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                                <div><label className="block text-sm font-medium text-gray-700">Teléfono 2</label><input type="tel" name="phone2" value={editableCandidate.phone2 || ''} onChange={handleInputChange} className="mt-1 block w-full input" placeholder="Opcional"/></div>
                                                <div><label className="block text-sm font-medium text-gray-700">Edad</label><input type="number" name="age" value={editableCandidate.age || ''} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                                <div><label className="block text-sm font-medium text-gray-700">DNI</label><input type="text" name="dni" value={editableCandidate.dni || ''} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                                <div><label className="block text-sm font-medium text-gray-700">Dirección / ciudad</label><input type="text" name="address" value={editableCandidate.address || ''} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <SearchableSelect
                                                        label="Provincia"
                                                        options={state.settings?.provinces && state.settings.provinces.length > 0 
                                                            ? state.settings.provinces 
                                                            : ['Lima', 'Arequipa', 'Cusco', 'La Libertad', 'Piura']}
                                                        value={editableCandidate.province || ''}
                                                        onChange={handleProvinceChange}
                                                        placeholder="Seleccionar provincia"
                                                        searchPlaceholder="Buscar provincia..."
                                                        className="mt-1"
                                                    />
                                                </div>
                                                <div>
                                                    <SearchableSelect
                                                        label="Distrito"
                                                        options={editableCandidate.province && state.settings?.districts?.[editableCandidate.province] && state.settings.districts[editableCandidate.province].length > 0
                                                            ? state.settings.districts[editableCandidate.province]
                                                            : []}
                                                        value={editableCandidate.district || ''}
                                                        onChange={(value) => setEditableCandidate(prev => ({ ...prev, district: value }))}
                                                        placeholder="Seleccionar distrito"
                                                        searchPlaceholder="Buscar distrito..."
                                                        disabled={!editableCandidate.province}
                                                        className="mt-1"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Fecha de contratación</label>
                                                    <input
                                                        type="date"
                                                        name="hireDate"
                                                        value={editableCandidate.hireDate || ''}
                                                        onChange={handleInputChange}
                                                        disabled={!canEditHireDate}
                                                        className={`mt-1 block w-full input ${!canEditHireDate ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                                    />
                                                    {!canEditHireDate && (
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Disponible cuando el candidato supere la etapa de “Presentación”.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div><label className="block text-sm font-medium text-gray-700">URL de LinkedIn</label><input type="url" name="linkedinUrl" value={editableCandidate.linkedinUrl || ''} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div><label className="block text-sm font-medium text-gray-700">Fuente</label>
                                                    <select name="source" value={editableCandidate.source || ''} onChange={handleInputChange} className="mt-1 block w-full input">
                                                        {(state.settings?.candidateSources && state.settings.candidateSources.length > 0 
                                                            ? state.settings.candidateSources 
                                                            : ['LinkedIn', 'Referencia', 'Sitio web', 'Otro']
                                                        ).map(opt => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div><label className="block text-sm font-medium text-gray-700">Expectativa salarial</label><input type="text" name="salaryExpectation" value={editableCandidate.salaryExpectation || ''} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                                <div><label className="block text-sm font-medium text-gray-700">Salario acordado</label><input type="text" name="agreedSalary" value={editableCandidate.agreedSalary || ''} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                            </div>
                                            <div><label className="block text-sm font-medium text-gray-700">Resumen</label><textarea name="description" rows={3} value={editableCandidate.description || ''} onChange={handleInputChange} className="mt-1 block w-full input" /></div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* View Details */}
                                        {/* Selector de Etapa y Toggle de Visibilidad - Siempre visible para admin/recruiter */}
                                        {canEdit && (
                                            <div className="space-y-4 mb-6">
                                                {/* Selector de Etapa */}
                                                {processStages.length > 0 && (
                                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                                            Etapa actual
                                                        </label>
                                                        <select 
                                                            value={currentCandidate.stageId} 
                                                            onChange={handleStageChange}
                                                            className="mt-1 block w-full input bg-white"
                                                        >
                                                            {processStages.map((stage) => (
                                                                <option key={stage.id} value={stage.id}>
                                                                    {stage.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <p className="mt-2 text-xs text-gray-600">
                                                            También puedes arrastrar el candidato entre etapas en el tablero del proceso.
                                                        </p>
                                                    </div>
                                                )}
                                                
                                                {/* Toggle de Visibilidad para Clientes/Viewers */}
                                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            Visible para clientes/viewers
                                                        </label>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Si está activado, los usuarios tipo cliente y viewer podrán ver este candidato.
                                                        </p>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={currentCandidate.visibleToClients || false}
                                                            onChange={handleVisibilityToggle}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="p-4 bg-gray-50 rounded-lg border">
                                            <h3 className="font-semibold text-gray-700 mb-3">Contacto e información personal</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <DetailItem icon={Mail} label="Correo" value={currentCandidate.email} href={`mailto:${currentCandidate.email}`} />
                                                <div className="flex flex-col">
                                                    <div className="flex items-start text-sm">
                                                        <Phone className="w-4 h-4 mr-3 mt-0.5 text-gray-400 flex-shrink-0" />
                                                        <div className="flex-1">
                                                            <span className="font-medium text-gray-700">Teléfono: </span>
                                                            <span className="text-gray-600">{currentCandidate.phone || 'N/D'}</span>
                                                        </div>
                                                    </div>
                                                    {currentCandidate.phone && (
                                                        <div className="flex flex-wrap items-center gap-2 mt-2 ml-7">
                                                            <button
                                                                onClick={handleCopyPhone}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                            >
                                                                <Copy className="w-3.5 h-3.5" /> Copiar
                                                            </button>
                                                            <a
                                                                href={`tel:${currentCandidate.phone}`}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-primary-200 text-xs font-medium text-primary-700 hover:bg-primary-50"
                                                            >
                                                                <Phone className="w-3.5 h-3.5" /> Llamar
                                                            </a>
                                                            <a
                                                                href={`https://wa.me/${normalizedPhone}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-green-200 text-xs font-medium text-green-700 hover:bg-green-50"
                                                            >
                                                                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                                                            </a>
                                                            <a
                                                                href={`whatsapp://call?phone=${normalizedPhone}`}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-green-200 text-xs font-medium text-green-700 hover:bg-green-50"
                                                            >
                                                                <PhoneCall className="w-3.5 h-3.5" /> Llamada WA
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                                {currentCandidate.phone2 && (
                                                    <div className="flex flex-col">
                                                        <div className="flex items-start text-sm">
                                                            <Phone className="w-4 h-4 mr-3 mt-0.5 text-gray-400 flex-shrink-0" />
                                                            <div className="flex-1">
                                                                <span className="font-medium text-gray-700">Teléfono 2: </span>
                                                                <span className="text-gray-600">{currentCandidate.phone2}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 mt-2 ml-7">
                                                            <button
                                                                onClick={handleCopyPhone2}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                            >
                                                                <Copy className="w-3.5 h-3.5" /> Copiar
                                                            </button>
                                                            <a
                                                                href={`tel:${currentCandidate.phone2}`}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-primary-200 text-xs font-medium text-primary-700 hover:bg-primary-50"
                                                            >
                                                                <Phone className="w-3.5 h-3.5" /> Llamar
                                                            </a>
                                                            <a
                                                                href={`https://wa.me/${normalizedPhone2}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-green-200 text-xs font-medium text-green-700 hover:bg-green-50"
                                                            >
                                                                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                                                            </a>
                                                            <a
                                                                href={`whatsapp://call?phone=${normalizedPhone2}`}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-green-200 text-xs font-medium text-green-700 hover:bg-green-50"
                                                            >
                                                                <PhoneCall className="w-3.5 h-3.5" /> Llamada WA
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                                <DetailItem icon={Linkedin} label="LinkedIn" value={currentCandidate.linkedinUrl} href={currentCandidate.linkedinUrl} />
                                                <DetailItem icon={Calendar} label="Edad" value={currentCandidate.age} />
                                                <DetailItem icon={Info} label="DNI" value={currentCandidate.dni} />
                                                <DetailItem icon={Briefcase} label="Fuente" value={currentCandidate.source} />
                                                <DetailItem icon={MapPin} label="Dirección" value={currentCandidate.address} />
                                                <DetailItem icon={MapPin} label="Provincia" value={currentCandidate.province} />
                                                <DetailItem icon={MapPin} label="Distrito" value={currentCandidate.district} />
                                                <DetailItem icon={DollarSign} label="Expectativa salarial" value={currentCandidate.salaryExpectation ? `${state.settings?.currencySymbol || ''}${currentCandidate.salaryExpectation.replace(/[$\€£S/]/g, '').trim()}` : 'N/D'} />
                                                <DetailItem icon={DollarSign} label="Salario acordado" value={currentCandidate.agreedSalary ? `${state.settings?.currencySymbol || ''}${currentCandidate.agreedSalary.replace(/[$\€£S/]/g, '').trim()}` : 'N/D'} />
                                                    <DetailItem icon={Calendar} label="Fecha de contratación" value={currentCandidate.hireDate ? new Date(currentCandidate.hireDate).toLocaleDateString('es-ES') : undefined} />
                                                    <DetailItem icon={Calendar} label="Fecha de aceptación de oferta" value={currentCandidate.offerAcceptedDate ? new Date(currentCandidate.offerAcceptedDate).toLocaleDateString('es-ES') : undefined} />
                                                    <DetailItem icon={Calendar} label="Fecha de inicio de solicitud" value={currentCandidate.applicationStartedDate ? new Date(currentCandidate.applicationStartedDate).toLocaleDateString('es-ES') : undefined} />
                                                    <DetailItem icon={Calendar} label="Fecha de finalización de solicitud" value={currentCandidate.applicationCompletedDate ? new Date(currentCandidate.applicationCompletedDate).toLocaleDateString('es-ES') : undefined} />
                                            </div>
                                        </div>
                                        {currentCandidate.description && (
                                            <div>
                                                <h3 className="font-semibold text-gray-700 mb-2">Resumen</h3>
                                                <p className="text-sm text-gray-600 whitespace-pre-wrap">{currentCandidate.description}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                                
                                <div className="flex flex-col h-full max-w-full">
                                    <h3 className="font-semibold text-gray-700 mb-2">
                                        Adjuntos {attachmentsCount !== null && `(${attachmentsCount})`}
                                    </h3>
                                    {!attachmentsLoaded ? (
                                        <div className="space-y-2">
                                            {attachmentsCount !== null && attachmentsCount > 0 ? (
                                                <div className="p-4 border rounded-md bg-gray-50 text-center">
                                                    <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                                    <p className="text-sm text-gray-600 mb-3">
                                                        {attachmentsCount} {attachmentsCount === 1 ? 'documento' : 'documentos'} disponible{attachmentsCount === 1 ? '' : 's'}
                                                    </p>
                                                    <button
                                                        onClick={async () => {
                                                            setIsLoadingAttachments(true);
                                                            try {
                                                                const { candidatesApi } = await import('../lib/api/candidates');
                                                                const attachments = await candidatesApi.getAttachments(currentCandidate.id);
                                                                setEditableCandidate(prev => ({
                                                                    ...prev,
                                                                    attachments: attachments
                                                                }));
                                                                setAttachmentsLoaded(true);
                                                                if (attachments.length > 0 && !previewFile) {
                                                                    setPreviewFile(attachments[0]);
                                                                }
                                                            } catch (error) {
                                                                console.error('Error cargando attachments:', error);
                                                                actions.showToast('Error al cargar documentos', 'error', 3000);
                                                            } finally {
                                                                setIsLoadingAttachments(false);
                                                            }
                                                        }}
                                                        disabled={isLoadingAttachments}
                                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                                            isLoadingAttachments
                                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                                : 'bg-primary-600 text-white hover:bg-primary-700'
                                                        }`}
                                                    >
                                                        {isLoadingAttachments ? 'Cargando...' : 'Ver documentos'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-500 text-center py-4">No hay documentos adjuntos</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                            {editableCandidate.attachments && editableCandidate.attachments.length > 0 ? editableCandidate.attachments.map(att => (
                                                <div key={att.id} className="flex items-center justify-between p-2 rounded-md border bg-white hover:bg-gray-50">
                                                    <div className="flex items-center overflow-hidden flex-1 min-w-0">
                                                        <FileText className="w-5 h-5 mr-3 text-gray-500 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-800 truncate">{att.name}</p>
                                                            {att.url && (
                                                                <a 
                                                                    href={att.url} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs text-primary-600 hover:underline truncate block"
                                                                >
                                                                    {att.url.startsWith('https://drive.google.com') ? 'Ver en Google Drive' : 'Ver documento'}
                                                                </a>
                                                            )}
                                                            {att.category && process?.documentCategories && (
                                                                <span className="text-xs text-gray-500 mt-1 block">
                                                                    Categoría: {process.documentCategories.find(c => c.id === att.category)?.name || 'Sin categoría'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-1 flex-shrink-0">
                                                        {canEdit && (
                                                            <button 
                                                                onClick={() => {
                                                                    setEditingAttachmentCategory(att.id);
                                                                    setSelectedCategoryForEdit(att.category || '');
                                                                }} 
                                                                className="p-1 rounded-md hover:bg-blue-100" 
                                                                title="Editar categoría"
                                                            >
                                                                <Edit className="w-4 h-4 text-blue-600" />
                                                            </button>
                                                        )}
                                                        <button onClick={() => setPreviewFile(att)} className="p-1 rounded-md hover:bg-gray-200" title="Previsualizar"><Eye className="w-4 h-4 text-gray-600" /></button>
                                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded-md hover:bg-gray-200" title="Abrir"><Download className="w-4 h-4 text-gray-600" /></a>
                                                        <button onClick={() => handleDeleteAttachment(att.id)} className="p-1 rounded-md hover:bg-red-100" title="Eliminar"><Trash2 className="w-4 h-4 text-red-500" /></button>
                                                    </div>
                                                </div>
                                            )) : (
                                                <p className="text-sm text-gray-500 text-center py-4">No hay documentos adjuntos</p>
                                            )}
                                        </div>
                                    )}
                                    <input type="file" ref={attachmentInputRef} onChange={handleAttachmentUpload} className="hidden" />
                                    <div className="mt-2 space-y-2">
                                        <button 
                                            type="button" 
                                            onClick={() => attachmentInputRef.current?.click()} 
                                            disabled={isUploading}
                                            className={`flex items-center text-sm font-medium ${
                                                isUploading 
                                                    ? 'text-gray-400 cursor-not-allowed' 
                                                    : 'text-primary-600 hover:text-primary-800'
                                            }`}
                                        >
                                            <Upload className="w-4 h-4 mr-1" /> 
                                            {isUploading ? `Subiendo ${uploadingFileName}...` : 'Subir documento'}
                                        </button>
                                        {(() => {
                                            const googleDriveConfig = state.settings?.googleDrive;
                                            const isGoogleDriveConnected = googleDriveConfig?.connected && googleDriveConfig?.accessToken;
                                            const currentProcess = state.processes.find(p => p.id === currentCandidate.processId);
                                            const hasGoogleDriveFolder = currentProcess?.googleDriveFolderId;
                                            
                                            const candidateHasFolder = currentCandidate.googleDriveFolderId;
                                            const targetFolderName = candidateHasFolder 
                                                ? currentCandidate.googleDriveFolderName || 'Carpeta del candidato'
                                                : currentProcess?.googleDriveFolderName || 'Carpeta del proceso';
                                            
                                            if (isGoogleDriveConnected && (hasGoogleDriveFolder || candidateHasFolder)) {
                                                return (
                                                    <p className="text-xs text-green-600 flex items-center">
                                                        <Info className="w-3 h-3 mr-1" />
                                                        Los archivos se subirán a Google Drive: <strong>{targetFolderName}</strong>
                                                        {candidateHasFolder && currentProcess?.googleDriveFolderName && (
                                                            <span className="ml-1 text-xs">(dentro de {currentProcess.googleDriveFolderName})</span>
                                                        )}
                                                    </p>
                                                );
                                            } else if (isGoogleDriveConnected && !hasGoogleDriveFolder) {
                                                return (
                                                    <p className="text-xs text-orange-600 flex items-center">
                                                        <Info className="w-3 h-3 mr-1" />
                                                        ⚠️ Google Drive está conectado pero este proceso no tiene carpeta configurada. Los archivos se guardarán localmente. Ve a <strong>Procesos → Editar Proceso</strong> para configurar una carpeta.
                                                    </p>
                                                );
                                            } else {
                                                return (
                                                    <p className="text-xs text-gray-500 flex items-center">
                                                        <Info className="w-3 h-3 mr-1" />
                                                        Los archivos se guardarán localmente (Base64). Conecta Google Drive en <strong>Configuración</strong> para usar almacenamiento en la nube.
                                                    </p>
                                                );
                                            }
                                        })()}
                                    </div>
                                </div>
                            </div>
                            {/* Right Column - Preview */}
                            <div className="bg-gray-100 rounded-xl border flex flex-col items-center justify-center p-4 min-h-[620px]">
                                {previewFile ? (
                                    <div className="w-full h-full">
                                    {previewFile.type.startsWith('image/') ? (
                                        <img src={previewFile.url} alt={previewFile.name} className="w-full h-full object-contain" />
                                    ) : previewFile.type === 'application/pdf' || previewFile.url.includes('drive.google.com') ? (
                                        <iframe 
                                            src={previewFile.url.includes('drive.google.com') 
                                                ? previewFile.url.replace('/view', '/preview').replace('/file/d/', '/file/d/')
                                                : previewFile.url
                                            } 
                                            title={previewFile.name} 
                                            className="w-full h-full border-0 rounded-lg bg-white"
                                            allow="fullscreen"
                                        />
                                    ) : (
                                        <div className="text-center p-8">
                                            <FileText className="w-16 h-16 mx-auto text-gray-400" />
                                            <p className="mt-2 text-gray-600">No hay vista previa disponible para este tipo de archivo.</p>
                                            <a 
                                                href={previewFile.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="mt-4 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                            >
                                                <Download className="w-4 h-4 mr-2" /> {previewFile.url.includes('drive.google.com') ? 'Abrir en Google Drive' : `Descargar "${previewFile.name}"`}
                                            </a>
                                        </div>
                                    )}
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-500">
                                        <Eye className="w-12 h-12 mx-auto mb-2" />
                                        <p>Selecciona un archivo para previsualizar</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'history' && (
                        <div className="p-6">
                             <ul className="border rounded-lg overflow-hidden">
                                <li className="p-3 bg-gray-50 font-medium text-sm grid grid-cols-3">
                                    <span>Etapa</span>
                                    <span className="text-center">Movido por</span>
                                    <span className="text-right">Fecha</span>
                                </li>
                                {initialCandidate.history.length > 0 ? initialCandidate.history.slice().reverse().map((h, index) => (
                                    <li key={index} className="p-3 border-t grid grid-cols-3 items-center">
                                        <p className="font-medium text-gray-800">{process.stages.find(s => s.id === h.stageId)?.name || 'Desconocido'}</p>
                                        <p className="text-sm text-gray-500 text-center">{h.movedBy}</p>
                                        <p className="text-sm text-gray-500 text-right">{new Date(h.movedAt).toLocaleString()}</p>
                                    </li>
                                )) : (
                                    <li className="p-6 text-center text-gray-500">No hay historial.</li>
                                )}
                             </ul>
                        </div>
                    )}
                    {activeTab === 'schedule' && (
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">Entrevistas programadas</h3>
                                <button onClick={() => openScheduler()} className="flex items-center px-3 py-1.5 bg-primary-600 text-white rounded-md shadow-sm hover:bg-primary-700 text-sm">
                                    <Calendar className="w-4 h-4 mr-2" /> Programar nueva
                                </button>
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                                {candidateEvents.length > 0 ? (
                                    <ul>
                                         {candidateEvents.sort((a,b) => b.start.getTime() - a.start.getTime()).map(event => (
                                            <li key={event.id} className="p-3 border-b last:border-b-0 grid grid-cols-4 items-center gap-4">
                                                <div>
                                                    <p className="font-medium text-gray-900">{event.title}</p>
                                                    <p className="text-xs text-gray-500">con {state.users.find(u => u.id === event.interviewerId)?.name || 'Desconocido'}</p>
                                                </div>
                                                <p className="text-sm text-gray-600">{event.start.toLocaleString()}</p>
                                                <p className="text-sm text-gray-600 italic truncate">{event.notes}</p>
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button onClick={() => openScheduler(event)} className="p-1.5 rounded-md hover:bg-gray-100"><Edit className="w-4 h-4 text-gray-600"/></button>
                                                    <button onClick={() => handleDeleteEvent(event.id)} className="p-1.5 rounded-md hover:bg-red-100"><Trash2 className="w-4 h-4 text-red-500"/></button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="p-8 text-center text-gray-500">No hay entrevistas programadas para este candidato.</div>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'documents' && process && (
                        <div className="p-6">
                            <DocumentChecklist candidate={currentCandidate} process={process} />
                        </div>
                    )}
                    {activeTab === 'comments' && (
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">Comentarios y Conversaciones</h3>
                                <button
                                    onClick={() => setIsCommentsModalOpen(true)}
                                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium"
                                >
                                    Ver todos los comentarios
                                </button>
                            </div>
                            
                            {initialCandidate.comments && initialCandidate.comments.length > 0 ? (
                                <div className="space-y-4">
                                    {initialCandidate.comments.slice(-5).reverse().map((comment) => {
                                        const user = state.users.find(u => u.id === comment.userId);
                                        return (
                                            <div key={comment.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-semibold text-sm text-gray-800">
                                                        {user?.name || 'Usuario desconocido'}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {new Date(comment.createdAt).toLocaleDateString('es-ES', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                                {comment.text && (
                                                    <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">
                                                        {comment.text}
                                                    </p>
                                                )}
                                                {comment.attachments && comment.attachments.length > 0 && (
                                                    <div className="flex gap-2 mt-2">
                                                        {comment.attachments.slice(0, 3).map((att) => (
                                                            <img
                                                                key={att.id}
                                                                src={att.url}
                                                                alt={att.name}
                                                                className="w-16 h-16 object-cover rounded border border-gray-200"
                                                            />
                                                        ))}
                                                        {comment.attachments.length > 3 && (
                                                            <div className="w-16 h-16 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-xs text-gray-500">
                                                                +{comment.attachments.length - 3}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {initialCandidate.comments.length > 5 && (
                                        <p className="text-center text-sm text-gray-500">
                                            Mostrando los últimos 5 comentarios. 
                                            <button
                                                onClick={() => setIsCommentsModalOpen(true)}
                                                className="ml-1 text-primary-600 hover:underline"
                                            >
                                                Ver todos ({initialCandidate.comments.length})
                                            </button>
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                                    <p className="text-gray-500 mb-4">No hay comentarios aún</p>
                                    <button
                                        onClick={() => setIsCommentsModalOpen(true)}
                                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium"
                                    >
                                        Agregar primer comentario
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </main>
                {isEditing && (
                    <footer className="p-4 bg-gray-50 border-t flex justify-end space-x-3 flex-shrink-0">
                        <button type="button" onClick={handleCancelEdit} className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium">Cancelar</button>
                        <button type="button" onClick={handleSaveChanges} className="px-4 py-2 bg-primary-600 text-white rounded-md shadow-sm text-sm font-medium">Guardar cambios</button>
                    </footer>
                )}
            </div>
             <style>{`.input { padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }`}</style>
        </div>
        {isScheduling && <ScheduleInterviewModal event={editingEvent} defaultCandidateId={initialCandidate.id} onClose={() => setIsScheduling(false)} />}
        {isChangeProcessModalOpen && <ChangeProcessModal candidate={initialCandidate} onClose={() => setIsChangeProcessModalOpen(false)} />}
        {isCommentsModalOpen && <CandidateCommentsModal candidateId={initialCandidate.id} onClose={() => setIsCommentsModalOpen(false)} />}
        
        {/* Modal para seleccionar categoría de documento */}
        {showCategoryModal && process && pendingFile && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                    <div className="p-6 border-b">
                        <h3 className="text-lg font-semibold text-gray-800">Seleccionar categoría de documento</h3>
                        <p className="text-sm text-gray-600 mt-1">Archivo: {pendingFile.name}</p>
                    </div>
                    <div className="p-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Categoría *
                        </label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm mb-4"
                        >
                            <option value="">Selecciona una categoría</option>
                            {process.documentCategories?.map(cat => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name} {cat.required && '(Requerido)'}
                                </option>
                            ))}
                        </select>
                        {process.documentCategories && process.documentCategories.length === 0 && (
                            <p className="text-sm text-gray-500 mb-4">
                                No hay categorías definidas. El documento se subirá sin categoría.
                            </p>
                        )}
                    </div>
                    <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end gap-2">
                        <button
                            onClick={() => {
                                setShowCategoryModal(false);
                                setPendingFile(null);
                                setSelectedCategory('');
                            }}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmCategory}
                            disabled={!selectedCategory && process.documentCategories && process.documentCategories.length > 0}
                            className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                            Subir documento
                        </button>
                    </div>
                </div>
            </div>
        )}
            {isDiscardModalOpen && (
                <DiscardCandidateModal
                    candidateId={initialCandidate.id}
                    candidateName={initialCandidate.name}
                    onClose={() => setIsDiscardModalOpen(false)}
                    onDiscard={async (reason) => {
                        await actions.discardCandidate(initialCandidate.id, reason);
                        setIsDiscardModalOpen(false);
                        onClose(); // Cerrar el modal de detalles después de descartar
                    }}
                />
            )}
            
            {/* Modal para editar categoría de documento existente */}
            {editingAttachmentCategory && process && (() => {
                const attachment = editableCandidate.attachments.find(att => att.id === editingAttachmentCategory);
                if (!attachment) return null;
                
                return (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                            <div className="p-6 border-b flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800">Editar categoría de documento</h3>
                                    <p className="text-sm text-gray-600 mt-1">Archivo: {attachment.name}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setEditingAttachmentCategory(null);
                                        setSelectedCategoryForEdit('');
                                    }}
                                    className="p-2 rounded-full hover:bg-gray-100"
                                >
                                    <X className="w-5 h-5 text-gray-600" />
                                </button>
                            </div>
                            <div className="p-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Categoría
                                </label>
                                <select
                                    value={selectedCategoryForEdit}
                                    onChange={(e) => setSelectedCategoryForEdit(e.target.value)}
                                    className="w-full border-gray-300 rounded-md shadow-sm mb-4"
                                >
                                    <option value="">Sin categoría</option>
                                    {process.documentCategories?.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name} {cat.required && '(Requerido)'}
                                        </option>
                                    ))}
                                </select>
                                {process.documentCategories && process.documentCategories.length === 0 && (
                                    <p className="text-sm text-gray-500 mb-4">
                                        No hay categorías definidas para este proceso.
                                    </p>
                                )}
                            </div>
                            <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end gap-2">
                                <button
                                    onClick={() => {
                                        setEditingAttachmentCategory(null);
                                        setSelectedCategoryForEdit('');
                                    }}
                                    className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleUpdateAttachmentCategory(attachment.id, selectedCategoryForEdit)}
                                    className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700"
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </>
    );
};