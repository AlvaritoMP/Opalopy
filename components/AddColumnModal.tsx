import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

interface CustomColumn {
    id: string;
    name: string;
    type: 'text' | 'number' | 'checkbox' | 'date' | 'select';
    options?: string[];
}

interface AddColumnModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (column: CustomColumn) => void;
}

export const AddColumnModal: React.FC<AddColumnModalProps> = ({
    isOpen,
    onClose,
    onAdd,
}) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<'text' | 'number' | 'checkbox' | 'date' | 'select'>('text');
    const [options, setOptions] = useState<string[]>(['']);
    const [optionInput, setOptionInput] = useState('');

    if (!isOpen) return null;

    const handleAddOption = () => {
        if (optionInput.trim()) {
            setOptions([...options, optionInput.trim()]);
            setOptionInput('');
        }
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

        const column: CustomColumn = {
            id: `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name.trim(),
            type,
            ...(type === 'select' && options.filter(o => o.trim()).length > 0 && { options: options.filter(o => o.trim()) }),
        };

        onAdd(column);
        setName('');
        setType('text');
        setOptions(['']);
        setOptionInput('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-semibold text-gray-900">Agregar Columna Personalizada</h2>
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
                            placeholder="Ej: Disponibilidad, Salario esperado..."
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
                            onChange={(e) => setType(e.target.value as any)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                            <option value="text">Texto</option>
                            <option value="number">Número</option>
                            <option value="checkbox">Checkbox (Sí/No)</option>
                            <option value="date">Fecha</option>
                            <option value="select">Selección (Lista desplegable)</option>
                        </select>
                    </div>

                    {type === 'select' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Opciones de Selección
                            </label>
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
                            Agregar Columna
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
