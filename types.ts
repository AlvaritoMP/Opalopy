// types.ts

export interface Stage {
    id: string;
    name: string;
}

export interface Attachment {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
}

export type ProcessStatus = 'en_proceso' | 'standby' | 'terminado';

export interface Process {
    id: string;
    title: string;
    description: string;
    stages: Stage[];
    salaryRange?: string;
    experienceLevel?: string;
    seniority?: string;
    flyerUrl?: string;
    attachments: Attachment[];
    serviceOrderCode?: string;
    startDate?: string;
    endDate?: string;
    status: ProcessStatus;
    vacancies: number;
}

export interface CandidateHistory {
    stageId: string;
    movedAt: string;
    movedBy: string;
}

export type CandidateSource = 'LinkedIn' | 'Referral' | 'Website' | 'Other';

export interface PostIt {
    id: string;
    text: string;
    color: 'yellow' | 'pink' | 'blue' | 'green' | 'orange';
    createdBy: string; // userId
    createdAt: string; // ISO date string
}

export interface Comment {
    id: string;
    text: string;
    userId: string; // userId del usuario que hizo el comentario
    createdAt: string; // ISO date string
    attachments?: Attachment[]; // Fotos o capturas de pantalla
}

export interface Candidate {
    id: string;
    name: string;
    email: string;
    phone?: string;
    processId: string;
    stageId: string;
    description?: string;
    history: CandidateHistory[];
    avatarUrl?: string;
    attachments: Attachment[];
    source?: CandidateSource | string;
    salaryExpectation?: string;
    age?: number;
    dni?: string;
    linkedinUrl?: string;
    address?: string;
    postIts?: PostIt[]; // Post-its para el board
    comments?: Comment[]; // Comentarios/chat sobre el candidato
    archived?: boolean;
    archivedAt?: string;
    hireDate?: string;
}

export type UserRole = 'admin' | 'recruiter' | 'client' | 'viewer';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    password?: string;
    avatarUrl?: string;
}

// Basic definitions for unused types to satisfy compiler
export interface Form {
    id: string;
    name: string;
}

export interface Application {
    id: string;
    candidateId: string;
    processId: string;
}

export interface AppSettings {
    database: {
        apiUrl: string;
        apiToken: string;
    };
    fileStorage: {
        provider: string;
        connected: boolean;
    };
    currencySymbol: string;
    appName: string;
    logoUrl: string;
    customLabels: { [key: string]: string };
}

export interface FormIntegration {
    id: string;
    platform: 'Tally' | 'Google Forms' | 'Microsoft Forms' | string;
    formName: string;
    formIdOrUrl: string;
    processId: string;
    webhookUrl: string;
}

export interface InterviewEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    candidateId: string;
    interviewerId: string;
    notes?: string;
    attendeeEmails?: string[]; // Emails de los asistentes a la reunión
}