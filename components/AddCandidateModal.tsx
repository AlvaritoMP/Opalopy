import React, { useState, useRef } from 'react';
import { useAppState } from '../App';
import { Process, Attachment, Candidate } from '../types';
import { X, Upload, FileText, Trash2, User } from 'lucide-react';

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
    const { actions } = useAppState();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [source, setSource] = useState<Candidate['source']>('Other');
    const [salaryExpectation, setSalaryExpectation] = useState('');
    const [age, setAge] = useState<number | ''>('');
    const [dni, setDni] = useState('');
    const [linkedinUrl, setLinkedinUrl] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const firstStageId = process.stages[0]?.id;
        if (!firstStageId) {
            alert("This process has no stages configured.");
            return;
        }

        await actions.addCandidate({
            name,
            email,
            phone,
            avatarUrl,
            processId: process.id,
            stageId: firstStageId,
            attachments,
            source,
            salaryExpectation,
            age: age === '' ? undefined : age,
            dni,
            linkedinUrl,
        });
        onClose();
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
                        <h2 className="text-2xl font-bold text-gray-800">Add Candidate to {process.title}</h2>
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
                                <label className="block text-sm font-medium text-gray-700">Profile Picture</label>
                                <button type="button" onClick={() => avatarInputRef.current?.click()} className="mt-1 text-sm font-medium text-primary-600 hover:text-primary-800">Upload Photo</button>
                                <input type="file" accept="image/*" ref={avatarInputRef} onChange={handleAvatarUpload} className="hidden" />
                            </div>
                        </div>

                        <div><label className="block text-sm font-medium text-gray-700">Full Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full input"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">Email Address</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 block w-full input"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">Phone Number</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 block w-full input"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">Age</label><input type="number" value={age} onChange={e => setAge(e.target.value === '' ? '' : parseInt(e.target.value, 10))} className="mt-1 block w-full input"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">DNI</label><input type="text" value={dni} onChange={e => setDni(e.target.value)} className="mt-1 block w-full input"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">Salary Expectation</label><input type="text" value={salaryExpectation} onChange={e => setSalaryExpectation(e.target.value)} placeholder="$100,000" className="mt-1 block w-full input"/></div>
                        <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700">LinkedIn Profile URL</label><input type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." className="mt-1 block w-full input"/></div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Source</label>
                            <select value={source} onChange={e => setSource(e.target.value as Candidate['source'])} className="mt-1 block w-full input">
                                <option>LinkedIn</option>
                                <option>Referral</option>
                                <option>Website</option>
                                <option>Other</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Attachments (Resume, etc.)</label>
                            <div className="space-y-2">
                                {attachments.map(att => (
                                    <div key={att.id} className="flex items-center justify-between p-2 rounded-md border bg-gray-50">
                                        <div className="flex items-center overflow-hidden"><FileText className="w-5 h-5 mr-3 text-gray-500 flex-shrink-0" /><p className="text-sm font-medium text-gray-800 truncate">{att.name}</p></div>
                                        <button type="button" onClick={() => handleDeleteAttachment(att.id)} className="p-1 rounded-md hover:bg-red-100" title="Delete"><Trash2 className="w-4 h-4 text-red-500" /></button>
                                    </div>
                                ))}
                            </div>
                            <input type="file" ref={attachmentInputRef} onChange={handleAttachmentUpload} className="hidden" />
                            <button type="button" onClick={() => attachmentInputRef.current?.click()} className="mt-2 flex items-center text-sm font-medium text-primary-600 hover:text-primary-800"><Upload className="w-4 h-4 mr-1" /> Upload Document</button>
                        </div>
                    </div>
                     <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                        <button type="submit" className="btn-primary">Add Candidate</button>
                    </div>
                </form>
            </div>
             <style>{`.input { padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); } .btn-primary { padding: 0.5rem 1rem; background-color: #2563eb; color: white; border-radius: 0.375rem; font-weight: 500;} .btn-primary:hover { background-color: #1d4ed8; } .btn-secondary { padding: 0.5rem 1rem; background-color: white; border: 1px solid #D1D5DB; color: #374151; border-radius: 0.375rem; font-weight: 500;} .btn-secondary:hover { background-color: #F9FAFB; }`}</style>
        </div>
    );
};