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

export interface Process {
    id: string;
    title: string;
    description: string;
    stages: Stage[];
    salaryRange?: string;
    experienceLevel?: string;
    seniority?: string;
    startDate?: string;
    endDate?: string;
    flyerUrl?: string;
    attachments: Attachment[];
}

export interface StageHistory {
    stageId: string;
    movedAt: string;
    movedBy: string;
}

export interface Candidate {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    processId: string;
    stageId: string;
    attachments: Attachment[];
    notes?: string;
    history: StageHistory[];
}

export type UserRole = 'admin' | 'recruiter' | 'viewer';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
}

export interface Form {
    id: string;
    title: string;
    fields: { id: string; label: string; type: string }[];
}

export interface Application {
    id: string;
    candidateId: string;
    formId: string;
    submittedAt: string;
    answers: { fieldId: string; answer: any }[];
}

export interface AppSettings {
    database: {
        apiUrl: string;
        apiToken: string;
    };
    fileStorage: {
        provider: 'Google Drive';
        connected: boolean;
    };
}

export interface FormIntegration {
    id: string;
    platform: 'Tally' | 'Google Forms' | 'Microsoft Forms';
    formName: string;
    formIdOrUrl: string;
    processId: string;
    webhookUrl: string;
}