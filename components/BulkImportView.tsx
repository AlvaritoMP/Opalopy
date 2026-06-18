
import React, { useState } from 'react';
import { useAppState } from '../App';
import { Upload, FileText, UserPlus, X, Download } from 'lucide-react';
import { Candidate, Process } from '../types';
import * as XLSX from 'xlsx';

// Función para parsear CSV correctamente (maneja comas dentro de valores entre comillas)
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

type ParsedCandidate = Omit<Candidate, 'id' | 'history' | 'processId' | 'stageId' | 'attachments'>;

const KEY_MAPPING: Record<string, string> = {
    'name': 'name',
    'nombre': 'name',
    'email': 'email',
    'correo': 'email',
    'phone': 'phone',
    'teléfono': 'phone',
    'telefono': 'phone',
    'phone2': 'phone2',
    'teléfono 2': 'phone2',
    'telefono2': 'phone2',
    'teléfono2': 'phone2',
    'description': 'description',
    'descripción': 'description',
    'descripcion': 'description',
    'source': 'source',
    'fuente': 'source',
    'salaryexpectation': 'salaryExpectation',
    'expectativa salarial': 'salaryExpectation',
    'expectativasalarial': 'salaryExpectation',
    'agreedsalary': 'agreedSalary',
    'salario acordado': 'agreedSalary',
    'salarioacordado': 'agreedSalary',
    'age': 'age',
    'edad': 'age',
    'dni': 'dni',
    'linkedinurl': 'linkedinUrl',
    'linkedin': 'linkedinUrl',
    'address': 'address',
    'dirección': 'address',
    'direccion': 'address',
    'province': 'province',
    'provincia': 'province',
    'district': 'district',
    'distrito': 'district',
};

const parseCSV = (csvText: string): ParsedCandidate[] => {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
    const candidates: ParsedCandidate[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]).map(v => v.trim().replace(/^"|"$/g, ''));
        const candidate: Record<string, unknown> = {};
        headers.forEach((header, index) => {
            const value = values[index] || '';
            const cleanValue = value.trim() === '' ? undefined : value.trim();
            
            if (header === 'age' && cleanValue && !isNaN(Number(cleanValue))) {
                candidate['age'] = Number(cleanValue);
            } else if (cleanValue !== undefined) {
                candidate[header] = cleanValue;
            }
        });
        candidates.push(candidate as ParsedCandidate);
    }
    return candidates;
};

const parseExcel = (data: ArrayBuffer): ParsedCandidate[] => {
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    const candidates: ParsedCandidate[] = [];
    
    jsonData.forEach((row: Record<string, unknown>) => {
        const candidate: Record<string, unknown> = {};
        Object.keys(row).forEach(key => {
            const normalizedKey = key.trim().toLowerCase();
            const value = row[key];
            
            if (normalizedKey === 'age' && value !== '' && !isNaN(Number(value))) {
                candidate['age'] = Number(value);
            } else {
                const mappedKey = KEY_MAPPING[normalizedKey] || key.trim();
                if (value === '' || value === null || value === undefined) {
                    candidate[mappedKey] = undefined;
                } else {
                    candidate[mappedKey] = typeof value === 'string' ? value.trim() : value;
                }
            }
        });
        candidates.push(candidate as ParsedCandidate);
    });
    
    return candidates;
};

const TEMPLATE_HEADERS = [
    'name', 'email', 'phone', 'phone2', 'description', 'source',
    'salaryExpectation', 'agreedSalary', 'age', 'dni', 'linkedinUrl',
    'address', 'province', 'district',
];

const TEMPLATE_EXAMPLE: Record<string, string> = {
    name: 'Juan Pérez',
    email: 'juan.perez@example.com',
    phone: '987654321',
    dni: '12345678',
    province: 'LIMA',
    district: 'MIRAFLORES',
};

const handleDownloadStandardTemplate = (processTitle: string) => {
    const templateRow: Record<string, string> = {};
    TEMPLATE_HEADERS.forEach(header => {
        templateRow[header] = TEMPLATE_EXAMPLE[header] || '';
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([templateRow]);
    ws['!cols'] = TEMPLATE_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 15) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Candidatos');

    const processName = processTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    XLSX.writeFile(wb, `Plantilla_${processName}.xlsx`);
};

interface ProcessImportModalProps {
    process: Process;
    onClose: () => void;
    onImportComplete?: () => void;
}

/** Importación masiva de candidatos para procesos específicos (no masivos). */
export const ProcessImportModal: React.FC<ProcessImportModalProps> = ({
    process,
    onClose,
    onImportComplete,
}) => {
    const { actions } = useAppState();
    const [file, setFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ success: number, failed: number, errors: string[] } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setImportResult(null);
        }
    };

    const handleImport = async () => {
        if (!file) {
            actions.showToast('Selecciona un archivo', 'error', 3000);
            return;
        }

        const firstStageId = process.stages[0]?.id;
        if (!firstStageId) {
            actions.showToast('El proceso no tiene etapas configuradas', 'error', 3000);
            return;
        }

        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const isExcel = fileExtension === 'xlsx' || fileExtension === 'xls';
        
        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            let parsedCandidates: ParsedCandidate[] = [];
            try {
                if (isExcel) {
                    parsedCandidates = parseExcel(event.target?.result as ArrayBuffer);
                } else {
                    parsedCandidates = parseCSV(event.target?.result as string);
                }
                let successCount = 0;
                const errors: string[] = [];
                
                const cleanValue = (value: unknown): unknown => {
                    if (value === undefined || value === null || value === '') return undefined;
                    if (typeof value === 'string') {
                        const trimmed = value.trim();
                        return trimmed === '' ? undefined : trimmed;
                    }
                    return value;
                };
                
                const cleanLocationValue = (value: unknown): string | undefined => {
                    const cleaned = cleanValue(value);
                    if (cleaned === undefined) return undefined;
                    return cleaned && String(cleaned).trim() ? String(cleaned).trim() : undefined;
                };
                
                for (let index = 0; index < parsedCandidates.length; index++) {
                    const candidateData = parsedCandidates[index];
                    const rowNumber = index + 2;
                    
                    const name = cleanValue(candidateData.name) as string | undefined;
                    const email = cleanValue(candidateData.email) as string | undefined;
                    
                    if (!name || !email) {
                        errors.push(`Fila ${rowNumber}: Faltan campos requeridos (nombre: "${name || 'vacío'}", email: "${email || 'vacío'}")`);
                        continue;
                    }
                    
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(email)) {
                        errors.push(`Fila ${rowNumber} (${name}): Email inválido "${email}"`);
                        continue;
                    }
                    
                    try {
                        const cleanCandidateData: Record<string, unknown> = {
                            name,
                            email,
                            processId: process.id,
                            stageId: firstStageId,
                            attachments: [],
                            registrationOrigin: 'masivo',
                        };
                        
                        const optionalFields = [
                            'phone', 'phone2', 'description', 'source', 'salaryExpectation', 
                            'agreedSalary', 'age', 'dni', 'linkedinUrl', 'address'
                        ];
                        
                        optionalFields.forEach(field => {
                            const cleaned = cleanValue((candidateData as Record<string, unknown>)[field]);
                            if (cleaned !== undefined) {
                                cleanCandidateData[field] = cleaned;
                            }
                        });
                        
                        const province = cleanLocationValue(candidateData.province);
                        const district = cleanLocationValue(candidateData.district);
                        if (province !== undefined) cleanCandidateData.province = province;
                        if (district !== undefined) cleanCandidateData.district = district;
                        
                        await actions.addCandidate(cleanCandidateData as Omit<Candidate, 'id' | 'history'>);
                        successCount++;
                    } catch (error: unknown) {
                        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
                        errors.push(`Fila ${rowNumber} (${name || 'sin nombre'}): ${errorMsg}`);
                    }
                }
                
                setImportResult({ 
                    success: successCount, 
                    failed: parsedCandidates.length - successCount,
                    errors: errors.slice(0, 10),
                });

                if (successCount > 0) {
                    actions.showToast(`${successCount} candidato(s) importado(s)`, 'success', 4000);
                    onImportComplete?.();
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
                actions.showToast(`Error al importar: ${errorMsg}`, 'error', 5000);
                setImportResult({ 
                    success: 0, 
                    failed: parsedCandidates.length,
                    errors: [`Error al parsear el archivo: ${errorMsg}`],
                });
            } finally {
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Importar candidatos — {process.title}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <p className="text-sm text-gray-600">
                        Sube un archivo CSV o Excel (.xlsx) con datos de candidatos para este proceso.
                        Campos requeridos: <strong>name</strong>, <strong>email</strong>.
                    </p>

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-blue-800 font-medium">Plantilla de importación</p>
                            <button
                                type="button"
                                onClick={() => handleDownloadStandardTemplate(process.title)}
                                className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                                <Download className="w-3 h-3" />
                                Descargar plantilla
                            </button>
                        </div>
                        <p className="text-xs text-blue-700">
                            Columnas: {TEMPLATE_HEADERS.join(', ')}
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
                                            <label htmlFor="process-import-file" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500">
                                                <span>Sube un archivo</span>
                                                <input id="process-import-file" type="file" className="sr-only" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
                                            </label>
                                            <p className="pl-1">o arrastra y suelta</p>
                                        </div>
                                        <p className="text-xs text-gray-500">CSV o Excel (.xlsx, .xls)</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {importResult && (
                        <div className={`p-4 rounded-md border ${importResult.failed > 0 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                            <p className="font-semibold">Importados: {importResult.success}</p>
                            {importResult.failed > 0 && (
                                <details className="mt-2">
                                    <summary className="cursor-pointer text-sm font-medium">Errores ({importResult.failed})</summary>
                                    <ul className="mt-2 ml-4 list-disc text-xs space-y-1 max-h-40 overflow-y-auto">
                                        {importResult.errors.map((error, idx) => (
                                            <li key={idx}>{error}</li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={!file || isImporting}
                            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700 disabled:bg-primary-300 disabled:cursor-not-allowed"
                        >
                            <UserPlus className="w-5 h-5 mr-2" />
                            {isImporting ? 'Importando...' : 'Importar candidatos'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/** Vista legacy — ya no aparece en el menú lateral; usar ProcessImportModal desde ProcessView. */
export const BulkImportView: React.FC = () => {
    const { state, actions, getLabel } = useAppState();
    const standardProcesses = state.processes.filter(p => !p.isBulkProcess);

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
                {getLabel('sidebar_bulk_import', 'Importación masiva de candidatos')}
            </h1>
            <p className="text-gray-600 max-w-2xl">
                La importación masiva está disponible dentro de cada proceso específico.
                Abra un proceso desde <strong>Procesos</strong> y use el botón <strong>Importar candidatos</strong>.
            </p>
            {standardProcesses.length > 0 && (
                <div className="mt-6">
                    <button
                        type="button"
                        onClick={() => actions.setView('process-view', standardProcesses[0].id)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                        Ir a {standardProcesses[0].title}
                    </button>
                </div>
            )}
        </div>
    );
};
