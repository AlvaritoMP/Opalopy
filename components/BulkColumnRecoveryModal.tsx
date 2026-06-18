import React, { useMemo, useState } from 'react';
import { X, Upload, HardDrive, Loader2, AlertTriangle } from 'lucide-react';
import { Process, CustomColumn } from '../types';
import {
    buildLegacyColumnIdToName,
    loadLocalColumnValuesForProcess,
    scanLocalColumnBackups,
    countRecoverableForColumns,
    normalizeBulkColumnValueKeys,
    enrichBulkColumnValuesForStorage,
    repairDateColumnValues,
} from '../lib/bulkTableColumns';
import { bulkCandidatesApi } from '../lib/api/bulkCandidates';

interface BulkColumnRecoveryModalProps {
    process: Process;
    customColumns: CustomColumn[];
    candidateIds: Set<string>;
    onClose: () => void;
    onRecovered: () => void;
}

export const BulkColumnRecoveryModal: React.FC<BulkColumnRecoveryModalProps> = ({
    process,
    customColumns,
    candidateIds,
    onClose,
    onRecovered,
}) => {
    const legacy = useMemo(
        () => buildLegacyColumnIdToName(process.bulkConfig, customColumns),
        [process.bulkConfig, customColumns]
    );

    const localBackups = useMemo(
        () => scanLocalColumnBackups(process.id, legacy, customColumns),
        [process.id, legacy, customColumns]
    );

    const localValues = useMemo(
        () => loadLocalColumnValuesForProcess(process.id),
        [process.id]
    );

    const recoverableCounts = useMemo(
        () => countRecoverableForColumns(localValues, customColumns, legacy),
        [localValues, customColumns, legacy]
    );

    const totalRecoverable = useMemo(
        () => Object.values(recoverableCounts).reduce((a, b) => a + b, 0),
        [recoverableCounts]
    );

    const [isRestoring, setIsRestoring] = useState(false);
    const [jsonFile, setJsonFile] = useState<File | null>(null);
    const [result, setResult] = useState<string | null>(null);

    const targetColumns = ['Ap Paterno', 'Ap Materno', 'Experiencia', 'F Nac'];

    const runRestore = async (source: Record<string, Record<string, any>>, label: string) => {
        setIsRestoring(true);
        setResult(null);
        try {
            const normalized = repairDateColumnValues(
                normalizeBulkColumnValueKeys(source, customColumns, legacy),
                customColumns
            );

            const updates: Record<string, Record<string, unknown>> = {};
            for (const [candidateId, row] of Object.entries(normalized)) {
                if (candidateIds.size > 0 && !candidateIds.has(candidateId)) continue;
                const enriched = enrichBulkColumnValuesForStorage(row, customColumns);
                if (Object.keys(enriched).length > 0) {
                    updates[candidateId] = enriched;
                }
            }

            if (Object.keys(updates).length === 0) {
                setResult('No se encontraron datos para restaurar en esta fuente.');
                return;
            }

            await bulkCandidatesApi.batchSetBulkColumnValues(updates, customColumns);
            setResult(`Restaurados ${Object.keys(updates).length} candidato(s) desde ${label}.`);
            onRecovered();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            setResult(`Error: ${msg}`);
        } finally {
            setIsRestoring(false);
        }
    };

    const handleRestoreFromBrowser = () => runRestore(localValues, 'el navegador');

    const handleRestoreFromJson = async () => {
        if (!jsonFile) return;
        const text = await jsonFile.text();
        let parsed: Record<string, Record<string, any>>;
        try {
            parsed = JSON.parse(text);
        } catch {
            setResult('El archivo JSON no es válido.');
            return;
        }
        await runRestore(parsed, 'archivo JSON');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Recuperar columnas personalizadas</h2>
                    <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                        <div className="flex gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <p>
                                En Supabase, este proceso solo tiene guardada la columna <strong>Edad</strong>.
                                Ap Paterno, Ap Materno, Experiencia y F. Nac. nunca se subieron a la nube;
                                pueden quedar en una copia local de este navegador.
                            </p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium text-gray-800 mb-2">Copias en este navegador</h3>
                        {localBackups.length === 0 ? (
                            <p className="text-sm text-gray-500">No se encontró ninguna copia local para este proceso.</p>
                        ) : (
                            <ul className="text-sm space-y-2">
                                {localBackups.map(b => (
                                    <li key={b.storageKey} className="p-2 bg-gray-50 rounded border text-gray-700">
                                        <span className="font-mono text-xs">{b.storageKey}</span>
                                        <br />
                                        {b.candidateCount} candidatos · {b.valueCount} celdas
                                        {b.sampleColumns.length > 0 && (
                                            <> · {b.sampleColumns.join(', ')}</>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {totalRecoverable > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-800 mb-2">Datos recuperables detectados</h3>
                            <ul className="text-sm text-gray-700 space-y-1">
                                {targetColumns.map(name => (
                                    <li key={name}>
                                        <strong>{name}:</strong> {recoverableCounts[name] || 0} celdas
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <button
                        type="button"
                        disabled={isRestoring || totalRecoverable === 0}
                        onClick={handleRestoreFromBrowser}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                        {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
                        Restaurar desde este navegador
                    </button>

                    <div className="border-t pt-4">
                        <h3 className="text-sm font-medium text-gray-800 mb-2">Restaurar desde archivo JSON</h3>
                        <p className="text-xs text-gray-500 mb-2">
                            Si exportaste o guardaste una copia de respaldo (p. ej. desde la consola del navegador).
                        </p>
                        <input
                            type="file"
                            accept=".json,application/json"
                            onChange={e => setJsonFile(e.target.files?.[0] || null)}
                            className="text-sm w-full mb-2"
                        />
                        <button
                            type="button"
                            disabled={isRestoring || !jsonFile}
                            onClick={handleRestoreFromJson}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50"
                        >
                            {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Importar JSON de respaldo
                        </button>
                    </div>

                    {result && (
                        <p className={`text-sm p-3 rounded ${result.startsWith('Error') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                            {result}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
