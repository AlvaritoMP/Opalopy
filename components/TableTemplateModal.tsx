import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, Download, Upload, Trash2, Loader2 } from 'lucide-react';
import { useAppState } from '../App';
import { DEFAULT_COLUMN_ORDER } from '../lib/bulkTableColumns';
import {
    type BulkTableTemplate,
    type BulkTableTemplateLayout,
} from '../lib/bulkTableTemplates';
import { bulkTableTemplatesApi } from '../lib/api/bulkTableTemplates';

export type { BulkTableTemplate, BulkTableTemplateLayout };

interface TableTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentLayout: BulkTableTemplateLayout;
    onLoadTemplate: (template: BulkTableTemplateLayout) => void | Promise<void>;
}

function hasSaveableLayout(layout: BulkTableTemplateLayout): boolean {
    if (layout.columns.length > 0) return true;
    if (layout.hiddenColumns.length > 0) return true;
    if (Object.keys(layout.columnWidths).length > 0) return true;
    if (layout.pinnedColumns.length !== 1 || layout.pinnedColumns[0] !== 'name') return true;
    return JSON.stringify(layout.columnOrder) !== JSON.stringify(DEFAULT_COLUMN_ORDER);
}

export const TableTemplateModal: React.FC<TableTemplateModalProps> = ({
    isOpen,
    onClose,
    currentLayout,
    onLoadTemplate,
}) => {
    const { state, actions } = useAppState();
    const currentUser = state.currentUser;

    const [templates, setTemplates] = useState<BulkTableTemplate[]>([]);
    const [templateName, setTemplateName] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [remoteEnabled, setRemoteEnabled] = useState(true);

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const list = await bulkTableTemplatesApi.refreshCache({
                id: currentUser?.id,
                name: currentUser?.name || currentUser?.email,
            });
            setTemplates(list);
            setRemoteEnabled(bulkTableTemplatesApi.isRemoteEnabled());
        } catch {
            actions.showToast('No se pudieron cargar las plantillas compartidas', 'error', 4000);
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id, currentUser?.name, currentUser?.email, actions]);

    useEffect(() => {
        if (isOpen) {
            void loadTemplates();
        }
    }, [isOpen, loadTemplates]);

    const handleSaveTemplate = async () => {
        if (!templateName.trim()) {
            actions.showToast('Ingrese un nombre para la plantilla', 'error', 3000);
            return;
        }
        if (!hasSaveableLayout(currentLayout)) {
            actions.showToast('No hay configuración de columnas para guardar', 'error', 3000);
            return;
        }

        setSaving(true);
        try {
            await bulkTableTemplatesApi.create(templateName.trim(), currentLayout, {
                id: currentUser?.id,
                name: currentUser?.name || currentUser?.email,
            });
            setTemplateName('');
            await loadTemplates();
            actions.showToast(
                remoteEnabled
                    ? 'Plantilla guardada y visible para todo el equipo'
                    : 'Plantilla guardada solo en este navegador',
                'success',
                3500
            );
        } catch {
            actions.showToast('Error al guardar la plantilla', 'error', 4000);
        } finally {
            setSaving(false);
        }
    };

    const handleLoadTemplate = async (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        const layout: BulkTableTemplateLayout = {
            columns: template.columns || [],
            columnOrder: template.columnOrder?.length
                ? template.columnOrder
                : [
                    ...DEFAULT_COLUMN_ORDER,
                    ...(template.columns || []).map(c => `custom_${c.id}`),
                ],
            hiddenColumns: template.hiddenColumns || [],
            pinnedColumns: template.pinnedColumns?.length ? template.pinnedColumns : ['name'],
            columnWidths: template.columnWidths || {},
        };

        await onLoadTemplate(layout);
        setSelectedTemplate(templateId);
    };

    const handleDeleteTemplate = async (templateId: string) => {
        if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;
        try {
            await bulkTableTemplatesApi.delete(templateId);
            await loadTemplates();
            if (selectedTemplate === templateId) setSelectedTemplate(null);
            actions.showToast('Plantilla eliminada', 'success', 2500);
        } catch {
            actions.showToast('Error al eliminar la plantilla', 'error', 4000);
        }
    };

    const handleExportTemplate = (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (!template) return;
        const dataStr = JSON.stringify(template, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `plantilla_${template.name.replace(/\s+/g, '_')}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleImportTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const reader = new FileReader();
        reader.onload = async event => {
            try {
                const parsed = JSON.parse(event.target?.result as string) as BulkTableTemplate;
                const layout: BulkTableTemplateLayout = {
                    columns: parsed.columns || [],
                    columnOrder: parsed.columnOrder || [],
                    hiddenColumns: parsed.hiddenColumns || [],
                    pinnedColumns: parsed.pinnedColumns || ['name'],
                    columnWidths: parsed.columnWidths || {},
                };
                const name = parsed.name?.trim() || `Importada ${new Date().toLocaleDateString('es-PE')}`;
                await bulkTableTemplatesApi.create(name, layout, {
                    id: currentUser?.id,
                    name: currentUser?.name || currentUser?.email,
                });
                await loadTemplates();
                actions.showToast('Plantilla importada', 'success', 3000);
            } catch {
                actions.showToast('Archivo JSON inválido', 'error', 4000);
            }
        };
        reader.readAsText(file);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Plantillas de Tabla</h2>
                        <p className="text-xs text-gray-500 mt-1">
                            {remoteEnabled
                                ? 'Compartidas con todos los usuarios de Opalopy'
                                : 'Modo local: ejecute MIGRATION_ADD_BULK_TABLE_TEMPLATES.sql en Supabase'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Guardar Plantilla Actual</h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={templateName}
                                onChange={e => setTemplateName(e.target.value)}
                                placeholder="Nombre de la plantilla..."
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <button
                                onClick={() => void handleSaveTemplate()}
                                disabled={!templateName.trim() || !hasSaveableLayout(currentLayout) || saving}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Guardar
                            </button>
                        </div>
                        {hasSaveableLayout(currentLayout) && (
                            <p className="text-xs text-gray-500 mt-2">
                                Se guardará el orden, visibilidad y {currentLayout.columns.length} columna
                                {currentLayout.columns.length !== 1 ? 's' : ''} personalizada
                                {currentLayout.columns.length !== 1 ? 's' : ''}
                                {currentLayout.hiddenColumns.length > 0
                                    ? ` (${currentLayout.hiddenColumns.length} oculta${currentLayout.hiddenColumns.length !== 1 ? 's' : ''})`
                                    : ''}
                            </p>
                        )}
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Importar Plantilla</h3>
                        <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer">
                            <Upload className="w-4 h-4" />
                            Seleccionar archivo JSON
                            <input type="file" accept=".json" onChange={e => void handleImportTemplate(e)} className="hidden" />
                        </label>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Plantillas Guardadas</h3>
                        {loading ? (
                            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Cargando plantillas…
                            </div>
                        ) : templates.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-8">No hay plantillas guardadas</p>
                        ) : (
                            <div className="space-y-2">
                                {templates.map(template => (
                                    <div
                                        key={template.id}
                                        className={`border rounded-lg p-4 ${
                                            selectedTemplate === template.id
                                                ? 'border-primary-500 bg-primary-50'
                                                : 'border-gray-200'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium text-gray-900 truncate">{template.name}</h4>
                                                <p className="text-xs text-gray-500">
                                                    {(template.columns || []).length} personalizada
                                                    {(template.columns || []).length !== 1 ? 's' : ''}
                                                    {template.columnOrder?.length ? ' • orden personalizado' : ''}
                                                    {template.hiddenColumns?.length
                                                        ? ` • ${template.hiddenColumns.length} oculta${template.hiddenColumns.length !== 1 ? 's' : ''}`
                                                        : ''}
                                                    {' • '}
                                                    {new Date(template.createdAt).toLocaleDateString('es-PE')}
                                                    {template.createdByName ? ` • ${template.createdByName}` : ''}
                                                </p>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button
                                                    onClick={() => void handleLoadTemplate(template.id)}
                                                    className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                                                >
                                                    Cargar
                                                </button>
                                                <button
                                                    onClick={() => handleExportTemplate(template.id)}
                                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="Exportar"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => void handleDeleteTemplate(template.id)}
                                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t p-6">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};
