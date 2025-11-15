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
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        const userData: Partial<User> = { name, email, role, avatarUrl };

        if (password) {
            userData.password = password;
        }

        if (user) {
            await actions.updateUser({ ...user, ...userData });
        } else {
            if (!password) {
                alert("Password is required for new users.");
                return;
            }
            await actions.addUser(userData as Omit<User, 'id'>);
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
                        <h2 className="text-2xl font-bold text-gray-800">{user ? getLabel('modal_edit_user', 'Editar usuario') : getLabel('modal_add_user', 'Agregar usuario')}</h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                            <X className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Foto de perfil (URL)</label>
                            <input
                                type="url"
                                value={avatarUrl}
                                onChange={e => setAvatarUrl(e.target.value)}
                                placeholder="https://..."
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre completo</label>
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
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Correo electrónico</label>
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
                            <label htmlFor="role" className="block text-sm font-medium text-gray-700">Rol</label>
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
                        <div>
                            <label htmlFor="password"className="block text-sm font-medium text-gray-700">Contraseña</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required={!user} // Required only for new users
                                placeholder={user ? "Leave blank to keep current password" : ""}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword"className="block text-sm font-medium text-gray-700">Confirmar contraseña</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required={!user || !!password} // Required if it's a new user or if password is being changed
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md shadow-sm text-sm font-medium">{user ? 'Guardar cambios' : 'Agregar usuario'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};