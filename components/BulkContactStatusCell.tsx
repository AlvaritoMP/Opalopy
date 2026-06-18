import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Phone, MessageCircle, Mail, Loader2, Clock, ChevronDown, X, Undo2, Trash2, Lock, Copy, ExternalLink } from 'lucide-react';
import {
    contactTrackingApi,
    parseUndoFromAttemptNotes,
    type ResetContactTrackingResult,
} from '../lib/api/contactTracking';
import { ContactLockError, formatContactLockMessage, type ContactLockInfo } from '../lib/contactLock';
import type { ContactAttempt, ContactOutcome, ContactStatus } from '../lib/contactTracking';
import type { ContactAttemptChannel } from '../lib/contactChannelConfig';
import { CONTACT_CHANNELS, hasChannelContactTracking } from '../lib/contactChannelConfig';
import {
    CONTACT_STATUS_META,
    QUICK_STATUS_OPTIONS,
    getContactBadgeLabelCompact,
    isContactCooldownActive,
    formatContactLastAtCompact,
    formatContactCooldownWarning,
    formatAttemptHistoryLine,
    isSyncedContactAttempt,
    CONTACT_OUTCOME_LABELS,
} from '../lib/contactTracking';
import { formatBulkDateTime } from '../lib/bulkTableColumns';

function buildCellTooltip(
    lastAttemptAt?: string,
    lastUserName?: string,
    cooldown?: boolean,
    cooldownMsg?: string
): string | undefined {
    const parts: string[] = [];
    if (lastAttemptAt) {
        parts.push(formatBulkDateTime(lastAttemptAt));
        if (lastUserName) parts.push(`por ${lastUserName}`);
    }
    if (cooldown && cooldownMsg) parts.push(cooldownMsg);
    return parts.length ? parts.join(' · ') : undefined;
}
import type { ChannelContactSummary } from '../lib/contactChannelConfig';
import type { BulkContactMessageTemplate } from '../types';
import {
    applyContactMessageTemplate,
    copyContactMessageToClipboard,
    filterContactTemplatesByChannel,
} from '../lib/contactMessageTemplates';
import { openMailCompose, getMailComposeToastMessage } from '../lib/openMailto';

export interface BulkContactStatusCellProps {
    channel: ContactAttemptChannel;
    candidateId: string;
    candidateName?: string;
    processId: string;
    /** Teléfono o email del candidato para acciones rápidas */
    contactAddress?: string;
    summary: ChannelContactSummary;
    userId?: string;
    userName?: string;
    onSummaryChange: (
        summary: ChannelContactSummary,
        actionType: 'contact_attempt' | 'contact_status',
        channel: ContactAttemptChannel
    ) => void;
    onResetChannel?: (result: ResetContactTrackingResult) => void;
    disabled?: boolean;
    /** Reserva activa de contactología (otro usuario o ventana de subida) */
    contactLock?: ContactLockInfo | null;
    isContactLocked?: boolean;
    onLockBlocked?: (message: string) => void;
    /** Plantillas de correo/WhatsApp del proceso masivo */
    contactTemplates?: BulkContactMessageTemplate[];
    processTitle?: string;
    onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type PopoverMode = 'status' | 'history' | 'templates' | null;

const POPOVER_WIDTH = 288;
const TEMPLATE_POPOVER_WIDTH = 260;
const POPOVER_MAX_HEIGHT = 420;

const ATTEMPT_OUTCOMES: Record<ContactAttemptChannel, { outcome: ContactOutcome; label: string }[]> = {
    call: [
        { outcome: 'no_answer', label: 'No contestó' },
        { outcome: 'busy', label: 'Ocupado' },
        { outcome: 'answered', label: 'Contestó' },
    ],
    whatsapp: [
        { outcome: 'no_response', label: 'Sin respuesta' },
        { outcome: 'answered', label: 'Respondió' },
    ],
    email: [
        { outcome: 'no_response', label: 'Sin respuesta' },
        { outcome: 'answered', label: 'Respondió' },
    ],
};

function computePopoverPosition(anchorRect: DOMRect, preferHeight: number, width = POPOVER_WIDTH) {
    const margin = 8;
    const maxH = Math.min(POPOVER_MAX_HEIGHT, window.innerHeight - margin * 2);
    const height = Math.min(preferHeight, maxH);

    let left = anchorRect.left;
    if (left + width > window.innerWidth - margin) {
        left = window.innerWidth - width - margin;
    }
    left = Math.max(margin, left);

    const spaceBelow = window.innerHeight - anchorRect.bottom - margin;
    const spaceAbove = anchorRect.top - margin;
    const openUp = spaceBelow < height && spaceAbove > spaceBelow;

    let top = openUp ? anchorRect.top - height - 4 : anchorRect.bottom + 4;
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));

    return { left, top, maxHeight: maxH };
}

export const BulkContactStatusCell: React.FC<BulkContactStatusCellProps> = React.memo(({
    channel,
    candidateId,
    candidateName,
    processId,
    contactAddress,
    summary,
    userId,
    userName,
    onSummaryChange,
    onResetChannel,
    disabled = false,
    contactLock = null,
    isContactLocked = false,
    onLockBlocked,
    contactTemplates = [],
    processTitle,
    onNotify,
}) => {
    const { status, attemptCount, lastAttemptAt, lastUserName } = summary;
    const channelDef = CONTACT_CHANNELS[channel];
    const effectiveDisabled = disabled || isContactLocked;
    const lockMessage = isContactLocked && contactLock ? formatContactLockMessage(contactLock) : undefined;

    const handleContactError = (error: unknown) => {
        if (error instanceof ContactLockError) {
            onLockBlocked?.(formatContactLockMessage(error.lock));
            return;
        }
        throw error;
    };

    const [popover, setPopover] = useState<PopoverMode>(null);
    const [popoverPos, setPopoverPos] = useState({ left: 0, top: 0, maxHeight: POPOVER_MAX_HEIGHT });
    const [history, setHistory] = useState<ContactAttempt[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [canUndo, setCanUndo] = useState(false);
    const [undoPreview, setUndoPreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const badgeRef = useRef<HTMLButtonElement>(null);
    const quickBtnRef = useRef<HTMLButtonElement>(null);

    const channelTemplates = useMemo(
        () =>
            channel === 'email' || channel === 'whatsapp'
                ? filterContactTemplatesByChannel(contactTemplates, channel)
                : [],
        [contactTemplates, channel]
    );

    const templateVars = useMemo(
        () => ({
            nombre: candidateName,
            email: channel === 'email' ? contactAddress : undefined,
            telefono: channel === 'whatsapp' ? contactAddress : undefined,
            puesto: processTitle,
        }),
        [candidateName, contactAddress, channel, processTitle]
    );

    const closePopover = useCallback(() => setPopover(null), []);

    const cooldown = isContactCooldownActive(lastAttemptAt);
    const meta = CONTACT_STATUS_META[status];
    const badgeLabel = getContactBadgeLabelCompact(status, attemptCount);
    const cellTooltip = buildCellTooltip(
        lastAttemptAt,
        lastUserName,
        cooldown && !isContactLocked,
        !isContactLocked && cooldown && lastAttemptAt
            ? formatContactCooldownWarning(lastAttemptAt, lastUserName)
            : undefined
    );

    const openPopover = useCallback((mode: PopoverMode, el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        const preferHeight = mode === 'status' ? 400 : mode === 'templates' ? 280 : 320;
        const width = mode === 'templates' ? TEMPLATE_POPOVER_WIDTH : POPOVER_WIDTH;
        setPopoverPos(computePopoverPosition(rect, preferHeight, width));
        setPopover(mode);
    }, []);

    const toggleStatusPopover = useCallback(
        (e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            if (popover === 'status') {
                closePopover();
                return;
            }
            openPopover('status', e.currentTarget);
        },
        [popover, closePopover, openPopover]
    );

    useEffect(() => {
        if (!popover) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closePopover();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [popover, closePopover]);

    useEffect(() => {
        if (!popover) return;
        const closeOnOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (rootRef.current?.contains(target)) return;
            const pop = document.getElementById(`contact-popover-${candidateId}-${channel}`);
            if (pop?.contains(target)) return;
            closePopover();
        };
        document.addEventListener('mousedown', closeOnOutside);
        return () => document.removeEventListener('mousedown', closeOnOutside);
    }, [popover, candidateId, channel, closePopover]);

    useLayoutEffect(() => {
        if (!popover) return;
        const el =
            popover === 'templates'
                ? quickBtnRef.current
                : badgeRef.current;
        if (!el) return;
        const preferHeight = popover === 'status' ? 400 : popover === 'templates' ? 280 : 320;
        const width = popover === 'templates' ? TEMPLATE_POPOVER_WIDTH : POPOVER_WIDTH;
        setPopoverPos(computePopoverPosition(el.getBoundingClientRect(), preferHeight, width));
    }, [popover]);

    useEffect(() => {
        if (!popover || popover === 'templates') return;
        let cancelled = false;
        setLoadingHistory(true);
        contactTrackingApi
            .getHistory(candidateId, channel, popover === 'history' ? 25 : 1)
            .then((rows) => {
                if (cancelled) return;
                setHistory(rows);
                const latest = rows[0];
                if (!latest) {
                    setCanUndo(false);
                    setUndoPreview(null);
                    return;
                }
                const snap = parseUndoFromAttemptNotes(latest.notes, latest.attemptNumber);
                if (snap) {
                    setCanUndo(true);
                    setUndoPreview(
                        `${CONTACT_STATUS_META[snap.statusBefore].label} · ${snap.attemptCountBefore} intento(s)`
                    );
                } else {
                    setCanUndo(true);
                    setUndoPreview('Estado anterior');
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setHistory([]);
                    setCanUndo(false);
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingHistory(false);
            });
        return () => {
            cancelled = true;
        };
    }, [popover, candidateId, channel]);

    const applySummary = useCallback(
        (
            next: Awaited<ReturnType<typeof contactTrackingApi.recordAttempt>>,
            actionType: 'contact_attempt' | 'contact_status'
        ) => {
            if (!next) return;
            onSummaryChange(next, actionType, channel);
        },
        [onSummaryChange, channel]
    );

    const handleMarkAttempt = async (outcome: ContactOutcome) => {
        if (effectiveDisabled || saving) return;
        setSaving(true);
        try {
            const result = await contactTrackingApi.recordAttempt({
                candidateId,
                processId,
                channel,
                outcome,
                userId,
                userName,
            });
            applySummary(result, 'contact_attempt');
            closePopover();
        } catch (error) {
            handleContactError(error);
        } finally {
            setSaving(false);
        }
    };

    const handleSetStatus = async (newStatus: ContactStatus) => {
        if (effectiveDisabled || saving || newStatus === status) return;
        setSaving(true);
        try {
            const result = await contactTrackingApi.setStatus({
                candidateId,
                processId,
                channel,
                status: newStatus,
                userId,
                userName,
            });
            applySummary(result, 'contact_status');
            closePopover();
        } catch (error) {
            handleContactError(error);
        } finally {
            setSaving(false);
        }
    };

    const handleUndo = async () => {
        if (effectiveDisabled || saving || !canUndo) return;
        setSaving(true);
        try {
            const result = await contactTrackingApi.revertLastAction({
                candidateId,
                processId,
                channel,
                userId,
                userName,
            });
            applySummary(result, 'contact_status');
            closePopover();
        } catch (error) {
            handleContactError(error);
        } finally {
            setSaving(false);
        }
    };

    const handleQuickAction = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (effectiveDisabled || saving || !contactAddress) return;

        if (channel === 'whatsapp' || channel === 'email') {
            if (popover === 'templates') {
                closePopover();
            } else {
                openPopover('templates', e.currentTarget);
            }
            return;
        }
        void handleMarkAttempt('no_answer');
    };

    const afterTemplateAction = async () => {
        closePopover();
        await handleMarkAttempt('no_response');
    };

    const handleTemplateCopy = async (template: BulkContactMessageTemplate) => {
        const subject = applyContactMessageTemplate(template.subject ?? '', templateVars);
        const body = applyContactMessageTemplate(template.body, templateVars);
        const ok = await copyContactMessageToClipboard(channel as 'email' | 'whatsapp', subject, body);
        onNotify?.(ok ? 'Copiado al portapapeles' : 'No se pudo copiar', ok ? 'success' : 'error');
        if (ok) await afterTemplateAction();
    };

    const handleTemplateOpen = async (template: BulkContactMessageTemplate) => {
        if (!contactAddress) return;
        const subject = applyContactMessageTemplate(template.subject ?? '', templateVars);
        const body = applyContactMessageTemplate(template.body, templateVars);

        if (channel === 'whatsapp') {
            const clean = contactAddress.replace(/[^\d]/g, '');
            window.open(`https://wa.me/${clean}?text=${encodeURIComponent(body)}`, '_blank', 'noopener,noreferrer');
            onNotify?.('WhatsApp abierto');
        } else {
            const result = await openMailCompose({ to: [contactAddress], subject, body });
            onNotify?.(getMailComposeToastMessage(result));
        }
        await afterTemplateAction();
    };

    const handleResetChannel = async () => {
        if (effectiveDisabled || saving || !onResetChannel) return;
        const msg =
            `¿Reiniciar el seguimiento de ${channelDef.label}?\n\n` +
            `Esta columna quedará como si nunca se hubiera contactado por este canal. Quedará registrado en el log quién lo hizo.`;
        if (!window.confirm(msg)) return;

        setSaving(true);
        try {
            const result = await contactTrackingApi.resetChannelContactTracking({
                candidateId,
                processId,
                channel,
                userId,
                userName,
            });
            if (result) {
                onResetChannel(result);
                closePopover();
            }
        } catch (error) {
            handleContactError(error);
        } finally {
            setSaving(false);
        }
    };

    const hasTracking = hasChannelContactTracking(summary);

    const QuickIcon = channel === 'email' ? Mail : channel === 'whatsapp' ? MessageCircle : Phone;

    const popoverContent =
        popover &&
        createPortal(
            <>
                <button
                    type="button"
                    className="fixed inset-0 z-[100] cursor-default bg-black/10"
                    aria-label="Cerrar menú"
                    onClick={closePopover}
                />
                <div
                    id={`contact-popover-${candidateId}-${channel}`}
                    role="dialog"
                    aria-modal="true"
                    className="fixed z-[110] flex flex-col bg-white border border-gray-200 rounded-lg shadow-2xl"
                    style={{
                        left: popoverPos.left,
                        top: popoverPos.top,
                        width: popover === 'templates' ? TEMPLATE_POPOVER_WIDTH : POPOVER_WIDTH,
                        maxHeight: popoverPos.maxHeight,
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between shrink-0 px-2 py-1.5 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                        <span className="text-[10px] uppercase tracking-wide text-gray-600 font-semibold">
                            {popover === 'templates' ? `Mensaje · ${channelDef.label}` : channelDef.label}
                        </span>
                        <button type="button" onClick={closePopover} className="p-1 rounded hover:bg-gray-200">
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>

                    <div
                        className="overflow-y-auto overflow-x-hidden overscroll-contain flex-1 min-h-0 p-2"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                        onWheel={(e) => e.stopPropagation()}
                    >
                        {popover === 'status' && (
                            <>
                                {cooldown && lastAttemptAt && (
                                    <p className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5 mb-2">
                                        {formatContactCooldownWarning(lastAttemptAt, lastUserName)}
                                    </p>
                                )}

                                {canUndo && (
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => void handleUndo()}
                                        className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-lg text-sm font-medium border border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100"
                                    >
                                        <Undo2 className="w-4 h-4 shrink-0" />
                                        <span className="text-left">
                                            Deshacer última acción
                                            {undoPreview && (
                                                <span className="block text-[10px] font-normal text-violet-700">
                                                    Volver a: {undoPreview}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                )}

                                <div className="flex flex-col gap-1">
                                    {QUICK_STATUS_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.status}
                                            type="button"
                                            disabled={saving}
                                            onClick={() => void handleSetStatus(opt.status)}
                                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium border ${
                                                status === opt.status
                                                    ? 'bg-primary-50 border-primary-300 text-primary-900'
                                                    : 'border-gray-200 hover:bg-gray-50 text-gray-800'
                                            }`}
                                        >
                                            <span className="mr-1.5">{CONTACT_STATUS_META[opt.status].dot}</span>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                <p className="text-[10px] uppercase tracking-wide text-gray-500 mt-3 mb-1.5 px-1">
                                    Registrar intento
                                </p>
                                <div className="flex flex-col gap-1">
                                    {ATTEMPT_OUTCOMES[channel].map((o) => (
                                        <button
                                            key={o.outcome}
                                            type="button"
                                            disabled={saving}
                                            onClick={() => void handleMarkAttempt(o.outcome)}
                                            className="w-full text-left px-3 py-2 rounded-lg text-sm border border-gray-200 hover:bg-amber-50 text-gray-800"
                                        >
                                            {o.label}
                                            {o.outcome === 'no_answer' && (
                                                <span className="text-[10px] text-gray-500 block">
                                                    +1 intento
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {onResetChannel && hasTracking && (
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => void handleResetChannel()}
                                        className="w-full flex items-center justify-center gap-1.5 mt-3 py-2 text-xs font-medium text-red-700 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Borrar seguimiento ({channelDef.shortLabel})
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={closePopover}
                                    className="w-full mt-2 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                                >
                                    Cerrar sin cambios
                                </button>
                            </>
                        )}

                        {popover === 'templates' && (
                            <>
                                <p className="text-[10px] text-gray-500 px-1 mb-2 truncate" title={candidateName}>
                                    {candidateName || 'Candidato'}
                                </p>
                                {channelTemplates.length === 0 ? (
                                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-2">
                                        Sin plantillas. Configúralas en la barra de herramientas del proceso.
                                    </p>
                                ) : (
                                    <ul className="space-y-1">
                                        {channelTemplates.map(t => (
                                            <li
                                                key={t.id}
                                                className="flex items-center gap-1 rounded-lg border border-gray-200 hover:bg-gray-50 overflow-hidden"
                                            >
                                                <span
                                                    className="flex-1 min-w-0 text-xs font-medium text-gray-800 px-2 py-2 truncate"
                                                    title={t.name}
                                                >
                                                    {t.name}
                                                </span>
                                                <button
                                                    type="button"
                                                    disabled={saving}
                                                    onClick={() => void handleTemplateCopy(t)}
                                                    className="shrink-0 p-2 text-gray-600 hover:bg-gray-100 border-l border-gray-200"
                                                    title="Copiar al portapapeles"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={saving}
                                                    onClick={() => void handleTemplateOpen(t)}
                                                    className={`shrink-0 p-2 border-l border-gray-200 ${
                                                        channel === 'email'
                                                            ? 'text-blue-600 hover:bg-blue-50'
                                                            : 'text-green-600 hover:bg-green-50'
                                                    }`}
                                                    title={channel === 'email' ? 'Abrir correo' : 'Abrir WhatsApp'}
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <button
                                    type="button"
                                    onClick={closePopover}
                                    className="w-full mt-2 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                                >
                                    Cerrar
                                </button>
                            </>
                        )}

                        {popover === 'history' && (
                            <>
                                {loadingHistory ? (
                                    <div className="flex justify-center py-6">
                                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                    </div>
                                ) : history.length === 0 ? (
                                    <p className="text-xs text-gray-500 px-2 py-4">Sin registros en este canal.</p>
                                ) : (
                                    <ul className="space-y-2 pr-1">
                                        {history.map((a) => {
                                            const synced = isSyncedContactAttempt(a);
                                            return (
                                                <li
                                                    key={a.id}
                                                    className={`text-[11px] leading-snug border-l-2 pl-2 ${
                                                        synced
                                                            ? 'text-amber-800 border-amber-300 bg-amber-50/80 rounded-r pr-1 py-1'
                                                            : 'text-gray-700 border-gray-200'
                                                    }`}
                                                >
                                                    {formatAttemptHistoryLine(a)}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                <button
                                    type="button"
                                    onClick={closePopover}
                                    className="w-full mt-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                                >
                                    Cerrar
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </>,
            document.body
        );

    return (
        <div
            ref={rootRef}
            className={`flex items-center gap-0.5 min-w-0 max-w-full leading-none ${
                isContactLocked
                    ? 'ring-1 ring-amber-400 bg-amber-50/60 rounded px-0.5'
                    : cooldown
                      ? 'ring-1 ring-red-300 rounded px-0.5'
                      : ''
            }`}
            onClick={(e) => e.stopPropagation()}
            title={lockMessage || cellTooltip}
        >
            {isContactLocked && (
                <Lock className="w-3 h-3 text-amber-700 shrink-0" aria-hidden />
            )}
            <button
                ref={badgeRef}
                type="button"
                disabled={effectiveDisabled || saving}
                onClick={toggleStatusPopover}
                className={`inline-flex items-center gap-0.5 shrink-0 h-5 min-w-[22px] pl-0.5 pr-1 rounded border text-[10px] font-semibold leading-none whitespace-nowrap ${meta.badgeClass}`}
                aria-expanded={popover === 'status'}
                title="Estado de contacto"
            >
                <span className="text-[10px] leading-none">{meta.dot}</span>
                {badgeLabel ? <span>{badgeLabel}</span> : null}
                <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 opacity-70 ${popover === 'status' ? 'rotate-180' : ''}`}
                />
            </button>

            {attemptCount > 0 && (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (popover === 'history') closePopover();
                        else openPopover('history', e.currentTarget);
                    }}
                    className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-5 px-0.5 text-[10px] font-bold text-gray-600 hover:text-primary-700 hover:bg-gray-50 rounded tabular-nums leading-none"
                    title={lockMessage || cellTooltip || 'Ver historial'}
                >
                    {status !== 'en_intento' ? attemptCount : null}
                </button>
            )}

            {contactAddress && (
                <button
                    ref={quickBtnRef}
                    type="button"
                    disabled={effectiveDisabled || saving}
                    onClick={handleQuickAction}
                    className={`shrink-0 inline-flex items-center justify-center min-w-[22px] h-5 rounded leading-none ${
                        popover === 'templates'
                            ? channel === 'whatsapp'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                            : channel === 'whatsapp'
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-blue-600 hover:bg-blue-50'
                    }`}
                    title={`Plantillas ${channelDef.shortLabel}`}
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <QuickIcon className="w-4 h-4" strokeWidth={2.25} />
                    )}
                </button>
            )}

            {cooldown && (
                <Clock className="w-3.5 h-3.5 text-red-500 shrink-0" aria-hidden />
            )}

            {lastAttemptAt ? (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (popover === 'history') closePopover();
                        else openPopover('history', e.currentTarget);
                    }}
                    className="inline-flex items-center h-5 min-w-0 shrink px-0.5 text-[9px] text-gray-500 tabular-nums whitespace-nowrap truncate hover:text-primary-700 hover:bg-gray-50 rounded leading-none"
                    title={cellTooltip}
                >
                    {formatContactLastAtCompact(lastAttemptAt)}
                </button>
            ) : null}

            {popoverContent}
        </div>
    );
});
