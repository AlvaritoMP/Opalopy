import React, { useState } from 'react';
import { useAppState } from '../App';
import { Process, Stage, ProcessStatus, BulkProcessConfig, KillerQuestion } from '../types';
import { X, Plus, Trash2, GripVertical, Settings, Filter, Brain, MessageCircle } from 'lucide-react';
import { processesApi } from '../lib/api/processes';

interface BulkProcessEditorModalProps {
    process: Process | null;
    onClose: () => void;
    onSave: () => void;
}

export const BulkProcessEditorModal: React.FC<BulkProcessEditorModalProps> = ({ process, onClose, onSave }) => {
    const { state, actions } = useAppState();
    const [title, setTitle] = useState(process?.title || '');
    const [description, setDescription] = useState(process?.description || '');
    const [stages, setStages] = useState<Stage[]>(process?.stages || [{ id: `new-${Date.now()}`, name: 'Postulación Inicial' }]);
    const [status, setStatus] = useState<ProcessStatus>(process?.status || 'en_proceso');
    const [vacancies, setVacancies] = useState<number>(process?.vacancies || 1);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'basic' | 'config'>('basic');
    
    // Configuración avanzada
    const [bulkConfig, setBulkConfig] = useState<BulkProcessConfig>(process?.bulkConfig || {
        killerQuestions: [],
        aiPrompt: '',
        scoreThreshold: 70,
        whatsappEnabled: true,
        whatsappMessageTemplate: 'Hola {nombre}, nos interesa tu perfil para el puesto de {puesto}. ¿Tienes disponibilidad para una entrevista?',
        autoFilterEnabled: true,
    });
    
    const [killerQuestions, setKillerQuestions] = useState<KillerQuestion[]>(process?.bulkConfig?.killerQuestions || []);

    const handleAddStage = () => {
        setStages([...stages, { id: `new-${Date.now()}`, name: '' }]);
    };

    const handleRemoveStage = (index: number) => {
        if (stages.length > 1) {
            setStages(stages.filter((_, i) => i !== index));
        }
    };

    const handleStageChange = (index: number, name: string) => {
        const newStages = [...stages];
        newStages[index] = { ...newStages[index], name };
        setStages(newStages);
    };

    const handleSave = async () => {
        if (!title.trim()) {
            actions.showToast('El título es requerido', 'error', 3000);
            return;
        }

        if (stages.some(s => !s.name.trim())) {
            actions.showToast('Todas las etapas deben tener un nombre', 'error', 3000);
            return;
        }

        setIsSaving(true);
        try {
            const processData: Omit<Process, 'id'> = {
                title: title.trim(),
                description: description.trim(),
                stages: stages.map((s, index) => ({
                    id: s.id.startsWith('new-') ? `stage-${Date.now()}-${index}` : s.id,
                    name: s.name.trim(),
                })),
                status,
                vacancies,
                attachments: [],
                isBulkProcess: true,
                bulkConfig: {
                    ...bulkConfig,
                    killerQuestions: killerQuestions,
                },
            };

            if (process) {
                await processesApi.update({ ...process, ...processData });
                actions.showToast('Proceso masivo actualizado', 'success', 3000);
            } else {
                await processesApi.create(processData);
                actions.showToast('Proceso masivo creado', 'success', 3000);
            }

            onSave();
            onClose();
        } catch (error: any) {
            console.error('Error guardando proceso masivo:', error);
            actions.showToast(`Error: ${error.message || 'Error desconocido'}`, 'error', 5000);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {process ? 'Editar Proceso Masivo' : 'Nuevo Proceso Masivo'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 mb-6">
                        <button
                            onClick={() => setActiveTab('basic')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'basic'
                                    ? 'border-primary-600 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Settings className="w-4 h-4 inline mr-2" />
                            Básico
                        </button>
                        <button
                            onClick={() => setActiveTab('config')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'config'
                                    ? 'border-primary-600 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Filter className="w-4 h-4 inline mr-2" />
                            Configuración Avanzada
                        </button>
                    </div>

                    {activeTab === 'basic' ? (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Título del Proceso *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej: Reclutamiento Masivo - Desarrolladores"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Descripción
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Descripción del proceso masivo..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Etapas del Proceso *
                                </label>
                                <div className="space-y-2">
                                    {stages.map((stage, index) => (
                                        <div key={stage.id} className="flex items-center gap-2">
                                            <GripVertical className="w-5 h-5 text-gray-400" />
                                            <input
                                                type="text"
                                                value={stage.name}
                                                onChange={(e) => handleStageChange(index, e.target.value)}
                                                placeholder={`Etapa ${index + 1}`}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            />
                                            {stages.length > 1 && (
                                                <button
                                                    onClick={() => handleRemoveStage(index)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={handleAddStage}
                                    className="mt-2 flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                                >
                                    <Plus className="w-4 h-4" />
                                    Agregar Etapa
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Estado
                                    </label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as ProcessStatus)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="en_proceso">En Proceso</option>
                                        <option value="standby">Standby</option>
                                        <option value="terminado">Terminado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Vacantes
                                    </label>
                                    <input
                                        type="number"
                                        value={vacancies}
                                        onChange={(e) => setVacancies(parseInt(e.target.value) || 1)}
                                        min="1"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Score Threshold */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Puntaje de Corte (Score Threshold)
                                </label>
                                <p className="text-xs text-gray-500 mb-2">
                                    Solo los candidatos con Score IA mayor o igual a este valor aparecerán en la vista principal
                                </p>
                                <input
                                    type="number"
                                    value={bulkConfig.scoreThreshold || 70}
                                    onChange={(e) => setBulkConfig({ ...bulkConfig, scoreThreshold: parseInt(e.target.value) || 0 })}
                                    min="0"
                                    max="100"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>

                            {/* Prompt de IA */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Brain className="w-4 h-4 inline mr-1" />
                                    Prompt de IA para Análisis de CV
                                </label>
                                <p className="text-xs text-gray-500 mb-2">
                                    Instrucciones específicas para OpenAI al analizar los CVs de los candidatos
                                </p>
                                <textarea
                                    value={bulkConfig.aiPrompt || ''}
                                    onChange={(e) => setBulkConfig({ ...bulkConfig, aiPrompt: e.target.value })}
                                    placeholder="Ej: Busca experiencia en ventas de tangibles. Prioriza candidatos que dominen Excel avanzado. Evalúa habilidades de comunicación y trabajo en equipo."
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>

                            {/* Killer Questions */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Killer Questions Automáticas
                                </label>
                                <p className="text-xs text-gray-500 mb-3">
                                    Preguntas que filtran automáticamente a los candidatos. Si no cumplen, se marcan como "No Aptos"
                                </p>
                                <div className="space-y-3">
                                    {killerQuestions.map((q, index) => (
                                        <div key={q.id} className="p-4 border border-gray-200 rounded-lg">
                                            <div className="flex items-start justify-between mb-2">
                                                <span className="text-sm font-medium text-gray-700">Pregunta {index + 1}</span>
                                                <button
                                                    onClick={() => setKillerQuestions(killerQuestions.filter((_, i) => i !== index))}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                value={q.question}
                                                onChange={(e) => {
                                                    const updated = [...killerQuestions];
                                                    updated[index] = { ...updated[index], question: e.target.value };
                                                    setKillerQuestions(updated);
                                                }}
                                                placeholder="Ej: ¿Tienes disponibilidad para trabajar en Surco?"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                                <select
                                                    value={q.type}
                                                    onChange={(e) => {
                                                        const updated = [...killerQuestions];
                                                        updated[index] = { ...updated[index], type: e.target.value as 'yes_no' | 'multiple_choice' };
                                                        setKillerQuestions(updated);
                                                    }}
                                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                >
                                                    <option value="yes_no">Sí/No</option>
                                                    <option value="multiple_choice">Opción Múltiple</option>
                                                </select>
                                                <label className="flex items-center gap-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={q.required}
                                                        onChange={(e) => {
                                                            const updated = [...killerQuestions];
                                                            updated[index] = { ...updated[index], required: e.target.checked };
                                                            setKillerQuestions(updated);
                                                        }}
                                                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                                    />
                                                    Requerida
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setKillerQuestions([...killerQuestions, {
                                            id: `kq-${Date.now()}`,
                                            question: '',
                                            type: 'yes_no',
                                            correctAnswer: '',
                                            required: true,
                                        }])}
                                        className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Agregar Killer Question
                                    </button>
                                </div>
                            </div>

                            {/* WhatsApp */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <MessageCircle className="w-4 h-4 inline mr-1" />
                                    Configuración de WhatsApp
                                </label>
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={bulkConfig.whatsappEnabled ?? true}
                                            onChange={(e) => setBulkConfig({ ...bulkConfig, whatsappEnabled: e.target.checked })}
                                            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                        />
                                        Habilitar acceso rápido a WhatsApp
                                    </label>
                                    {bulkConfig.whatsappEnabled && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Plantilla de Mensaje
                                            </label>
                                            <p className="text-xs text-gray-500 mb-2">
                                                Usa {'{nombre}'} y {'{puesto}'} como variables
                                            </p>
                                            <textarea
                                                value={bulkConfig.whatsappMessageTemplate || ''}
                                                onChange={(e) => setBulkConfig({ ...bulkConfig, whatsappMessageTemplate: e.target.value })}
                                                placeholder="Hola {nombre}, nos interesa tu perfil para el puesto de {puesto}..."
                                                rows={3}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Filtrado Automático */}
                            <div>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={bulkConfig.autoFilterEnabled ?? true}
                                        onChange={(e) => setBulkConfig({ ...bulkConfig, autoFilterEnabled: e.target.checked })}
                                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">
                                        Activar filtrado automático
                                    </span>
                                </label>
                                <p className="text-xs text-gray-500 mt-1 ml-6">
                                    Los candidatos se filtrarán automáticamente según las Killer Questions y el Score Threshold
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? 'Guardando...' : process ? 'Actualizar' : 'Crear'}
                    </button>
                </div>
            </div>
        </div>
    );
};
