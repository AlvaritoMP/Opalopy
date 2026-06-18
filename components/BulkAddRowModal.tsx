import React, { useState } from 'react';
import { useAppState } from '../App';
import { X, Loader2, ListPlus } from 'lucide-react';
import { Candidate, Process } from '../types';
import { BulkCandidate } from '../lib/api/bulkCandidates';
import { resolveBulkCandidateEmail } from '../lib/bulkTableColumns';

interface BulkAddRowModalProps {
    process: Process;
    /** Número de fila para email placeholder único */
    rowNumber: number;
    onClose: () => void;
    onSuccess: (candidate: BulkCandidate) => void;
}

function candidateToBulkRow(c: Candidate): BulkCandidate {
    return {
        id: c.id,
        name: c.name || '',
        email: c.email,
        phone: c.phone,
        dni: c.dni,
        source: c.source,
        province: c.province,
        district: c.district,
        age: c.age,
        stageId: c.stageId,
        processId: c.processId,
        createdAt: c.applicationStartedDate || new Date().toISOString(),
        registrationOrigin: c.registrationOrigin || 'manual',
        createdBy: c.createdBy,
        contactLockUserId: c.contactLockUserId,
        contactLockUserName: c.contactLockUserName,
        contactLockUntil: c.contactLockUntil,
        contactLockReason: c.contactLockReason,
    };
}

export const BulkAddRowModal: React.FC<BulkAddRowModalProps> = ({
    process,
    rowNumber,
    onClose,
    onSuccess,
}) => {
    const { state, actions } = useAppState();
    const getDefaultSource = (): Candidate['source'] => {
        const sources = state.settings?.candidateSources?.length
            ? state.settings.candidateSources
            : ['LinkedIn', 'Referencia', 'Sitio web', 'Otro'];
        return sources[0] || 'Otro';
    };

    const [name, setName] = useState('');
    const [dni, setDni] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [source, setSource] = useState<Candidate['source']>(getDefaultSource());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) {
            actions.showToast('Indique al menos el nombre', 'error', 3000);
            return;
        }

        const firstStageId = process.stages[0]?.id;
        if (!firstStageId) {
            actions.showToast('Este proceso no tiene etapas configuradas.', 'error', 4000);
            return;
        }

        const trimmedDni = dni.trim();
        const trimmedPhone = phone.trim();
        const trimmedEmail = email.trim();
        const { email: resolvedEmail } = resolveBulkCandidateEmail(
            trimmedEmail || undefined,
            rowNumber,
            trimmedName,
            trimmedDni || undefined,
            trimmedPhone || undefined
        );

        setIsSubmitting(true);
        try {
            const created = await actions.addCandidate(
                {
                    name: trimmedName,
                    email: resolvedEmail,
                    phone: trimmedPhone || undefined,
                    dni: trimmedDni || undefined,
                    source,
                    processId: process.id,
                    stageId: firstStageId,
                    attachments: [],
                    registrationOrigin: 'manual',
                },
                { skipGoogleDrive: true, silent: true }
            );
            onSuccess(candidateToBulkRow(created));
            onClose();
        } catch (error) {
            console.error('Error al añadir fila:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const sourceOptions =
        state.settings?.candidateSources?.length
            ? state.settings.candidateSources
            : ['LinkedIn', 'Referencia', 'Sitio web', 'Otro'];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    <div className="p-5 border-b flex justify-between items-center gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <ListPlus className="w-5 h-5 text-primary-600 flex-shrink-0" />
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold text-gray-800 truncate">Añadir fila</h2>
                                <p className="text-xs text-gray-500 truncate">{process.title}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="p-2 rounded-full hover:bg-gray-100 flex-shrink-0"
                        >
                            <X className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>

                    <div className="p-5 space-y-3">
                        <p className="text-sm text-gray-600">
                            Campos básicos para crear la fila en la tabla. El resto puede completarse directamente en la grilla.
                        </p>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nombre *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                                autoFocus
                                className="mt-1 block w-full bulk-add-row-input"
                                placeholder="Nombre del candidato"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">DNI</label>
                                <input
                                    type="text"
                                    value={dni}
                                    onChange={e => setDni(e.target.value)}
                                    className="mt-1 block w-full bulk-add-row-input"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="mt-1 block w-full bulk-add-row-input"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="mt-1 block w-full bulk-add-row-input"
                                placeholder="Opcional — se genera uno temporal si queda vacío"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Fuente</label>
                            <select
                                value={source}
                                onChange={e => setSource(e.target.value as Candidate['source'])}
                                className="mt-1 block w-full bulk-add-row-input"
                            >
                                {sourceOptions.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="p-5 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="bulk-add-row-btn-secondary"
                        >
                            Cancelar
                        </button>
                        <button type="submit" disabled={isSubmitting} className="bulk-add-row-btn-primary">
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                                    Guardando…
                                </>
                            ) : (
                                'Añadir fila'
                            )}
                        </button>
                    </div>
                </form>
            </div>
            <style>{`
                .bulk-add-row-input {
                    padding: 0.5rem 0.75rem;
                    border: 1px solid #D1D5DB;
                    border-radius: 0.375rem;
                    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
                    font-size: 0.875rem;
                }
                .bulk-add-row-btn-primary {
                    padding: 0.5rem 1rem;
                    background-color: #2563eb;
                    color: white;
                    border-radius: 0.375rem;
                    font-weight: 500;
                }
                .bulk-add-row-btn-primary:hover:not(:disabled) { background-color: #1d4ed8; }
                .bulk-add-row-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
                .bulk-add-row-btn-secondary {
                    padding: 0.5rem 1rem;
                    background-color: white;
                    border: 1px solid #D1D5DB;
                    color: #374151;
                    border-radius: 0.375rem;
                    font-weight: 500;
                }
                .bulk-add-row-btn-secondary:hover:not(:disabled) { background-color: #F9FAFB; }
            `}</style>
        </div>
    );
};
