import { Process, Candidate, User, Form, Application, AppSettings, FormIntegration } from '../types';

export const initialStages = [
    { id: 'stage-1', name: 'Applied' },
    { id: 'stage-2', name: 'Screening' },
    { id: 'stage-3', name: 'Technical Interview' },
    { id: 'stage-4', name: 'HR Interview' },
    { id: 'stage-5', name: 'Offer' },
    { id: 'stage-6', name: 'Hired' },
];

export const initialProcesses: Process[] = [
    {
        id: 'process-1',
        title: 'Senior Frontend Engineer',
        description: 'Hiring for a senior frontend engineer to work on our main product.',
        stages: initialStages,
        salaryRange: '$120k - $150k',
        experienceLevel: '5+ Years',
        seniority: 'Senior',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        flyerUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1632&q=80',
        attachments: [
            { id: 'att-p1-1', name: 'Job Description.pdf', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', type: 'application/pdf', size: 13264 }
        ],
    },
    {
        id: 'process-2',
        title: 'UX/UI Designer',
        description: 'Hiring for a designer to improve our user experience.',
        attachments: [],
        stages: [
            { id: 'stage-d-1', name: 'Application Review' },
            { id: 'stage-d-2', name: 'Portfolio Review' },
            { id: 'stage-d-3', name: 'Design Challenge' },
            { id: 'stage-d-4', name: 'Final Interview' },
            { id: 'stage-d-5', name: 'Offer' },
        ],
    },
];

export const initialCandidates: Candidate[] = [
    {
        id: 'candidate-1',
        name: 'Alice Johnson',
        email: 'alice.j@example.com',
        phone: '123-456-7890',
        processId: 'process-1',
        stageId: 'stage-1',
        attachments: [
             { id: 'att-c1-1', name: 'Resume_Alice_Johnson.pdf', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', type: 'application/pdf', size: 13264 }
        ],
        notes: 'Promising candidate with strong React experience.',
        history: [{ stageId: 'stage-1', movedAt: new Date().toISOString(), movedBy: 'System' }],
        avatarUrl: 'https://i.pravatar.cc/150?u=alice'
    },
    {
        id: 'candidate-2',
        name: 'Bob Williams',
        email: 'bob.w@example.com',
        processId: 'process-1',
        stageId: 'stage-2',
        attachments: [],
        history: [
            { stageId: 'stage-1', movedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), movedBy: 'System' },
            { stageId: 'stage-2', movedAt: new Date().toISOString(), movedBy: 'Super Admin' },
        ],
        avatarUrl: 'https://i.pravatar.cc/150?u=bob'
    },
    {
        id: 'candidate-3',
        name: 'Charlie Brown',
        email: 'charlie.b@example.com',
        processId: 'process-2',
        stageId: 'stage-d-2',
        attachments: [],
        history: [
            { stageId: 'stage-d-1', movedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), movedBy: 'System' },
            { stageId: 'stage-d-2', movedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), movedBy: 'Recruiter Jane' },
        ],
        avatarUrl: 'https://i.pravatar.cc/150?u=charlie'
    },
];

export const initialUsers: User[] = [
    { id: 'user-1', name: 'Super Admin', email: 'admin@ats.com', role: 'admin' },
    { id: 'user-2', name: 'Recruiter Jane', email: 'jane@ats.com', role: 'recruiter' },
    { id: 'user-3', name: 'Hiring Manager Mike', email: 'mike@ats.com', role: 'viewer' },
];

export const initialForms: Form[] = [];
export const initialApplications: Application[] = [];

export const initialSettings: AppSettings = {
    database: {
        apiUrl: '',
        apiToken: '',
    },
    fileStorage: {
        provider: 'Google Drive',
        connected: false,
    },
};

export const initialFormIntegrations: FormIntegration[] = [];