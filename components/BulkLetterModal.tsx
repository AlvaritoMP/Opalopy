import React, { useMemo, useState } from 'react';
import { useAppState } from '../App';
import { Candidate } from '../types';
import { X, Upload, Download, AlertCircle } from 'lucide-react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { obtenerFechaEmision } from '../lib/dateFormatter';

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

// Función mejorada para detectar campos en plantillas DOCX
const detectTemplateKeys = (xml: string): string[] => {
    const keys = new Set<string>();
    
    // Formato estándar de docxtemplater: {{campo}}
    const patterns = [
        /\{\{([^}]+)\}\}/g,           // {{campo}}
        /\{([^}]+)\}/g,                // {campo} (sin doble llave)
        /\$\{([^}]+)\}/g,              // ${campo}
        /\[\[([^\]]+)\]\]/g,           // [[campo]]
    ];

    patterns.forEach(pattern => {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(xml)) !== null) {
            const key = match[1].trim();
            // Filtrar claves que parecen ser XML real (con < o >)
            if (key && !key.includes('<') && !key.includes('>') && key.length < 100) {
                keys.add(key);
            }
        }
    });

    return Array.from(keys).sort();
};

export const BulkLetterModal: React.FC<{ candidateIds: string[]; onClose: () => void }> = ({ candidateIds, onClose }) => {
    const { state, actions } = useAppState();
    const candidates = useMemo(() => state.candidates.filter(c => candidateIds.includes(c.id)), [state.candidates, candidateIds]);
    const [uploadedName, setUploadedName] = useState<string>('');
    const [uploadedBuffer, setUploadedBuffer] = useState<ArrayBuffer | null>(null);
    const [detectedKeys, setDetectedKeys] = useState<string[]>([]);
    const [data, setData] = useState<Record<string, string>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [lastError, setLastError] = useState<string>('');

    const savedTemplates = state.settings?.templates || [];
    const companyName = state.settings?.appName || 'ATS Pro';

    const fromBase64ToArrayBuffer = (b64: string): ArrayBuffer => {
        const binary = atob(b64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    };

    const loadSavedTemplate = (tplId: string) => {
        const tpl = savedTemplates.find(t => t.id === tplId);
        if (!tpl) return;
        setSelectedTemplateId(tplId);
        setLastError('');
        const buf = fromBase64ToArrayBuffer(tpl.docxBase64);
        setUploadedBuffer(buf);
        setUploadedName(`${tpl.name}.docx`);
        try {
            const zip = new PizZip(buf);
            const xml = zip.file('word/document.xml')?.asText() || '';
            const keys = detectTemplateKeys(xml);
            setDetectedKeys(keys);
            
            if (keys.length === 0) {
                setLastError('No se detectaron campos en la plantilla. Asegúrate de usar el formato {{campo}} en tu documento Word.');
            }
        } catch (e: any) {
            setLastError('No se pudo leer la plantilla guardada: ' + (e.message || 'Error desconocido'));
            alert('No se pudo leer la plantilla guardada.');
        }
    };

    const generateForAll = async () => {
        if (!uploadedBuffer) {
            alert('Sube o selecciona una plantilla .docx primero.');
            return;
        }
        setIsGenerating(true);
        setLastError('');
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];
        
        try {
            for (const cand of candidates) {
                try {
                    const zip = new PizZip(uploadedBuffer);
                    const doc = new Docxtemplater(zip, { 
                        paragraphLoop: true, 
                        linebreaks: true,
                        delimiters: {
                            start: '{{',
                            end: '}}'
                        }
                    });
                    
                    // Generar fecha de emisión automáticamente
                    const fechaEmision = obtenerFechaEmision();
                    
                    // Preparar datos con todas las variaciones posibles
                    const merged: Record<string, string> = {
                        candidateName: cand.name,
                        Nombre: cand.name,
                        nombre: cand.name,
                        candidateEmail: cand.email || '',
                        Email: cand.email || '',
                        candidatePhone: cand.phone || '',
                        Telefono: cand.phone || '',
                        candidateDni: cand.dni || '',
                        DNI: cand.dni || '',
                        dni: cand.dni || '',
                        companyName: companyName,
                        Empresa: companyName,
                        Salarioacordadoletras: cand.agreedSalaryInWords || '',
                        salarioAcordadoLetras: cand.agreedSalaryInWords || '',
                        salarioacordadoletras: cand.agreedSalaryInWords || '',
                        SalarioAcordadoLetras: cand.agreedSalaryInWords || '',
                        Fechaemision: fechaEmision,
                        fechaEmision: fechaEmision,
                        FechaEmision: fechaEmision,
                        fechaemision: fechaEmision,
                        FechaEmision: fechaEmision,
                        ...data,
                    };
                    
                    doc.setData(merged);
                    doc.render();
                    const out = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                    const nameSafe = cand.name.replace(/[^a-z0-9_-]/gi, '_');
                    const finalName = `${(uploadedName || 'documento').replace(/\.docx?$/i, '')}_${nameSafe}.docx`;
                    const url = await blobToDataUrl(out);
                    const updated = {
                        ...cand,
                        attachments: [
                            ...cand.attachments,
                            { id: `att-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: finalName, url, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: out.size },
                        ],
                    };
                    await actions.updateCandidate(updated, state.currentUser?.name);
                    successCount++;
                } catch (e: any) {
                    errorCount++;
                    let errorMsg = `Error con ${cand.name}: `;
                    if (e.properties && e.properties.errors) {
                        const errs = e.properties.errors;
                        errs.forEach((err: any) => {
                            if (err.name === 'UnclosedTagError') {
                                errorMsg += `Campo "${err.tag}" no está cerrado correctamente. `;
                            } else if (err.name === 'UnopenedTagError') {
                                errorMsg += `Campo "${err.tag}" no está abierto correctamente. `;
                            } else {
                                errorMsg += err.message || 'Error desconocido. ';
                            }
                        });
                    } else {
                        errorMsg += e.message || 'Error desconocido.';
                    }
                    errors.push(errorMsg);
                }
            }
            
            if (errorCount > 0) {
                setLastError(`Se generaron ${successCount} documento(s) exitosamente, pero ${errorCount} fallaron:\n\n${errors.join('\n')}`);
            } else {
                alert(`Documentos generados y guardados exitosamente para ${successCount} candidato(s).`);
                onClose();
            }
        } catch (e: any) {
            console.error(e);
            setLastError('Error general al generar documentos: ' + (e.message || 'Error desconocido'));
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Emitir cartas para {candidates.length} candidato(s)</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><X /></button>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {lastError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start">
                                <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                                <div className="flex-1">
                                    <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                                    <pre className="text-sm text-red-800 whitespace-pre-wrap">{lastError}</pre>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            {state.settings?.templates?.length ? (
                                <select
                                    value={selectedTemplateId}
                                    onChange={e => e.target.value && loadSavedTemplate(e.target.value)}
                                    className="w-full border-gray-300 rounded-md shadow-sm"
                                >
                                    <option value="">Seleccionar plantilla guardada</option>
                                    {state.settings.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            ) : (
                                <p className="text-sm text-gray-500">No hay plantillas guardadas. Cárgalas y guárdalas en la sección "Cartas".</p>
                            )}
                        </div>
                        {uploadedName && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 whitespace-nowrap">Plantilla: {uploadedName}</span>
                                {detectedKeys.length > 0 && (
                                    <span className="text-xs text-green-600">✓ {detectedKeys.length} campo(s)</span>
                                )}
                            </div>
                        )}
                    </div>
                    {uploadedBuffer && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-gray-800">Campos de plantilla</h3>
                            {detectedKeys.length === 0 ? (
                                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                                    <p className="text-xs text-yellow-800">
                                        No se detectaron campos con formato {'{{campo}}'}. Los campos comunes se llenarán automáticamente, pero puedes definir valores adicionales abajo.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {detectedKeys.map(k => (
                                        <div key={k}>
                                            <label className="block text-xs text-gray-600 mb-1">{k}</label>
                                            <input
                                                value={data[k] || ''}
                                                onChange={e => setData(prev => ({ ...prev, [k]: e.target.value }))}
                                                className="w-full border-gray-300 rounded-md shadow-sm"
                                                placeholder={`Valor para ${k}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-gray-500">
                                Los campos comunes (Nombre, DNI, Email, Teléfono, Puesto, Empresa) se llenarán automáticamente con los datos de cada candidato.
                            </p>
                        </div>
                    )}
                </div>
                <div className="p-6 bg-gray-50 rounded-b-2xl flex justify-end gap-2 border-t">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md">Cancelar</button>
                    <button onClick={generateForAll} disabled={!uploadedBuffer || isGenerating} className="px-4 py-2 bg-primary-600 text-white rounded-md disabled:bg-primary-300 flex items-center">
                        <Download className="w-4 h-4 mr-2" /> {isGenerating ? 'Generando...' : 'Generar y guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
};


