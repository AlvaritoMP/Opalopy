import React, { useEffect, useMemo, useState } from 'react';
import { X, Send, Loader2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppState } from '../App';
import { workerHandoffApi } from '../lib/api/workerHandoff';
import {
    WORKER_HANDOFF_FIELD_GROUPS,
    ALL_WORKER_HANDOFF_FIELD_KEYS,
    countCandidatesWithFieldData,
    loadSavedWorkerHandoffFieldKeys,
    saveWorkerHandoffFieldKeys,
    validateFieldSelection,
} from '../lib/workerHandoffFields';
import type { Candidate } from '../types';

interface SendToOpsFlowModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidates: Candidate[];
    onSent?: () => void;
}

export const SendToOpsFlowModal: React.FC<SendToOpsFlowModalProps> = ({
    isOpen,
    onClose,
    candidates,
    onSent,
}) => {
    const { state, actions } = useAppState();
    const [senderNote, setSenderNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [checkingDuplicates, setCheckingDuplicates] = useState(false);
    const [activeDuplicateIds, setActiveDuplicateIds] = useState<Set<string>>(new Set());
    const [ignoreDuplicates, setIgnoreDuplicates] = useState(false);
    const [selectedFields, setSelectedFields] = useState<Set<string>>(
        () => new Set(loadSavedWorkerHandoffFieldKeys())
    );
    const [fieldsExpanded, setFieldsExpanded] = useState(true);

    const uniqueCandidates = useMemo(() => {
        const byId = new Map<string, Candidate>();
        for (const candidate of candidates) {
            if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
        }
        return [...byId.values()];
    }, [candidates]);

    const processById = useMemo(
        () => new Map(state.processes.map(process => [process.id, process])),
        [state.processes]
    );

    const duplicateCandidates = useMemo(
        () => uniqueCandidates.filter(candidate => activeDuplicateIds.has(candidate.id)),
        [uniqueCandidates, activeDuplicateIds]
    );

    const fieldSelectionError = useMemo(
        () => validateFieldSelection(selectedFields),
        [selectedFields]
    );

    useEffect(() => {
        if (!isOpen) return;
        setSenderNote('');
        setIgnoreDuplicates(false);
        setActiveDuplicateIds(new Set());
        setSelectedFields(new Set(loadSavedWorkerHandoffFieldKeys()));
        setFieldsExpanded(true);

        if (uniqueCandidates.length === 0) return;

        let cancelled = false;
        setCheckingDuplicates(true);
        workerHandoffApi
            .getActiveCandidateIds(uniqueCandidates.map(candidate => candidate.id))
            .then(ids => {
                if (!cancelled) setActiveDuplicateIds(new Set(ids));
            })
            .catch(error => {
                console.error('Error verificando envíos activos:', error);
            })
            .finally(() => {
                if (!cancelled) setCheckingDuplicates(false);
            });

        return () => {
            cancelled = true;
        };
    }, [isOpen, uniqueCandidates]);

    if (!isOpen) return null;

    const toggleField = (key: string) => {
        setSelectedFields(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                if (key === 'fullName' && !next.has('dni')) return prev;
                if (key === 'dni' && !next.has('fullName')) return prev;
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const selectAllFields = () => {
        setSelectedFields(new Set(ALL_WORKER_HANDOFF_FIELD_KEYS));
    };

    const selectFieldsWithData = () => {
        const withData = ALL_WORKER_HANDOFF_FIELD_KEYS.filter(
            key => countCandidatesWithFieldData(key, uniqueCandidates, processById) > 0
        );
        const next = new Set(withData);
        if (!next.has('fullName') && !next.has('dni')) {
            if (countCandidatesWithFieldData('fullName', uniqueCandidates, processById) > 0) {
                next.add('fullName');
            } else if (countCandidatesWithFieldData('dni', uniqueCandidates, processById) > 0) {
                next.add('dni');
            } else {
                next.add('fullName');
            }
        }
        setSelectedFields(next);
    };

    const handleSend = async () => {
        if (uniqueCandidates.length === 0) {
            actions.showToast('No hay candidatos seleccionados', 'error', 3000);
            return;
        }

        if (fieldSelectionError) {
            actions.showToast(fieldSelectionError, 'error', 3500);
            return;
        }

        if (duplicateCandidates.length > 0 && !ignoreDuplicates) {
            actions.showToast('Confirma el envío a pesar de los envíos activos', 'error', 3500);
            return;
        }

        const includedFields = [...selectedFields];
        saveWorkerHandoffFieldKeys(includedFields);

        setBusy(true);
        try {
            await workerHandoffApi.sendPackage({
                candidates: uniqueCandidates,
                processes: state.processes,
                senderNote: senderNote.trim() || undefined,
                createdBy: state.currentUser?.id,
                createdByName: state.currentUser?.name,
                includedFields,
            });

            actions.showToast(
                `Paquete enviado a OpsFlow (${uniqueCandidates.length} trabajador${uniqueCandidates.length === 1 ? '' : 'es'}, ${includedFields.length} campos)`,
                'success',
                4000
            );
            onSent?.();
            onClose();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'No se pudo enviar el paquete';
            actions.showToast(message, 'error', 5000);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                        <Send className="w-5 h-5 text-primary-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Enviar a OpsFlow</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="p-2 rounded-full hover:bg-gray-100"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto flex-1">
                    <p className="text-sm text-gray-600">
                        Elige qué datos incluir en el paquete para{' '}
                        <span className="font-medium text-gray-900">{uniqueCandidates.length}</span>{' '}
                        trabajador{uniqueCandidates.length === 1 ? '' : 'es'}. Solo se envían campos
                        seleccionados que tengan valor en cada candidato.
                    </p>

                    <div className="border border-gray-200 rounded-lg max-h-32 overflow-y-auto">
                        <ul className="divide-y divide-gray-100">
                            {uniqueCandidates.map(candidate => (
                                <li key={candidate.id} className="px-3 py-2 text-sm text-gray-800">
                                    {candidate.name || candidate.dni || 'Sin nombre'}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="border border-gray-200 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setFieldsExpanded(expanded => !expanded)}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 rounded-t-lg"
                        >
                            <span>
                                Campos a enviar ({selectedFields.size}/{ALL_WORKER_HANDOFF_FIELD_KEYS.length})
                            </span>
                            {fieldsExpanded ? (
                                <ChevronUp className="w-4 h-4 text-gray-500" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                            )}
                        </button>

                        {fieldsExpanded && (
                            <div className="px-3 pb-3 space-y-3 border-t border-gray-100">
                                <div className="flex flex-wrap gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={selectAllFields}
                                        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                                    >
                                        Todos
                                    </button>
                                    <button
                                        type="button"
                                        onClick={selectFieldsWithData}
                                        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                                    >
                                        Solo con datos
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedFields(new Set(['fullName', 'dni']))}
                                        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                                    >
                                        Mínimo (nombre/DNI)
                                    </button>
                                </div>

                                {WORKER_HANDOFF_FIELD_GROUPS.map(group => (
                                    <div key={group.id}>
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                            {group.label}
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                            {group.fields.map(field => {
                                                const withData = countCandidatesWithFieldData(
                                                    field.key,
                                                    uniqueCandidates,
                                                    processById
                                                );
                                                const checked = selectedFields.has(field.key);
                                                const isRequiredIdentity =
                                                    (field.key === 'fullName' && !selectedFields.has('dni')) ||
                                                    (field.key === 'dni' && !selectedFields.has('fullName'));

                                                return (
                                                    <label
                                                        key={field.key}
                                                        className={`flex items-start gap-2 text-sm rounded px-2 py-1 cursor-pointer hover:bg-gray-50 ${
                                                            withData === 0 ? 'text-gray-400' : 'text-gray-800'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            disabled={checked && isRequiredIdentity}
                                                            onChange={() => toggleField(field.key)}
                                                            className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                        />
                                                        <span className="flex-1 min-w-0">
                                                            {field.label}
                                                            <span className="ml-1 text-xs text-gray-500">
                                                                ({withData}/{uniqueCandidates.length})
                                                            </span>
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}

                                {fieldSelectionError && (
                                    <p className="text-xs text-red-600">{fieldSelectionError}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {checkingDuplicates && (
                        <p className="text-xs text-gray-500 flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Verificando envíos activos…
                        </p>
                    )}

                    {!checkingDuplicates && duplicateCandidates.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium">Envíos activos detectados</p>
                                    <ul className="mt-1 list-disc list-inside text-amber-800">
                                        {duplicateCandidates.map(candidate => (
                                            <li key={candidate.id}>{candidate.name}</li>
                                        ))}
                                    </ul>
                                    <label className="mt-2 flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={ignoreDuplicates}
                                            onChange={event => setIgnoreDuplicates(event.target.checked)}
                                            className="rounded border-amber-400"
                                        />
                                        <span>Enviar de todos modos</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label htmlFor="opsflow-sender-note" className="block text-sm font-medium text-gray-700 mb-1">
                            Nota para OpsFlow (opcional)
                        </label>
                        <textarea
                            id="opsflow-sender-note"
                            value={senderNote}
                            onChange={event => setSenderNote(event.target.value)}
                            rows={3}
                            placeholder="Ej: Ingresan el lunes, prioridad alta…"
                            className="w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 text-sm"
                        />
                    </div>
                </div>

                <div className="p-4 border-t flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={
                            busy ||
                            uniqueCandidates.length === 0 ||
                            checkingDuplicates ||
                            !!fieldSelectionError
                        }
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                        Enviar {selectedFields.size} campos
                    </button>
                </div>
            </div>
        </div>
    );
};
