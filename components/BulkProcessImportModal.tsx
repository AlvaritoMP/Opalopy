import React, { useState, useEffect, useMemo } from 'react';
import { useAppState } from '../App';
import { Upload, FileText, X, Loader2, Download } from 'lucide-react';
import { Candidate, CustomColumn, Process } from '../types';
import * as XLSX from 'xlsx';
import { getImportHeaders,
    mapImportHeader,
    OPTIONAL_IMPORT_FIELDS,
    formatBulkDate,
    normalizeBulkDateInput,
    DB_PRIORITY_IMPORT_FIELDS,
    enrichBulkColumnValuesForStorage,
    isPlaceholderImportEmail,
    resolveBulkCandidateEmail,
    findCustomColumnByHeader,
    normalizeDniKey,
    normalizePhoneKey,
    normalizeImportTextCase,
    buildImportBulkConfig,
} from '../lib/bulkTableColumns';
import { bulkCandidatesApi } from '../lib/api/bulkCandidates';

interface BulkProcessImportModalProps {
    process: Process;
    onClose: () => void;
    onImportComplete: () => void;
    /** Modo restauración: solo actualiza existentes, no crea candidatos nuevos */
    restoreMode?: boolean;
    /** Layout actual de la tabla en pantalla (columnas, orden y visibilidad) */
    tableLayout?: {
        customColumns: CustomColumn[];
        columnOrder: string[];
        hiddenColumns: string[];
    };
}

interface ParsedRow {
    candidate: Partial<Candidate>;
    customValues: Record<string, any>;
}

const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
};

type ImportCustomColumn = {
    name: string;
    id: string;
    type: string;
    options?: string[];
};

const normalizeImportCellText = (
    rawValue: string,
    opts: { field?: string; column?: ImportCustomColumn }
): string =>
    normalizeImportTextCase(rawValue, {
        field: opts.field,
        columnType: opts.column?.type,
        selectOptions: opts.column?.options,
    });

const parseRow = (
    headers: string[],
    values: string[],
    customColumns: ImportCustomColumn[]
): ParsedRow => {
    const candidate: Record<string, any> = {};
    const customValues: Record<string, any> = {};

    headers.forEach((header, index) => {
        const cellValue = values[index];
        if (cellValue === undefined || cellValue === null || cellValue === '') return;

        const customColByHeader = findCustomColumnByHeader(header, customColumns);
        if (customColByHeader?.type === 'date') {
            customValues[customColByHeader.id] = normalizeBulkDateInput(cellValue);
            return;
        }

        const rawValue = typeof cellValue === 'string'
            ? cellValue.trim().replace(/^"|"$/g, '')
            : cellValue;
        if (rawValue === '') return;

        const mappedField = mapImportHeader(header);
        const isDbPriorityField = mappedField && (DB_PRIORITY_IMPORT_FIELDS as readonly string[]).includes(mappedField);

        const customCol = !isDbPriorityField
            ? findCustomColumnByHeader(header, customColumns)
            : undefined;

        if (customCol) {
            if (customCol.type === 'number' && !isNaN(Number(rawValue))) {
                customValues[customCol.id] = Number(rawValue);
            } else if (customCol.type === 'checkbox') {
                customValues[customCol.id] = ['true', '1', 'si', 'sí', 'yes'].includes(rawValue.toLowerCase());
            } else if (customCol.type === 'date') {
                customValues[customCol.id] = normalizeBulkDateInput(rawValue);
            } else {
                const text =
                    typeof rawValue === 'string' ? rawValue : String(rawValue);
                customValues[customCol.id] = normalizeImportCellText(text, {
                    column: customCol,
                });
            }
            return;
        }

        if (mappedField) {
            if (mappedField === 'age' && !isNaN(Number(rawValue))) {
                candidate[mappedField] = Number(rawValue);
            } else {
                const text =
                    typeof rawValue === 'string' ? rawValue : String(rawValue);
                candidate[mappedField] = normalizeImportCellText(text, {
                    field: mappedField,
                });
            }
            // Mantener copia en columna personalizada homónima si existe
            if (isDbPriorityField) {
                const homonymCol = findCustomColumnByHeader(header, customColumns);
                if (homonymCol) {
                    const text =
                        typeof rawValue === 'string' ? rawValue : String(rawValue);
                    customValues[homonymCol.id] = normalizeImportCellText(text, {
                        field: mappedField,
                        column: homonymCol,
                    });
                }
            }
        }
    });

    return { candidate, customValues };
};

const parseCSV = (csvText: string, customColumns: ImportCustomColumn[]): ParsedRow[] => {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]).map(v => v.trim().replace(/^"|"$/g, ''));
        rows.push(parseRow(headers, values, customColumns));
    }

    return rows;
};

const parseExcel = (data: ArrayBuffer, customColumns: ImportCustomColumn[]): ParsedRow[] => {
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '', raw: true });

    return jsonData.map(row => {
        const headers = Object.keys(row);
        const values = headers.map(h => row[h] ?? '');
        return parseRow(headers, values, customColumns);
    });
};

const rowHasData = (
    candidateData: Partial<Candidate>,
    customValues: Record<string, any>,
    cleanValue: (value: any) => any
): boolean => {
    const fields = ['name', 'email', 'phone', 'phone2', 'dni', 'description', ...OPTIONAL_IMPORT_FIELDS];
    if (fields.some(field => cleanValue((candidateData as any)[field]) !== undefined)) {
        return true;
    }
    return Object.keys(customValues).length > 0;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const BulkProcessImportModal: React.FC<BulkProcessImportModalProps> = ({
    process,
    onClose,
    onImportComplete,
    restoreMode = false,
    tableLayout,
}) => {
    const { actions } = useAppState();
    const [file, setFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [updateOnly, setUpdateOnly] = useState(true);

    useEffect(() => {
        if (restoreMode) setUpdateOnly(true);
    }, [restoreMode]);
    const [importResult, setImportResult] = useState<{
        success: number;
        updated: number;
        skippedUnmatched: number;
        cellsRestored: number;
        failed: number;
        errors: string[];
    } | null>(null);

    const effectiveBulkConfig = useMemo(
        () => buildImportBulkConfig(process.bulkConfig, tableLayout),
        [process.bulkConfig, tableLayout]
    );

    const importHeaders = getImportHeaders(effectiveBulkConfig);
    const customColumns = (effectiveBulkConfig.customColumns || []).map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        options: c.options,
    }));

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setImportResult(null);
        }
    };

    const handleDownloadTemplate = () => {
        const templateRow: Record<string, string> = {};

        importHeaders.forEach(({ header, isCustom, columnId }) => {
            if (isCustom && columnId) {
                const col = customColumns.find(c => c.id === columnId);
                if (col?.type === 'date') {
                    templateRow[header] = '18/05/2026';
                } else if (col?.type === 'checkbox') {
                    templateRow[header] = 'Sí';
                } else if (col?.type === 'number') {
                    templateRow[header] = '100';
                } else {
                    templateRow[header] = 'Ejemplo';
                }
            } else if (header === 'name') {
                templateRow[header] = 'Juan Pérez';
            } else if (header === 'email') {
                templateRow[header] = 'juan.perez@example.com';
            } else if (header === 'phone') {
                templateRow[header] = '987654321';
            } else if (header === 'dni') {
                templateRow[header] = '12345678';
            } else {
                templateRow[header] = '';
            }
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet([templateRow]);
        ws['!cols'] = importHeaders.map(h => ({ wch: Math.max(h.header.length + 4, 15) }));
        XLSX.utils.book_append_sheet(wb, ws, 'Candidatos');

        const processName = process.title.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
        XLSX.writeFile(wb, `Plantilla_${processName}.xlsx`);
    };

    const handleImport = async () => {
        if (!file) {
            actions.showToast('Por favor selecciona un archivo', 'error', 3000);
            return;
        }

        if (!process.stages || process.stages.length === 0) {
            actions.showToast('El proceso no tiene etapas configuradas', 'error', 3000);
            return;
        }

        const firstStageId = process.stages[0].id;
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

        setIsImporting(true);
        setImportResult(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            let parsedRows: ParsedRow[] = [];
            let importToastId: string | null = null;

            try {
                if (isExcel) {
                    parsedRows = parseExcel(event.target?.result as ArrayBuffer, customColumns);
                } else {
                    parsedRows = parseCSV(event.target?.result as string, customColumns);
                }

                importToastId = actions.showToast('Importando candidatos...', 'loading', 0);

                let successCount = 0;
                let updatedCount = 0;
                let skippedUnmatched = 0;
                let cellsRestored = 0;
                let skippedEmptyRows = 0;
                const errors: string[] = [];
                const columnValuesUpdates: Record<string, Record<string, any>> = {};

                const customColumnsFull = effectiveBulkConfig.customColumns || [];
                const existingCandidates = await bulkCandidatesApi.getAllCandidates(process.id);
                const normalizeMatchKey = (s?: string) =>
                    (s || '').trim().toLowerCase().replace(/\s+/g, '');

                const byDni = new Map<string, typeof existingCandidates[0]>();
                const byEmail = new Map<string, typeof existingCandidates[0]>();
                const byPhone = new Map<string, typeof existingCandidates[0]>();
                for (const c of existingCandidates) {
                    const dniKey = normalizeDniKey(c.dni);
                    if (dniKey) byDni.set(dniKey, c);
                    if (c.email && !isPlaceholderImportEmail(c.email)) {
                        byEmail.set(normalizeMatchKey(c.email), c);
                    }
                    const phoneKey = normalizePhoneKey(c.phone);
                    if (phoneKey) byPhone.set(phoneKey, c);
                }

                const cleanValue = (value: any): any => {
                    if (value === undefined || value === null || value === '') return undefined;
                    if (typeof value === 'string') {
                        const trimmed = value.trim();
                        return trimmed === '' ? undefined : trimmed;
                    }
                    return value;
                };

                for (let index = 0; index < parsedRows.length; index++) {
                    const { candidate: candidateData, customValues } = parsedRows[index];
                    const rowNumber = index + 2;

                    if (!rowHasData(candidateData, customValues, cleanValue)) {
                        skippedEmptyRows++;
                        continue;
                    }

                    const name =
                        cleanValue(candidateData.name) ||
                        cleanValue(candidateData.dni) ||
                        cleanValue(candidateData.phone) ||
                        `Candidato ${rowNumber - 1}`;

                    const email = cleanValue(candidateData.email);
                    const dni = cleanValue(candidateData.dni);
                    const phone = cleanValue(candidateData.phone);
                    const { email: resolvedEmail } = resolveBulkCandidateEmail(
                        email,
                        rowNumber,
                        name,
                        dni,
                        phone,
                        'manual'
                    );

                    if (email && !EMAIL_REGEX.test(email)) {
                        errors.push(`Fila ${rowNumber} (${name}): Email inválido "${email}" — se usó email temporal`);
                    }

                    const existing =
                        (dni ? byDni.get(normalizeDniKey(dni)) : undefined) ||
                        (email ? byEmail.get(normalizeMatchKey(email)) : undefined) ||
                        (phone ? byPhone.get(normalizePhoneKey(phone)) : undefined);

                    if (existing) {
                        if (Object.keys(customValues).length > 0) {
                            cellsRestored += Object.keys(customValues).length;
                            const prev = columnValuesUpdates[existing.id] || {};
                            columnValuesUpdates[existing.id] = enrichBulkColumnValuesForStorage(
                                { ...prev, ...customValues },
                                customColumnsFull
                            );
                        }

                        const standardUpdates: Record<string, string> = {};
                        OPTIONAL_IMPORT_FIELDS.forEach(field => {
                            const cleaned = cleanValue((candidateData as any)[field]);
                            if (cleaned === undefined) return;
                            const current = (existing as Record<string, unknown>)[field];
                            if (current === undefined || current === null || current === '') {
                                standardUpdates[field] = String(cleaned);
                            }
                        });
                        if (Object.keys(standardUpdates).length > 0) {
                            try {
                                await bulkCandidatesApi.patchFields(existing.id, standardUpdates);
                            } catch (error: any) {
                                errors.push(`Fila ${rowNumber} (${name}): ${error?.message || 'Error al actualizar'}`);
                            }
                        }

                        updatedCount++;
                        successCount++;
                        continue;
                    }

                    if (updateOnly) {
                        skippedUnmatched++;
                        if (skippedUnmatched <= 10) {
                            errors.push(`Fila ${rowNumber} (${name}): no coincide con ningún candidato existente (DNI/email/teléfono)`);
                        }
                        continue;
                    }

                    try {
                        const cleanCandidateData: any = {
                            name,
                            email: resolvedEmail,
                            processId: process.id,
                            stageId: firstStageId,
                            attachments: [],
                            registrationOrigin: 'manual',
                        };

                        OPTIONAL_IMPORT_FIELDS.forEach(field => {
                            const cleaned = cleanValue((candidateData as any)[field]);
                            if (cleaned !== undefined) {
                                cleanCandidateData[field] = cleaned;
                            }
                        });

                        const newCandidate = await actions.addCandidate(cleanCandidateData, {
                            skipGoogleDrive: true,
                            silent: true,
                        });
                        successCount++;

                        if (Object.keys(customValues).length > 0 && newCandidate?.id) {
                            columnValuesUpdates[newCandidate.id] = enrichBulkColumnValuesForStorage(
                                customValues,
                                customColumnsFull
                            );
                        }
                    } catch (error: any) {
                        errors.push(`Fila ${rowNumber} (${name}): ${error?.message || 'Error desconocido'}`);
                    }
                }

                if (Object.keys(columnValuesUpdates).length > 0) {
                    await bulkCandidatesApi.batchFillEmptyBulkColumnValues(columnValuesUpdates, customColumnsFull);
                }

                setImportResult({
                    success: successCount,
                    updated: updatedCount,
                    skippedUnmatched,
                    cellsRestored,
                    failed: parsedRows.length - successCount - skippedEmptyRows - skippedUnmatched,
                    errors: errors.slice(0, 15),
                });

                if (successCount > 0) {
                    const msg = updateOnly
                        ? `${updatedCount} candidato(s) actualizado(s), ${cellsRestored} celdas importadas (solo vacías)`
                        : updatedCount > 0
                            ? `${updatedCount} actualizado(s), ${successCount - updatedCount} nuevo(s)`
                            : `${successCount} candidato(s) importado(s)`;
                    actions.showToast(msg, 'success', 6000);
                    onImportComplete();
                } else if (updateOnly && skippedUnmatched > 0) {
                    actions.showToast(
                        'Ninguna fila coincidió. Verifique que el Excel tenga columna DNI igual que en la tabla.',
                        'error',
                        8000
                    );
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
                actions.showToast(`Error al importar: ${errorMsg}`, 'error', 5000);
                setImportResult({
                    success: 0,
                    updated: 0,
                    skippedUnmatched: 0,
                    cellsRestored: 0,
                    failed: parsedRows.length,
                    errors: [`Error al parsear el archivo: ${errorMsg}`],
                });
            } finally {
                if (importToastId) actions.hideToast(importToastId);
                setIsImporting(false);
                setFile(null);
            }
        };

        if (isExcel) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    };

    const optionalHeaders = importHeaders.filter(h => h.field !== 'name' && h.field !== 'email' && !h.isCustom);
    const customHeaders = importHeaders.filter(h => h.isCustom);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Importar Candidatos - {process.title}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {restoreMode && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                            <strong>Restaurar datos perdidos:</strong> sube tu Excel original. Se empareja cada fila
                            por <strong>DNI</strong> (luego email o teléfono) con los candidatos que ya existen.
                            Solo se rellenan celdas vacías — no se borran tus ediciones recientes ni se crean duplicados.
                        </div>
                    )}
                    <div>
                        <p className="text-sm text-gray-600 mb-4">
                            {restoreMode
                                ? 'Usa el archivo Excel con el que importaste originalmente (debe incluir columna DNI y las columnas Ap Paterno, Ap Materno, Experiencia, F Nac., etc.).'
                                : 'La plantilla se genera según las columnas configuradas en la Tabla de Alta Densidad de este proceso.'}
                            {' '}Las celdas vacías son válidas. Si un candidato ya existe, solo se rellenan celdas vacías.
                        </p>
                        <label className="flex items-center gap-2 text-sm text-gray-700 mb-4 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={updateOnly}
                                onChange={e => setUpdateOnly(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            Solo actualizar candidatos existentes (no crear nuevos)
                        </label>
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs text-blue-800 font-medium">Plantilla dinámica del proceso</p>
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                >
                                    <Download className="w-3 h-3" />
                                    Descargar Plantilla
                                </button>
                            </div>
                            <p className="text-xs text-blue-700">
                                Columnas incluidas: {importHeaders.map(h => h.header).join(', ') || 'name, email'}
                            </p>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                            Cada fila debe tener al menos un dato. Las celdas vacías son válidas.
                            Si falta el email, se genera uno temporal que puedes editar después en la tabla.
                            {optionalHeaders.length > 0 && (
                                <>
                                    <br />
                                    <strong>Columnas opcionales:</strong> {optionalHeaders.map(h => h.header).join(', ')}
                                </>
                            )}
                            {customHeaders.length > 0 && (
                                <>
                                    <br />
                                    <strong>Personalizadas:</strong> {customHeaders.map(h => h.header).join(', ')}
                                </>
                            )}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Archivo CSV o Excel</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                {file ? (
                                    <>
                                        <FileText className="mx-auto h-12 w-12 text-gray-400" />
                                        <p className="font-medium text-primary-600">{file.name}</p>
                                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                                        <button onClick={() => setFile(null)} className="mt-2 text-sm text-red-600 hover:text-red-700">
                                            Quitar archivo
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                        <div className="flex text-sm text-gray-600">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none">
                                                <span>Sube un archivo</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
                                            </label>
                                            <p className="pl-1">o arrastra y suelta</p>
                                        </div>
                                        <p className="text-xs text-gray-500">CSV o Excel (.xlsx, .xls) de hasta 10MB</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {importResult && (
                        <div className={`p-4 rounded-lg ${importResult.failed > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                            <p className="font-medium text-sm mb-2">
                                {importResult.success > 0 && (
                                    <span className="text-green-700">
                                        ✅ {importResult.updated} candidato(s) actualizado(s)
                                        {importResult.cellsRestored > 0 && ` · ${importResult.cellsRestored} celdas importadas`}
                                    </span>
                                )}
                                {importResult.skippedUnmatched > 0 && (
                                    <span className="text-yellow-700"> · {importResult.skippedUnmatched} fila(s) sin coincidencia</span>
                                )}
                                {importResult.failed > 0 && (
                                    <span className="text-red-700"> · {importResult.failed} error(es)</span>
                                )}
                            </p>
                            {importResult.errors.length > 0 && (
                                <div className="mt-2 max-h-40 overflow-y-auto">
                                    <p className="text-xs font-medium text-gray-700 mb-1">Errores:</p>
                                    <ul className="text-xs text-gray-600 space-y-1">
                                        {importResult.errors.map((error, idx) => (
                                            <li key={idx} className="list-disc list-inside">{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            disabled={isImporting}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={!file || isImporting}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isImporting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Importando...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    Importar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
