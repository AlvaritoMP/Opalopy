import React, { useState, useRef, useEffect } from 'react';
import { useAppState } from '../App';
import { Process, Attachment, Candidate } from '../types';
import { X, Upload, FileText, Trash2, User } from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';

interface AddCandidateModalProps {
    process: Process;
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

export const AddCandidateModal: React.FC<AddCandidateModalProps> = ({ process, onClose }) => {
    const { state, actions, getLabel } = useAppState();
    const getDefaultSource = (): Candidate['source'] => {
        // Validar que candidateSources sea un array válido
        const candidateSources = state.settings?.candidateSources;
        const isValidArray = Array.isArray(candidateSources) && candidateSources.length > 0;
        const sources = isValidArray
            ? candidateSources
            : ['LinkedIn', 'Referencia', 'Sitio web', 'Otro'];
        
        // Log para debuggear
        if (!isValidArray && candidateSources !== undefined) {
            console.warn('⚠️ candidateSources no es un array válido:', candidateSources, 'Type:', typeof candidateSources);
        }
        
        return sources[0] || 'Otro';
    };
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [phone2, setPhone2] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [description, setDescription] = useState('');
    const [source, setSource] = useState<Candidate['source']>(getDefaultSource());
    const [salaryExpectation, setSalaryExpectation] = useState('');
    const [agreedSalary, setAgreedSalary] = useState('');
    const [age, setAge] = useState<number | ''>('');
    const [dni, setDni] = useState('');
    const [linkedinUrl, setLinkedinUrl] = useState('');
    const [address, setAddress] = useState('');
    
    // Recargar settings cuando se abre el modal para asegurar que tenemos la versión más reciente
    useEffect(() => {
        if (actions.reloadSettings) {
            actions.reloadSettings().catch(err => {
                console.warn('Error reloading settings in AddCandidateModal:', err);
            });
        }
    }, []); // Solo al montar el componente
    
    // Log candidateSources cuando cambia
    useEffect(() => {
        const candidateSources = state.settings?.candidateSources;
        console.log('🔍 AddCandidateModal - candidateSources changed:', candidateSources);
        console.log('🔍 AddCandidateModal - IsArray:', Array.isArray(candidateSources), 'Length:', Array.isArray(candidateSources) ? candidateSources.length : 'N/A');
    }, [state.settings?.candidateSources]);
    const [province, setProvince] = useState<string>('');
    const [district, setDistrict] = useState<string>('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const firstStageId = process.stages[0]?.id;
        if (!firstStageId) {
            alert("Este proceso no tiene etapas configuradas.");
            return;
        }

        try {
            await actions.addCandidate({
                name,
                email,
                phone,
                phone2,
                avatarUrl,
                description,
                processId: process.id,
                stageId: firstStageId,
                attachments,
                source,
                salaryExpectation,
                agreedSalary,
                age: age === '' ? undefined : age,
                dni,
                linkedinUrl,
                address,
                province,
                district,
                applicationStartedDate: new Date().toISOString(), // Set automatically when candidate is created
            });
            
            // Recargar candidatos del proceso para asegurar sincronización
            if (actions.reloadCandidates && typeof actions.reloadCandidates === 'function') {
                try {
                    await actions.reloadCandidates();
                } catch (reloadError: any) {
                    console.warn('Error al recargar candidatos después de crear (no crítico):', reloadError);
                    // No mostrar error al usuario, el candidato ya se creó
                }
            }
            
            // Solo cerrar el modal si la creación fue exitosa
            onClose();
        } catch (error: any) {
            // El error ya fue manejado y mostrado en addCandidate
            // No cerrar el modal para que el usuario pueda corregir y reintentar
            console.error('Error en handleSubmit de AddCandidateModal:', error);
        }
    };

    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const dataUrl = await fileToBase64(file);
            const newAttachment: Attachment = {
                id: `att-c-${Date.now()}`,
                name: file.name,
                url: dataUrl,
                type: file.type,
                size: file.size,
            };
            setAttachments(prev => [...prev, newAttachment]);
        }
    };
    
    const handleDeleteAttachment = (id: string) => {
        setAttachments(prev => prev.filter(att => att.id !== id));
    };
    
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const dataUrl = await fileToBase64(file);
            setAvatarUrl(dataUrl);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-gray-800">{getLabel('modal_add_candidate', 'Agregar candidato a')} {process.title}</h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><X className="w-6 h-6 text-gray-600" /></button>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                        <div className="md:col-span-2 flex items-center space-x-4">
                             {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar Preview" className="w-20 h-20 rounded-full object-cover" />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                                    <User className="w-8 h-8 text-gray-500" />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Foto de perfil</label>
                                <button type="button" onClick={() => avatarInputRef.current?.click()} className="mt-1 text-sm font-medium text-primary-600 hover:text-primary-800">Subir foto</button>
                                <input type="file" accept="image/*" ref={avatarInputRef} onChange={handleAvatarUpload} className="hidden" />
                            </div>
                        </div>

                        <div><label className="block text-sm font-medium text-gray-700">Nombre completo</label><input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full input"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">Correo electrónico</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 block w-full input"/></div>
                        
                        <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700">Resumen / descripción</label><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 block w-full input" /></div>

                        <div><label className="block text-sm font-medium text-gray-700">Teléfono</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 block w-full input"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">Teléfono 2</label><input type="tel" value={phone2} onChange={e => setPhone2(e.target.value)} className="mt-1 block w-full input" placeholder="Opcional"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">Edad</label><input type="number" value={age} onChange={e => setAge(e.target.value === '' ? '' : parseInt(e.target.value, 10))} className="mt-1 block w-full input"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">DNI</label><input type="text" value={dni} onChange={e => setDni(e.target.value)} className="mt-1 block w-full input"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">Dirección / ciudad</label><input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Ej: Ciudad de México" className="mt-1 block w-full input"/></div>
                        <div>
                            <SearchableSelect
                                label="Provincia"
                                options={state.settings?.provinces && state.settings.provinces.length > 0 
                                    ? state.settings.provinces 
                                    : ['Lima', 'Arequipa', 'Cusco', 'La Libertad', 'Piura']}
                                value={province}
                                onChange={(newProvince) => {
                                    setProvince(newProvince);
                                    // Resetear distrito si no está en la nueva provincia
                                    const availableDistricts = state.settings?.districts?.[newProvince] || [];
                                    if (district && !availableDistricts.includes(district)) {
                                        setDistrict('');
                                    }
                                }}
                                placeholder="Seleccionar provincia"
                                searchPlaceholder="Buscar provincia..."
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <SearchableSelect
                                label="Distrito"
                                options={province && state.settings?.districts?.[province] && state.settings.districts[province].length > 0
                                    ? state.settings.districts[province]
                                    : []}
                                value={district}
                                onChange={setDistrict}
                                placeholder="Seleccionar distrito"
                                searchPlaceholder="Buscar distrito..."
                                disabled={!province}
                                className="mt-1"
                            />
                        </div>
                        <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700">Expectativa salarial</label><input type="text" value={salaryExpectation} onChange={e => setSalaryExpectation(e.target.value)} placeholder={`${state.settings?.currencySymbol || '$'}100,000`} className="mt-1 block w-full input"/></div>
                        <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700">Salario acordado</label><input type="text" value={agreedSalary} onChange={e => setAgreedSalary(e.target.value)} placeholder={`${state.settings?.currencySymbol || '$'}100,000`} className="mt-1 block w-full input"/></div>
                        <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700">URL de LinkedIn</label><input type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." className="mt-1 block w-full input"/></div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Fuente</label>
                            <select value={source} onChange={e => setSource(e.target.value as Candidate['source'])} className="mt-1 block w-full input">
                                {(() => {
                                    // Validar que candidateSources sea un array válido
                                    const candidateSources = state.settings?.candidateSources;
                                    const isValidArray = Array.isArray(candidateSources) && candidateSources.length > 0;
                                    const sources = isValidArray
                                        ? candidateSources
                                        : ['LinkedIn', 'Referencia', 'Sitio web', 'Otro'];
                                    
                                    // Log para debuggear si hay problema
                                    if (!isValidArray && candidateSources !== undefined) {
                                        console.warn('⚠️ AddCandidateModal: candidateSources no es un array válido:', candidateSources, 'Type:', typeof candidateSources, 'IsArray:', Array.isArray(candidateSources));
                                    }
                                    
                                    return sources.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ));
                                })()}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Adjuntos (CV, etc.)</label>
                            <div className="space-y-2">
                                {attachments.map(att => (
                                    <div key={att.id} className="flex items-center justify-between p-2 rounded-md border bg-gray-50">
                                        <div className="flex items-center overflow-hidden"><FileText className="w-5 h-5 mr-3 text-gray-500 flex-shrink-0" /><p className="text-sm font-medium text-gray-800 truncate">{att.name}</p></div>
                                        <button type="button" onClick={() => handleDeleteAttachment(att.id)} className="p-1 rounded-md hover:bg-red-100" title="Eliminar"><Trash2 className="w-4 h-4 text-red-500" /></button>
                                    </div>
                                ))}
                            </div>
                            <input type="file" ref={attachmentInputRef} onChange={handleAttachmentUpload} className="hidden" />
                            <button type="button" onClick={() => attachmentInputRef.current?.click()} className="mt-2 flex items-center text-sm font-medium text-primary-600 hover:text-primary-800"><Upload className="w-4 h-4 mr-1" /> Subir documento</button>
                        </div>
                    </div>
                     <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                        <button type="submit" className="btn-primary">Agregar candidato</button>
                    </div>
                </form>
            </div>
             <style>{`.input { padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); } .btn-primary { padding: 0.5rem 1rem; background-color: #2563eb; color: white; border-radius: 0.375rem; font-weight: 500;} .btn-primary:hover { background-color: #1d4ed8; } .btn-secondary { padding: 0.5rem 1rem; background-color: white; border: 1px solid #D1D5DB; color: #374151; border-radius: 0.375rem; font-weight: 500;} .btn-secondary:hover { background-color: #F9FAFB; }`}</style>
        </div>
    );
};