import type {
    BulkQuickReply,
    BulkQuickReplyAttachment,
    BulkQuickReplyAttachmentType,
    Process,
} from '../types';
import { getBulkInfoPinStyle } from './bulkInfoPins';

export { getBulkInfoPinStyle };

export const BULK_QUICK_REPLY_ATTACHMENT_MAX_BYTES: Record<BulkQuickReplyAttachmentType, number> = {
    image: 2.5 * 1024 * 1024,
    video: 8 * 1024 * 1024,
    file: 5 * 1024 * 1024,
};

const ACCEPTED_MIME_PREFIX: Record<BulkQuickReplyAttachmentType, string[]> = {
    image: ['image/'],
    video: ['video/'],
    file: [],
};

export interface BulkQuickReplyProcessEntry {
    processId: string;
    processTitle: string;
    reply: BulkQuickReply;
}

export function quickReplyCopyKey(processId: string, replyId: string): string {
    return `${processId}:${replyId}`;
}

export function collectQuickRepliesFromProcesses(
    processes: Process[],
    options?: { currentProcessId?: string }
): BulkQuickReplyProcessEntry[] {
    const entries: BulkQuickReplyProcessEntry[] = [];
    for (const p of processes) {
        for (const reply of p.bulkConfig?.quickReplies ?? []) {
            entries.push({
                processId: p.id,
                processTitle: p.title,
                reply,
            });
        }
    }
    entries.sort((a, b) => {
        if (options?.currentProcessId) {
            const aCurrent = a.processId === options.currentProcessId;
            const bCurrent = b.processId === options.currentProcessId;
            if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
        }
        const byProcess = a.processTitle.localeCompare(b.processTitle, 'es');
        if (byProcess !== 0) return byProcess;
        return a.reply.title.localeCompare(b.reply.title, 'es');
    });
    return entries;
}

export function createBulkQuickReply(partial?: Partial<BulkQuickReply>): BulkQuickReply {
    return {
        id: partial?.id || `qr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: partial?.title ?? 'Nueva respuesta',
        content: partial?.content ?? '',
        color: partial?.color ?? 'blue',
        attachments: partial?.attachments ?? [],
    };
}

export function createBulkQuickReplyAttachment(
    partial?: Partial<BulkQuickReplyAttachment>
): BulkQuickReplyAttachment {
    return {
        id: partial?.id || `qra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: partial?.type ?? 'file',
        fileName: partial?.fileName ?? 'archivo',
        mimeType: partial?.mimeType,
        dataUrl: partial?.dataUrl,
        url: partial?.url,
    };
}

export function bulkQuickReplyHasAttachments(reply: BulkQuickReply): boolean {
    return (reply.attachments?.length ?? 0) > 0;
}

export function bulkQuickReplyAttachmentCount(reply: BulkQuickReply): number {
    return reply.attachments?.length ?? 0;
}

export function validateBulkQuickReplyAttachmentFile(
    file: File,
    type: BulkQuickReplyAttachmentType,
    options?: { fromClipboard?: boolean }
): string | null {
    const maxBytes = BULK_QUICK_REPLY_ATTACHMENT_MAX_BYTES[type];
    const mime = file.type || '';

    if (options?.fromClipboard) {
        if (type === 'image' && mime && !mime.startsWith('image/')) {
            return 'El portapapeles no contiene una imagen válida.';
        }
    } else {
        const prefixes = ACCEPTED_MIME_PREFIX[type];
        if (prefixes.length > 0 && mime && !prefixes.some(p => mime.startsWith(p))) {
            return type === 'image'
                ? 'Seleccione un archivo de imagen.'
                : 'Seleccione un archivo de video.';
        }
    }

    if (file.size > maxBytes) {
        return `El archivo no puede superar ${Math.round(maxBytes / (1024 * 1024))} MB.`;
    }
    return null;
}

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

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function attachmentPlainLine(att: BulkQuickReplyAttachment): string {
    if (att.url?.trim()) return att.url.trim();
    if (att.dataUrl) return `[${att.fileName}]`;
    return `[${att.fileName}]`;
}

function attachmentHtmlBlock(att: BulkQuickReplyAttachment): string {
    if (att.type === 'image' && att.dataUrl) {
        return `<img src="${att.dataUrl}" alt="${escapeHtml(att.fileName)}" />`;
    }
    const href = att.url?.trim() || att.dataUrl || '#';
    const label = escapeHtml(att.fileName);
    return `<a href="${href}">${label}</a>`;
}

export function buildBulkQuickReplyPlainText(reply: BulkQuickReply): string {
    const parts: string[] = [];
    const text = reply.content?.trim();
    if (text) parts.push(text);
    const attachments = reply.attachments ?? [];
    if (attachments.length > 0) {
        const lines = attachments.map(attachmentPlainLine);
        parts.push(lines.join('\n'));
    }
    return parts.join('\n\n');
}

export function buildBulkQuickReplyHtml(reply: BulkQuickReply): string {
    const chunks: string[] = [];
    const text = reply.content?.trim();
    if (text) {
        chunks.push(`<div>${escapeHtml(text).replace(/\n/g, '<br>')}</div>`);
    }
    for (const att of reply.attachments ?? []) {
        chunks.push(`<div>${attachmentHtmlBlock(att)}</div>`);
    }
    return chunks.join('');
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob | null> {
    try {
        const res = await fetch(dataUrl);
        return await res.blob();
    } catch {
        return null;
    }
}

export interface CopyBulkQuickReplyResult {
    success: boolean;
    message: string;
}

/** Copia texto enriquecido y, si hay imagen, también el blob para pegar en chats. */
export async function copyBulkQuickReplyToClipboard(
    reply: BulkQuickReply
): Promise<CopyBulkQuickReplyResult> {
    const plain = buildBulkQuickReplyPlainText(reply);
    const html = buildBulkQuickReplyHtml(reply);
    const attachments = reply.attachments ?? [];
    const imageAttachment = attachments.find(a => a.type === 'image' && a.dataUrl);

    if (!plain && attachments.length === 0) {
        return { success: false, message: 'La respuesta está vacía' };
    }

    try {
        if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
            const clipItems: Record<string, Blob> = {
                'text/plain': new Blob([plain || ' '], { type: 'text/plain' }),
            };
            if (html) {
                clipItems['text/html'] = new Blob([html], { type: 'text/html' });
            }
            if (imageAttachment?.dataUrl) {
                const blob = await dataUrlToBlob(imageAttachment.dataUrl);
                if (blob) {
                    clipItems[blob.type || 'image/png'] = blob;
                }
            }
            await navigator.clipboard.write([new ClipboardItem(clipItems)]);
            const extra =
                attachments.length > 1
                    ? ' (texto + adjuntos; algunas apps requieren pegar por separado)'
                    : imageAttachment
                      ? ' (texto e imagen)'
                      : '';
            return { success: true, message: `Copiado al portapapeles${extra}` };
        }

        await navigator.clipboard.writeText(plain);
        return { success: true, message: 'Texto copiado al portapapeles' };
    } catch {
        try {
            await navigator.clipboard.writeText(plain);
            return { success: true, message: 'Texto copiado al portapapeles' };
        } catch {
            return { success: false, message: 'No se pudo copiar. Prueba con Ctrl+C manualmente.' };
        }
    }
}

export interface BulkQuickReplyEmojiGroup {
    label: string;
    emojis: string[];
}

/** Emojis frecuentes para respuestas rápidas, agrupados por uso */
export const COMMON_REPLY_EMOJI_GROUPS: BulkQuickReplyEmojiGroup[] = [
    {
        label: 'General',
        emojis: ['😊', '👍', '🙏', '✅', '📞', '📅', '📍', '💼', '🎉', '❗', '⚠️', '📝'],
    },
    {
        label: 'Operaciones',
        emojis: ['🧹', '⛽', '👷', '👷‍♂️', '👷‍♀️', '🧽', '🔧', '🛠️', '🚛', '🚌', '🏗️'],
    },
    {
        label: 'Gestos y saludo',
        emojis: ['🙌', '👋', '🤝', '🙋', '🙋‍♂️', '🙋‍♀️', '✋', '🤲', '🫡', '🥳', '🎅', '🧑‍🎄'],
    },
    {
        label: 'Personas y roles',
        emojis: [
            '🧑‍🔧',
            '🧑‍🏭',
            '🧑‍🍳',
            '🧑‍🌾',
            '🧑‍💼',
            '🧑‍🏫',
            '🧑‍⚕️',
            '🧑‍🚒',
            '🧑‍✈️',
            '👮',
            '👮‍♂️',
            '👮‍♀️',
            '🧑‍🎓',
            '🧑‍🤝‍🧑',
            '👥',
            '👨‍👩‍👧',
            '👨‍👩‍👧‍👦',
            '🧑',
            '👨',
            '👩',
            '🧑‍🦽',
            '🧑‍🦯',
        ],
    },
];

/** Lista plana (compatibilidad) */
export const COMMON_REPLY_EMOJIS = COMMON_REPLY_EMOJI_GROUPS.flatMap(g => g.emojis);
