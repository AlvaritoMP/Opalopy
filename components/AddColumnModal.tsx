import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { CustomColumn, PsycholaboralReportNamePart, DashboardSemanticField, DASHBOARD_SEMANTIC_FIELD_OPTIONS } from '../types';

interface AddColumnModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (column: CustomColumn) => void;
    editingColumn?: CustomColumn | null;
    onEdit?: (column: CustomColumn) => void;
    /** Columnas existentes del proceso (para vincular costo de ruta). */
    existingColumns?: CustomColumn[];
}

type ColumnType = CustomColumn['type'];

export const AddColumnModal: React.FC<AddColumnModalProps> = ({
    isOpen,
    onClose,
    onAdd,
    editingColumn,
    onEdit,
    existingColumns = [],
}) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<ColumnType>('text');
    const [options, setOptions] = useState<string[]>(['']);
    const [routeDestination, setRouteDestination] = useState('');
    const [sourceRouteColumnId, setSourceRouteColumnId] = useState('');
    const [reportNamePart, setReportNamePart] = useState<'' | PsycholaboralReportNamePart>('');
    const [dashboardSemanticField, setDashboardSemanticField] = useState<'' | DashboardSemanticField>('');

    const routeColumns = useMemo(
        () => existingColumns.filter(c => c.type === 'route'),
        [existingColumns]
    );

    const isEditing = !!editingColumn;

    useEffect(() => {
        if (isOpen && editingColumn) {
            setName(editingColumn.name);
            setType(editingColumn.type);
            const opts = editingColumn.options?.filter(o => o != null && String(o).trim() !== '') ?? [];
            setOptions(
                editingColumn.type === 'select'
                    ? opts.length > 0
                        ? [...opts]
                        : ['']
                    : opts.length > 0
                        ? [...opts]
                        : ['']
            );
            setRouteDestination(editingColumn.routeDestination || '');
            setSourceRouteColumnId(editingColumn.sourceRouteColumnId || '');
            setReportNamePart(editingColumn.reportNamePart ?? '');
            setDashboardSemanticField(editingColumn.dashboardSemanticField ?? '');
        } else if (isOpen) {
            setName('');
            setType('text');
            setOptions(['']);
            setRouteDestination('');
            setSourceRouteColumnId('');
            setReportNamePart('');
            setDashboardSemanticField('');
        }
    }, [isOpen, editingColumn]);

    if (!isOpen) return null;

    const handleAddOption = () => {
        setOptions(prev => [...prev, '']);
    };

    const handleRemoveOption = (index: number) => {
        setOptions(options.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            alert('Por favor, ingrese un nombre para la columna');
            return;
        }

        if (type === 'select') {
            const validOptions = options.map(o => o.trim()).filter(Boolean);
            if (validOptions.length === 0) {
                alert('Agregue al menos una opción para la lista desplegable');
                return;
            }
        }

        if (type === 'route' && !routeDestination.trim()) {
            alert('Ingrese la dirección de destino para la ruta en transporte público');
            return;
        }

        if (type === 'route_cost') {
            if (routeColumns.length === 0) {
                alert('Primero cree al menos una columna de tipo Ruta (transporte público)');
                return;
            }
            if (!sourceRouteColumnId) {
                alert('Seleccione la columna de ruta de referencia');
                return;
            }
        }

        const column: CustomColumn = {
            id: editingColumn?.id || `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name.trim(),
            type,
            ...(type === 'select' && { options: options.map(o => o.trim()).filter(Boolean) }),
            ...(type === 'route' && { routeDestination: routeDestination.trim() }),
            ...(type === 'route_cost' && {
                sourceRouteColumnId,
                routeCostOnDemand: true,
            }),
            ...(reportNamePart && type !== 'route' && type !== 'route_cost' ? { reportNamePart } : {}),
            ...(dashboardSemanticField && type !== 'route' && type !== 'route_cost'
                ? { dashboardSemanticField }
                : {}),
        };

        if (isEditing && onEdit) {
            onEdit(column);
        } else {
            onAdd(column);
        }

        setName('');
        setType('text');
        setOptions(['']);
        setRouteDestination('');
        setSourceRouteColumnId('');
        setReportNamePart('');
        setDashboardSemanticField('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {isEditing ? 'Editar Columna' : 'Agregar Columna Personalizada'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nombre de la Columna <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={
                                type === 'route'
                                    ? 'Ej: Ruta a sede Miraflores'
                                    : type === 'route_cost'
                                        ? 'Ej: Costo ruta sede Miraflores'
                                        : 'Ej: Disponibilidad, Salario esperado...'
                            }
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tipo de Columna <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={type}
                            onChange={(e) => {
                                const newType = e.target.value as ColumnType;
                                setType(newType);
                                if (newType === 'select' && options.length === 0) {
                                    setOptions(['']);
                                }
                                if (newType === 'route_cost' && routeColumns.length === 1) {
                                    setSourceRouteColumnId(routeColumns[0].id);
                                }
                            }}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                            <option value="text">Texto</option>
                            <option value="number">Número</option>
                            <option value="checkbox">Checkbox (Sí/No)</option>
                            <option value="date">Fecha</option>
                            <option value="select">Selección (Lista desplegable)</option>
                            <option value="route">Ruta (transporte público)</option>
                            <option value="route_cost">Costo aprox. de ruta</option>
                        </select>
                    </div>

                    {type === 'route' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Punto de destino <span className="text-red-500">*</span>
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                Dirección del lugar de entrevista o sede. Cada fila mostrará un enlace con la ruta en bus/metro desde la ubicación del candidato.
                            </p>
                            <input
                                type="text"
                                value={routeDestination}
                                onChange={(e) => setRouteDestination(e.target.value)}
                                placeholder="Ej: Av. Javier Prado 4200, San Isidro, Lima"
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                    )}

                    {type === 'route_cost' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Columna de ruta de referencia <span className="text-red-500">*</span>
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                Se estimará el costo aproximado del tramo según la ruta seleccionada.
                                El valor <strong>no se calcula automáticamente</strong>: cada fila se consulta
                                solo cuando el usuario pulse «Calcular» o use la acción masiva de pendientes.
                                El resultado queda guardado en la base de datos.
                            </p>
                            {routeColumns.length === 0 ? (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    No hay columnas de ruta en este proceso. Cree primero una columna tipo «Ruta (transporte público)».
                                </p>
                            ) : (
                                <select
                                    value={sourceRouteColumnId}
                                    onChange={(e) => setSourceRouteColumnId(e.target.value)}
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                >
                                    <option value="">Seleccionar columna de ruta...</option>
                                    {routeColumns.map(col => (
                                        <option key={col.id} value={col.id}>
                                            {col.name}
                                            {col.routeDestination ? ` → ${col.routeDestination}` : ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {type === 'select' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Opciones de Selección
                            </label>
                            {isEditing && (
                                <p className="text-xs text-gray-500 mb-2">
                                    Agregue o modifique opciones aquí; los cambios se aplican a toda la tabla al guardar.
                                </p>
                            )}
                            <div className="space-y-2">
                                {options.map((option, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => {
                                                const newOptions = [...options];
                                                newOptions[index] = e.target.value;
                                                setOptions(newOptions);
                                            }}
                                            placeholder={`Opción ${index + 1}`}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        />
                                        {options.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveOption(index)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddOption}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Agregar Opción
                                </button>
                            </div>
                        </div>
                    )}

                    {type !== 'route' && type !== 'route_cost' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Clasificación para el Panel
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                Indique qué indicador del Panel alimenta esta columna cuando su nombre no es estándar
                                (p. ej. «Asistió» → Asistencia a cita; «¿Cómo se enteró?» → Fuente de candidato).
                            </p>
                            <select
                                value={dashboardSemanticField}
                                onChange={(e) =>
                                    setDashboardSemanticField((e.target.value || '') as '' | DashboardSemanticField)
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="">Automático (detectar por nombre)</option>
                                {DASHBOARD_SEMANTIC_FIELD_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label} — {opt.chartHint}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {type !== 'route' && type !== 'route_cost' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Informe psicolaboral (nombre en PDF)
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                Opcional: indica si esta columna aporta nombres o apellidos. Si dejas «Automático», se
                                infiere del título de la columna (p. ej. «Apellido Paterno»).
                            </p>
                            <select
                                value={reportNamePart}
                                onChange={(e) =>
                                    setReportNamePart((e.target.value || '') as '' | PsycholaboralReportNamePart)
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="">Automático (por nombre de columna)</option>
                                <option value="given_names">Nombres</option>
                                <option value="paternal_surname">Apellido paterno</option>
                                <option value="maternal_surname">Apellido materno</option>
                                <option value="surnames_combined">Apellidos (un solo campo)</option>
                            </select>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                            {isEditing ? 'Guardar Cambios' : 'Agregar Columna'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
