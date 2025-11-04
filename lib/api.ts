
import { Process, Candidate, User, Form, Application, AppSettings, FormIntegration, UserRole, InterviewEvent } from '../types';
import { initialProcesses, initialCandidates, initialUsers, initialForms, initialApplications, initialSettings, initialFormIntegrations, initialInterviewEvents } from './data';

const getFromStorage = <T>(key: string, fallback: T): T => {
    try {
        const item = localStorage.getItem(key);
        // Date strings need to be converted back to Date objects
        if (item && (key === 'interview_events' || key === 'candidates')) {
             const data = JSON.parse(item);
             if (key === 'interview_events') {
                return data.map((event: any) => ({...event, start: new Date(event.start), end: new Date(event.end)})) as T;
             }
             return data;
        }
        return item ? JSON.parse(item) : fallback;
    } catch (e) {
        console.error(`Failed to parse ${key} from localStorage`, e);
        return fallback;
    }
};

const saveToStorage = <T>(key: string, data: T) => {
    localStorage.setItem(key, JSON.stringify(data));
};


// Simulate API latency
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));


export const api = {
    // Processes
    getProcesses: async (): Promise<Process[]> => {
        await delay(300);
        return getFromStorage('processes', initialProcesses);
    },
    addProcess: async (processData: Omit<Process, 'id'>): Promise<Process> => {
        await delay(300);
        const processes = await api.getProcesses();
        const newProcess: Process = { ...processData, id: `process-${Date.now()}` };
        saveToStorage('processes', [...processes, newProcess]);
        return newProcess;
    },
    updateProcess: async (updatedProcess: Process): Promise<Process> => {
        await delay(300);
        let processes = await api.getProcesses();
        processes = processes.map(p => p.id === updatedProcess.id ? updatedProcess : p);
        saveToStorage('processes', processes);
        return updatedProcess;
    },
    deleteProcess: async (processId: string): Promise<void> => {
        await delay(300);
        let processes = await api.getProcesses();
        processes = processes.filter(p => p.id !== processId);
        saveToStorage('processes', processes);

        // Also delete candidates associated with this process
        let candidates = await api.getCandidates();
        candidates = candidates.filter(c => c.processId !== processId);
        saveToStorage('candidates', candidates);
    },

    // Candidates
    getCandidates: async (): Promise<Candidate[]> => {
        await delay(300);
        return getFromStorage('candidates', initialCandidates);
    },
    addCandidate: async (candidateData: Omit<Candidate, 'id' | 'history'>, addedBy: string): Promise<Candidate> => {
        await delay(300);
        const candidates = await api.getCandidates();
        const newCandidate: Candidate = { 
            ...candidateData, 
            id: `candidate-${Date.now()}`,
            history: [{ stageId: candidateData.stageId, movedAt: new Date().toISOString(), movedBy: addedBy }]
        };
        saveToStorage('candidates', [...candidates, newCandidate]);
        return newCandidate;
    },
    updateCandidate: async (updatedCandidate: Candidate): Promise<Candidate> => {
        await delay(300);
        let candidates = await api.getCandidates();
        candidates = candidates.map(c => c.id === updatedCandidate.id ? updatedCandidate : c);
        saveToStorage('candidates', candidates);
        return updatedCandidate;
    },
    
    // Users
    getUsers: async (): Promise<User[]> => {
        await delay(300);
        return getFromStorage('users', initialUsers);
    },
    addUser: async (userData: Omit<User, 'id'>): Promise<User> => {
        await delay(300);
        const users = await api.getUsers();
        const newUser: User = { ...userData, id: `user-${Date.now()}`};
        saveToStorage('users', [...users, newUser]);
        return newUser;
    },
    updateUser: async (updatedUser: User): Promise<User> => {
        await delay(300);
        let users = await api.getUsers();
        users = users.map(u => u.id === updatedUser.id ? updatedUser : u);
        saveToStorage('users', users);
        return updatedUser;
    },
    deleteUser: async (userId: string): Promise<void> => {
        await delay(300);
        let users = await api.getUsers();
        users = users.filter(u => u.id !== userId);
        saveToStorage('users', users);
    },

    getForms: async (): Promise<Form[]> => {
        await delay(300);
        return getFromStorage('forms', initialForms);
    },
    getApplications: async (): Promise<Application[]> => {
        await delay(300);
        return getFromStorage('applications', initialApplications);
    },

    // Settings
    getSettings: async (): Promise<AppSettings> => {
        await delay(100);
        return getFromStorage('settings', initialSettings);
    },
    saveSettings: async (settings: AppSettings): Promise<AppSettings> => {
        await delay(300);
        saveToStorage('settings', settings);
        return settings;
    },

    // Form Integrations
    getFormIntegrations: async (): Promise<FormIntegration[]> => {
        await delay(200);
        return getFromStorage('form_integrations', initialFormIntegrations);
    },
    addFormIntegration: async (integrationData: Omit<FormIntegration, 'id' | 'webhookUrl'>): Promise<FormIntegration> => {
        await delay(300);
        const integrations = await api.getFormIntegrations();
        const newIntegration: FormIntegration = { 
            ...integrationData, 
            id: `fi-${Date.now()}`,
            webhookUrl: `https://ats-pro.app/api/webhooks/${integrationData.platform.toLowerCase().replace(' ','')}/${Date.now()}`
        };
        saveToStorage('form_integrations', [...integrations, newIntegration]);
        return newIntegration;
    },
    deleteFormIntegration: async (integrationId: string): Promise<void> => {
        await delay(300);
        let integrations = await api.getFormIntegrations();
        integrations = integrations.filter(i => i.id !== integrationId);
        saveToStorage('form_integrations', integrations);
    },

    // Interview Events
    getInterviewEvents: async (): Promise<InterviewEvent[]> => {
        await delay(200);
        return getFromStorage('interview_events', initialInterviewEvents);
    },
    addInterviewEvent: async (eventData: Omit<InterviewEvent, 'id'>): Promise<InterviewEvent> => {
        await delay(300);
        const events = await api.getInterviewEvents();
        const newEvent: InterviewEvent = { ...eventData, id: `event-${Date.now()}` };
        saveToStorage('interview_events', [...events, newEvent]);
        return newEvent;
    },
    updateInterviewEvent: async (updatedEvent: InterviewEvent): Promise<InterviewEvent> => {
        await delay(300);
        let events = await api.getInterviewEvents();
        events = events.map(e => e.id === updatedEvent.id ? updatedEvent : e);
        saveToStorage('interview_events', events);
        return updatedEvent;
    },
    deleteInterviewEvent: async (eventId: string): Promise<void> => {
        await delay(300);
        let events = await api.getInterviewEvents();
        events = events.filter(e => e.id !== eventId);
        saveToStorage('interview_events', events);
    },
};