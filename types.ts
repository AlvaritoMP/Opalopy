export type UserRole = 'admin' | 'recruiter' | 'viewer' | 'client';

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
    description?: string;
    history: CandidateHistory[];
    attachments: Attachment[];
    notes?: string;
    source?: 'LinkedIn' | 'Referral' | 'Website' | 'Other';
    salaryExpectation?: string;
    age?: number;
    dni?: string;
    linkedinUrl?: string;
    address?: string;
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
    currencySymbol?: string;
    appName?: string;
    logoUrl?: string;
    customLabels?: Record<string, string>;
}

export interface FormIntegration {
    id: string;
    platform: 'Tally' | 'Google Forms' | 'Microsoft Forms';
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
}