import React, { useState } from 'react';
import { useAppState } from '../App';
import { User, UserRole } from '../types';
import { UserEditorModal } from './UserEditorModal';
import { UserPlus, Edit, Trash2 } from 'lucide-react';

export const Users: React.FC = () => {
    const { state, actions, getLabel } = useAppState();
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const isAdmin = state.currentUser?.role === 'admin';

    const handleAddNew = () => {
        setEditingUser(null);
        setIsEditorOpen(true);
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setIsEditorOpen(true);
    };
    
    const handleDelete = (userId: string) => {
        if (userId === state.currentUser?.id) {
            alert("You cannot delete your own account.");
            return;
        }
        if (window.confirm("Are you sure you want to delete this user?")) {
            actions.deleteUser(userId);
        }
    };

    const getRoleBadgeColor = (role: UserRole) => {
        switch (role) {
            case 'admin': return 'bg-red-100 text-red-800';
            case 'recruiter': return 'bg-blue-100 text-blue-800';
            case 'client': return 'bg-green-100 text-green-800';
            case 'viewer': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    
    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">{getLabel('sidebar_users', 'Gestión de usuarios')}</h1>
                {isAdmin && (
                    <button
                        onClick={handleAddNew}
                        className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700"
                    >
                        <UserPlus className="w-5 h-5 mr-2" /> Añadir usuario
                    </button>
                )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3">Usuario</th>
                            <th scope="col" className="px-6 py-3">Email</th>
                            <th scope="col" className="px-6 py-3">Rol</th>
                            <th scope="col" className="px-6 py-3"><span className="sr-only">Acciones</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {state.users.map(user => (
                            <tr key={user.id} className="bg-white border-b hover:bg-gray-50">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                    {user.avatarUrl ? (
                                        <div className="flex items-center space-x-3">
                                            <img src={user.avatarUrl} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
                                            <span>{user.name}</span>
                                        </div>
                                    ) : (
                                        user.name
                                    )}
                                </th>
                                <td className="px-6 py-4">{user.email}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getRoleBadgeColor(user.role)}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {isAdmin && (
                                        <div className="flex justify-end space-x-2">
                                            <button onClick={() => handleEdit(user)} className="p-2 rounded-md hover:bg-gray-100" title="Editar"><Edit className="w-4 h-4 text-gray-600" /></button>
                                            <button onClick={() => handleDelete(user.id)} className="p-2 rounded-md hover:bg-red-100" title="Eliminar"><Trash2 className="w-4 h-4 text-red-500" /></button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isEditorOpen && <UserEditorModal user={editingUser} onClose={() => setIsEditorOpen(false)} />}
        </div>
    );
};