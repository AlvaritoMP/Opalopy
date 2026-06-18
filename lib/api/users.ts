import { supabase, setCurrentUser } from '../supabase';
import { User } from '../../types';
import { APP_NAME } from '../appConfig';

// Convertir de DB a tipo de aplicación
function dbToUser(dbUser: any): User {
    return {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        password: dbUser.password_hash, // Solo para comparación, no debería exponerse
        avatarUrl: dbUser.avatar_url,
        permissions: dbUser.permissions || undefined,
        visibleSections: dbUser.visible_sections || undefined,
        allowedClientIds: dbUser.allowed_client_ids || undefined,
    };
}

// Convertir de tipo de aplicación a DB
function userToDb(user: Partial<User>): any {
    const dbUser: any = {};
    if (user.name !== undefined) dbUser.name = user.name;
    if (user.email !== undefined) dbUser.email = user.email;
    if (user.role !== undefined) dbUser.role = user.role;
    if (user.password !== undefined) dbUser.password_hash = user.password;
    if (user.avatarUrl !== undefined) dbUser.avatar_url = user.avatarUrl;
    if (user.permissions !== undefined) dbUser.permissions = user.permissions;
    if (user.visibleSections !== undefined) dbUser.visible_sections = user.visibleSections;
    // No enviar null: PostgREST falla si la columna no existe o el valor es inválido
    if (user.allowedClientIds !== undefined && user.allowedClientIds !== null) {
        dbUser.allowed_client_ids =
            user.allowedClientIds.length > 0 ? user.allowedClientIds : null;
    }
    return dbUser;
}

function normalizeEmail(email: string): string {
    return String(email || '').trim().toLowerCase();
}

export function formatUsersApiError(error: unknown, action: 'create' | 'update' | 'delete' = 'create'): string {
    const err = error as { code?: string; status?: number; message?: string; details?: string };
    const msg = String(err?.message || err?.details || '').toLowerCase();

    if (err?.code === '23505' || err?.status === 409) {
        if (msg.includes('email') || msg.includes('users_email')) {
            return (
                'Ese correo ya está registrado en la base de datos con una regla global (probablemente en Opalopy). ' +
                'Ejecute MIGRATION_FIX_USERS_EMAIL_UNIQUE_PER_APP.sql en Supabase para permitir el mismo email por aplicación.'
            );
        }
        return 'Conflicto al guardar el usuario (registro duplicado).';
    }
    if (err?.code === '23503') {
        return 'No se pudo guardar el usuario porque referencia un dato que no existe (cliente u otro registro).';
    }
    if (err?.code === '42501' || err?.status === 403) {
        return 'No tiene permisos para guardar usuarios. Revise las políticas RLS en Supabase.';
    }
    if (err?.code === 'PGRST116') {
        return action === 'create'
            ? 'El usuario se creó pero no es visible. Revise app_name y políticas RLS.'
            : 'Usuario no encontrado.';
    }

    return String(err?.message || `No se pudo ${action === 'create' ? 'crear' : action === 'update' ? 'actualizar' : 'eliminar'} el usuario.`);
}

export const usersApi = {
    // Obtener todos los usuarios (solo de esta app)
    async getAll(): Promise<User[]> {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('app_name', APP_NAME)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return (data || []).map(dbToUser);
    },

    // Obtener un usuario por ID (solo de esta app)
    async getById(id: string): Promise<User | null> {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .eq('app_name', APP_NAME)
            .maybeSingle();
        
        if (error) throw error;
        return data ? dbToUser(data) : null;
    },

    // Obtener usuario por email (solo de esta app)
    async getByEmail(email: string): Promise<User | null> {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', normalizeEmail(email))
            .eq('app_name', APP_NAME)
            .maybeSingle();
        
        if (error) throw error;
        return data ? dbToUser(data) : null;
    },

    // Crear usuario (con app_name automático)
    async create(userData: Omit<User, 'id'>): Promise<User> {
        const email = normalizeEmail(userData.email);
        if (!email) {
            throw new Error('El correo electrónico es obligatorio.');
        }

        const existing = await this.getByEmail(email);
        if (existing) {
            throw new Error('Ya existe un usuario con ese correo electrónico en Opalopy.');
        }

        const dbData = userToDb({ ...userData, email });
        dbData.id = crypto.randomUUID();
        dbData.app_name = APP_NAME;

        const { data, error } = await supabase
            .from('users')
            .insert(dbData)
            .select()
            .single();
        
        if (error) {
            throw new Error(formatUsersApiError(error, 'create'));
        }
        if (!data?.app_name || data.app_name !== APP_NAME) {
            throw new Error(
                `El usuario se guardó con app_name="${data?.app_name ?? 'null'}" en lugar de "${APP_NAME}". ` +
                'Ejecuta MIGRATION_FIX_USERS_ANON_GRANTS.sql en Supabase.'
            );
        }
        const verified = await this.getById(data.id);
        if (!verified) {
            throw new Error(
                'El usuario se creó pero no es visible para esta aplicación. ' +
                'Revisa app_name y las políticas RLS en Supabase.'
            );
        }
        return verified;
    },

    // Actualizar usuario (solo de esta app)
    async update(id: string, userData: Partial<User>): Promise<User> {
        const dbData = userToDb(userData);
        if (dbData.email !== undefined) {
            dbData.email = normalizeEmail(dbData.email);
            const existing = await this.getByEmail(dbData.email);
            if (existing && existing.id !== id) {
                throw new Error('Ya existe otro usuario con ese correo electrónico en Opalopy.');
            }
        }
        // No permitir cambiar app_name
        delete dbData.app_name;
        const { data, error } = await supabase
            .from('users')
            .update(dbData)
            .eq('id', id)
            .eq('app_name', APP_NAME) // Asegurar que solo se actualicen usuarios de esta app
            .select()
            .single();
        
        if (error) {
            throw new Error(formatUsersApiError(error, 'update'));
        }
        return dbToUser(data);
    },

    // Eliminar usuario (solo de esta app)
    async delete(id: string): Promise<void> {
        console.log('usersApi.delete called with id:', id);
        
        // Primero verificar que el usuario existe y pertenece a esta app
        const existingUser = await this.getById(id);
        if (!existingUser) {
            console.warn('User not found or does not belong to this app, cannot delete:', id);
            throw new Error('Usuario no encontrado');
        }
        
        console.log('User exists, proceeding with deletion:', existingUser.email);
        
        // Intentar eliminar - primero sin select para evitar problemas
        const { error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('id', id)
            .eq('app_name', APP_NAME); // Asegurar que solo se eliminen usuarios de esta app
        
        console.log('Delete result (without select):', { deleteError });
        
        if (deleteError) {
            console.error('Supabase delete error details:', {
                message: deleteError.message,
                details: deleteError.details,
                hint: deleteError.hint,
                code: deleteError.code,
                fullError: deleteError
            });
            // Mostrar el error completo en la consola
            console.error('Full error object:', JSON.stringify(deleteError, null, 2));
            throw deleteError;
        }
        
        // Verificar que se eliminó correctamente consultando de nuevo
        const verifyUser = await this.getById(id);
        if (verifyUser) {
            const errorMsg = 'No se pudo eliminar el usuario. Puede que las políticas RLS estén bloqueando la operación.';
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        
        console.log('User deleted successfully. Verified by checking if user still exists.');
    },

    // Login (verificar credenciales - solo usuarios de esta app)
    async login(email: string, password: string): Promise<User | null> {
        const user = await this.getByEmail(email); // Ya filtra por app_name
        if (!user || user.password !== password) {
            return null;
        }
        // Establecer usuario actual en sesión
        await setCurrentUser(user.id);
        return user;
    },
};

