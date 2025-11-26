import React, { useState } from 'react';
import { useAppState } from '../App';
import { User, UserRole } from '../types';
import { UserEditorModal } from './UserEditorModal';
import { UserPlus, Edit, Trash2, Shield } from 'lucide-react';

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
            alert("No puedes eliminar tu propia cuenta.");
            return;
        }
        if (window.confirm("¿Seguro que deseas eliminar este usuario?")) {
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
        <div className="p-4 md:p-8 h-full flex flex-col overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 md:mb-8 gap-3 sm:gap-4">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{getLabel('sidebar_users', 'Gestión de usuarios')}</h1>
                {isAdmin && (
                    <button
                        onClick={handleAddNew}
                        className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700 text-sm md:text-base whitespace-nowrap self-start sm:self-auto"
                    >
                        <UserPlus className="w-5 h-5 mr-2" /> Añadir usuario
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                    <div className="overflow-x-auto overflow-y-auto flex-1">
                        <table className="w-full text-sm text-left text-gray-500 min-w-[700px]">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th scope="col" className="px-3 md:px-6 py-3">Usuario</th>
                                    <th scope="col" className="px-3 md:px-6 py-3">Email</th>
                                    <th scope="col" className="px-3 md:px-6 py-3">Rol</th>
                                    <th scope="col" className="px-3 md:px-6 py-3">Permisos</th>
                                    <th scope="col" className="px-3 md:px-6 py-3"><span className="sr-only">Acciones</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {state.users.map(user => (
                                    <tr key={user.id} className="bg-white border-b hover:bg-gray-50">
                                        <th scope="row" className="px-3 md:px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                            <div className="flex items-center space-x-2 md:space-x-3">
                                                <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                                                    {user.avatarUrl ? (
                                                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-gray-600 text-xs font-semibold">
                                                            {user.name.split(' ').slice(0,2).map(p => p.charAt(0)).join('').toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs md:text-sm">{user.name}</span>
                                            </div>
                                        </th>
                                        <td className="px-3 md:px-6 py-4 text-xs md:text-sm">{user.email}</td>
                                        <td className="px-3 md:px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getRoleBadgeColor(user.role)}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-3 md:px-6 py-4">
                                            {user.permissions && user.permissions.length > 0 ? (
                                                <div className="flex items-center gap-1 text-xs text-blue-600" title={`${user.permissions.length} permisos personalizados`}>
                                                    <Shield className="w-3 h-3 md:w-4 md:h-4" />
                                                    <span className="hidden sm:inline">Personalizados ({user.permissions.length})</span>
                                                    <span className="sm:hidden">({user.permissions.length})</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-500">Por defecto</span>
                                            )}
                                        </td>
                                        <td className="px-3 md:px-6 py-4 text-right">
                                            {isAdmin && (
                                                <div className="flex justify-end space-x-1 md:space-x-2">
                                                    <button onClick={() => handleEdit(user)} className="p-1 md:p-2 rounded-md hover:bg-gray-100" title="Editar"><Edit className="w-4 h-4 text-gray-600" /></button>
                                                    <button onClick={() => handleDelete(user.id)} className="p-1 md:p-2 rounded-md hover:bg-red-100" title="Eliminar"><Trash2 className="w-4 h-4 text-red-500" /></button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {isEditorOpen && <UserEditorModal user={editingUser} onClose={() => setIsEditorOpen(false)} />}
        </div>
    );
};