import React, { useState } from 'react';
import { useAppState } from '../App';
import { User, UserRole } from '../types';
import { X } from 'lucide-react';

interface UserEditorModalProps {
    user: User | null;
    onClose: () => void;
}

export const UserEditorModal: React.FC<UserEditorModalProps> = ({ user, onClose }) => {
    const { actions, getLabel } = useAppState();
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [role, setRole] = useState<UserRole>(user?.role || 'viewer');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const userData = { name, email, role };

        if (user) {
            await actions.updateUser({ ...user, ...userData });
        } else {
            await actions.addUser(userData);
        }
        onClose();
    };

    const roleOptions: { value: UserRole, label: string }[] = [
        { value: 'admin', label: 'Admin (Edición)' },
        { value: 'recruiter', label: 'Recruiter (Consultor)' },
        { value: 'client', label: 'Client (Cliente)' },
        { value: 'viewer', label: 'Viewer (Consulta)' },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-gray-800">{user ? getLabel('modal_edit_user', 'Edit User') : getLabel('modal_add_user', 'Add New User')}</h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                            <X className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                            <input
                                type="text"
                                id="name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
                            <select
                                id="role"
                                value={role}
                                onChange={e => setRole(e.target.value as UserRole)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            >
                                {roleOptions.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md shadow-sm text-sm font-medium">{user ? 'Save Changes' : 'Add User'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};