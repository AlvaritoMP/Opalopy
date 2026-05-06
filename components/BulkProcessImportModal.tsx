import React, { useState } from 'react';
import { useAppState } from '../App';
import { Upload, FileText, X, Loader2, Download } from 'lucide-react';
import { Candidate, Process } from '../types';
import * as XLSX from 'xlsx';

interface BulkProcessImportModalProps {
    process: Process;
    onClose: () => void;
    onImportComplete: () => void;
}

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

// CSV parser
const parseCSV = (csvText: string): Omit<Candidate, 'id' | 'history' | 'processId' | 'stageId' | 'attachments'>[] => {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
    const candidates: Omit<Candidate, 'id' | 'history' | 'processId' | 'stageId' | 'attachments'>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]).map(v => v.trim().replace(/^"|"$/g, ''));
        const candidate: any = {};
        headers.forEach((header, index) => {
            const value = values[index] || '';
            const cleanValue = value.trim() === '' ? undefined : value.trim();
            
            if (header === 'age' && cleanValue && !isNaN(Number(cleanValue))) {
                candidate[header] = Number(cleanValue);
            } else if (cleanValue !== undefined) {
                candidate[header] = cleanValue;
            }
        });
        candidates.push(candidate);
    }
    return candidates;
};

// Excel parser
const parseExcel = (data: ArrayBuffer): Omit<Candidate, 'id' | 'history' | 'processId' | 'stageId' | 'attachments'>[] => {
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    const candidates: Omit<Candidate, 'id' | 'history' | 'processId' | 'stageId' | 'attachments'>[] = [];
    
    jsonData.forEach((row: any) => {
        const candidate: any = {};
        Object.keys(row).forEach(key => {
            const normalizedKey = key.trim().toLowerCase();
            const value = row[key];
            
            if (normalizedKey === 'age' && value !== '' && !isNaN(Number(value))) {
                candidate['age'] = Number(value);
            } else {
                const keyMapping: { [key: string]: string } = {
                    'name': 'name', 'nombre': 'name',
                    'email': 'email', 'correo': 'email',
                    'phone': 'phone', 'teléfono': 'phone', 'telefono': 'phone',
                    'phone2': 'phone2', 'teléfono 2': 'phone2', 'telefono2': 'phone2',
                    'description': 'description', 'descripción': 'description',
                    'source': 'source', 'fuente': 'source',
                    'salaryexpectation': 'salaryExpectation', 'expectativa salarial': 'salaryExpectation',
                    'agreedSalary': 'agreedSalary', 'salario acordado': 'agreedSalary',
                    'dni': 'dni',
                    'linkedinurl': 'linkedinUrl', 'linkedin': 'linkedinUrl',
                    'address': 'address', 'dirección': 'address', 'direccion': 'address',
                    'province': 'province', 'provincia': 'province',
                    'district': 'district', 'distrito': 'district',
                };
                
                const mappedKey = keyMapping[normalizedKey];
                if (mappedKey && value !== '') {
                    candidate[mappedKey] = value;
                }
            }
        });
        candidates.push(candidate);
    });
    
    return candidates;
};

export const BulkProcessImportModal: React.FC<BulkProcessImportModalProps> = ({ process, onClose, onImportComplete }) => {
    const { state, actions } = useAppState();
    const [file, setFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setImportResult(null);
        }
    };

    const handleDownloadTemplate = () => {
        // Crear plantilla Excel con columnas predefinidas y ejemplos
        const templateData = [
            {
                'name': 'Juan Pérez',
                'email': 'juan.perez@example.com',
                'phone': '987654321',
                'description': 'Desarrollador con 5 años de experiencia',
                'source': 'LinkedIn',
                'salaryExpectation': '50000',
                'age': '30',
                'dni': '12345678',
                'linkedinUrl': 'https://linkedin.com/in/juanperez',
                'address': 'Lima',
                'province': 'LIMA',
                'district': 'MIRAFLORES'
            },
            {
                'name': 'María González',
                'email': 'maria.gonzalez@example.com',
                'phone': '987654322',
                'description': 'Ingeniera de Software especializada en React',
                'source': 'Referencia',
                'salaryExpectation': '60000',
                'age': '28',
                'dni': '87654321',
                'linkedinUrl': 'https://linkedin.com/in/mariagonzalez',
                'address': 'Arequipa',
                'province': 'AREQUIPA',
                'district': 'YANAHUARA'
            }
        ];

        // Crear workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);
        
        // Ajustar ancho de columnas
        const colWidths = [
            { wch: 20 }, // name
            { wch: 30 }, // email
            { wch: 15 }, // phone
            { wch: 40 }, // description
            { wch: 15 }, // source
            { wch: 18 }, // salaryExpectation
            { wch: 5 },  // age
            { wch: 12 }, // dni
            { wch: 40 }, // linkedinUrl
            { wch: 20 }, // address
            { wch: 15 }, // province
            { wch: 15 }  // district
        ];
        ws['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(wb, ws, 'Candidatos');
        
        // Descargar archivo con nombre basado en el proceso
        const processName = process.title.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
        XLSX.writeFile(wb, `Plantilla_Importacion_${processName}.xlsx`);
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
            let parsedCandidates: Omit<Candidate, 'id' | 'history' | 'processId' | 'stageId' | 'attachments'>[] = [];
            try {
                if (isExcel) {
                    const arrayBuffer = event.target?.result as ArrayBuffer;
                    parsedCandidates = parseExcel(arrayBuffer);
                } else {
                    const text = event.target?.result as string;
                    parsedCandidates = parseCSV(text);
                }
                
                let successCount = 0;
                const errors: string[] = [];
                
                const cleanValue = (value: any): any => {
                    if (value === undefined || value === null || value === '') return undefined;
                    if (typeof value === 'string') {
                        const trimmed = value.trim();
                        return trimmed === '' ? undefined : trimmed;
                    }
                    return value;
                };
                
                const cleanLocationValue = (value: any): string | undefined => {
                    const cleaned = cleanValue(value);
                    if (cleaned === undefined) return undefined;
                    return cleaned && cleaned.trim() ? cleaned.trim() : undefined;
                };
                
                for (let index = 0; index < parsedCandidates.length; index++) {
                    const candidateData = parsedCandidates[index];
                    const rowNumber = index + 2;
                    
                    const name = cleanValue(candidateData.name);
                    const email = cleanValue(candidateData.email);
                    
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
                        const cleanCandidateData: any = {
                            name: name,
                            email: email,
                            processId: process.id,
                            stageId: firstStageId,
                            attachments: [],
                        };
                        
                        const optionalFields = [
                            'phone', 'phone2', 'description', 'source', 'salaryExpectation', 
                            'agreedSalary', 'age', 'dni', 'linkedinUrl', 'address'
                        ];
                        
                        optionalFields.forEach(field => {
                            const cleaned = cleanValue(candidateData[field]);
                            if (cleaned !== undefined) {
                                cleanCandidateData[field] = cleaned;
                            }
                        });
                        
                        const province = cleanLocationValue(candidateData.province);
                        const district = cleanLocationValue(candidateData.district);
                        if (province !== undefined) {
                            cleanCandidateData.province = province;
                        }
                        if (district !== undefined) {
                            cleanCandidateData.district = district;
                        }
                        
                        await actions.addCandidate(cleanCandidateData);
                        successCount++;
                    } catch (error: any) {
                        const errorMsg = error?.message || 'Error desconocido';
                        errors.push(`Fila ${rowNumber} (${name || 'sin nombre'}): ${errorMsg}`);
                        console.error(`Error creando candidato ${name} (fila ${rowNumber}):`, error);
                    }
                }
                
                setImportResult({ 
                    success: successCount, 
                    failed: parsedCandidates.length - successCount,
                    errors: errors.slice(0, 10)
                });
                
                if (successCount > 0) {
                    actions.showToast(`${successCount} candidato(s) importado(s) exitosamente`, 'success', 5000);
                    onImportComplete();
                }
            } catch (error) {
                console.error("Failed to parse or import file", error);
                const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
                actions.showToast(`Error al importar: ${errorMsg}`, 'error', 5000);
                setImportResult({ 
                    success: 0, 
                    failed: parsedCandidates.length,
                    errors: [`Error al parsear el archivo: ${errorMsg}`]
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
                        Importar Candidatos - {process.title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <p className="text-sm text-gray-600 mb-4">
                            Sube un archivo CSV o Excel (.xlsx) con datos de candidatos. La primera fila debe contener encabezados.
                        </p>
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs text-blue-800 font-medium">📄 Plantilla Predefinida</p>
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                >
                                    <Download className="w-3 h-3" />
                                    Descargar Plantilla
                                </button>
                            </div>
                            <p className="text-xs text-blue-700">
                                Descarga la plantilla Excel con el formato correcto y ejemplos de datos
                            </p>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                            <strong>Campos requeridos:</strong> name, email<br />
                            <strong>Campos opcionales:</strong> phone, description, source, salaryExpectation, agreedSalary, age, dni, linkedinUrl, address, province, district
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
                                        <button
                                            onClick={() => setFile(null)}
                                            className="mt-2 text-sm text-red-600 hover:text-red-700"
                                        >
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
                                {importResult.success > 0 && <span className="text-green-700">✅ {importResult.success} candidato(s) importado(s) exitosamente</span>}
                                {importResult.failed > 0 && <span className="text-yellow-700">⚠️ {importResult.failed} candidato(s) fallaron</span>}
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
