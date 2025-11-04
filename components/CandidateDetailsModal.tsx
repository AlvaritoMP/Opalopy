import React, { useRef, useState } from 'react';
import { useAppState } from '../App';
import { Candidate, Attachment, InterviewEvent, UserRole } from '../types';
import { X, Mail, Phone, Linkedin, User, FileText, Eye, Download, Upload, Trash2, Briefcase, DollarSign, Calendar, Info, MapPin, Edit } from 'lucide-react';
import { ScheduleInterviewModal } from './ScheduleInterviewModal';

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
                <span className="text-gray-600">{value || 'N/A'}</span>
            )}
        </div>
    </div>
);


export const CandidateDetailsModal: React.FC<{ candidate: Candidate, onClose: () => void }> = ({ candidate: initialCandidate, onClose }) => {
    const { state, actions } = useAppState();
    const [isEditing, setIsEditing] = useState(false);
    const [editableCandidate, setEditableCandidate] = useState<Candidate>(initialCandidate);
    
    const [previewFile, setPreviewFile] = useState<Attachment | null>(initialCandidate.attachments?.[0] || null);
    const [activeTab, setActiveTab] = useState<'details' | 'history' | 'schedule'>('details');
    const [isScheduling, setIsScheduling] = useState(false);
    const [editingEvent, setEditingEvent] = useState<InterviewEvent | null>(null);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    
    const process = state.processes.find(p => p.id === initialCandidate.processId);
    const candidateEvents = state.interviewEvents.filter(e => e.candidateId === initialCandidate.id);

    const canEdit = ['admin', 'recruiter'].includes(state.currentUser?.role as UserRole);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setEditableCandidate(prev => ({
            ...prev,
            [name]: e.target.type === 'number' && value !== '' ? parseInt(value, 10) : value
        }));
    };

    const handleSaveChanges = async () => {
        await actions.updateCandidate(editableCandidate, state.currentUser?.name);
        setIsEditing(false);
    };
    
    const handleCancelEdit = () => {
        setEditableCandidate(initialCandidate);
        setIsEditing(false);
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
        if (file) {
            const dataUrl = await fileToBase64(file);
            const newAttachment: Attachment = {
                id: `att-c-${Date.now()}`,
                name: file.name,
                url: dataUrl,
                type: file.type,
                size: file.size,
            };
            const updatedCandidate = { ...editableCandidate, attachments: [...editableCandidate.attachments, newAttachment] };
            setEditableCandidate(updatedCandidate);
            await actions.updateCandidate(updatedCandidate, state.currentUser?.name);
        }
    };
    
     const handleDeleteAttachment = async (id: string) => {
        const updatedAttachments = editableCandidate.attachments.filter(att => att.id !== id);
        const updatedCandidate = { ...editableCandidate, attachments: updatedAttachments };
        setEditableCandidate(updatedCandidate);
        await actions.updateCandidate(updatedCandidate, state.currentUser?.name);
        if(previewFile?.id === id) setPreviewFile(null);
    };
    
    const openScheduler = (event: InterviewEvent | null = null) => {
        setEditingEvent(event);
        setIsScheduling(true);
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (window.confirm('Are you sure you want to delete this interview?')) {
            await actions.deleteInterviewEvent(eventId);
        }
    };

    if (!process) return null;
    
    const TabButton: React.FC<{tabId: 'details' | 'history' | 'schedule', children: React.ReactNode}> = ({tabId, children}) => (
        <button 
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tabId ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >{children}</button>
    );

    const currentCandidate = isEditing ? editableCandidate : initialCandidate;

    return (
        <>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh]">
                <header className="p-4 border-b flex justify-between items-center flex-shrink-0">
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
                            <h2 className="text-2xl font-bold text-gray-800">{currentCandidate.name}</h2>
                            <p className="text-sm text-gray-500">Applied for: {process.title}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        {canEdit && !isEditing && (
                            <button onClick={() => setIsEditing(true)} className="flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                                <Edit className="w-4 h-4 mr-2" /> Edit
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><X /></button>
                    </div>
                </header>
                 <div className="border-b flex-shrink-0">
                    <nav className="flex space-x-4 px-6">
                        <TabButton tabId="details">Details</TabButton>
                        <TabButton tabId="history">History</TabButton>
                        <TabButton tabId="schedule">Schedule</TabButton>
                    </nav>
                </div>
                <main className="flex-1 overflow-y-auto">
                   {activeTab === 'details' && (
                        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left Column - Details */}
                            <div className="space-y-6">
                                {isEditing ? (
                                    <>
                                        {/* Edit Form */}
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div><label className="block text-sm font-medium text-gray-700">Full Name</label><input type="text" name="name" value={editableCandidate.name} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                                <div><label className="block text-sm font-medium text-gray-700">Email</label><input type="email" name="email" value={editableCandidate.email} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                                <div><label className="block text-sm font-medium text-gray-700">Phone</label><input type="tel" name="phone" value={editableCandidate.phone || ''} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                                <div><label className="block text-sm font-medium text-gray-700">Age</label><input type="number" name="age" value={editableCandidate.age || ''} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                                <div><label className="block text-sm font-medium text-gray-700">DNI</label><input type="text" name="dni" value={editableCandidate.dni || ''} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                                <div><label className="block text-sm font-medium text-gray-700">Address / City</label><input type="text" name="address" value={editableCandidate.address || ''} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                            </div>
                                            <div><label className="block text-sm font-medium text-gray-700">LinkedIn URL</label><input type="url" name="linkedinUrl" value={editableCandidate.linkedinUrl || ''} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div><label className="block text-sm font-medium text-gray-700">Source</label>
                                                    <select name="source" value={editableCandidate.source || ''} onChange={handleInputChange} className="mt-1 block w-full input">
                                                        <option>LinkedIn</option><option>Referral</option><option>Website</option><option>Other</option>
                                                    </select>
                                                </div>
                                                <div><label className="block text-sm font-medium text-gray-700">Salary Expectation</label><input type="text" name="salaryExpectation" value={editableCandidate.salaryExpectation || ''} onChange={handleInputChange} className="mt-1 block w-full input"/></div>
                                            </div>
                                            <div><label className="block text-sm font-medium text-gray-700">Summary</label><textarea name="description" rows={3} value={editableCandidate.description || ''} onChange={handleInputChange} className="mt-1 block w-full input" /></div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* View Details */}
                                        <div className="p-4 bg-gray-50 rounded-lg border">
                                            <h3 className="font-semibold text-gray-700 mb-3">Contact & Personal Info</h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <DetailItem icon={Mail} label="Email" value={currentCandidate.email} href={`mailto:${currentCandidate.email}`} />
                                                <DetailItem icon={Phone} label="Phone" value={currentCandidate.phone} />
                                                <DetailItem icon={Linkedin} label="LinkedIn" value={currentCandidate.linkedinUrl} href={currentCandidate.linkedinUrl} />
                                                <DetailItem icon={Calendar} label="Age" value={currentCandidate.age} />
                                                <DetailItem icon={Info} label="DNI" value={currentCandidate.dni} />
                                                <DetailItem icon={Briefcase} label="Source" value={currentCandidate.source} />
                                                <DetailItem icon={MapPin} label="Address" value={currentCandidate.address} />
                                                <DetailItem icon={DollarSign} label="Salary Expectation" value={currentCandidate.salaryExpectation ? `${state.settings?.currencySymbol || ''}${currentCandidate.salaryExpectation.replace(/[$\€£S/]/g, '').trim()}` : 'N/A'} />
                                            </div>
                                        </div>
                                        {currentCandidate.description && (
                                            <div>
                                                <h3 className="font-semibold text-gray-700 mb-2">Summary</h3>
                                                <p className="text-sm text-gray-600 whitespace-pre-wrap">{currentCandidate.description}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                                
                                <div>
                                    <h3 className="font-semibold text-gray-700 mb-2">Attachments</h3>
                                    <div className="space-y-2">
                                        {currentCandidate.attachments.map(att => (
                                            <div key={att.id} className="flex items-center justify-between p-2 rounded-md border bg-white hover:bg-gray-50">
                                                <div className="flex items-center overflow-hidden"><FileText className="w-5 h-5 mr-3 text-gray-500 flex-shrink-0" /><p className="text-sm font-medium text-gray-800 truncate">{att.name}</p></div>
                                                <div className="flex items-center space-x-1">
                                                    <button onClick={() => setPreviewFile(att)} className="p-1 rounded-md hover:bg-gray-200" title="Preview"><Eye className="w-4 h-4 text-gray-600" /></button>
                                                    <a href={att.url} download={att.name} className="p-1 rounded-md hover:bg-gray-200" title="Download"><Download className="w-4 h-4 text-gray-600" /></a>
                                                    <button onClick={() => handleDeleteAttachment(att.id)} className="p-1 rounded-md hover:bg-red-100" title="Delete"><Trash2 className="w-4 h-4 text-red-500" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <input type="file" ref={attachmentInputRef} onChange={handleAttachmentUpload} className="hidden" />
                                    <button type="button" onClick={() => attachmentInputRef.current?.click()} className="mt-2 flex items-center text-sm font-medium text-primary-600 hover:text-primary-800"><Upload className="w-4 h-4 mr-1" /> Upload Document</button>
                                </div>
                            </div>
                            {/* Right Column - Preview */}
                            <div className="bg-gray-100 rounded-lg border flex flex-col items-center justify-center p-4 min-h-[400px]">
                                {previewFile ? (
                                    <div className="w-full h-full">
                                    {previewFile.type.startsWith('image/') ? (
                                        <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-full object-contain" />
                                    ) : previewFile.type === 'application/pdf' ? (
                                        <iframe src={previewFile.url} title={previewFile.name} className="w-full h-full border-0" />
                                    ) : (
                                        <div className="text-center">
                                            <FileText className="w-16 h-16 mx-auto text-gray-400" />
                                            <p className="mt-2 text-gray-600">No preview available for this file type.</p>
                                            <a href={previewFile.url} download={previewFile.name} className="mt-4 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg">
                                                <Download className="w-4 h-4 mr-2" /> Download "{previewFile.name}"
                                            </a>
                                        </div>
                                    )}
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-500">
                                        <Eye className="w-12 h-12 mx-auto mb-2" />
                                        <p>Select a file to preview</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'history' && (
                        <div className="p-6">
                             <ul className="border rounded-lg overflow-hidden">
                                <li className="p-3 bg-gray-50 font-medium text-sm grid grid-cols-3">
                                    <span>Stage</span>
                                    <span className="text-center">Moved By</span>
                                    <span className="text-right">Date</span>
                                </li>
                                {initialCandidate.history.length > 0 ? initialCandidate.history.slice().reverse().map((h, index) => (
                                    <li key={index} className="p-3 border-t grid grid-cols-3 items-center">
                                        <p className="font-medium text-gray-800">{process.stages.find(s => s.id === h.stageId)?.name || 'Unknown'}</p>
                                        <p className="text-sm text-gray-500 text-center">{h.movedBy}</p>
                                        <p className="text-sm text-gray-500 text-right">{new Date(h.movedAt).toLocaleString()}</p>
                                    </li>
                                )) : (
                                    <li className="p-6 text-center text-gray-500">No history found.</li>
                                )}
                             </ul>
                        </div>
                    )}
                    {activeTab === 'schedule' && (
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">Scheduled Interviews</h3>
                                <button onClick={() => openScheduler()} className="flex items-center px-3 py-1.5 bg-primary-600 text-white rounded-md shadow-sm hover:bg-primary-700 text-sm">
                                    <Calendar className="w-4 h-4 mr-2" /> Schedule New
                                </button>
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                                {candidateEvents.length > 0 ? (
                                    <ul>
                                         {candidateEvents.sort((a,b) => b.start.getTime() - a.start.getTime()).map(event => (
                                            <li key={event.id} className="p-3 border-b last:border-b-0 grid grid-cols-4 items-center gap-4">
                                                <div>
                                                    <p className="font-medium text-gray-900">{event.title}</p>
                                                    <p className="text-xs text-gray-500">with {state.users.find(u => u.id === event.interviewerId)?.name || 'Unknown'}</p>
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
                                    <div className="p-8 text-center text-gray-500">No interviews scheduled for this candidate.</div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
                {isEditing && (
                    <footer className="p-4 bg-gray-50 border-t flex justify-end space-x-3 flex-shrink-0">
                        <button type="button" onClick={handleCancelEdit} className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium">Cancel</button>
                        <button type="button" onClick={handleSaveChanges} className="px-4 py-2 bg-primary-600 text-white rounded-md shadow-sm text-sm font-medium">Save Changes</button>
                    </footer>
                )}
            </div>
             <style>{`.input { padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }`}</style>
        </div>
        {isScheduling && <ScheduleInterviewModal event={editingEvent} defaultCandidateId={initialCandidate.id} onClose={() => setIsScheduling(false)} />}
        </>
    );
};