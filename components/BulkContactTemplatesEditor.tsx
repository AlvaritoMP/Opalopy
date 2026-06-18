import React from 'react';
import { Plus, Trash2, Mail, MessageCircle } from 'lucide-react';
import type { BulkContactMessageTemplate, BulkContactMessageChannel } from '../types';
import { createContactMessageTemplate } from '../lib/contactMessageTemplates';

interface BulkContactTemplatesEditorProps {
    templates: BulkContactMessageTemplate[];
    onChange: (templates: BulkContactMessageTemplate[]) => void;
}

export const BulkContactTemplatesEditor: React.FC<BulkContactTemplatesEditorProps> = ({
    templates,
    onChange,
}) => {
    const updateTemplate = (id: string, patch: Partial<BulkContactMessageTemplate>) => {
        onChange(templates.map(t => (t.id === id ? { ...t, ...patch } : t)));
    };

    const removeTemplate = (id: string) => {
        onChange(templates.filter(t => t.id !== id));
    };

    const addTemplate = (channel: BulkContactMessageChannel) => {
        onChange([
            ...templates,
            createContactMessageTemplate({
                channel,
                name: channel === 'email' ? 'Nueva plantilla de correo' : 'Nueva plantilla de WhatsApp',
                subject: channel === 'email' ? 'Asunto - {{nombre}}' : undefined,
                body:
                    channel === 'email'
                        ? 'Estimado/a {{nombre}},\n\n'
                        : 'Hola {{nombre}}, te contactamos por el proceso de {{puesto}}.',
            }),
        ]);
    };

    const sorted = [...templates].sort((a, b) => {
        if (a.channel !== b.channel) return a.channel === 'email' ? -1 : 1;
        return a.name.localeCompare(b.name, 'es');
    });

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => addTemplate('email')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                >
                    <Plus className="w-4 h-4" />
                    Plantilla de correo
                </button>
                <button
                    type="button"
                    onClick={() => addTemplate('whatsapp')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100"
                >
                    <Plus className="w-4 h-4" />
                    Plantilla de WhatsApp
                </button>
            </div>

            {sorted.length === 0 ? (
                <p className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-lg px-3 py-4">
                    Sin plantillas personalizadas. Se usarán las plantillas predeterminadas del sistema.
                    Agrega plantillas aquí para adaptarlas a este proceso.
                </p>
            ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {sorted.map(template => (
                        <div
                            key={template.id}
                            className="border border-gray-200 rounded-lg p-3 bg-white space-y-2"
                        >
                            <div className="flex items-start gap-2">
                                {template.channel === 'email' ? (
                                    <Mail className="w-4 h-4 text-blue-600 shrink-0 mt-2" />
                                ) : (
                                    <MessageCircle className="w-4 h-4 text-green-600 shrink-0 mt-2" />
                                )}
                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={template.name}
                                            onChange={e =>
                                                updateTemplate(template.id, { name: e.target.value })
                                            }
                                            placeholder="Nombre de la plantilla"
                                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                                        />
                                        <select
                                            value={template.channel}
                                            onChange={e =>
                                                updateTemplate(template.id, {
                                                    channel: e.target.value as BulkContactMessageChannel,
                                                })
                                            }
                                            className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                                        >
                                            <option value="email">Correo</option>
                                            <option value="whatsapp">WhatsApp</option>
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => removeTemplate(template.id)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                            title="Eliminar plantilla"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {template.channel === 'email' && (
                                        <input
                                            type="text"
                                            value={template.subject ?? ''}
                                            onChange={e =>
                                                updateTemplate(template.id, { subject: e.target.value })
                                            }
                                            placeholder="Asunto — ej: Invitación - {{nombre}}"
                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                                        />
                                    )}

                                    <textarea
                                        value={template.body}
                                        onChange={e =>
                                            updateTemplate(template.id, { body: e.target.value })
                                        }
                                        rows={template.channel === 'email' ? 5 : 3}
                                        placeholder="Cuerpo del mensaje..."
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <p className="text-xs text-gray-500">
                Variables: {'{{nombre}}'}, {'{{email}}'}, {'{{telefono}}'}, {'{{puesto}}'}.
                Los reclutadores eligen plantilla al pulsar el icono de correo o WhatsApp en la tabla.
            </p>
        </div>
    );
};
