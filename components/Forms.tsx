import React, { useState } from 'react';
import { useAppState } from '../App';
import { Plus, Trash2, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { FormEditorModal } from './FormEditorModal'; // This is now the FormIntegrationModal
import { FormIntegration } from '../types';

const PlatformLogo: React.FC<{platform: string}> = ({platform}) => {
    const baseClasses = "w-8 h-8 mr-4 rounded-md flex items-center justify-center text-white font-bold";
    if (platform === 'Tally') {
        return <div className={`${baseClasses} bg-black text-lg`}>T</div>;
    }
    if (platform === 'Google Forms') {
         return <svg className="w-8 h-8 mr-4" viewBox="0 0 40 40">
            <path d="M25,5H15c-1.1,0-2,0.9-2,2v5h10v-5C27,5.9,26.1,5,25,5z" fill="#7e57c2"></path>
            <path d="M27,14h-5v12c0,1.1-0.9,2-2,2h-2c-1.1,0-2-0.9-2-2V14h-5c-1.1,0-2,0.9-2,2v12c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V16 C29,14.9,28.1,14,27,14z" fill="#512da8"></path>
        </svg>
    }
     if (platform === 'Microsoft Forms') {
        return <svg className="w-8 h-8 mr-4" viewBox="0 0 24 24">
            <path fill="#217346" d="M13.2,6.1H4.3v4.2h7.8c-0.1-0.3-0.2-0.6-0.2-1C11.9,8,12.4,6.9,13.2,6.1z M4.3,13.7h9.7c0.1,0.7,0.3,1.3,0.6,1.9H4.3V13.7z M4.3,3h12.4c0.4,0.6,0.7,1.3,1,2h-15V3z M19.7,11.9c0-2.5-1.5-4.6-3.6-5.6c0.5-0.9,0.8-1.9,0.8-3c0-0.2,0-0.3,0-0.5h0.4c0.4,0,0.8-0.3,0.8-0.8S20,1,19.5,1h-15C4,1,3.6,1.3,3.6,1.8S4,2.5,4.5,2.5h0.4v19H12c2.1,0,4-0.8,5.5-2.2C19,17.5,19.7,14.9,19.7,11.9z M12.8,20.5H5v-2.1h8.7C13.5,19.1,13.2,19.8,12.8,20.5z M16,11.9c0,2.6-2.1,4.8-4.8,4.8s-4.8-2.1-4.8-4.8s2.1-4.8,4.8-4.8S16,9.3,16,11.9z"/>
        </svg>
    }
    return <div className={`${baseClasses} bg-gray-400`}><LinkIcon className="w-5 h-5"/></div>;
}


export const Forms: React.FC = () => {
    const { state, actions, getLabel } = useAppState();
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    
    const handleDelete = (formId: string) => {
        if (window.confirm('¿Seguro que quieres eliminar esta integración? Esto no eliminará el formulario en la plataforma original.')) {
            actions.deleteFormIntegration(formId);
        }
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">{getLabel('sidebar_forms', 'Integraciones de formularios')}</h1>
                <button
                    onClick={() => setIsEditorOpen(true)}
                    className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700"
                >
                    <Plus className="w-5 h-5 mr-2" /> Nueva integración
                </button>
            </div>
            {state.formIntegrations.length === 0 ? (
                 <div className="text-center py-12 bg-white rounded-xl border border-dashed">
                    <h3 className="text-lg font-medium text-gray-900">No se encontraron integraciones</h3>
                    <p className="mt-1 text-sm text-gray-500">Conecta un formulario externo para empezar a recibir postulaciones.</p>
                    <div className="mt-6">
                        <button
                            onClick={() => setIsEditorOpen(true)}
                            type="button"
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                            <Plus className="-ml-1 mr-2 h-5 w-5" />
                            Nueva integración
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <ul role="list" className="divide-y divide-gray-200">
                        {state.formIntegrations.map((integration) => {
                             const process = state.processes.find(p => p.id === integration.processId);
                             return (
                                <li key={integration.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                                    <div className="flex items-center">
                                        <PlatformLogo platform={integration.platform} />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{integration.formName}</p>
                                            <p className="text-sm text-gray-500">
                                                Vinculado a: <span className="font-medium">{process?.title || 'Proceso desconocido'}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                         <a href="#" className="text-sm text-primary-600 hover:text-primary-800 flex items-center">
                                            Ver formulario <ExternalLink className="w-4 h-4 ml-1"/>
                                         </a>
                                         <button onClick={() => handleDelete(integration.id)} className="p-2 rounded-md hover:bg-red-100" title="Eliminar integración">
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                </li>
                             )
                        })}
                    </ul>
                </div>
            )}
             {isEditorOpen && (
                <FormEditorModal form={null} onClose={() => setIsEditorOpen(false)} />
            )}
        </div>
    );
};