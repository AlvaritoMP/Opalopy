export async function runWithAbortTimeout<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number
): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fn(controller.signal);
    } catch (error) {
        if (controller.signal.aborted) {
            throw new Error(`Timeout tras ${timeoutMs}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

export function isAbortOrTimeoutError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return msg.includes('Timeout') || msg.includes('timeout') || msg.includes('aborted');
}
