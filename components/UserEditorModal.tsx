import React, { useRef, useState, useEffect } from 'react';
import { useAppState } from '../App';
import { User, UserRole, Permission, PermissionCategory, Section, Client } from '../types';
import { X, ChevronDown, ChevronRight, Shield, Eye, Building2 } from 'lucide-react';
import { clientsApi } from '../lib/api';

interface UserEditorModalProps {
    user: User | null;
    onClose: () => void;
}

// Definir categorías de permisos
const PERMISSION_CATEGORIES: PermissionCategory[] = [
    {
        id: 'processes',
        name: 'Procesos',
        description: 'Gestión de procesos de reclutamiento',
        permissions: ['processes.view', 'processes.create', 'processes.edit', 'processes.delete']
    },
    {
        id: 'candidates',
        name: 'Candidatos',
        description: 'Gestión de candidatos',
        permissions: ['candidates.view', 'candidates.create', 'candidates.edit', 'candidates.delete', 'candidates.archive', 'candidates.export']
    },
    {
        id: 'calendar',
        name: 'Calendario',
        description: 'Gestión de entrevistas y eventos',
        permissions: ['calendar.view', 'calendar.create', 'calendar.edit', 'calendar.delete']
    },
    {
        id: 'reports',
        name: 'Reportes',
        description: 'Visualización y exportación de reportes',
        permissions: ['reports.view', 'reports.export']
    },
    {
        id: 'users',
        name: 'Usuarios',
        description: 'Gestión de usuarios del sistema',
        permissions: ['users.view', 'users.create', 'users.edit', 'users.delete']
    },
    {
        id: 'settings',
        name: 'Configuración',
        description: 'Configuración del sistema',
        permissions: ['settings.view', 'settings.edit']
    },
    {
        id: 'letters',
        name: 'Cartas y Documentos',
        description: 'Generación de cartas y documentos',
        permissions: ['letters.view', 'letters.create', 'letters.download']
    },
    {
        id: 'comparator',
        name: 'Comparador',
        description: 'Comparación de candidatos',
        permissions: ['comparator.view', 'comparator.export']
    },
    {
        id: 'forms',
        name: 'Formularios',
        description: 'Gestión de formularios',
        permissions: ['forms.view', 'forms.edit']
    }
];

// Permisos por defecto según rol
const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    admin: [
        'processes.view', 'processes.create', 'processes.edit', 'processes.delete',
        'candidates.view', 'candidates.create', 'candidates.edit', 'candidates.delete', 'candidates.archive', 'candidates.export',
        'calendar.view', 'calendar.create', 'calendar.edit', 'calendar.delete',
        'reports.view', 'reports.export',
        'users.view', 'users.create', 'users.edit', 'users.delete',
        'settings.view', 'settings.edit',
        'letters.view', 'letters.create', 'letters.download',
        'comparator.view', 'comparator.export',
        'forms.view', 'forms.edit'
    ],
    recruiter: [
        'processes.view', 'processes.create', 'processes.edit',
        'candidates.view', 'candidates.create', 'candidates.edit', 'candidates.archive', 'candidates.export',
        'calendar.view', 'calendar.create', 'calendar.edit', 'calendar.delete',
        'reports.view', 'reports.export',
        'letters.view', 'letters.create', 'letters.download',
        'comparator.view', 'comparator.export',
        'forms.view', 'forms.edit'
    ],
    client: [
        'processes.view',
        'candidates.view',
        'calendar.view',
        'reports.view',
        'comparator.view'
    ],
    viewer: [
        'processes.view',
        'candidates.view',
        'calendar.view',
        'reports.view'
    ]
};

// Secciones visibles por defecto según rol
const DEFAULT_ROLE_SECTIONS: Record<UserRole, Section[]> = {
    admin: ['dashboard', 'processes', 'archived', 'candidates', 'forms', 'letters', 'calendar', 'reports', 'compare', 'bulk-processes', 'opsflow-handoffs', 'users', 'settings'],
    recruiter: ['dashboard', 'processes', 'archived', 'candidates', 'forms', 'letters', 'calendar', 'reports', 'compare', 'bulk-processes', 'opsflow-handoffs'],
    client: ['dashboard', 'processes', 'candidates', 'calendar', 'reports', 'compare'],
    viewer: ['dashboard', 'processes', 'candidates', 'calendar', 'reports']
};

const SECTION_LABELS: Record<Section, string> = {
    'dashboard': 'Panel',
    'processes': 'Procesos',
    'archived': 'Archivados',
    'candidates': 'Candidatos',
    'forms': 'Formularios',
    'letters': 'Cartas',
    'calendar': 'Calendario',
    'reports': 'Reportes',
    'compare': 'Comparador',
    'bulk-import': 'Importación Masiva',
    'bulk-processes': 'Procesos Masivos',
    'opsflow-handoffs': 'Envíos OpsFlow',
    'users': 'Usuarios',
    'settings': 'Configuración'
};

const PERMISSION_LABELS: Record<Permission, string> = {
    'processes.view': 'Ver procesos',
    'processes.create': 'Crear procesos',
    'processes.edit': 'Editar procesos',
    'processes.delete': 'Eliminar procesos',
    'candidates.view': 'Ver candidatos',
    'candidates.create': 'Crear candidatos',
    'candidates.edit': 'Editar candidatos',
    'candidates.delete': 'Eliminar candidatos',
    'candidates.archive': 'Archivar candidatos',
    'candidates.export': 'Exportar candidatos',
    'calendar.view': 'Ver calendario',
    'calendar.create': 'Crear eventos',
    'calendar.edit': 'Editar eventos',
    'calendar.delete': 'Eliminar eventos',
    'reports.view': 'Ver reportes',
    'reports.export': 'Exportar reportes',
    'users.view': 'Ver usuarios',
    'users.create': 'Crear usuarios',
    'users.edit': 'Editar usuarios',
    'users.delete': 'Eliminar usuarios',
    'settings.view': 'Ver configuración',
    'settings.edit': 'Editar configuración',
    'letters.view': 'Ver cartas',
    'letters.create': 'Crear cartas',
    'letters.download': 'Descargar cartas',
    'comparator.view': 'Ver comparador',
    'comparator.export': 'Exportar comparaciones',
    'forms.view': 'Ver formularios',
    'forms.edit': 'Editar formularios'
};

export const UserEditorModal: React.FC<UserEditorModalProps> = ({ user, onClose }) => {
    const { actions, getLabel } = useAppState();
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [role, setRole] = useState<UserRole>(user?.role || 'viewer');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
    const [useCustomPermissions, setUseCustomPermissions] = useState(!!user?.permissions);
    const [permissions, setPermissions] = useState<Permission[]>(user?.permissions || DEFAULT_ROLE_PERMISSIONS[user?.role || 'viewer']);
    const [useCustomSections, setUseCustomSections] = useState(!!user?.visibleSections);
    const [visibleSections, setVisibleSections] = useState<Section[]>(user?.visibleSections || DEFAULT_ROLE_SECTIONS[user?.role || 'viewer']);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['processes', 'candidates']));
    const [clients, setClients] = useState<Client[]>([]);
    const [restrictClients, setRestrictClients] = useState(Array.isArray(user?.allowedClientIds) && user?.allowedClientIds !== null);
    const [allowedClientIds, setAllowedClientIds] = useState<string[]>(user?.allowedClientIds || []);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const data = await clientsApi.getAll();
                setClients(data);
            } catch (err) {
                console.error("Error fetching clients", err);
            }
        };
        fetchClients();
    }, []);

    // Actualizar permisos y secciones cuando cambia el rol (si no hay personalización)
    const handleRoleChange = (newRole: UserRole) => {
        setRole(newRole);
        if (!useCustomPermissions) {
            setPermissions(DEFAULT_ROLE_PERMISSIONS[newRole]);
        }
        if (!useCustomSections) {
            setVisibleSections(DEFAULT_ROLE_SECTIONS[newRole]);
        }
    };

    const toggleSection = (section: Section) => {
        if (!useCustomSections) return;
        const newSections = visibleSections.includes(section)
            ? visibleSections.filter(s => s !== section)
            : [...visibleSections, section];
        setVisibleSections(newSections);
    };

    const toggleCategory = (categoryId: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        setExpandedCategories(newExpanded);
    };

    const togglePermission = (permission: Permission) => {
        if (!useCustomPermissions) return;
        const newPermissions = permissions.includes(permission)
            ? permissions.filter(p => p !== permission)
            : [...permissions, permission];
        setPermissions(newPermissions);
    };

    const toggleCategoryPermissions = (category: PermissionCategory) => {
        if (!useCustomPermissions) return;
        const categoryPerms = category.permissions;
        const allSelected = categoryPerms.every(p => permissions.includes(p));
        
        if (allSelected) {
            // Deseleccionar todos
            setPermissions(permissions.filter(p => !categoryPerms.includes(p)));
        } else {
            // Seleccionar todos
            const newPermissions = [...permissions];
            categoryPerms.forEach(p => {
                if (!newPermissions.includes(p)) {
                    newPermissions.push(p);
                }
            });
            setPermissions(newPermissions);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            setAvatarUrl(dataUrl);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        const userData: Partial<User> = { 
            name: name.trim(), 
            email: email.trim().toLowerCase(), 
            role,
            avatarUrl,
            permissions: useCustomPermissions ? permissions : undefined,
            visibleSections: useCustomSections ? visibleSections : undefined,
            allowedClientIds: restrictClients ? allowedClientIds : undefined
        };

        if (password) {
            userData.password = password;
        }

        try {
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
        } catch {
            // El toast de error ya se muestra en App.tsx; mantener el modal abierto.
        }
    };

    const roleOptions: { value: UserRole, label: string }[] = [
        { value: 'admin', label: 'Admin (Edición)' },
        { value: 'recruiter', label: 'Recruiter (Consultor)' },
        { value: 'client', label: 'Client (Cliente)' },
        { value: 'viewer', label: 'Viewer (Consulta)' },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
                    <div className="p-6 border-b flex justify-between items-center flex-shrink-0">
                        <h2 className="text-2xl font-bold text-gray-800">{user ? getLabel('modal_edit_user', 'Editar usuario') : getLabel('modal_add_user', 'Agregar usuario')}</h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                            <X className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">Foto de perfil</label>
                            <div className="flex items-center space-x-3">
                                <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={name || 'Avatar'} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-gray-500 text-sm">Sin foto</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => avatarInputRef.current?.click()} className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">Subir foto</button>
                                    <input type="file" accept="image/*" ref={avatarInputRef} onChange={handleAvatarUpload} className="hidden" />
                                </div>
                            </div>
                            <input
                                type="url"
                                value={avatarUrl}
                                onChange={e => setAvatarUrl(e.target.value)}
                                placeholder="o pega aquí la URL https://..."
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
                                onChange={e => handleRoleChange(e.target.value as UserRole)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            >
                        {roleOptions.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
                                El rol define los permisos por defecto. Puedes personalizarlos abajo.
                            </p>
                        </div>

                        {/* Sección de Acceso a Clientes */}
                        <div className="border-t pt-4 mt-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-gray-600" />
                                    <label className="text-sm font-medium text-gray-700">Acceso a Clientes</label>
                                </div>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={restrictClients}
                                        onChange={e => {
                                            const restrict = e.target.checked;
                                            setRestrictClients(restrict);
                                            if (!restrict) {
                                                setAllowedClientIds([]);
                                            }
                                        }}
                                        className="rounded text-primary-600 focus:ring-primary-500"
                                    />
                                    Restringir por cliente
                                </label>
                            </div>
                            
                            {restrictClients ? (
                                <div className="space-y-2 border rounded-lg p-3 bg-gray-50 max-h-60 overflow-y-auto">
                                    {clients.length === 0 ? (
                                        <p className="text-sm text-gray-500">No hay clientes creados en el sistema.</p>
                                    ) : (
                                        clients.map(client => (
                                            <label key={client.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer border border-transparent hover:border-gray-200 shadow-sm transition-all">
                                                <input
                                                    type="checkbox"
                                                    checked={allowedClientIds.includes(client.id)}
                                                    onChange={e => {
                                                        if (e.target.checked) {
                                                            setAllowedClientIds([...allowedClientIds, client.id]);
                                                        } else {
                                                            setAllowedClientIds(allowedClientIds.filter(id => id !== client.id));
                                                        }
                                                    }}
                                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-900">{client.razonSocial}</span>
                                                    <span className="text-xs text-gray-500">RUC: {client.ruc}</span>
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p>Este usuario tiene acceso a los procesos de <strong>todos los clientes</strong> (sujetos a su rol y permisos).</p>
                                    <p className="mt-1 text-xs">Activa "Restringir por cliente" para limitar su acceso solo a ciertos clientes.</p>
                                </div>
                            )}
                        </div>
                        
                        {/* Sección de Permisos */}
                        <div className="border-t pt-4 mt-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-gray-600" />
                                    <label className="text-sm font-medium text-gray-700">Permisos Personalizados</label>
                                </div>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={useCustomPermissions}
                                        onChange={e => {
                                            const useCustom = e.target.checked;
                                            setUseCustomPermissions(useCustom);
                                            if (!useCustom) {
                                                setPermissions(DEFAULT_ROLE_PERMISSIONS[role]);
                                            }
                                        }}
                                        className="rounded"
                                    />
                                    Personalizar permisos
                                </label>
                            </div>
                            
                            {useCustomPermissions ? (
                                <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
                                    {PERMISSION_CATEGORIES.map(category => {
                                        const isExpanded = expandedCategories.has(category.id);
                                        const categoryPerms = category.permissions;
                                        const selectedCount = categoryPerms.filter(p => permissions.includes(p)).length;
                                        const allSelected = categoryPerms.every(p => permissions.includes(p));
                                        const someSelected = selectedCount > 0 && !allSelected;
                                        
                                        return (
                                            <div key={category.id} className="border rounded-lg bg-white">
                                                <div 
                                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                                                    onClick={() => toggleCategory(category.id)}
                                                >
                                                    <div className="flex items-center gap-2 flex-1">
                                                        {isExpanded ? (
                                                            <ChevronDown className="w-4 h-4 text-gray-500" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4 text-gray-500" />
                                                        )}
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-sm text-gray-800">{category.name}</span>
                                                                {someSelected && (
                                                                    <span className="text-xs text-blue-600">({selectedCount}/{categoryPerms.length})</span>
                                                                )}
                                                                {allSelected && (
                                                                    <span className="text-xs text-green-600">(Todos)</span>
                                                                )}
                                                            </div>
                                                            {category.description && (
                                                                <p className="text-xs text-gray-500 mt-0.5">{category.description}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={allSelected}
                                                            ref={(el) => {
                                                                if (el) el.indeterminate = someSelected;
                                                            }}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                toggleCategoryPermissions(category);
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="rounded"
                                                        />
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div className="px-3 pb-3 space-y-2 border-t bg-gray-50">
                                                        {categoryPerms.map(permission => (
                                                            <label 
                                                                key={permission} 
                                                                className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={permissions.includes(permission)}
                                                                    onChange={() => togglePermission(permission)}
                                                                    className="rounded"
                                                                />
                                                                <span className="text-sm text-gray-700">{PERMISSION_LABELS[permission]}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p>Se están usando los permisos por defecto del rol <strong>{role}</strong>.</p>
                                    <p className="mt-1 text-xs">Activa "Personalizar permisos" para ajustar permisos individuales.</p>
                                </div>
                            )}
                        </div>
                        
                        {/* Sección de Visibilidad de Secciones */}
                        <div className="border-t pt-4 mt-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Eye className="w-5 h-5 text-gray-600" />
                                    <label className="text-sm font-medium text-gray-700">Secciones Visibles</label>
                                </div>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={useCustomSections}
                                        onChange={e => {
                                            const useCustom = e.target.checked;
                                            setUseCustomSections(useCustom);
                                            if (!useCustom) {
                                                setVisibleSections(DEFAULT_ROLE_SECTIONS[role]);
                                            }
                                        }}
                                        className="rounded"
                                    />
                                    Personalizar secciones
                                </label>
                            </div>
                            
                            {useCustomSections ? (
                                <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
                                    <p className="text-xs text-gray-600 mb-2">Selecciona las secciones que este usuario puede ver en el menú:</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(Object.keys(SECTION_LABELS) as Section[]).map(section => (
                                            <label 
                                                key={section} 
                                                className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer border border-gray-200"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={visibleSections.includes(section)}
                                                    onChange={() => toggleSection(section)}
                                                    className="rounded"
                                                />
                                                <span className="text-sm text-gray-700">{SECTION_LABELS[section]}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {visibleSections.length} de {Object.keys(SECTION_LABELS).length} secciones visibles
                                    </p>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p>Se están usando las secciones por defecto del rol <strong>{role}</strong>.</p>
                                    <p className="mt-1 text-xs">Activa "Personalizar secciones" para controlar qué secciones puede ver este usuario.</p>
                                </div>
                            )}
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
                    <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end space-x-3 flex-shrink-0 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md shadow-sm text-sm font-medium">{user ? 'Guardar cambios' : 'Agregar usuario'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};