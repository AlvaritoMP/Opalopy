import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Copy, Loader2, Paperclip, MessageSquare } from 'lucide-react';
import type { BulkQuickReplyProcessEntry } from '../lib/bulkQuickReplies';
import {
    bulkQuickReplyAttachmentCount,
    getBulkInfoPinStyle,
    quickReplyCopyKey,
} from '../lib/bulkQuickReplies';

interface BulkQuickRepliesGlobalPanelProps {
    isOpen: boolean;
    onClose: () => void;
    entries: BulkQuickReplyProcessEntry[];
    currentProcessId?: string;
    copyingKey?: string | null;
    onCopyReply: (entry: BulkQuickReplyProcessEntry) => void;
}

function replyPreview(content: string, maxLen = 80): string {
    const text = content.trim().replace(/\s+/g, ' ');
    if (!text) return '(sin texto)';
    return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

export const BulkQuickRepliesGlobalPanel: React.FC<BulkQuickRepliesGlobalPanelProps> = ({
    isOpen,
    onClose,
    entries,
    currentProcessId,
    copyingKey,
    onCopyReply,
}) => {
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!isOpen) setQuery('');
    }, [isOpen]);

    const filteredEntries = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return entries;
        return entries.filter(entry => {
            const haystack = [
                entry.processTitle,
                entry.reply.title,
                entry.reply.content,
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [entries, query]);

    const grouped = useMemo(() => {
        const map = new Map<string, { processTitle: string; items: BulkQuickReplyProcessEntry[] }>();
        for (const entry of filteredEntries) {
            const group = map.get(entry.processId);
            if (group) {
                group.items.push(entry);
            } else {
                map.set(entry.processId, {
                    processTitle: entry.processTitle,
                    items: [entry],
                });
            }
        }
        const groups = Array.from(map.entries()).map(([processId, value]) => ({
            processId,
            processTitle: value.processTitle,
            items: value.items,
            isCurrent: processId === currentProcessId,
        }));
        groups.sort((a, b) => {
            if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
            return a.processTitle.localeCompare(b.processTitle, 'es');
        });
        return groups;
    }, [filteredEntries, currentProcessId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <button
                type="button"
                className="absolute inset-0 bg-black/30"
                aria-label="Cerrar panel"
                onClick={onClose}
            />
            <aside
                className="relative flex flex-col w-full max-w-md h-full bg-white shadow-2xl border-l border-gray-200"
                role="dialog"
                aria-label="Todas las respuestas rápidas"
            >
                <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-sky-600 shrink-0" />
                            <h2 className="text-sm font-semibold text-gray-900">
                                Todas las respuestas rápidas
                            </h2>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">
                            {entries.length} respuesta{entries.length !== 1 ? 's' : ''} en{' '}
                            {new Set(entries.map(e => e.processId)).size} proceso
                            {new Set(entries.map(e => e.processId)).size !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 shrink-0"
                        title="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="search"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Buscar por proceso, título o texto..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-2 py-2">
                    {entries.length === 0 ? (
                        <p className="px-2 py-8 text-sm text-center text-gray-500">
                            Aún no hay respuestas rápidas en ningún proceso masivo.
                        </p>
                    ) : filteredEntries.length === 0 ? (
                        <p className="px-2 py-8 text-sm text-center text-gray-500">
                            Ninguna respuesta coincide con la búsqueda.
                        </p>
                    ) : (
                        grouped.map(group => (
                            <section key={group.processId} className="mb-4">
                                <div
                                    className={`sticky top-0 z-10 px-2 py-1.5 mb-1 rounded-md text-xs font-semibold uppercase tracking-wide ${
                                        group.isCurrent
                                            ? 'bg-sky-100 text-sky-900'
                                            : 'bg-gray-100 text-gray-600'
                                    }`}
                                >
                                    {group.processTitle}
                                    {group.isCurrent && (
                                        <span className="ml-1.5 font-normal normal-case tracking-normal text-sky-700">
                                            (proceso actual)
                                        </span>
                                    )}
                                </div>
                                <ul className="space-y-1">
                                    {group.items.map(entry => {
                                        const style = getBulkInfoPinStyle(entry.reply.color);
                                        const attachmentCount = bulkQuickReplyAttachmentCount(entry.reply);
                                        const copyKey = quickReplyCopyKey(entry.processId, entry.reply.id);
                                        const isCopying = copyingKey === copyKey;
                                        return (
                                            <li key={copyKey}>
                                                <button
                                                    type="button"
                                                    onClick={() => onCopyReply(entry)}
                                                    disabled={isCopying}
                                                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${style.button} ${
                                                        isCopying ? 'opacity-60 cursor-wait' : 'hover:brightness-95'
                                                    }`}
                                                    title={`Copiar: ${entry.reply.title}`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <span
                                                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`}
                                                                />
                                                                <span className="text-sm font-semibold truncate">
                                                                    {entry.reply.title}
                                                                </span>
                                                                {attachmentCount > 0 && (
                                                                    <Paperclip
                                                                        className="w-3 h-3 shrink-0 opacity-70"
                                                                        aria-hidden
                                                                    />
                                                                )}
                                                            </div>
                                                            <p className="mt-1 text-xs opacity-80 line-clamp-2">
                                                                {replyPreview(entry.reply.content)}
                                                            </p>
                                                        </div>
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide bg-white/70 border border-black/10 rounded-md shrink-0">
                                                            {isCopying ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <Copy className="w-3 h-3" />
                                                            )}
                                                            Copiar
                                                        </span>
                                                    </div>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        ))
                    )}
                </div>
            </aside>
        </div>
    );
};
