
import React, { useState } from 'react';
import { Form, FormField } from '../types';
import { X, Plus, Trash2 } from 'lucide-react';

interface FormEditorModalProps {
    form: Form | null;
    onClose: () => void;
}

export const FormEditorModal: React.FC<FormEditorModalProps> = ({ form, onClose }) => {
    // const { actions } = useAppState();
    const [title, setTitle] = useState(form?.title || '');
    const [description, setDescription] = useState(form?.description || '');
    const [fields, setFields] = useState<FormField[]>(form?.fields || [{ id: `new-${Date.now()}`, label: 'Full Name', type: 'text', required: true }]);

    const handleFieldChange = (index: number, key: keyof FormField, value: any) => {
        const newFields = [...fields];
        // Fix: Use a type assertion to allow assignment
        (newFields[index] as any)[key] = value;
        setFields(newFields);
    };

    const addField = () => {
        setFields([...fields, { id: `new-${Date.now()}`, label: '', type: 'text', required: false }]);
    };
    
    const removeField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // actions.saveForm(...) not implemented
        alert("Saving forms is not implemented yet.");
        onClose();
    };
    
    return (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-gray-800">{form ? 'Edit Form' : 'New Form'}</h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                            <X className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                    <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700">Form Title</label>
                            <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                            <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={2} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Form Fields</h3>
                            <div className="space-y-4">
                                {fields.map((field, index) => (
                                    <div key={index} className="p-4 border rounded-md bg-gray-50 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <p className="font-medium">Field {index + 1}</p>
                                            <button type="button" onClick={() => removeField(index)} className="p-1 rounded-md hover:bg-red-100">
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </button>
                                        </div>
                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <input type="text" placeholder="Field Label" value={field.label} onChange={e => handleFieldChange(index, 'label', e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-md"/>
                                            <select value={field.type} onChange={e => handleFieldChange(index, 'type', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                                                <option value="text">Text</option>
                                                <option value="textarea">Text Area</option>
                                                <option value="file">File Upload</option>
                                            </select>
                                        </div>
                                        <label className="flex items-center">
                                            <input type="checkbox" checked={field.required} onChange={e => handleFieldChange(index, 'required', e.target.checked)} className="h-4 w-4 text-primary-600 border-gray-300 rounded"/>
                                            <span className="ml-2 text-sm text-gray-700">Required</span>
                                        </label>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addField} className="mt-4 flex items-center text-sm font-medium text-primary-600 hover:text-primary-800">
                                <Plus className="w-4 h-4 mr-1" /> Add Field
                            </button>
                        </div>
                    </div>
                     <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md">Save Form</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
