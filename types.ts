// Populated the `types.ts` file with type definitions based on their usage across the application. This resolves multiple "Cannot find name" and "is not a module" errors.
export type UserRole = 'admin' | 'recruiter' | 'viewer';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
}

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

export interface CandidateHistory {
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
    history: CandidateHistory[];
    attachments: Attachment[];
    notes?: string;
    source?: 'LinkedIn' | 'Referral' | 'Website' | 'Other';
    salaryExpectation?: string;
    age?: number;
    dni?: string;
    linkedinUrl?: string;
    socials?: {
        github?: string;
        portfolio?: string;
    };
}

export interface Form {
    id: string;
    name: string;
    processId: string;
}

export interface Application {
    id: string;
    candidateName: string;
    candidateEmail: string;
    formId: string;
    submittedAt: string;
    answers: Record<string, string>;
}

export interface AppSettings {
    database: {
        apiUrl: string;
        apiToken: string;
    };
    fileStorage: {
        provider: 'Google Drive' | 'None';
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