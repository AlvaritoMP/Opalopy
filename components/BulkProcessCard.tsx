import React from 'react';
import { Edit, Trash2, Paperclip } from 'lucide-react';
import { Process, ProcessStatus } from '../types';

const STATUS_LABELS: Record<ProcessStatus, string> = {
    en_proceso: 'En Proceso',
    standby: 'Stand By',
    terminado: 'Terminado',
};

const STATUS_COLORS: Record<ProcessStatus, string> = {
    en_proceso: 'bg-green-100 text-green-800',
    standby: 'bg-yellow-100 text-yellow-800',
    terminado: 'bg-gray-200 text-gray-700',
};

const DEFAULT_FLYER =
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800';

interface BulkProcessCardProps {
    process: Process;
    attachmentCount?: number;
    onSelect: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onDocuments?: () => void;
}

export const BulkProcessCard: React.FC<BulkProcessCardProps> = ({
    process,
    attachmentCount = 0,
    onSelect,
    onEdit,
    onDelete,
    onDocuments,
}) => {
    const currentStatus = process.status || 'en_proceso';

    return (
        <div
            className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden flex flex-col group hover:shadow-lg hover:border-primary-200 transition-all cursor-pointer"
            onClick={onSelect}
        >
            <div
                className="h-36 bg-cover relative"
                style={{
                    backgroundImage: `url(${process.flyerUrl || DEFAULT_FLYER})`,
                    backgroundPosition: process.flyerPosition || 'center center',
                }}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute top-2 right-2 flex gap-1" onClick={e => e.stopPropagation()}>
                    {onDocuments && (
                        <button
                            type="button"
                            onClick={onDocuments}
                            className="relative p-2 rounded-full bg-black/35 text-white hover:bg-black/55 backdrop-blur-sm"
                            title="Documentos del proceso"
                        >
                            <Paperclip className="w-4 h-4" />
                            {attachmentCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                                    {attachmentCount > 9 ? '9+' : attachmentCount}
                                </span>
                            )}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onEdit}
                        className="p-2 rounded-full bg-black/35 text-white hover:bg-black/55 backdrop-blur-sm"
                        title="Editar"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="p-2 rounded-full bg-black/35 text-white hover:bg-red-600/90 backdrop-blur-sm"
                        title="Eliminar"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-lg font-bold text-white line-clamp-2 drop-shadow-sm">{process.title}</h3>
                </div>
            </div>
            <div className="p-4 flex-1 flex flex-col gap-2">
                {process.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 flex-1">{process.description}</p>
                )}
                <div className="flex items-center justify-between gap-2 text-xs text-gray-500 pt-1 border-t border-gray-100">
                    <span>{process.stages.length} etapas</span>
                    <span>
                        {process.vacancies} vacante{process.vacancies !== 1 ? 's' : ''}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[currentStatus]}`}>
                        {STATUS_LABELS[currentStatus]}
                    </span>
                </div>
            </div>
        </div>
    );
};
