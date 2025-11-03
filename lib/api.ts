
import { Process, Candidate, User, Form, Application } from '../types';
import { initialProcesses, initialCandidates, initialUsers, initialForms, initialApplications } from './data';

const getFromStorage = <T>(key: string, fallback: T): T => {
    try {
        const item = localStorage.getItem(key);
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
    addCandidate: async (candidateData: Omit<Candidate, 'id' | 'history'>): Promise<Candidate> => {
        await delay(300);
        const candidates = await api.getCandidates();
        const newCandidate: Candidate = { 
            ...candidateData, 
            id: `candidate-${Date.now()}`,
            history: [{ stageId: candidateData.stageId, movedAt: new Date().toISOString() }]
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
    
    getUsers: async (): Promise<User[]> => {
        await delay(300);
        return getFromStorage('users', initialUsers);
    },
    getForms: async (): Promise<Form[]> => {
        await delay(300);
        return getFromStorage('forms', initialForms);
    },
    getApplications: async (): Promise<Application[]> => {
        await delay(300);
        return getFromStorage('applications', initialApplications);
    },
};
