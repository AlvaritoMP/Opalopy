import React, { useState, useRef } from 'react';
import { Candidate, Attachment } from '../types';
import { useAppState } from '../App';
import { X, User, Mail, Phone, FileText, StickyNote, Download, Eye, Upload, Paperclip, Trash2, Clock, Camera } from 'lucide-react';

interface CandidateDetailsModalProps {
    candidate: Candidate;
    onClose: () => void;
}

export const CandidateDetailsModal: React.FC<CandidateDetailsModalProps> = ({ candidate, onClose }) => {
    const { state, actions } = useAppState();
    const process = state.processes.find(p => p.id === candidate.processId);
    const [notes, setNotes] = useState(candidate.notes || '');
    const [previewingAttachment, setPreviewingAttachment] = useState<Attachment | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNotes(e.target.value);
    };

    const handleSaveNotes = () => {
        if(candidate.notes !== notes) {
            actions.updateCandidate({ ...candidate, notes }, state.currentUser?.name);
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const fileDataUrl = await fileToBase64(file);
            const newAttachment: Attachment = {
                id: `file-${Date.now()}`,
                name: file.name,
                url: fileDataUrl,
                type: file.type,
                size: file.size,
            };
            const updatedAttachments = [...candidate.attachments, newAttachment];
            actions.updateCandidate({ ...candidate, attachments: updatedAttachments });
            // Automatically preview the newly uploaded file
            setPreviewingAttachment(newAttachment);
        }
    };
    
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const avatarUrl = await fileToBase64(file);
            actions.updateCandidate({ ...candidate, avatarUrl });
        }
    };

    const handleDeleteAttachment = (attachmentId: string) => {
        if (window.confirm('Are you sure you want to delete this attachment?')) {
            actions.updateCandidate({ ...candidate, attachments: candidate.attachments.filter(a => a.id !== attachmentId)});
            if (previewingAttachment?.id === attachmentId) {
                setPreviewingAttachment(null);
            }
        }
    };

    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };
    
    const renderPreview = () => {
        if (!previewingAttachment) {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 rounded-lg border-2 border-dashed">
                    <Eye className="w-16 h-16 text-gray-400 mb-4" />
                    <p className="text-gray-600 font-medium">Select an attachment to preview</p>
                    <p className="text-sm text-gray-500 text-center">Previews for images and PDFs are supported.</p>
                </div>
            );
        }

        return (
             <div className="w-full h-full flex flex-col bg-gray-50 rounded-lg p-3">
                <div className="pb-2 border-b mb-2 flex justify-between items-center flex-shrink-0">
                    <h3 className="text-base font-bold text-gray-800 truncate pr-4">{previewingAttachment.name}</h3>
                    <a href={previewingAttachment.url} download={previewingAttachment.name} className="p-2 rounded-full hover:bg-gray-200" title="Download">
                        <Download className="w-5 h-5 text-gray-600" />
                    </a>
                </div>
                <div className="flex-1 bg-white flex items-center justify-center overflow-auto rounded border">
                    {previewingAttachment.type.startsWith('image/') ? (
                        <img src={previewingAttachment.url} alt={previewingAttachment.name} className="max-w-full max-h-full object-contain" />
                    ) : previewingAttachment.type === 'application/pdf' ? (
                        <iframe src={previewingAttachment.url} title={previewingAttachment.name} className="w-full h-full border-0" />
                    ) : (
                        <div className="text-center p-8 bg-white rounded-lg">
                            <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                            <h4 className="text-xl font-semibold">Preview not available</h4>
                            <p className="text-gray-500">In-app preview for "{previewingAttachment.type}" files is not supported.</p>
                            <a href={previewingAttachment.url} download={previewingAttachment.name} className="mt-6 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700">
                                <Download className="w-4 h-4 mr-2" /> Download File
                            </a>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center flex-shrink-0">
                    <h2 className="text-2xl font-bold text-gray-800">{candidate.name}</h2>
                    <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                        <X className="w-6 h-6 text-gray-600" />
                    </button>
                </div>

                <div className="flex-1 p-6 grid grid-cols-5 gap-6 overflow-y-hidden">
                    {/* Left Column */}
                    <div className="col-span-2 space-y-6 overflow-y-auto pr-2">
                        <div className="flex items-start space-x-4">
                            <div className="relative group w-24 h-24 flex-shrink-0">
                                {candidate.avatarUrl ? (
                                    <img src={candidate.avatarUrl} alt={candidate.name} className="w-24 h-24 rounded-full object-cover border" />
                                ) : (
                                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border">
                                        <User className="w-12 h-12 text-gray-500" />
                                    </div>
                                )}
                                <button
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Change profile picture"
                                >
                                    <Camera className="w-6 h-6" />
                                </button>
                                <input type="file" accept="image/*" ref={avatarInputRef} onChange={handleAvatarUpload} className="hidden" />
                            </div>
                            <div className="space-y-2 pt-2">
                                <div className="flex items-center text-gray-600">
                                    <User className="w-5 h-5 mr-3 flex-shrink-0" />
                                    <span className="truncate" title={process?.title}>{process?.title}</span>
                                </div>
                                <div className="flex items-center text-gray-600">
                                    <Mail className="w-5 h-5 mr-3 flex-shrink-0" />
                                    <a href={`mailto:${candidate.email}`} className="text-primary-600 hover:underline truncate" title={candidate.email}>{candidate.email}</a>
                                </div>
                                {candidate.phone && (
                                    <div className="flex items-center text-gray-600">
                                        <Phone className="w-5 h-5 mr-3 flex-shrink-0" />
                                        <span>{candidate.phone}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div>
                            <h3 className="font-semibold text-gray-700 flex items-center mb-2"><Clock className="w-5 h-5 mr-2" /> Stage History</h3>
                            <ul className="space-y-2 max-h-32 overflow-y-auto pr-2">
                                {candidate.history.slice().reverse().map((h, i) => {
                                    const stage = process?.stages.find(s => s.id === h.stageId);
                                    return (
                                        <li key={i} className="text-sm text-gray-600">
                                            Moved to <span className="font-medium text-gray-800">{stage?.name || 'Unknown Stage'}</span> by <span className="font-medium text-gray-800">{h.movedBy}</span>
                                            <div className="text-xs text-gray-400">{new Date(h.movedAt).toLocaleString()}</div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-700 flex items-center mb-2"><Paperclip className="w-5 h-5 mr-2" /> Attachments</h3>
                             <div className="space-y-2">
                                {candidate.attachments.map(attachment => (
                                    <div key={attachment.id} className={`flex items-center justify-between p-2 rounded-md border transition-colors ${previewingAttachment?.id === attachment.id ? 'bg-primary-100 border-primary-300' : 'bg-gray-50'}`}>
                                        <div className="flex items-center overflow-hidden">
                                            <FileText className="w-5 h-5 mr-3 text-gray-500 flex-shrink-0" />
                                            <div className="overflow-hidden">
                                               <p className="text-sm font-medium text-gray-800 truncate">{attachment.name}</p>
                                               <p className="text-xs text-gray-500">{formatBytes(attachment.size)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                                            <button onClick={() => setPreviewingAttachment(attachment)} className="p-2 rounded-md hover:bg-gray-200" title="Preview"><Eye className="w-4 h-4 text-gray-600" /></button>
                                            <a href={attachment.url} download={attachment.name} className="p-2 rounded-md hover:bg-gray-200" title="Download"><Download className="w-4 h-4 text-gray-600" /></a>
                                            <button onClick={() => handleDeleteAttachment(attachment.id)} className="p-2 rounded-md hover:bg-red-100" title="Delete"><Trash2 className="w-4 h-4 text-red-500" /></button>
                                        </div>
                                    </div>
                                ))}
                                {candidate.attachments.length === 0 && <p className="text-sm text-gray-500">No attachments found.</p>}
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="mt-3 flex items-center text-sm font-medium text-primary-600 hover:text-primary-800">
                                <Upload className="w-4 h-4 mr-1" /> Upload File
                            </button>
                        </div>
                        
                        <div>
                            <h3 className="font-semibold text-gray-700 flex items-center mb-2"><StickyNote className="w-5 h-5 mr-2" /> Notes</h3>
                            <textarea 
                                rows={5} 
                                value={notes}
                                onChange={handleNotesChange}
                                onBlur={handleSaveNotes}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                                placeholder="Add notes about this candidate..."
                            />
                        </div>
                    </div>
                    
                    {/* Right Column */}
                    <div className="col-span-3 overflow-y-auto">
                        {renderPreview()}
                    </div>
                </div>

                <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end flex-shrink-0">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
                </div>
            </div>
        </div>
    );
};