import React, { useMemo, useState, useEffect } from 'react';
import { useAppState } from '../App';
import { Candidate, Process } from '../types';
import { FileText, Download, Upload, AlertCircle, CheckCircle, HelpCircle, Info, Edit2 } from 'lucide-react';
import { saveAs } from 'file-saver';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

// Función para convertir Blob a DataURL (base64)
const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

interface ValidationError {
    field: string;
    message: string;
    type: 'missing' | 'invalid' | 'warning';
}

// Función mejorada para detectar campos en plantillas DOCX
// Maneja casos donde Word divide los campos en múltiples nodos XML
const detectTemplateKeys = (zip: PizZip): string[] => {
    const keys = new Set<string>();
    
    // Extraer todo el texto de los nodos w:t (texto) del XML
    // Esto reconstruye campos que Word puede haber dividido en múltiples nodos
    const extractTextFromXML = (xml: string): string => {
        // Extraer todo el contenido de las etiquetas <w:t>...</w:t>
        // Usar una expresión más permisiva que capture contenido incluso si hay entidades XML
        const textMatches = xml.match(/<w:t[^>]*>(.*?)<\/w:t>/gs) || [];
        return textMatches
            .map(match => {
                // Extraer solo el texto, eliminando etiquetas anidadas si las hay
                let text = match.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '');
                // Eliminar cualquier etiqueta XML que pueda estar dentro
                text = text.replace(/<[^>]+>/g, '');
                // Decodificar entidades XML comunes
                text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
                return text;
            })
            .join('');
    };
    
    // Buscar en document.xml (contenido principal)
    const documentXml = zip.file('word/document.xml')?.asText() || '';
    let allText = extractTextFromXML(documentXml);
    
    // Buscar en headers
    const headerFiles = Object.keys(zip.files).filter(name => name.startsWith('word/header') && name.endsWith('.xml'));
    headerFiles.forEach(headerFile => {
        const headerXml = zip.file(headerFile)?.asText() || '';
        allText += ' ' + extractTextFromXML(headerXml);
    });
    
    // Buscar en footers
    const footerFiles = Object.keys(zip.files).filter(name => name.startsWith('word/footer') && name.endsWith('.xml'));
    footerFiles.forEach(footerFile => {
        const footerXml = zip.file(footerFile)?.asText() || '';
        allText += ' ' + extractTextFromXML(footerXml);
    });
    
    // También buscar directamente en el XML sin procesar (por si hay campos que no están en w:t)
    const rawXml = documentXml + 
        headerFiles.map(f => zip.file(f)?.asText() || '').join('') + 
        footerFiles.map(f => zip.file(f)?.asText() || '').join('');
    
    // Función para extraer campos de un texto
    const extractKeys = (text: string) => {
        // Patrón principal: {{campo}} - buscar campos completos
        const doubleBracePattern = /\{\{([^}]+)\}\}/g;
        let match: RegExpExecArray | null;
        const tempKeys = new Set<string>();
        
        // Resetear el regex para buscar desde el inicio
        doubleBracePattern.lastIndex = 0;
        while ((match = doubleBracePattern.exec(text)) !== null) {
            const key = match[1].trim();
            if (key && 
                !key.includes('<') && 
                !key.includes('>') && 
                key.length > 0 && 
                key.length < 100 && 
                !key.toLowerCase().includes('xml') &&
                !key.toLowerCase().includes('w:t') &&
                !key.toLowerCase().includes('w:r')) {
                tempKeys.add(key);
            }
        }
        
        // Agregar todas las claves encontradas
        tempKeys.forEach(k => keys.add(k));
    };
    
    // Buscar en texto extraído (reconstruido desde nodos w:t)
    extractKeys(allText);
    
    // Buscar también en XML crudo (por si hay campos que cruzan etiquetas)
    extractKeys(rawXml);
    
    // Limpiar y normalizar las claves
    const cleanedKeys = Array.from(keys)
        .map(k => k.trim())
        .filter(k => k.length > 0 && k.length < 100)
        .filter(k => !k.toLowerCase().includes('xml'))
        .filter(k => !k.toLowerCase().includes('w:t'))
        .filter(k => !k.toLowerCase().includes('w:r'))
        .filter(k => !k.match(/^[<>]/)); // No debe empezar con < o >
    
    // Eliminar duplicados (case-insensitive) y mantener la versión original
    const uniqueKeys = new Map<string, string>();
    cleanedKeys.forEach(key => {
        const keyLower = key.toLowerCase();
        if (!uniqueKeys.has(keyLower)) {
            uniqueKeys.set(keyLower, key);
        }
    });
    
    return Array.from(uniqueKeys.values()).sort();
};

// Función para autocompletar datos del candidato
const autoFillCandidateData = (
    candidate: Candidate | undefined,
    process: Process | undefined,
    companyName: string,
    detectedKeys: string[]
): Record<string, string> => {
    const data: Record<string, string> = {};
    
    if (!candidate) return data;

    // Mapeo inteligente de campos comunes
    const fieldMappings: Record<string, string> = {
        // Nombres del candidato
        'candidateName': candidate.name,
        'Nombre': candidate.name,
        'nombre': candidate.name,
        'NOMBRE': candidate.name,
        'candidato': candidate.name,
        'Candidato': candidate.name,
        
        // Email
        'candidateEmail': candidate.email || '',
        'Email': candidate.email || '',
        'email': candidate.email || '',
        'EMAIL': candidate.email || '',
        'correo': candidate.email || '',
        'Correo': candidate.email || '',
        
        // Teléfono
        'candidatePhone': candidate.phone || '',
        'Telefono': candidate.phone || '',
        'telefono': candidate.phone || '',
        'TELÉFONO': candidate.phone || '',
        'Teléfono': candidate.phone || '',
        'phone': candidate.phone || '',
        'Phone': candidate.phone || '',
        
        // DNI
        'candidateDni': candidate.dni || '',
        'DNI': candidate.dni || '',
        'dni': candidate.dni || '',
        'cedula': candidate.dni || '',
        'Cedula': candidate.dni || '',
        'CÉDULA': candidate.dni || '',
        
        // LinkedIn
        'candidateLinkedIn': candidate.linkedinUrl || '',
        'LinkedIn': candidate.linkedinUrl || '',
        'linkedin': candidate.linkedinUrl || '',
        'LINKEDIN': candidate.linkedinUrl || '',
        
        // Dirección
        'candidateAddress': candidate.address || '',
        'Direccion': candidate.address || '',
        'direccion': candidate.address || '',
        'DIRECCIÓN': candidate.address || '',
        'Dirección': candidate.address || '',
        'address': candidate.address || '',
        'Address': candidate.address || '',
        
        // Fecha de contratación
        'hireDate': candidate.hireDate || '',
        'FechaContratacion': candidate.hireDate || '',
        'fechaContratacion': candidate.hireDate || '',
        'Fecha de Contratación': candidate.hireDate || '',
        'fecha de contratación': candidate.hireDate || '',
        
        // Proceso/Posición
        'positionTitle': process?.title || '',
        'Puesto': process?.title || '',
        'puesto': process?.title || '',
        'PUESTO': process?.title || '',
        'Posicion': process?.title || '',
        'posicion': process?.title || '',
        'POSICIÓN': process?.title || '',
        'Posición': process?.title || '',
        'processTitle': process?.title || '',
        'ProcessTitle': process?.title || '',
        
        // Empresa
        'companyName': companyName,
        'Empresa': companyName,
        'empresa': companyName,
        'EMPRESA': companyName,
        'Company': companyName,
        'company': companyName,
        
        // Fecha actual
        'fechaActual': new Date().toLocaleDateString('es-ES'),
        'FechaActual': new Date().toLocaleDateString('es-ES'),
        'fecha': new Date().toLocaleDateString('es-ES'),
        'Fecha': new Date().toLocaleDateString('es-ES'),
        'FECHA': new Date().toLocaleDateString('es-ES'),
        'today': new Date().toLocaleDateString('es-ES'),
        'Today': new Date().toLocaleDateString('es-ES'),
        'hoy': new Date().toLocaleDateString('es-ES'),
        'Hoy': new Date().toLocaleDateString('es-ES'),
    };

    // Autocompletar todos los campos detectados
    detectedKeys.forEach(key => {
        // Buscar coincidencia exacta primero
        if (fieldMappings[key]) {
            data[key] = fieldMappings[key];
            return;
        }
        
        // Buscar coincidencia sin importar mayúsculas/minúsculas
        const keyLower = key.toLowerCase();
        for (const [mappedKey, value] of Object.entries(fieldMappings)) {
            if (mappedKey.toLowerCase() === keyLower) {
                data[key] = value;
                return;
            }
        }
        
        // Si no hay coincidencia, dejar vacío (el usuario puede completarlo)
        if (!data[key]) {
            data[key] = '';
        }
    });

    return data;
};

export const Letters: React.FC = () => {
    const { state, getLabel, actions } = useAppState();
    const [candidateId, setCandidateId] = useState<string>('');
    const [uploadedName, setUploadedName] = useState<string>('');
    const [uploadedBuffer, setUploadedBuffer] = useState<ArrayBuffer | null>(null);
    const [detectedKeys, setDetectedKeys] = useState<string[]>([]);
    const [docxData, setDocxData] = useState<Record<string, string>>({});
    const [templateLabel, setTemplateLabel] = useState<string>('');
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [showGuide, setShowGuide] = useState<boolean>(false);
    const [lastError, setLastError] = useState<string>('');
    const [editingField, setEditingField] = useState<string | null>(null);

    const savedTemplates = state.settings?.templates || [];
    const companyName = state.settings?.appName || 'ATS Pro';
    const selectedCandidate = useMemo(() => state.candidates.find(c => c.id === candidateId), [state.candidates, candidateId]);
    const selectedProcess = useMemo(() => {
        if (!selectedCandidate) return undefined;
        return state.processes.find(p => p.id === selectedCandidate.processId);
    }, [state.processes, selectedCandidate]);

    // Autocompletar datos cuando cambia el candidato o la plantilla
    useEffect(() => {
        if (selectedCandidate && uploadedBuffer && detectedKeys.length > 0) {
            const autoFilled = autoFillCandidateData(selectedCandidate, selectedProcess, companyName, detectedKeys);
            setDocxData(autoFilled);
        }
    }, [selectedCandidate, uploadedBuffer, detectedKeys, selectedProcess, companyName]);

    const toBase64 = async (buf: ArrayBuffer): Promise<string> => {
        let binary = '';
        const bytes = new Uint8Array(buf);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    };

    const fromBase64ToArrayBuffer = (b64: string): ArrayBuffer => {
        const binary = atob(b64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    };

    const validateTemplateData = (): ValidationError[] => {
        const errors: ValidationError[] = [];
        
        if (!uploadedBuffer) {
            return errors;
        }

        detectedKeys.forEach(key => {
            const value = docxData[key];
            if (!value || value.trim() === '') {
                errors.push({
                    field: key,
                    message: `El campo "${key}" está vacío. Debes proporcionar un valor.`,
                    type: 'missing'
                });
            }
        });

        return errors;
    };

    const handleDownload = async () => {
        if (!uploadedBuffer || !selectedCandidate) {
            alert('Selecciona un candidato y carga una plantilla primero.');
            return;
        }

        try {
            // Validar antes de generar
            const errors = validateTemplateData();
            if (errors.length > 0) {
                setValidationErrors(errors);
                setLastError(`Hay ${errors.length} campo(s) vacío(s) que deben completarse antes de generar el documento.`);
                return;
            }

            const zip = new PizZip(uploadedBuffer);
            const doc = new Docxtemplater(zip, { 
                paragraphLoop: true, 
                linebreaks: true,
                delimiters: {
                    start: '{{',
                    end: '}}'
                }
            });
            
            doc.setData(docxData);
            doc.render();
            
            const out = doc.getZip().generate({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
            const nameSafe = selectedCandidate.name.replace(/[^a-z0-9_-]/gi, '_');
            const base = uploadedName.replace(/\.docx?$/i, '') || 'documento';
            const finalName = `${base}_${nameSafe}.docx`;
            
            // Descargar el archivo
            saveAs(out, finalName);
            
            // Guardar también en los attachments del candidato y en Google Drive
            try {
                const googleDriveConfig = state.settings?.googleDrive;
                const isGoogleDriveConnected = googleDriveConfig?.connected && googleDriveConfig?.accessToken;
                let attachmentUrl: string;
                let attachmentId: string = `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;

                // Si Google Drive está conectado, subir a la carpeta "Cartas"
                if (isGoogleDriveConnected && googleDriveConfig && googleDriveConfig.rootFolderId) {
                    try {
                        const { googleDriveService } = await import('../lib/googleDrive');
                        googleDriveService.initialize(googleDriveConfig);
                        
                        // Obtener o crear carpeta "Cartas" dentro de la carpeta raíz
                        const cartasFolder = await googleDriveService.getOrCreateSectionFolder('Cartas', googleDriveConfig.rootFolderId);
                        
                        // Convertir blob a File para subir
                        const file = new File([out], finalName, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                        
                        // Subir a Google Drive
                        const uploadedFile = await googleDriveService.uploadFile(file, cartasFolder.id, finalName);
                        attachmentUrl = googleDriveService.getFileViewUrl(uploadedFile.id);
                        attachmentId = uploadedFile.id;
                        console.log(`✅ Carta guardada en Google Drive: Cartas/${finalName}`);
                    } catch (driveError: any) {
                        console.error('Error subiendo a Google Drive, usando almacenamiento local:', driveError);
                        // Fallback a Base64
                        attachmentUrl = await blobToDataUrl(out);
                    }
                } else {
                    // Usar Base64 si Google Drive no está configurado
                    attachmentUrl = await blobToDataUrl(out);
                }

                const updated = {
                    ...selectedCandidate,
                    attachments: [
                        ...selectedCandidate.attachments,
                        { 
                            id: attachmentId, 
                            name: finalName, 
                            url: attachmentUrl, 
                            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
                            size: out.size 
                        },
                    ],
                };
                await actions.updateCandidate(updated, state.currentUser?.name);
            } catch (saveError) {
                console.error('Error guardando documento en candidato:', saveError);
                // No fallar si no se puede guardar, solo mostrar advertencia
                alert('Documento generado y descargado, pero hubo un problema al guardarlo en los documentos del candidato.');
            }
            
            setLastError('');
            setValidationErrors([]);
            alert('Documento generado exitosamente y guardado en los documentos del candidato.');
        } catch (e: any) {
            console.error('Error generando DOCX:', e);
            let errorMessage = 'No se pudo generar el documento. ';
            
            if (e.properties && e.properties.errors) {
                const errors = e.properties.errors;
                errorMessage += `\n\nErrores encontrados:\n`;
                errors.forEach((err: any) => {
                    if (err.name === 'UnclosedTagError') {
                        errorMessage += `- Campo "${err.tag}" no está cerrado correctamente. Verifica que uses {{${err.tag}}} con dobles llaves.\n`;
                    } else if (err.name === 'UnopenedTagError') {
                        errorMessage += `- Campo "${err.tag}" no está abierto correctamente.\n`;
                    } else if (err.name === 'XMLError') {
                        errorMessage += `- Error en el formato XML de la plantilla. Verifica que la plantilla no esté corrupta.\n`;
                    } else {
                        errorMessage += `- ${err.message || 'Error desconocido'}\n`;
                    }
                });
            } else if (e.message) {
                errorMessage += e.message;
            }
            
            setLastError(errorMessage);
            alert(errorMessage);
        }
    };

    const handleUploadTemplate = async (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const buf = reader.result as ArrayBuffer;
            setUploadedBuffer(buf);
            setUploadedName(file.name);
            setLastError('');
            setValidationErrors([]);
            try {
                const zip = new PizZip(buf);
                
                // Verificar que el archivo sea válido
                if (!zip.file('word/document.xml')) {
                    throw new Error('No se pudo leer el contenido del documento. Asegúrate de que sea un archivo .docx válido.');
                }
                
                const keys = detectTemplateKeys(zip);
                setDetectedKeys(keys);
                
                if (keys.length === 0) {
                    setLastError('No se detectaron campos en la plantilla. Asegúrate de usar el formato {{campo}} en tu documento Word.');
                } else {
                    setLastError('');
                    // Autocompletar si hay candidato seleccionado
                    if (selectedCandidate) {
                        const autoFilled = autoFillCandidateData(selectedCandidate, selectedProcess, companyName, keys);
                        setDocxData(autoFilled);
                    }
                }
            } catch (e: any) {
                console.error('No se pudo leer la plantilla DOCX:', e);
                const errorMsg = e.message || 'No se pudo leer la plantilla. Asegúrate de subir un .docx válido.';
                setLastError(errorMsg);
                alert(errorMsg);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSaveTemplate = async () => {
        if (!uploadedBuffer) {
            alert('Primero sube una plantilla .docx.');
            return;
        }
        const name = templateLabel.trim() || uploadedName.replace(/\.docx?$/i, '');
        if (!name) {
            alert('Asigna un nombre a la plantilla.');
            return;
        }
        const docxBase64 = await toBase64(uploadedBuffer);
        const newTpl = { id: `tpl-${Date.now()}`, name, docxBase64 };
        const templates = [...savedTemplates, newTpl];
        await actions.saveSettings({ ...(state.settings as any), templates });
        alert('Plantilla guardada.');
        setTemplateLabel('');
    };

    const handleLoadTemplate = async (tplId: string) => {
        const tpl = savedTemplates.find(t => t.id === tplId);
        if (!tpl) return;
        const buf = fromBase64ToArrayBuffer(tpl.docxBase64);
        setUploadedBuffer(buf);
        setUploadedName(`${tpl.name}.docx`);
        setLastError('');
        setValidationErrors([]);
        try {
            const zip = new PizZip(buf);
            const keys = detectTemplateKeys(zip);
            setDetectedKeys(keys);
            
            if (selectedCandidate) {
                const autoFilled = autoFillCandidateData(selectedCandidate, selectedProcess, companyName, keys);
                setDocxData(autoFilled);
            }
        } catch (e) {
            console.error('No se pudo leer la plantilla DOCX:', e);
            setLastError('No se pudo leer la plantilla guardada.');
            alert('No se pudo leer la plantilla guardada.');
        }
    };

    const handleDeleteTemplate = async (tplId: string) => {
        if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;
        const templates = savedTemplates.filter(t => t.id !== tplId);
        await actions.saveSettings({ ...(state.settings as any), templates });
    };

    // Validar cuando cambian los datos
    useEffect(() => {
        if (uploadedBuffer && detectedKeys.length > 0) {
            setValidationErrors(validateTemplateData());
        }
    }, [docxData, detectedKeys, uploadedBuffer]);

    const canGenerate = !!selectedCandidate && !!uploadedBuffer && detectedKeys.length > 0;

    return (
        <div className="p-8 h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <FileText className="w-7 h-7 mr-3" />
                    {getLabel('letters_title', 'Cartas')}
                </h1>
                <button
                    onClick={() => setShowGuide(!showGuide)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
                >
                    <HelpCircle className="w-5 h-5" />
                    {showGuide ? 'Ocultar guía' : 'Ver guía de plantillas'}
                </button>
            </div>

            {/* Guía de cómo crear plantillas */}
            {showGuide && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold text-blue-900 mb-4 flex items-center">
                        <Info className="w-6 h-6 mr-2" />
                        Guía: Cómo crear plantillas Word para cartas
                    </h2>
                    <div className="space-y-4 text-sm text-blue-800">
                        <div>
                            <h3 className="font-semibold mb-2">1. Crear el documento en Word</h3>
                            <p>Crea un documento Word (.docx) con el contenido de tu carta. Puedes usar cualquier formato, imágenes, tablas, etc.</p>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-2">2. Insertar campos dinámicos</h3>
                            <p>Para insertar datos que se reemplazarán automáticamente, usa el formato:</p>
                            <div className="bg-white p-3 rounded border border-blue-300 my-2 font-mono text-sm">
                                {'{{nombreDelCampo}}'}
                            </div>
                            <p className="mt-2"><strong>Importante:</strong> Usa exactamente <strong>doble llave</strong> al inicio y al final: <code className="bg-white px-1 rounded">{'{{'}</code> y <code className="bg-white px-1 rounded">{'}}'}</code></p>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-2">3. Campos disponibles (se autocompletan automáticamente)</h3>
                            <p className="mb-2 text-sm">El sistema reconoce automáticamente estos campos y sus variaciones. Puedes usar cualquiera de estos nombres en tu plantilla:</p>
                            <div className="bg-white p-3 rounded border border-blue-300 my-2 space-y-2 text-sm">
                                <div><strong>Nombre del candidato:</strong> {'{{Nombre}}'}, {'{{nombre}}'}, {'{{candidateName}}'}, {'{{Candidato}}'}</div>
                                <div><strong>Email:</strong> {'{{Email}}'}, {'{{email}}'}, {'{{candidateEmail}}'}, {'{{Correo}}'}</div>
                                <div><strong>Teléfono:</strong> {'{{Telefono}}'}, {'{{telefono}}'}, {'{{candidatePhone}}'}, {'{{Phone}}'}</div>
                                <div><strong>DNI:</strong> {'{{DNI}}'}, {'{{dni}}'}, {'{{candidateDni}}'}, {'{{Cedula}}'}</div>
                                <div><strong>Dirección:</strong> {'{{Direccion}}'}, {'{{direccion}}'}, {'{{candidateAddress}}'}, {'{{Address}}'}</div>
                                <div><strong>LinkedIn:</strong> {'{{LinkedIn}}'}, {'{{linkedin}}'}, {'{{candidateLinkedIn}}'}</div>
                                <div><strong>Puesto/Posición:</strong> {'{{Puesto}}'}, {'{{puesto}}'}, {'{{positionTitle}}'}, {'{{Posicion}}'}</div>
                                <div><strong>Empresa:</strong> {'{{Empresa}}'}, {'{{empresa}}'}, {'{{companyName}}'}, {'{{Company}}'}</div>
                                <div><strong>Fecha actual:</strong> {'{{Fecha}}'}, {'{{fecha}}'}, {'{{fechaActual}}'}, {'{{Today}}'}, {'{{Hoy}}'}</div>
                                <div><strong>Fecha de contratación:</strong> {'{{FechaContratacion}}'}, {'{{hireDate}}'}, {'{{Fecha de Contratación}}'}</div>
                            </div>
                            <div className="bg-green-50 border border-green-300 rounded p-3 mt-2">
                                <p className="text-sm text-green-800">
                                    <strong>✓ Mapeo automático:</strong> El sistema reconoce automáticamente estos campos sin importar mayúsculas/minúsculas. 
                                    Si usas un nombre diferente, puedes editarlo manualmente en el resumen de datos.
                                </p>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-2">4. Guardar y subir</h3>
                            <p>Guarda el documento como <strong>.docx</strong> (no .doc) y súbelo usando el botón "Elegir archivo" arriba.</p>
                            <div className="bg-blue-50 border border-blue-300 rounded p-3 mt-2">
                                <p className="text-sm text-blue-800">
                                    <strong>💡 Tip:</strong> Después de subir la plantilla, puedes guardarla con un nombre para reutilizarla con otros candidatos. 
                                    Las plantillas guardadas aparecerán en la lista "Plantillas guardadas" y podrás seleccionarlas sin tener que subirlas nuevamente.
                                </p>
                            </div>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-300 rounded p-3">
                            <h3 className="font-semibold mb-2 text-yellow-900">⚠️ Errores comunes</h3>
                            <ul className="list-disc list-inside space-y-1 text-yellow-800">
                                <li>Usar una sola llave <code>{'{campo}'}</code> en lugar de doble <code>{'{{campo}}'}</code></li>
                                <li>Espacios dentro de las llaves: <code>{'{{ campo }}'}</code> (debe ser <code>{'{{campo}}'}</code>)</li>
                                <li>Guardar como .doc en lugar de .docx</li>
                                <li>Campos sin cerrar: <code>{'{{campo'}</code> (falta <code>{'}}'}</code>)</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Mensaje de error general */}
            {lastError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                            <pre className="text-sm text-red-800 whitespace-pre-wrap">{lastError}</pre>
                        </div>
                    </div>
                </div>
            )}

            {/* Errores de validación */}
            {validationErrors.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="font-semibold text-yellow-900 mb-2">
                                Campos vacíos ({validationErrors.length})
                            </h3>
                            <ul className="space-y-1">
                                {validationErrors.map((err, idx) => (
                                    <li key={idx} className="text-sm text-yellow-800">
                                        <strong>"{err.field}":</strong> {err.message}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Panel izquierdo: Selección y configuración */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-1">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Configuración</h2>
                    <div className="space-y-4">
                        {/* Selección de candidato */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Candidato *</label>
                            <select 
                                value={candidateId} 
                                onChange={e => {
                                    setCandidateId(e.target.value);
                                    // Autocompletar cuando se selecciona candidato
                                    if (e.target.value && uploadedBuffer && detectedKeys.length > 0) {
                                        const candidate = state.candidates.find(c => c.id === e.target.value);
                                        const process = candidate ? state.processes.find(p => p.id === candidate.processId) : undefined;
                                        const autoFilled = autoFillCandidateData(candidate, process, companyName, detectedKeys);
                                        setDocxData(autoFilled);
                                    }
                                }} 
                                className="w-full border-gray-300 rounded-md shadow-sm"
                            >
                                <option value="">Selecciona un candidato</option>
                                {state.candidates.map((c: Candidate) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Subir plantilla */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla DOCX *</label>
                            <label className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 cursor-pointer w-full justify-center">
                                <Upload className="w-4 h-4 mr-2" /> Elegir archivo
                                <input type="file" accept=".docx" onChange={e => e.target.files && e.target.files[0] && handleUploadTemplate(e.target.files[0])} className="hidden" />
                            </label>
                            {uploadedName && (
                                <div className="mt-2 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    <p className="text-xs text-gray-600">{uploadedName}</p>
                                </div>
                            )}
                            {uploadedBuffer && detectedKeys.length > 0 && (
                                <p className="text-xs text-green-600 mt-1">
                                    ✓ {detectedKeys.length} campo(s) detectado(s)
                                </p>
                            )}
                        </div>

                        {/* Guardar plantilla */}
                        {uploadedBuffer && (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Guardar como plantilla</label>
                                <div className="flex gap-2">
                                    <input
                                        value={templateLabel}
                                        onChange={e => setTemplateLabel(e.target.value)}
                                        placeholder="Nombre de la plantilla"
                                        className="flex-1 border-gray-300 rounded-md shadow-sm"
                                    />
                                    <button type="button" onClick={handleSaveTemplate} className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Plantillas guardadas */}
                        {savedTemplates.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-gray-800">Plantillas guardadas</h3>
                                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                    {savedTemplates.map(t => (
                                        <div key={t.id} className="flex items-center justify-between text-sm">
                                            <button type="button" onClick={() => handleLoadTemplate(t.id)} className="text-primary-600 hover:text-primary-800">{t.name}</button>
                                            <button type="button" onClick={() => handleDeleteTemplate(t.id)} className="text-gray-400 hover:text-red-600">Eliminar</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Botón de generar */}
                        <div className="pt-4 border-t">
                            <button 
                                onClick={handleDownload} 
                                disabled={!canGenerate || validationErrors.length > 0} 
                                className="w-full px-4 py-2 bg-primary-600 text-white rounded-md shadow-sm disabled:bg-primary-300 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                <Download className="w-4 h-4 mr-2" /> Generar documento
                            </button>
                            {!canGenerate && (
                                <p className="text-xs text-gray-500 mt-2 text-center">
                                    Selecciona un candidato y carga una plantilla para continuar
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Panel derecho: Resumen de campos y datos */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-2">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumen de datos</h2>
                    
                    {!uploadedBuffer ? (
                        <div className="text-center py-12 text-gray-500">
                            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p>Sube una plantilla DOCX para ver los campos y datos que se usarán</p>
                        </div>
                    ) : !selectedCandidate ? (
                        <div className="text-center py-12 text-gray-500">
                            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p>Selecciona un candidato para autocompletar los datos</p>
                        </div>
                    ) : detectedKeys.length === 0 ? (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-yellow-800">
                                No se detectaron campos con formato {'{{campo}}'} en la plantilla. 
                                Verifica que tu plantilla use el formato correcto. Consulta la guía arriba para más información.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Información del candidato */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-gray-800 mb-2">Información del candidato</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div><span className="text-gray-600">Nombre:</span> <span className="font-medium">{selectedCandidate.name}</span></div>
                                    {selectedCandidate.email && <div><span className="text-gray-600">Email:</span> <span className="font-medium">{selectedCandidate.email}</span></div>}
                                    {selectedCandidate.phone && <div><span className="text-gray-600">Teléfono:</span> <span className="font-medium">{selectedCandidate.phone}</span></div>}
                                    {selectedCandidate.dni && <div><span className="text-gray-600">DNI:</span> <span className="font-medium">{selectedCandidate.dni}</span></div>}
                                    {selectedProcess && <div><span className="text-gray-600">Proceso:</span> <span className="font-medium">{selectedProcess.title}</span></div>}
                                </div>
                            </div>

                            {/* Referencia de campos disponibles */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 Campos disponibles para mapeo automático</h3>
                                <div className="grid grid-cols-2 gap-2 text-xs text-blue-800">
                                    <div><strong>Nombre:</strong> Nombre, nombre, candidateName, Candidato</div>
                                    <div><strong>Email:</strong> Email, email, candidateEmail, Correo</div>
                                    <div><strong>Teléfono:</strong> Telefono, telefono, candidatePhone, Phone</div>
                                    <div><strong>DNI:</strong> DNI, dni, candidateDni, Cedula</div>
                                    <div><strong>Dirección:</strong> Direccion, direccion, candidateAddress</div>
                                    <div><strong>LinkedIn:</strong> LinkedIn, linkedin, candidateLinkedIn</div>
                                    <div><strong>Puesto:</strong> Puesto, puesto, positionTitle, Posicion</div>
                                    <div><strong>Empresa:</strong> Empresa, empresa, companyName, Company</div>
                                    <div><strong>Fecha:</strong> Fecha, fecha, fechaActual, Today, Hoy</div>
                                    <div><strong>Contratación:</strong> FechaContratacion, hireDate</div>
                                </div>
                                <p className="text-xs text-blue-700 mt-2">
                                    El sistema mapea automáticamente estos campos. Si usas otro nombre, puedes editarlo manualmente abajo.
                                </p>
                            </div>

                            {/* Campos de la plantilla */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-800 mb-3">
                                    Campos de la plantilla ({detectedKeys.length})
                                </h3>
                                <div className="space-y-3">
                                    {detectedKeys.map(key => {
                                        const value = docxData[key] || '';
                                        const isEmpty = !value || value.trim() === '';
                                        const isEditing = editingField === key;
                                        
                                        return (
                                            <div 
                                                key={key} 
                                                className={`border rounded-lg p-3 ${isEmpty ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-white'}`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <label className="text-sm font-medium text-gray-700">
                                                                {key}
                                                            </label>
                                                            {isEmpty && <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded">Vacío</span>}
                                                            {!isEmpty && <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">Completo</span>}
                                                        </div>
                                                        {isEditing ? (
                                                            <div className="space-y-2">
                                                                <textarea
                                                                    value={value}
                                                                    onChange={e => setDocxData(prev => ({ ...prev, [key]: e.target.value }))}
                                                                    className="w-full border-gray-300 rounded-md shadow-sm text-sm"
                                                                    rows={3}
                                                                    autoFocus
                                                                />
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => setEditingField(null)}
                                                                        className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                                                                    >
                                                                        Guardar
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setDocxData(prev => ({ ...prev, [key]: '' }));
                                                                            setEditingField(null);
                                                                        }}
                                                                        className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                                                    >
                                                                        Limpiar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm text-gray-600">
                                                                {value || <span className="italic text-gray-400">Sin valor</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!isEditing && (
                                                        <button
                                                            onClick={() => setEditingField(key)}
                                                            className="ml-2 p-1 text-gray-400 hover:text-primary-600"
                                                            title="Editar"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
