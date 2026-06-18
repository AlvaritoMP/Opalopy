import type { BulkInfoPin, BulkInfoPinColor } from '../types';

export const BULK_INFO_PIN_COLOR_OPTIONS: BulkInfoPinColor[] = [
    'yellow',
    'pink',
    'blue',
    'green',
    'purple',
];

export const BULK_INFO_PIN_STYLES: Record<
    BulkInfoPinColor,
    { button: string; dot: string; label: string }
> = {
    yellow: {
        button: 'bg-amber-100 border-amber-300 text-amber-950 hover:bg-amber-200',
        dot: 'bg-amber-400',
        label: 'Amarillo',
    },
    pink: {
        button: 'bg-pink-100 border-pink-300 text-pink-950 hover:bg-pink-200',
        dot: 'bg-pink-400',
        label: 'Rosa',
    },
    blue: {
        button: 'bg-sky-100 border-sky-300 text-sky-950 hover:bg-sky-200',
        dot: 'bg-sky-400',
        label: 'Azul',
    },
    green: {
        button: 'bg-emerald-100 border-emerald-300 text-emerald-950 hover:bg-emerald-200',
        dot: 'bg-emerald-400',
        label: 'Verde',
    },
    purple: {
        button: 'bg-violet-100 border-violet-300 text-violet-950 hover:bg-violet-200',
        dot: 'bg-violet-400',
        label: 'Morado',
    },
};

export function createBulkInfoPin(partial?: Partial<BulkInfoPin>): BulkInfoPin {
    return {
        id: partial?.id || `pin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: partial?.title ?? 'Nueva referencia',
        content: partial?.content ?? '',
        color: partial?.color ?? 'yellow',
    };
}

export function getBulkInfoPinStyle(color?: BulkInfoPinColor) {
    return BULK_INFO_PIN_STYLES[color || 'yellow'];
}

/** Tamaño máximo del PNG antes de guardar en bulk_config (bytes) */
export const BULK_INFO_PIN_IMAGE_MAX_MB = 3.5;
export const BULK_INFO_PIN_IMAGE_MAX_BYTES = BULK_INFO_PIN_IMAGE_MAX_MB * 1024 * 1024;

export function bulkInfoPinHasImage(pin: BulkInfoPin): boolean {
    return Boolean(pin.imageDataUrl?.startsWith('data:image/'));
}

export function validateBulkInfoPinImageFile(
    file: File,
    options?: { fromClipboard?: boolean }
): string | null {
    const type = file.type || '';
    if (options?.fromClipboard) {
        if (type && !type.startsWith('image/')) {
            return 'El portapapeles no contiene una imagen válida.';
        }
    } else if (type !== 'image/png') {
        return 'Solo se permiten archivos PNG.';
    }
    if (file.size > BULK_INFO_PIN_IMAGE_MAX_BYTES) {
        return `La imagen no puede superar ${BULK_INFO_PIN_IMAGE_MAX_MB} MB.`;
    }
    return null;
}

/** Extrae la primera imagen del portapapeles (Ctrl+V). */
export function getImageFileFromClipboardEvent(event: ClipboardEvent): File | null {
    const items = event.clipboardData?.items;
    if (!items) return null;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            return item.getAsFile();
        }
    }
    return null;
}
