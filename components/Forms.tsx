
import React, { useState } from 'react';
import { useAppState } from '../App';
import { Plus, MoreVertical, Edit, Trash2, Eye } from 'lucide-react';
import { FormEditorModal } from './FormEditorModal';
import { Form } from '../types';

export const Forms: React.FC = () => {
    const { state } = useAppState();
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingForm, setEditingForm] = useState<Form | null>(null);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    const handleOpenEditor = (form: Form | null = null) => {
        setEditingForm(form);
        setIsEditorOpen(true);
        setActiveDropdown(null);
    };

    const handleCloseEditor = () => {
        setIsEditorOpen(false);
        setEditingForm(null);
    };

    const handleDelete = (formId: string) => {
        if (window.confirm('Are you sure you want to delete this form?')) {
            // actions.deleteForm(formId); // Action not implemented yet
            alert(`Form deletion for ${formId} not implemented yet.`);
        }
        setActiveDropdown(null);
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Application Forms</h1>
                <button
                    onClick={() => handleOpenEditor()}
                    className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700"
                >
                    <Plus className="w-5 h-5 mr-2" /> New Form
                </button>
            </div>
            {state.forms.length === 0 ? (
                 <div className="text-center py-12 bg-white rounded-xl border border-dashed">
                    <h3 className="text-lg font-medium text-gray-900">No Forms Found</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by creating a new application form.</p>
                    <div className="mt-6">
                        <button
                            onClick={() => handleOpenEditor()}
                            type="button"
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                            <Plus className="-ml-1 mr-2 h-5 w-5" />
                            New Form
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Render forms here */}
                </div>
            )}
             {isEditorOpen && (
                <FormEditorModal form={editingForm} onClose={handleCloseEditor} />
            )}
        </div>
    );
};
