import { createClient } from '@supabase/supabase-js';

// Configura estas variables en .env.local
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validar que las credenciales estén configuradas
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase no está configurado. Por favor, configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local');
}

// Configurar cliente de Supabase con opciones mejoradas
// Si no hay credenciales, usar valores dummy para evitar errores de inicialización
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
    auth: {
        persistSession: false, // No persistir sesión en localStorage para evitar problemas
        autoRefreshToken: false,
    },
    global: {
        headers: {
            'X-Client-Info': 'ats-pro-web',
        },
    },
    db: {
        schema: 'public',
    },
});

// Función helper para detectar y manejar errores de CORS
// Solo detecta errores REALES de CORS, no errores de red genéricos
export function isCorsError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = (error.message || error.toString() || '').toLowerCase();
    const errorCode = error.code || '';
    
    // Solo detectar errores específicos de CORS, no errores de red genéricos
    // Los errores reales de CORS tienen mensajes específicos del navegador
    const isRealCorsError = (
        errorMessage.includes('cors') && (
            errorMessage.includes('policy') ||
            errorMessage.includes('blocked') ||
            errorMessage.includes('not allowed')
        )
    ) || 
    errorMessage.includes('access-control-allow-origin') ||
    errorCode === 'CORS_ERROR' ||
    (errorMessage.includes('fetch') && errorMessage.includes('blocked') && errorMessage.includes('cors'));
    
    return isRealCorsError;
}

// Función helper para obtener mensaje de error más claro
export function getErrorMessage(error: any): string {
    if (isCorsError(error)) {
        const currentOrigin = window.location.origin;
        return `Error de CORS: El dominio ${currentOrigin} no está permitido en Supabase. Por favor, agrega este dominio en la configuración de CORS de Supabase. Ver SOLUCION_CORS_SUPABASE.md para más detalles.`;
    }
    
    if (error?.message) {
        return error.message;
    }
    
    if (typeof error === 'string') {
        return error;
    }
    
    return 'Error desconocido al conectar con Supabase';
}

// Función helper para verificar si Supabase está configurado
export function isSupabaseConfigured(): boolean {
    return !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co');
}

// Función helper para establecer el usuario actual en la sesión
export async function setCurrentUser(userId: string) {
    if (!isSupabaseConfigured()) {
        console.warn('Supabase no está configurado, saltando setCurrentUser');
        return;
    }
    try {
        // Intentar usar la función RPC si existe
        const { error } = await supabase.rpc('set_current_user', { user_id: userId });
        if (error) {
            // Si la función RPC no existe o falla, simplemente continuar
            // Las políticas RLS usarán el userId del localStorage
            console.warn('set_current_user RPC not available, using localStorage fallback:', error.message);
        }
    } catch (err) {
        // Si hay un error, simplemente continuar - no es crítico
        console.warn('Error in setCurrentUser (non-critical):', err);
    }
}


