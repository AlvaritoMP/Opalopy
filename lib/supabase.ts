import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://afhiiplxqtodqxvmswor.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmaGlpcGx4cXRvZHF4dm1zd29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4Njg4MTYsImV4cCI6MjA3ODQ0NDgxNn0.r9YmrHHajLsd5YHUkPnmD7UazpvmsW0TfqC5jy0_3ZU';

const SUPABASE_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_SUPABASE_REQUEST_TIMEOUT_MS) || 30000;
const RETRIABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504, 522, 523, 524]);
const RETRIABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getRequestMethod(init?: RequestInit): string {
    return (init?.method || 'GET').toUpperCase();
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
    return 350 * (attempt + 1);
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const method = getRequestMethod(init);
    const canRetry = RETRIABLE_METHODS.has(method);
    const maxAttempts = canRetry ? 3 : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(input, {
                ...init,
                signal: controller.signal,
            });

            if (!canRetry || !RETRIABLE_STATUS_CODES.has(response.status) || attempt === maxAttempts - 1) {
                return response;
            }
        } catch (error) {
            lastError = error;

            if (!canRetry || attempt === maxAttempts - 1) {
                throw error;
            }
        } finally {
            window.clearTimeout(timeoutId);
        }

        await delay(getRetryDelay(attempt));
    }

    throw lastError instanceof Error ? lastError : new Error('Supabase request failed after retries');
}

// Configurar cliente de Supabase con opciones mejoradas
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false, // No persistir sesión en localStorage para evitar problemas
        autoRefreshToken: false,
    },
    db: {
        schema: 'public',
    },
    global: {
        fetch: fetchWithTimeout,
        headers: {
            'X-Client-Info': 'ats-pro-web',
        },
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
    return !!(supabaseUrl && supabaseAnonKey);
}

// Función helper para establecer el usuario actual en la sesión
export async function setCurrentUser(userId: string) {
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

// Función helper para obtener el usuario actual
export async function getCurrentUserId(): Promise<string | null> {
    try {
        const { data, error } = await supabase.rpc('get_current_user_id');
        if (error) {
            console.error('Error getting current user:', error);
            return null;
        }
        return data;
    } catch (err) {
        console.error('Error in getCurrentUserId:', err);
        return null;
    }
}

