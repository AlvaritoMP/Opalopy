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
    return dbUser;
}

export const usersApi = {
    // Obtener todos los usuarios
    async getAll(): Promise<User[]> {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('app_name', APP_NAME)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return (data || []).map(dbToUser);
    },

    // Obtener un usuario por ID
    async getById(id: string): Promise<User | null> {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .eq('app_name', APP_NAME)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') return null; // No encontrado
            throw error;
        }
        return data ? dbToUser(data) : null;
    },

    // Obtener usuario por email
    async getByEmail(email: string): Promise<User | null> {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase())
            .eq('app_name', APP_NAME)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data ? dbToUser(data) : null;
    },

    // Crear usuario
    async create(userData: Omit<User, 'id'>): Promise<User> {
        const dbData = userToDb(userData);
        dbData.app_name = APP_NAME;
        const { data, error } = await supabase
            .from('users')
            .insert(dbData)
            .select()
            .single();
        
        if (error) throw error;
        return dbToUser(data);
    },

    // Actualizar usuario
    async update(id: string, userData: Partial<User>): Promise<User> {
        const dbData = userToDb(userData);
        delete dbData.app_name; // No permitir cambiar app_name
        const { data, error } = await supabase
            .from('users')
            .update(dbData)
            .eq('id', id)
            .eq('app_name', APP_NAME)
            .select()
            .single();
        
        if (error) throw error;
        return dbToUser(data);
    },

    // Eliminar usuario
    async delete(id: string): Promise<void> {
        console.log('usersApi.delete called with id:', id);
        
        // Primero verificar que el usuario existe
        const existingUser = await this.getById(id);
        if (!existingUser) {
            console.warn('User not found, cannot delete:', id);
            throw new Error('Usuario no encontrado');
        }
        
        console.log('User exists, proceeding with deletion:', existingUser.email);
        
        // Intentar eliminar - primero sin select para evitar problemas
        const { error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('id', id)
            .eq('app_name', APP_NAME);
        
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

    // Login (verificar credenciales)
    async login(email: string, password: string): Promise<User | null> {
        const user = await this.getByEmail(email);
        if (!user || user.password !== password) {
            return null;
        }
        // Establecer usuario actual en sesión
        await setCurrentUser(user.id);
        return user;
    },
};

