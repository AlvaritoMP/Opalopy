/** Logs de desarrollo — no aparecen en producción */
const enabled = import.meta.env.DEV;

export function debugLog(...args: unknown[]): void {
    if (enabled) console.log(...args);
}

export function debugWarn(...args: unknown[]): void {
    if (enabled) console.warn(...args);
}

export function debugInfo(...args: unknown[]): void {
    if (enabled) console.info(...args);
}
