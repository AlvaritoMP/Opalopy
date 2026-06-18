import React from 'react';
import { X, Plus, Edit, Trash2, List } from 'lucide-react';
import { CustomColumn, DASHBOARD_SEMANTIC_FIELD_OPTIONS } from '../types';

const TYPE_LABELS: Record<CustomColumn['type'], string> = {
    text: 'Texto',
    number: 'Número',
    checkbox: 'Sí/No',
    date: 'Fecha',
    select: 'Lista desplegable',
    route: 'Ruta',
    route_cost: 'Costo de ruta',
};

interface ManageCustomColumnsModalProps {
    isOpen: boolean;
    onClose: () => void;
    columns: CustomColumn[];
    onEdit: (column: CustomColumn) => void;
    onDelete: (columnId: string) => void;
    onAdd: () => void;
}

export const ManageCustomColumnsModal: React.FC<ManageCustomColumnsModalProps> = ({
    isOpen,
    onClose,
    columns,
    onEdit,
    onDelete,
    onAdd,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b shrink-0">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                            <List className="w-5 h-5 text-primary-600" />
                            Columnas personalizadas
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Edite nombre, tipo y opciones (p. ej. agregar categorías a listas desplegables).
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {columns.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-8">
                            No hay columnas personalizadas. Cree una para empezar.
                        </p>
                    ) : (
                        columns.map(col => (
                            <div
                                key={col.id}
                                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 truncate">{col.name}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                        {TYPE_LABELS[col.type]}
                                        {col.dashboardSemanticField && (
                                            <span className="text-indigo-600">
                                                {' · Panel: '}
                                                {DASHBOARD_SEMANTIC_FIELD_OPTIONS.find(o => o.value === col.dashboardSemanticField)?.label
                                                    || col.dashboardSemanticField}
                                            </span>
                                        )}
                                        {col.type === 'select' && (
                                            <span>
                                                {' · '}
                                                {col.options?.length
                                                    ? `${col.options.length} opción(es)`
                                                    : 'sin opciones'}
                                            </span>
                                        )}
                                        {col.type === 'route' && col.routeDestination && (
                                            <span className="truncate block" title={col.routeDestination}>
                                                → {col.routeDestination}
                                            </span>
                                        )}
                                        {col.type === 'route_cost' && col.sourceRouteColumnId && (
                                            <span className="truncate block">
                                                A solicitud del usuario · guardado en BD
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => onEdit(col)}
                                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                        title="Editar columna"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onDelete(col.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar columna"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t shrink-0 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cerrar
                    </button>
                    <button
                        type="button"
                        onClick={onAdd}
                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva columna
                    </button>
                </div>
            </div>
        </div>
    );
};
