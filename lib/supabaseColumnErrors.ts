/** Errores de PostgREST/Postgres por columnas o tablas inexistentes (migraciones pendientes). */

export function isMissingColumnError(error: { message?: string; code?: string; status?: number } | null): boolean {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        msg.includes('schema cache') ||
        msg.includes('could not find') ||
        msg.includes('application_count') ||
        msg.includes('first_application_at') ||
        msg.includes('bulk_column_values') ||
        (msg.includes('column') && (msg.includes('candidates') || msg.includes('does not exist')))
    );
}

export function isMissingTableError(error: { message?: string; code?: string; status?: number } | null): boolean {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        error.status === 404 ||
        msg.includes('schema cache') ||
        msg.includes('could not find the table') ||
        (msg.includes('relation') && msg.includes('does not exist'))
    );
}
