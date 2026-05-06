// Populated `lib/data.ts` with initial seed data for processes, candidates, users, and settings. This provides default content for the application on first load and resolves module-related errors.
import { Process, Candidate, User, AppSettings, FormIntegration, InterviewEvent } from '../types';
import { getLocationData } from './locationData';

// Datos iniciales vacíos - La aplicación comenzará sin procesos, candidatos ni usuarios
export const initialProcesses: Process[] = [];

// Datos iniciales vacíos - La aplicación comenzará sin candidatos
export const initialCandidates: Candidate[] = [];

// Datos iniciales vacíos - Los usuarios se crearán desde la interfaz de administración
export const initialUsers: User[] = [];

export const initialSettings: AppSettings = {
    database: {
        apiUrl: '',
        apiToken: '',
    },
    fileStorage: {
        provider: 'None',
        connected: false,
    },
    currencySymbol: '$',
    appName: 'Opalopy',
    logoUrl: '',
    poweredByLogoUrl: undefined,
    customLabels: {},
    candidateSources: ['LinkedIn', 'Referencia', 'Sitio web', 'Otro'], // Valores por defecto en español
    ...getLocationData(), // Carga provincias y distritos desde locationData.ts
};

// Datos iniciales vacíos - Las integraciones de formularios se configurarán desde la interfaz
export const initialFormIntegrations: FormIntegration[] = [];

// Datos iniciales vacíos - Los eventos de entrevistas se crearán desde el calendario
export const initialInterviewEvents: InterviewEvent[] = [];