import React, { useMemo, useState, useRef } from 'react';
import { useAppState } from '../App';
import { Candidate, Process } from '../types';
import { BarChart2, Download, Plus, Trash2, GripVertical, Settings, Image as ImageIcon, Table, TrendingUp, PieChart, LayoutGrid, FileText, X } from 'lucide-react';
import { 
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, 
    BarChart, XAxis, YAxis, CartesianGrid, Bar, Legend, ResponsiveContainer,
    LineChart, Line, PieChart as RechartsPieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

type WidgetType = 'bar' | 'line' | 'radar' | 'pie' | 'area' | 'table' | 'summary' | 'list';
type DataField = 
    | 'name' | 'email' | 'phone' | 'age' | 'dni' | 'address' | 'linkedinUrl'
    | 'salaryExpectation' | 'source' | 'stageProgress' | 'attachmentsCount'
    | 'processTitle' | 'stageName' | 'hireDate' | 'daysInProcess';

interface Widget {
    id: string;
    type: WidgetType;
    title: string;
    dataFields: DataField[];
    xAxisField?: DataField;
    yAxisField?: DataField;
    groupBy?: DataField;
    showPhotos?: boolean;
    layout?: 'full' | 'half' | 'third';
    // Configuración avanzada para radar (múltiples ejes)
    radarFields?: DataField[]; // Campos para los ejes del radar
    radarMaxValue?: number; // Valor máximo para el radar
    // Configuración para tablas/listas
    tableSortBy?: DataField; // Campo por el que ordenar
    tableSortOrder?: 'asc' | 'desc'; // Orden de clasificación
    listDisplayMode?: 'cards' | 'compact'; // Modo de visualización para listas
    // Datos manuales (fuera de la base de datos)
    manualData?: Array<Record<string, any>>; // Datos ingresados manualmente
    useManualData?: boolean; // Si usar datos manuales en lugar de datos de candidatos
}

const DATA_FIELD_LABELS: Record<DataField, string> = {
    name: 'Nombre',
    email: 'Email',
    phone: 'Teléfono',
    age: 'Edad',
    dni: 'DNI',
    address: 'Dirección',
    linkedinUrl: 'LinkedIn',
    salaryExpectation: 'Expectativa salarial',
    source: 'Fuente',
    stageProgress: 'Avance en proceso (%)',
    attachmentsCount: 'Cantidad de adjuntos',
    processTitle: 'Proceso',
    stageName: 'Etapa actual',
    hireDate: 'Fecha de contratación',
    daysInProcess: 'Días en proceso',
};

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#f59e0b', '#0ea5e9', '#ec4899', '#14b8a6'];

export const CandidateComparator: React.FC = () => {
    const { state, getLabel, actions } = useAppState();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [widgets, setWidgets] = useState<Widget[]>([]);
    const [editingWidget, setEditingWidget] = useState<string | null>(null);
    const [candidateQuery, setCandidateQuery] = useState<string>('');
    const [comments, setComments] = useState<string>('');
    const [savePdfToCandidates, setSavePdfToCandidates] = useState<boolean>(false);
    
    const widgetsContainerRef = useRef<HTMLDivElement>(null);
    const commentsRef = useRef<HTMLDivElement>(null);
    const widgetRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const candidates = state.candidates;
    const processes = state.processes;
    const selectedCandidates = useMemo(() => candidates.filter(c => selectedIds.includes(c.id)), [candidates, selectedIds]);
    
    const filteredCandidates = useMemo(() => {
        const q = candidateQuery.trim().toLowerCase();
        return state.candidates.filter(c =>
            !q ||
            c.name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q) ||
            (state.processes.find(p => p.id === c.processId)?.title || '').toLowerCase().includes(q)
        );
    }, [state.candidates, state.processes, candidateQuery]);

    // Función para obtener el valor de un campo de datos
    const getFieldValue = (candidate: Candidate, field: DataField): any => {
        const process = processes.find(p => p.id === candidate.processId);
        const stage = process?.stages.find(s => s.id === candidate.stageId);
        
        switch (field) {
            case 'name': return candidate.name;
            case 'email': return candidate.email;
            case 'phone': return candidate.phone || '';
            case 'age': return candidate.age || 0;
            case 'dni': return candidate.dni || '';
            case 'address': return candidate.address || '';
            case 'linkedinUrl': return candidate.linkedinUrl || '';
            case 'salaryExpectation': 
                const salary = candidate.salaryExpectation || '';
                const num = salary.replace(/[^0-9.,]/g, '').replace('.', '').replace(',', '.');
                return parseFloat(num) || 0;
            case 'source': return candidate.source || 'Sin fuente';
            case 'stageProgress':
                if (!process || process.stages.length === 0) return 0;
                const idx = process.stages.findIndex(s => s.id === candidate.stageId);
                return idx >= 0 ? Math.round(((idx + 1) / process.stages.length) * 100) : 0;
            case 'attachmentsCount': return candidate.attachments?.length || 0;
            case 'processTitle': return process?.title || '';
            case 'stageName': return stage?.name || '';
            case 'hireDate': return candidate.hireDate || '';
            case 'daysInProcess':
                if (!candidate.history || candidate.history.length === 0) return 0;
                const firstEntry = candidate.history[0];
                const days = Math.floor((new Date().getTime() - new Date(firstEntry.movedAt).getTime()) / (1000 * 60 * 60 * 24));
                return days;
            default: return '';
        }
    };

    // Preparar datos para widgets
    const prepareWidgetData = (widget: Widget) => {
        // Si el widget usa datos manuales, retornarlos directamente (ya están en el formato correcto)
        if (widget.useManualData && widget.manualData && widget.manualData.length > 0) {
            // Para gráficos pie, asegurar que tengan formato {name, value}
            if (widget.type === 'pie') {
                return widget.manualData.map((item: any) => ({
                    name: item.name || item.label || String(item[Object.keys(item)[0]] || ''),
                    value: item.value || item.count || Number(item[Object.keys(item)[1]] || 0)
                }));
            }
            // Para otros gráficos, retornar tal cual
            return widget.manualData;
        }
        
        if (selectedCandidates.length === 0) return [];

        if (widget.type === 'table' || widget.type === 'summary' || widget.type === 'list') {
            let data = selectedCandidates.map(c => {
                const row: Record<string, any> = { id: c.id, name: c.name };
                widget.dataFields.forEach(field => {
                    row[field] = getFieldValue(c, field);
                });
                return row;
            });
            
            // Ordenar si está configurado
            if (widget.tableSortBy && widget.tableSortOrder) {
                data = data.sort((a, b) => {
                    const aVal = a[widget.tableSortBy!] ?? '';
                    const bVal = b[widget.tableSortBy!] ?? '';
                    const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                    return widget.tableSortOrder === 'asc' ? comparison : -comparison;
                });
            }
            
            return data;
        }

        if (widget.type === 'pie') {
            const groupBy = widget.groupBy || 'source';
            const counts = new Map<string, number>();
            selectedCandidates.forEach(c => {
                const key = String(getFieldValue(c, groupBy)) || 'Sin valor';
                counts.set(key, (counts.get(key) || 0) + 1);
            });
            return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
        }

        // Para gráficos radar con múltiples campos
        if (widget.type === 'radar' && widget.radarFields && widget.radarFields.length > 0) {
            // Crear un array donde cada elemento tiene todos los campos de todos los candidatos
            // Esto permite que cada Radar component use un dataKey diferente (el nombre del candidato)
            const allFields = widget.radarFields.map(f => DATA_FIELD_LABELS[f]);
            const radarData: Record<string, any>[] = [];
            
            // Para cada campo, crear un objeto con los valores de todos los candidatos
            widget.radarFields.forEach(field => {
                const fieldLabel = DATA_FIELD_LABELS[field];
                const entry: Record<string, any> = { name: fieldLabel };
                selectedCandidates.forEach(c => {
                    const value = getFieldValue(c, field);
                    const numValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
                    entry[c.name] = numValue;
                });
                radarData.push(entry);
            });
            
            return radarData;
        }

        // Para gráficos de barras, líneas, área, radar simple
        const dataField = widget.dataFields[0] || 'age';
        return selectedCandidates.map(c => ({
            name: c.name,
            value: getFieldValue(c, dataField),
            candidate: c,
        }));
    };

    const addWidget = () => {
        const newWidget: Widget = {
            id: `widget-${Date.now()}`,
            type: 'bar',
            title: 'Nuevo gráfico',
            dataFields: ['age'],
            layout: 'half',
        };
        setWidgets([...widgets, newWidget]);
        setEditingWidget(newWidget.id);
    };

    const removeWidget = (id: string) => {
        setWidgets(widgets.filter(w => w.id !== id));
    };

    const updateWidget = (id: string, updates: Partial<Widget>) => {
        setWidgets(widgets.map(w => w.id === id ? { ...w, ...updates } : w));
    };

    const renderWidget = (widget: Widget) => {
        const data = prepareWidgetData(widget);
        const isEditing = editingWidget === widget.id;
        const layoutClass = widget.layout === 'full' ? 'col-span-full' : widget.layout === 'third' ? 'col-span-1' : 'col-span-1 lg:col-span-2';

        return (
            <div 
                key={widget.id} 
                ref={el => { widgetRefs.current[widget.id] = el; }}
                data-widget-id={widget.id}
                className={`bg-white p-4 rounded-xl border border-gray-200 shadow-sm ${layoutClass}`}
            >
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">{widget.title}</h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setEditingWidget(isEditing ? null : widget.id)}
                            className="p-1 rounded-md hover:bg-gray-100"
                            title="Configurar"
                        >
                            <Settings className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                            onClick={() => removeWidget(widget.id)}
                            className="p-1 rounded-md hover:bg-red-100"
                            title="Eliminar"
                        >
                            <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                    </div>
                </div>

                {isEditing && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                            <input
                                type="text"
                                value={widget.title}
                                onChange={e => updateWidget(widget.id, { title: e.target.value })}
                                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de widget</label>
                            <select
                                value={widget.type}
                                onChange={e => updateWidget(widget.id, { type: e.target.value as WidgetType })}
                                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2"
                            >
                                <option value="bar">Gráfico de barras</option>
                                <option value="line">Gráfico de líneas</option>
                                <option value="area">Gráfico de área</option>
                                <option value="radar">Gráfico radar</option>
                                <option value="pie">Gráfico circular</option>
                                <option value="table">Tabla</option>
                                <option value="list">Lista de datos</option>
                                <option value="summary">Resumen con fotos</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {widget.type === 'pie' ? 'Agrupar por' : 'Campo de datos'}
                            </label>
                            {widget.type === 'pie' ? (
                                <select
                                    value={widget.groupBy || 'source'}
                                    onChange={e => updateWidget(widget.id, { groupBy: e.target.value as DataField })}
                                    className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2"
                                >
                                    {Object.entries(DATA_FIELD_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            ) : widget.type === 'radar' ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">Seleccionar campos para los ejes del radar (mínimo 3)</label>
                                        <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
                                            {Object.entries(DATA_FIELD_LABELS).filter(([value]) => {
                                                // Solo mostrar campos numéricos para radar
                                                const numericFields: DataField[] = ['age', 'salaryExpectation', 'stageProgress', 'attachmentsCount', 'daysInProcess'];
                                                return numericFields.includes(value as DataField);
                                            }).map(([value, label]) => (
                                                <label key={value} className="flex items-center gap-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={(widget.radarFields || []).includes(value as DataField)}
                                                        onChange={e => {
                                                            const fields = widget.radarFields || [];
                                                            if (e.target.checked) {
                                                                updateWidget(widget.id, { radarFields: [...fields, value as DataField] });
                                                            } else {
                                                                updateWidget(widget.id, { radarFields: fields.filter(f => f !== value) });
                                                            }
                                                        }}
                                                    />
                                                    {label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    {(widget.radarFields && widget.radarFields.length > 0) && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Valor máximo (opcional, 0 = automático)</label>
                                            <input
                                                type="number"
                                                value={widget.radarMaxValue || ''}
                                                onChange={e => updateWidget(widget.id, { radarMaxValue: e.target.value ? parseFloat(e.target.value) : undefined })}
                                                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2"
                                                placeholder="Auto"
                                                min="0"
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : widget.type === 'table' || widget.type === 'summary' || widget.type === 'list' ? (
                                <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
                                    {Object.entries(DATA_FIELD_LABELS).map(([value, label]) => (
                                        <label key={value} className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={widget.dataFields.includes(value as DataField)}
                                                onChange={e => {
                                                    const fields = widget.dataFields || [];
                                                    if (e.target.checked) {
                                                        updateWidget(widget.id, { dataFields: [...fields, value as DataField] });
                                                    } else {
                                                        updateWidget(widget.id, { dataFields: fields.filter(f => f !== value) });
                                                    }
                                                }}
                                            />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <select
                                    value={widget.dataFields[0] || 'age'}
                                    onChange={e => updateWidget(widget.id, { dataFields: [e.target.value as DataField] })}
                                    className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2"
                                >
                                    {Object.entries(DATA_FIELD_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tamaño</label>
                            <select
                                value={widget.layout || 'half'}
                                onChange={e => updateWidget(widget.id, { layout: e.target.value as 'full' | 'half' | 'third' })}
                                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2"
                            >
                                <option value="third">1/3 de ancho</option>
                                <option value="half">1/2 de ancho</option>
                                <option value="full">Ancho completo</option>
                            </select>
                        </div>
                        {widget.type === 'summary' && (
                            <div>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={widget.showPhotos || false}
                                        onChange={e => updateWidget(widget.id, { showPhotos: e.target.checked })}
                                    />
                                    Mostrar fotos de candidatos
                                </label>
                            </div>
                        )}
                        {(widget.type === 'table' || widget.type === 'list') && (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ordenar por</label>
                                    <select
                                        value={widget.tableSortBy || ''}
                                        onChange={e => updateWidget(widget.id, { tableSortBy: e.target.value as DataField || undefined })}
                                        className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2"
                                    >
                                        <option value="">Sin ordenar</option>
                                        {widget.dataFields.map(field => (
                                            <option key={field} value={field}>{DATA_FIELD_LABELS[field]}</option>
                                        ))}
                                    </select>
                                </div>
                                {widget.tableSortBy && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                                        <select
                                            value={widget.tableSortOrder || 'asc'}
                                            onChange={e => updateWidget(widget.id, { tableSortOrder: e.target.value as 'asc' | 'desc' })}
                                            className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2"
                                        >
                                            <option value="asc">Ascendente</option>
                                            <option value="desc">Descendente</option>
                                        </select>
                                    </div>
                                )}
                                {widget.type === 'list' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Modo de visualización</label>
                                        <select
                                            value={widget.listDisplayMode || 'cards'}
                                            onChange={e => updateWidget(widget.id, { listDisplayMode: e.target.value as 'cards' | 'compact' })}
                                            className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2"
                                        >
                                            <option value="cards">Tarjetas</option>
                                            <option value="compact">Compacto</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Opción para usar datos manuales */}
                        {(widget.type === 'bar' || widget.type === 'line' || widget.type === 'area' || widget.type === 'pie' || widget.type === 'table' || widget.type === 'list') && (
                            <div className="space-y-3 border-t pt-3">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={widget.useManualData || false}
                                        onChange={e => {
                                            const useManual = e.target.checked;
                                            if (useManual && !widget.manualData) {
                                                // Inicializar con datos por defecto según el tipo
                                                if (widget.type === 'pie' || widget.type === 'bar' || widget.type === 'line' || widget.type === 'area') {
                                                    updateWidget(widget.id, { 
                                                        useManualData: true,
                                                        manualData: [{ name: 'Ejemplo 1', value: 10 }, { name: 'Ejemplo 2', value: 20 }]
                                                    });
                                                } else {
                                                    updateWidget(widget.id, { 
                                                        useManualData: true,
                                                        manualData: [{ campo1: 'Valor 1', campo2: 'Valor 2' }]
                                                    });
                                                }
                                            } else {
                                                updateWidget(widget.id, { useManualData: useManual });
                                            }
                                        }}
                                    />
                                    Usar datos manuales (fuera de la base de datos)
                                </label>
                                {widget.useManualData && (
                                    <div className="border rounded-lg p-3 bg-gray-50">
                                        {(widget.type === 'bar' || widget.type === 'line' || widget.type === 'area' || widget.type === 'pie') ? (
                                            // Tabla para gráficos: name y value
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="text-xs font-medium text-gray-700">Datos del gráfico</label>
                                                    <button
                                                        onClick={() => {
                                                            const current = widget.manualData || [];
                                                            updateWidget(widget.id, { 
                                                                manualData: [...current, { name: '', value: 0 }]
                                                            });
                                                        }}
                                                        className="text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center gap-1"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        Agregar fila
                                                    </button>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="border-b">
                                                                <th className="text-left p-2">Nombre</th>
                                                                <th className="text-left p-2">Valor</th>
                                                                <th className="w-8"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(widget.manualData || []).map((row: any, idx: number) => (
                                                                <tr key={idx} className="border-b">
                                                                    <td className="p-1">
                                                                        <input
                                                                            type="text"
                                                                            value={row.name || ''}
                                                                            onChange={e => {
                                                                                const updated = [...(widget.manualData || [])];
                                                                                updated[idx] = { ...updated[idx], name: e.target.value };
                                                                                updateWidget(widget.id, { manualData: updated });
                                                                            }}
                                                                            className="w-full border rounded px-2 py-1 text-xs"
                                                                            placeholder="Nombre"
                                                                        />
                                                                    </td>
                                                                    <td className="p-1">
                                                                        <input
                                                                            type="number"
                                                                            value={row.value ?? ''}
                                                                            onChange={e => {
                                                                                const updated = [...(widget.manualData || [])];
                                                                                updated[idx] = { ...updated[idx], value: parseFloat(e.target.value) || 0 };
                                                                                updateWidget(widget.id, { manualData: updated });
                                                                            }}
                                                                            className="w-full border rounded px-2 py-1 text-xs"
                                                                            placeholder="0"
                                                                        />
                                                                    </td>
                                                                    <td className="p-1">
                                                                        <button
                                                                            onClick={() => {
                                                                                const updated = (widget.manualData || []).filter((_: any, i: number) => i !== idx);
                                                                                updateWidget(widget.id, { manualData: updated });
                                                                            }}
                                                                            className="text-red-600 hover:text-red-800"
                                                                        >
                                                                            <X className="w-4 h-4" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ) : (
                                            // Tabla dinámica para tablas/listas
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="text-xs font-medium text-gray-700">Datos de la tabla/lista</label>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                const current = widget.manualData || [];
                                                                const columns = current.length > 0 ? Object.keys(current[0]) : ['Campo 1', 'Campo 2'];
                                                                const newRow: Record<string, any> = {};
                                                                columns.forEach(col => { newRow[col] = ''; });
                                                                updateWidget(widget.id, { 
                                                                    manualData: [...current, newRow]
                                                                });
                                                            }}
                                                            className="text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center gap-1"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                            Agregar fila
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const current = widget.manualData || [];
                                                                const columns = current.length > 0 ? Object.keys(current[0]) : [];
                                                                const newCol = `Campo ${columns.length + 1}`;
                                                                const updated = current.map((row: any) => ({ ...row, [newCol]: '' }));
                                                                if (updated.length === 0) updated.push({ [newCol]: '' });
                                                                updateWidget(widget.id, { manualData: updated });
                                                            }}
                                                            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                            Agregar columna
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="sticky top-0 bg-gray-100">
                                                            <tr className="border-b">
                                                                {(widget.manualData && widget.manualData.length > 0) ? Object.keys(widget.manualData[0]).map((col, colIdx) => (
                                                                    <th key={colIdx} className="text-left p-2 border-r">
                                                                        <input
                                                                            type="text"
                                                                            value={col}
                                                                            onChange={e => {
                                                                                const oldCol = col;
                                                                                const updated = (widget.manualData || []).map((row: any) => {
                                                                                    const newRow = { ...row };
                                                                                    newRow[e.target.value] = row[oldCol];
                                                                                    delete newRow[oldCol];
                                                                                    return newRow;
                                                                                });
                                                                                updateWidget(widget.id, { manualData: updated });
                                                                            }}
                                                                            className="w-full border rounded px-2 py-1 text-xs font-medium"
                                                                        />
                                                                    </th>
                                                                )) : (
                                                                    <th className="text-left p-2">Sin columnas</th>
                                                                )}
                                                                <th className="w-8"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(widget.manualData || []).map((row: any, rowIdx: number) => (
                                                                <tr key={rowIdx} className="border-b">
                                                                    {Object.keys(row).map((col, colIdx) => (
                                                                        <td key={colIdx} className="p-1 border-r">
                                                                            <input
                                                                                type="text"
                                                                                value={row[col] || ''}
                                                                                onChange={e => {
                                                                                    const updated = [...(widget.manualData || [])];
                                                                                    updated[rowIdx] = { ...updated[rowIdx], [col]: e.target.value };
                                                                                    updateWidget(widget.id, { manualData: updated });
                                                                                }}
                                                                                className="w-full border rounded px-2 py-1 text-xs"
                                                                                placeholder="Valor"
                                                                            />
                                                                        </td>
                                                                    ))}
                                                                    <td className="p-1">
                                                                        <button
                                                                            onClick={() => {
                                                                                const updated = (widget.manualData || []).filter((_: any, i: number) => i !== rowIdx);
                                                                                updateWidget(widget.id, { manualData: updated });
                                                                            }}
                                                                            className="text-red-600 hover:text-red-800"
                                                                        >
                                                                            <X className="w-4 h-4" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {(!widget.manualData || widget.manualData.length === 0) && (
                                                                <tr>
                                                                    <td colSpan={100} className="text-center p-4 text-gray-500 text-xs">
                                                                        No hay datos. Haz clic en "Agregar fila" para comenzar.
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {widget.manualData && widget.manualData.length > 0 && (
                                                    <div className="mt-2 flex gap-2">
                                                        {Object.keys(widget.manualData[0]).map((col, colIdx) => (
                                                            <button
                                                                key={colIdx}
                                                                onClick={() => {
                                                                    const updated = (widget.manualData || []).map((row: any) => {
                                                                        const newRow = { ...row };
                                                                        delete newRow[col];
                                                                        return newRow;
                                                                    });
                                                                    updateWidget(widget.id, { manualData: updated });
                                                                }}
                                                                className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center gap-1"
                                                            >
                                                                <X className="w-3 h-3" />
                                                                {col}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="h-64">
                    {widget.type === 'bar' && (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="value" fill={COLORS[0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                    {widget.type === 'line' && (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                    {widget.type === 'area' && (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Area type="monotone" dataKey="value" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.6} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                    {widget.type === 'radar' && (() => {
                        // Radar con múltiples campos (ejes)
                        if (widget.radarFields && widget.radarFields.length > 0) {
                            // data ya está preparado con la estructura correcta: cada elemento tiene 'name' (el campo) y valores por candidato
                            const maxValue = widget.radarMaxValue || Math.max(
                                ...data.flatMap((d: any) => 
                                    selectedCandidates.map(c => {
                                        const val = d[c.name];
                                        return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
                                    })
                                )
                            ) * 1.2 || 100;
                            
                            return (
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart data={data}>
                                        <PolarGrid />
                                        <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <PolarRadiusAxis angle={90} domain={[0, maxValue]} />
                                        {selectedCandidates.map((c, idx) => (
                                            <Radar
                                                key={c.id}
                                                name={c.name}
                                                dataKey={c.name}
                                                stroke={COLORS[idx % COLORS.length]}
                                                fill={COLORS[idx % COLORS.length]}
                                                fillOpacity={0.6}
                                            />
                                        ))}
                                        <Tooltip />
                                        <Legend />
                                    </RadarChart>
                                </ResponsiveContainer>
                            );
                        }
                        
                        // Radar simple (un solo campo)
                        return (
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={data}>
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="name" />
                                    <PolarRadiusAxis />
                                    <Radar name="Valor" dataKey="value" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.6} />
                                    <Tooltip />
                                </RadarChart>
                            </ResponsiveContainer>
                        );
                    })()}
                    {widget.type === 'pie' && (
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsPieChart>
                                <Tooltip />
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                            </RechartsPieChart>
                        </ResponsiveContainer>
                    )}
                    {widget.type === 'table' && (
                        <div className="overflow-x-auto h-full">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                                    <tr>
                                        {widget.dataFields.map(field => (
                                            <th key={field} className="px-4 py-2 border-b border-gray-200">
                                                {DATA_FIELD_LABELS[field]}
                                                {widget.tableSortBy === field && (
                                                    <span className="ml-1 text-primary-600">
                                                        {widget.tableSortOrder === 'asc' ? '↑' : '↓'}
                                                    </span>
                                                )}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((row: any) => (
                                        <tr key={row.id} className="border-b hover:bg-gray-50">
                                            {widget.dataFields.map(field => (
                                                <td key={field} className="px-4 py-2">
                                                    {typeof row[field] === 'number' 
                                                        ? row[field].toLocaleString('es-ES')
                                                        : row[field] ?? '-'
                                                    }
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {widget.type === 'list' && (
                        <div className="overflow-y-auto h-full space-y-2">
                            {widget.listDisplayMode === 'cards' ? (
                                // Modo tarjetas
                                data.map((row: any) => (
                                    <div key={row.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {widget.dataFields.map(field => (
                                                <div key={field} className="flex flex-col">
                                                    <span className="text-xs text-gray-500 font-medium mb-1">
                                                        {DATA_FIELD_LABELS[field]}
                                                    </span>
                                                    <span className="text-sm text-gray-800">
                                                        {typeof row[field] === 'number' 
                                                            ? row[field].toLocaleString('es-ES')
                                                            : row[field] ?? '-'
                                                        }
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                // Modo compacto
                                <div className="space-y-1">
                                    {data.map((row: any) => (
                                        <div key={row.id} className="flex items-center gap-4 p-2 hover:bg-gray-50 rounded border-b border-gray-100">
                                            {widget.dataFields.map((field, idx) => (
                                                <div key={field} className={`flex-1 ${idx === 0 ? 'font-medium' : ''}`}>
                                                    <span className="text-xs text-gray-500 md:hidden">{DATA_FIELD_LABELS[field]}: </span>
                                                    <span className="text-sm text-gray-800">
                                                        {typeof row[field] === 'number' 
                                                            ? row[field].toLocaleString('es-ES')
                                                            : row[field] ?? '-'
                                                        }
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {widget.type === 'summary' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto h-full">
                            {data.map((row: any) => {
                                const candidate = selectedCandidates.find(c => c.id === row.id);
                                return (
                                    <div key={row.id} className="border rounded-lg p-3 bg-gray-50">
                                        {widget.showPhotos && candidate?.avatarUrl && (
                                            <img 
                                                src={candidate.avatarUrl} 
                                                alt={candidate.name}
                                                className="w-16 h-16 rounded-full object-cover mx-auto mb-2"
                                            />
                                        )}
                                        <h4 className="font-semibold text-center mb-2">{row.name}</h4>
                                        <div className="space-y-1 text-xs">
                                            {widget.dataFields.map(field => (
                                                <div key={field} className="flex justify-between">
                                                    <span className="text-gray-600">{DATA_FIELD_LABELS[field]}:</span>
                                                    <span className="font-medium">{row[field] ?? '-'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const fetchImageAsDataUrl = async (url?: string): Promise<string | null> => {
        if (!url) return null;
        try {
            if (url.startsWith('data:')) return url;
            const res = await fetch(url, { mode: 'cors' });
            const blob = await res.blob();
            return await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch {
            return null;
        }
    };

    const exportWord = async () => {
        try {
            // Crear documento Word con estructura completa
            const zip = new PizZip();
            
            // Content Types
            zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Default Extension="png" ContentType="image/png"/>
    <Default Extension="jpeg" ContentType="image/jpeg"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
            
            zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
            
            // Construir contenido
            let documentBody = '';
            let imageCounter = 0;
            const imageMap: Array<{ id: string; data: string }> = [];
            
            // Título
            documentBody += `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>${(state.settings?.reportTheme?.coverTitle || 'Informe comparativo de candidatos').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t></w:r></w:p>`;
            documentBody += `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>Generado el: ${new Date().toLocaleString('es-ES')}</w:t></w:r></w:p><w:p/>`;
            
            // Fotos de candidatos en tabla
            if (selectedCandidates.length > 0) {
                documentBody += `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Fotos de candidatos</w:t></w:r></w:p>`;
                documentBody += `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="1500"/><w:gridCol w:w="1500"/><w:gridCol w:w="1500"/><w:gridCol w:w="1500"/></w:tblGrid>`;
                
                for (let i = 0; i < selectedCandidates.length; i += 4) {
                    documentBody += `<w:tr>`;
                    for (let j = 0; j < 4 && i + j < selectedCandidates.length; j++) {
                        const c = selectedCandidates[i + j];
                        const avatarData = await fetchImageAsDataUrl(c.avatarUrl);
                        if (avatarData) {
                            imageCounter++;
                            const imgId = `img${imageCounter}`;
                            imageMap.push({ id: imgId, data: avatarData });
                            documentBody += `<w:tc><w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="1200000" cy="1200000"/><wp:docPr id="${imageCounter}" name="${c.name}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${imageCounter}" name="${c.name}"/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId${imageCounter + 1}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1200000" cy="1200000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r><w:r><w:t>${c.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t></w:r></w:p></w:tc>`;
                        } else {
                            documentBody += `<w:tc><w:p><w:r><w:t>${c.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t></w:r></w:p></w:tc>`;
                        }
                    }
                    documentBody += `</w:tr>`;
                }
                documentBody += `</w:tbl><w:p/>`;
            }
            
            // Widgets
            for (const widget of widgets) {
                const widgetElement = widgetRefs.current[widget.id];
                if (!widgetElement) continue;
                
                try {
                    await new Promise(resolve => setTimeout(resolve, 300));
                    const canvas = await html2canvas(widgetElement, {
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        scale: 2,
                        logging: false,
                    });
                    
                    const imgData = canvas.toDataURL('image/png');
                    imageCounter++;
                    const imgId = `img${imageCounter}`;
                    imageMap.push({ id: imgId, data: imgData });
                    
                    documentBody += `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${widget.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t></w:r></w:p>`;
                    documentBody += `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${Math.min(6000000, canvas.width * 9525)}" cy="${Math.min(4000000, canvas.height * 9525)}"/><wp:docPr id="${imageCounter}" name="${widget.title}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${imageCounter}" name="${widget.title}"/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId${imageCounter + 1}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.min(6000000, canvas.width * 9525)}" cy="${Math.min(4000000, canvas.height * 9525)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:p/>`;
                } catch (e) {
                    console.error('Error capturando widget:', widget.id, e);
                }
            }
            
            // Comentarios
            if (comments.trim()) {
                documentBody += `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Comentarios</w:t></w:r></w:p>`;
                const commentLines = comments.split('\n');
                commentLines.forEach(line => {
                    documentBody += `<w:p><w:r><w:t>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t></w:r></w:p>`;
                });
            }
            
            const wordDocument = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
    <w:body>
        ${documentBody}
    </w:body>
</w:document>`;
            
            zip.file('word/document.xml', wordDocument);
            
            // Agregar imágenes
            const relationships: string[] = [];
            imageMap.forEach((img, idx) => {
                const base64Data = img.data.split(',')[1];
                const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                const ext = img.data.startsWith('data:image/png') ? 'png' : 'jpeg';
                zip.file(`word/media/image${idx + 1}.${ext}`, imageBuffer);
                relationships.push(`<Relationship Id="rId${idx + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${idx + 1}.${ext}"/>`);
            });
            
            zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relationships.join('\n')}
</Relationships>`);
            
            // Agregar archivos necesarios para que Word pueda abrir el documento correctamente
            zip.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:zoom w:percent="100"/>
</w:settings>`);
            
            zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:style w:type="paragraph" w:styleId="Normal">
        <w:name w:val="Normal"/>
    </w:style>
</w:styles>`);
            
            zip.file('word/webSettings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:webSettings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`);
            
            zip.file('word/fontTable.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:font w:name="Calibri">
        <w:panose1 w:val="020F0502020204030204"/>
    </w:font>
</w:fonts>`);
            
            zip.file('word/numbering.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`);
            
            // Actualizar Content Types con todos los archivos
            zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Default Extension="png" ContentType="image/png"/>
    <Default Extension="jpeg" ContentType="image/jpeg"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
    <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
    <Override PartName="/word/webSettings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.webSettings+xml"/>
    <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
    <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`);
            
            const blob = zip.generate({ 
                type: 'blob', 
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });
            const fileName = `informe_comparador_${Date.now()}.docx`;
            saveAs(blob, fileName);
            
            // Guardar en Google Drive si está configurado
            let attachmentUrl: string | undefined;
            let attachmentId: string = `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            
            const googleDriveConfig = state.settings?.googleDrive;
            const isGoogleDriveConnected = googleDriveConfig?.connected && googleDriveConfig?.accessToken;
            
            if (isGoogleDriveConnected && googleDriveConfig && googleDriveConfig.rootFolderId) {
                try {
                    const { googleDriveService } = await import('../lib/googleDrive');
                    googleDriveService.initialize(googleDriveConfig);
                    
                    // Obtener o crear carpeta "Reportes" dentro de la carpeta raíz
                    const reportesFolder = await googleDriveService.getOrCreateSectionFolder('Reportes', googleDriveConfig.rootFolderId);
                    
                    // Convertir blob a File para subir
                    const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                    
                    // Subir a Google Drive
                    const uploadedFile = await googleDriveService.uploadFile(file, reportesFolder.id, fileName);
                    attachmentUrl = googleDriveService.getFileViewUrl(uploadedFile.id);
                    attachmentId = uploadedFile.id;
                    console.log(`✅ Informe Word guardado en Google Drive: Reportes/${fileName}`);
                } catch (driveError: any) {
                    console.error('Error subiendo a Google Drive, usando almacenamiento local:', driveError);
                    // Fallback a Base64
                    attachmentUrl = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                }
            } else {
                // Usar Base64 si Google Drive no está configurado
                attachmentUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            }
            
            if (savePdfToCandidates && selectedCandidates.length > 0 && attachmentUrl) {
                for (const c of selectedCandidates) {
                    const updated = {
                        ...c,
                        attachments: [
                            ...c.attachments,
                            { 
                                id: attachmentId, 
                                name: fileName, 
                                url: attachmentUrl, 
                                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
                                size: blob.size 
                            },
                        ],
                    };
                    await actions.updateCandidate(updated, state.currentUser?.name);
                }
            }
            
            alert('Documento Word generado exitosamente.');
        } catch (err) {
            console.error('Error al exportar Word:', err);
            alert('No se pudo generar el documento Word. Revisa la consola para más detalles.');
        }
    };

    const exportPDF = async () => {
        try {
            const doc = new jsPDF('p', 'pt', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 40;
            const contentWidth = pageWidth - (margin * 2);
            let y = margin;

            // Header
            if (state.settings?.logoUrl) {
                try {
                    const logoData = await fetchImageAsDataUrl(state.settings.logoUrl);
                    if (logoData) {
                        doc.addImage(logoData, 'PNG', margin, y, 80, 24, undefined, 'FAST');
                    }
                } catch {}
            }
            const titleText = state.settings?.reportTheme?.coverTitle || 'Informe comparativo de candidatos';
            const primary = state.settings?.reportTheme?.primaryColor || '#2563eb';
            
            doc.setTextColor(primary);
            doc.setFontSize(18);
            doc.text(titleText, pageWidth / 2, y + 20, { align: 'center' });
            doc.setFontSize(10);
            doc.setTextColor('#000000');
            doc.text(new Date().toLocaleString('es-ES'), pageWidth / 2, y + 35, { align: 'center' });
            y += 50;

            // Fotos de candidatos (grid compacto)
            if (selectedCandidates.length > 0) {
                const photosPerRow = 4;
                const photoSize = (contentWidth - (photosPerRow - 1) * 10) / photosPerRow;
                const photoHeight = 60;
                let col = 0;
                
                for (const c of selectedCandidates) {
                    const photoX = margin + col * (photoSize + 10);
                    const photoY = y;
                    
                    const avatarData = await fetchImageAsDataUrl(c.avatarUrl);
                    if (avatarData) {
                        try {
                            doc.addImage(avatarData, 'JPEG', photoX, photoY, photoSize * 0.7, photoSize * 0.7, undefined, 'FAST');
                        } catch {}
                    }
                    
                    doc.setFontSize(8);
                    doc.text(c.name, photoX, photoY + photoSize * 0.75, { maxWidth: photoSize });
                    
                    col++;
                    if (col === photosPerRow) {
                        col = 0;
                        y += photoHeight + 15;
                        if (y > pageHeight - 100) {
                            doc.addPage();
                            y = margin;
                        }
                    }
                }
                if (col !== 0) {
                    y += photoHeight + 15;
                }
            }

            // Widgets - optimizado para usar menos páginas
            const widgetsToRender = [...widgets];
            let currentRow: { widget: Widget; width: number; height: number; imgData: string }[] = [];
            let currentRowWidth = 0;
            const maxRowWidth = contentWidth;

            for (const widget of widgetsToRender) {
                const widgetElement = widgetRefs.current[widget.id];
                if (!widgetElement) continue;

                try {
                    // Esperar un momento para que el elemento se renderice completamente
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    // Obtener dimensiones reales del elemento
                    const rect = widgetElement.getBoundingClientRect();
                    const scrollHeight = Math.max(widgetElement.scrollHeight, rect.height, widgetElement.offsetHeight);
                    const scrollWidth = Math.max(widgetElement.scrollWidth, rect.width, widgetElement.offsetWidth);
                    
                    const canvas = await html2canvas(widgetElement, { 
                        useCORS: true, 
                        backgroundColor: '#ffffff', 
                        scale: 2,
                        logging: false,
                        width: scrollWidth,
                        height: scrollHeight,
                        windowWidth: scrollWidth,
                        windowHeight: scrollHeight,
                        allowTaint: true,
                        removeContainer: false,
                        scrollX: 0,
                        scrollY: 0,
                        x: 0,
                        y: 0
                    });
                    const imgData = canvas.toDataURL('image/png', 1.0);
                    
                    // Determinar tamaño según layout - usar dimensiones reales del canvas
                    let widgetWidth: number;
                    let widgetHeight: number;
                    
                    // Calcular ratio basado en dimensiones reales del canvas
                    const canvasRatio = canvas.height / canvas.width;
                    // Convertir píxeles del canvas a puntos PDF (1px ≈ 0.75pt a escala 2)
                    const scaleFactor = 0.75; // Ajuste para convertir px a pt
                    const canvasWidthPt = canvas.width * scaleFactor;
                    const canvasHeightPt = canvas.height * scaleFactor;
                    
                    if (widget.layout === 'full') {
                        widgetWidth = Math.min(contentWidth, canvasWidthPt);
                        widgetHeight = widgetWidth * canvasRatio;
                    } else if (widget.layout === 'third') {
                        widgetWidth = Math.min(contentWidth / 3 - 10, canvasWidthPt);
                        widgetHeight = widgetWidth * canvasRatio;
                    } else {
                        widgetWidth = Math.min(contentWidth / 2 - 10, canvasWidthPt);
                        widgetHeight = widgetWidth * canvasRatio;
                    }

                    // Si el widget es muy alto, ajustar manteniendo proporción
                    const maxHeight = pageHeight - y - 100;
                    if (widgetHeight > maxHeight) {
                        widgetHeight = maxHeight;
                        widgetWidth = widgetHeight / canvasRatio;
                    }
                    
                    // Asegurar que no exceda el ancho disponible
                    if (widgetWidth > contentWidth) {
                        widgetWidth = contentWidth;
                        widgetHeight = widgetWidth * canvasRatio;
                    }

                    // Verificar si cabe en la fila actual
                    if (currentRowWidth + widgetWidth + 10 > maxRowWidth && currentRow.length > 0) {
                        // Renderizar fila actual
                        const rowHeight = Math.max(...currentRow.map(w => w.height));
                        if (y + rowHeight + 40 > pageHeight - 40) {
                            doc.addPage();
                            y = margin;
                        }

                        let x = margin;
                        for (const item of currentRow) {
                            doc.setFontSize(10);
                            doc.setTextColor(primary);
                            doc.text(item.widget.title, x, y, { maxWidth: item.width });
                            // Convertir PNG a dimensiones correctas para PDF
                            const pdfWidth = item.width;
                            const pdfHeight = item.height;
                            doc.addImage(item.imgData, 'PNG', x, y + 12, pdfWidth, pdfHeight, undefined, 'FAST');
                            x += item.width + 10;
                        }
                        y += rowHeight + 30;
                        currentRow = [];
                        currentRowWidth = 0;
                    }

                    // Agregar a fila actual
                    currentRow.push({ widget, width: widgetWidth, height: widgetHeight, imgData });
                    currentRowWidth += widgetWidth + 10;
                } catch (e) {
                    console.error('Error capturando widget:', widget.id, e);
                }
            }

            // Renderizar última fila
            if (currentRow.length > 0) {
                const rowHeight = Math.max(...currentRow.map(w => w.height));
                if (y + rowHeight + 40 > pageHeight - 40) {
                    doc.addPage();
                    y = margin;
                }

                let x = margin;
                for (const item of currentRow) {
                    doc.setFontSize(10);
                    doc.setTextColor(primary);
                    doc.text(item.widget.title, x, y, { maxWidth: item.width });
                    doc.addImage(item.imgData, 'PNG', x, y + 12, item.width, item.height, undefined, 'FAST');
                    x += item.width + 10;
                }
                y += rowHeight + 30;
            }

            // Comentarios
            if (comments.trim()) {
                if (y + 100 > pageHeight - 40) {
                    doc.addPage();
                    y = margin;
                }
                doc.setFontSize(12);
                doc.setTextColor(primary);
                doc.text('Comentarios', margin, y);
                y += 20;
                doc.setFontSize(10);
                doc.setTextColor('#000000');
                const lines = doc.splitTextToSize(comments, contentWidth);
                doc.text(lines, margin, y);
            }

            // Footer
            const footerText = state.settings?.reportTheme?.footerText;
            if (footerText) {
                const pageCount = (doc as any).internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(8);
                    doc.setTextColor('#666666');
                    doc.text(footerText, pageWidth / 2, pageHeight - 20, { align: 'center' });
                }
            }

            const fileName = `informe_comparador_${Date.now()}.pdf`;
            const pdfBlob = doc.output('blob');
            saveAs(pdfBlob, fileName);
            
            // Guardar en Google Drive si está configurado
            let attachmentUrl: string | undefined;
            let attachmentId: string = `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            
            const googleDriveConfig = state.settings?.googleDrive;
            const isGoogleDriveConnected = googleDriveConfig?.connected && googleDriveConfig?.accessToken;
            
            if (isGoogleDriveConnected && googleDriveConfig && googleDriveConfig.rootFolderId) {
                try {
                    const { googleDriveService } = await import('../lib/googleDrive');
                    googleDriveService.initialize(googleDriveConfig);
                    
                    // Obtener o crear carpeta "Reportes" dentro de la carpeta raíz
                    const reportesFolder = await googleDriveService.getOrCreateSectionFolder('Reportes', googleDriveConfig.rootFolderId);
                    
                    // Convertir blob a File para subir
                    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                    
                    // Subir a Google Drive
                    const uploadedFile = await googleDriveService.uploadFile(file, reportesFolder.id, fileName);
                    attachmentUrl = googleDriveService.getFileViewUrl(uploadedFile.id);
                    attachmentId = uploadedFile.id;
                    console.log(`✅ Informe PDF guardado en Google Drive: Reportes/${fileName}`);
                } catch (driveError: any) {
                    console.error('Error subiendo a Google Drive, usando almacenamiento local:', driveError);
                    // Fallback a Base64
                    attachmentUrl = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(pdfBlob);
                    });
                }
            } else {
                // Usar Base64 si Google Drive no está configurado
                attachmentUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(pdfBlob);
                });
            }
            
            if (savePdfToCandidates && selectedCandidates.length > 0 && attachmentUrl) {
                for (const c of selectedCandidates) {
                    const updated = {
                        ...c,
                        attachments: [
                            ...c.attachments,
                            { 
                                id: attachmentId, 
                                name: fileName, 
                                url: attachmentUrl, 
                                type: 'application/pdf', 
                                size: pdfBlob.size 
                            },
                        ],
                    };
                    await actions.updateCandidate(updated, state.currentUser?.name);
                }
            }
        } catch (err) {
            console.error('Error al exportar PDF:', err);
            alert('No se pudo generar el PDF. Revisa la consola para más detalles.');
        }
    };

    return (
        <div className="p-8 flex-1 min-h-0 flex flex-col">
            <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                <BarChart2 className="w-7 h-7 mr-3" /> 
                {getLabel('compare_title', 'Comparador de candidatos')}
            </h1>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
                {/* Selección de candidatos */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Buscar y seleccionar candidatos</label>
                    <input
                        value={candidateQuery}
                        onChange={e => setCandidateQuery(e.target.value)}
                        placeholder="Buscar por nombre, email, proceso..."
                        className="w-full border border-gray-300 rounded-md shadow-sm mb-2 px-3 py-2"
                    />
                    <div className="border rounded-md max-h-48 overflow-y-auto">
                        {filteredCandidates.map(c => {
                            const checked = selectedIds.includes(c.id);
                            return (
                                <label key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={e => {
                                            setSelectedIds(prev => checked ? prev.filter(id => id !== c.id) : [...prev, c.id]);
                                        }}
                                    />
                                    <span className="text-sm text-gray-700">{c.name}</span>
                                    <span className="text-xs text-gray-500">
                                        ({processes.find(p => p.id === c.processId)?.title || 'Sin proceso'})
                                    </span>
                                </label>
                            );
                        })}
                        {filteredCandidates.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">Sin resultados</div>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{selectedIds.length} candidato(s) seleccionado(s)</p>
                </div>

                {/* Widgets */}
                {selectedCandidates.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-800">Widgets de comparación</h2>
                            <button
                                onClick={addWidget}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                            >
                                <Plus className="w-4 h-4" />
                                Agregar widget
                            </button>
                        </div>
                        {widgets.length === 0 ? (
                            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                                <LayoutGrid className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-600 mb-2">No hay widgets configurados</p>
                                <p className="text-sm text-gray-500 mb-4">Agrega widgets para comparar los candidatos seleccionados</p>
                                <button
                                    onClick={addWidget}
                                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                                >
                                    Crear primer widget
                                </button>
                            </div>
                        ) : (
                            <div ref={widgetsContainerRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {widgets.map(widget => renderWidget(widget))}
                            </div>
                        )}
                    </div>
                )}

                {/* Comentarios y exportación */}
                {selectedCandidates.length > 0 && (
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm" ref={commentsRef}>
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">Comentarios para informe</h2>
                        <textarea 
                            value={comments} 
                            onChange={e => setComments(e.target.value)} 
                            rows={5} 
                            className="w-full border border-gray-300 rounded-md shadow-sm p-3" 
                            placeholder="Anota aquí observaciones, riesgos, fortalezas, recomendación final..." 
                        />
                        <div className="mt-3 flex items-center justify-between gap-2">
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input 
                                    type="checkbox" 
                                    checked={savePdfToCandidates} 
                                    onChange={e => setSavePdfToCandidates(e.target.checked)} 
                                />
                                Guardar PDF en Adjuntos de candidatos seleccionados
                            </label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={exportPDF} 
                                    disabled={selectedCandidates.length === 0 || widgets.length === 0} 
                                    className="px-4 py-2 bg-primary-600 text-white rounded-md shadow-sm disabled:bg-primary-300 disabled:cursor-not-allowed flex items-center"
                                >
                                    <Download className="w-4 h-4 mr-2" /> 
                                    Exportar PDF
                                </button>
                                <button 
                                    onClick={exportWord} 
                                    disabled={selectedCandidates.length === 0 || widgets.length === 0} 
                                    className="px-4 py-2 bg-green-600 text-white rounded-md shadow-sm disabled:bg-green-300 disabled:cursor-not-allowed flex items-center"
                                >
                                    <FileText className="w-4 h-4 mr-2" /> 
                                    Exportar Word
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
