
export interface Stage {
    id: string;
    name: string;
}

export interface Process {
    id:string;
    title: string;
    description: string;
    stages: Stage[];
}

export interface CandidateHistory {
    stageId: string;
    movedAt: string; // ISO date string
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
    notes?: string;
    resumeUrl?: string;
}

export type UserRole = 'admin' | 'recruiter' | 'viewer';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
}

export interface ApiSettings {
    apiKey: string;
}

export type FormFieldType = 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file';

export interface FormField {
    id: string;
    label: string;
    type: FormFieldType;
    options?: string[];
    required: boolean;
}

export interface Form {
    id: string;
    title: string;
    description: string;
    fields: FormField[];
    processId: string; // Link form to a process
}

export interface Application {
    id: string;
    candidateId: string;
    formId: string;
    answers: Record<string, string | boolean | string[]>; // field.id -> answer
    submittedAt: string;
}
