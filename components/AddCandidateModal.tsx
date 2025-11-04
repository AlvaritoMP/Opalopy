import React, { useState } from 'react';
import { useAppState } from '../App';
import { Process, Attachment } from '../types';
import { X, FileText, Paperclip, User } from 'lucide-react';

interface AddCandidateModalProps {
    process: Process;
    onClose: () => void;
}

export const AddCandidateModal: React.FC<AddCandidateModalProps> = ({ process, onClose }) => {
    const { actions } = useAppState();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

    const handleResumeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setResumeFile(selectedFile);
        }
    };
    
    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setAvatarFile(null);
            setAvatarPreview(null);
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!process.stages.length) {
            alert("This process has no stages. Please add stages first.");
            return;
        }

        let newAttachments: Attachment[] = [];
        if (resumeFile) {
            const fileDataUrl = await fileToBase64(resumeFile);
            newAttachments.push({
                id: `file-${Date.now()}`,
                name: resumeFile.name,
                url: fileDataUrl,
                type: resumeFile.type,
                size: resumeFile.size,
            });
        }
        
        let avatarUrl: string | undefined = undefined;
        if (avatarFile) {
            avatarUrl = await fileToBase64(avatarFile);
        }

        await actions.addCandidate({
            name,
            email,
            phone,
            avatarUrl,
            processId: process.id,
            stageId: process.stages[0].id, // Add to the first stage
            attachments: newAttachments,
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-gray-800">Add Candidate to "{process.title}"</h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                            <X className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                         <div className="flex flex-col items-center space-y-2">
                             <label htmlFor="avatar-upload" className="cursor-pointer">
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Avatar preview" className="w-24 h-24 rounded-full object-cover" />
                                 ) : (
                                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border">
                                        <User className="w-12 h-12 text-gray-400" />
                                    </div>
                                 )}
                             </label>
                             <input id="avatar-upload" name="avatar-upload" type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange}/>
                             <span className="text-sm text-gray-500">Profile Picture (Optional)</span>
                         </div>
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                            <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                            <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                         <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone (Optional)</label>
                            <input type="tel" id="phone" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Resume (Optional)</label>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                                <div className="space-y-1 text-center">
                                    {resumeFile ? (
                                        <>
                                            <FileText className="mx-auto h-12 w-12 text-gray-400" />
                                            <p className="text-sm text-gray-600">{resumeFile.name}</p>
                                            <button type="button" onClick={() => setResumeFile(null)} className="text-xs text-red-500 hover:underline">Remove</button>
                                        </>
                                    ) : (
                                        <>
                                            <Paperclip className="mx-auto h-12 w-12 text-gray-400" />
                                            <div className="flex text-sm text-gray-600">
                                                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500">
                                                    <span>Upload a file</span>
                                                    <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleResumeFileChange}/>
                                                </label>
                                                <p className="pl-1">or drag and drop</p>
                                            </div>
                                            <p className="text-xs text-gray-500">PDF, DOCX up to 10MB</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-primary-700">Add Candidate</button>
                    </div>
                </form>
            </div>
        </div>
    );
};