import { Process, Candidate, User, Form, Application, AppSettings, FormIntegration } from '../types';

export const initialProcesses: Process[] = [
    {
        id: 'process-1',
        title: 'Software Engineer (Frontend)',
        description: 'Hiring for a senior frontend developer to work on our main product.',
        stages: [
            { id: 'stage-1-1', name: 'Applied' },
            { id: 'stage-1-2', name: 'Screening' },
            { id: 'stage-1-3', name: 'Technical Interview' },
            { id: 'stage-1-4', name: 'Final Interview' },
            { id: 'stage-1-5', name: 'Offer' },
            { id: 'stage-1-6', name: 'Hired' },
        ],
    },
    {
        id: 'process-2',
        title: 'UX/UI Designer',
        description: 'Looking for a creative designer to join our growing design team.',
        stages: [
            { id: 'stage-2-1', name: 'Applied' },
            { id: 'stage-2-2', name: 'Portfolio Review' },
            { id: 'stage-2-3', name: 'Design Challenge' },
            { id: 'stage-2-4', name: 'Team Interview' },
            { id: 'stage-2-5', name: 'Hired' },
        ],
    },
];

export const initialCandidates: Candidate[] = [
    {
        id: 'candidate-1',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        avatarUrl: 'https://images.unsplash.com/photo-1521119989659-a83eee488004?q=80&w=400',
        processId: 'process-1',
        stageId: 'stage-1-3',
        history: [
            { stageId: 'stage-1-1', movedAt: '2023-10-01T10:00:00Z', movedBy: 'System' },
            { stageId: 'stage-1-2', movedAt: '2023-10-03T14:00:00Z', movedBy: 'Recruiter Rick' },
            { stageId: 'stage-1-3', movedAt: '2023-10-10T11:00:00Z', movedBy: 'Super Admin' },
        ],
        notes: "Strong React skills. Impressive portfolio project.",
        attachments: [
            { id: 'file-1', name: 'alice_johnson_resume.pdf', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', type: 'application/pdf', size: 123456 },
            { id: 'file-2', name: 'portfolio_preview.png', url: 'https://images.unsplash.com/photo-1580927752452-89d86da3fa0a?q=80&w=800', type: 'image/png', size: 78910 }
        ]
    },
    {
        id: 'candidate-2',
        name: 'Bob Williams',
        email: 'bob@example.com',
        processId: 'process-1',
        stageId: 'stage-1-2',
        history: [
            { stageId: 'stage-1-1', movedAt: '2023-10-02T09:00:00Z', movedBy: 'System' },
            { stageId: 'stage-1-2', movedAt: '2023-10-04T16:00:00Z', movedBy: 'Recruiter Rick' },
        ],
        notes: "",
        attachments: [],
    },
    {
        id: 'candidate-3',
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        processId: 'process-2',
        stageId: 'stage-2-2',
        history: [
            { stageId: 'stage-2-1', movedAt: '2023-10-05T12:00:00Z', movedBy: 'System' },
            { stageId: 'stage-2-2', movedAt: '2023-10-08T17:00:00Z', movedBy: 'Super Admin' },
        ],
        notes: "Excellent eye for detail in their portfolio.",
        attachments: [],
    },
    {
        id: 'candidate-4',
        name: 'Diana Prince',
        email: 'diana@example.com',
        processId: 'process-1',
        stageId: 'stage-1-6',
        history: [
            { stageId: 'stage-1-1', movedAt: '2023-09-15T10:00:00Z', movedBy: 'System' },
            { stageId: 'stage-1-2', movedAt: '2023-09-18T14:00:00Z', movedBy: 'Recruiter Rick' },
            { stageId: 'stage-1-3', movedAt: '2023-09-22T11:00:00Z', movedBy: 'Super Admin' },
            { stageId: 'stage-1-4', movedAt: '2023-09-28T11:00:00Z', movedBy: 'Super Admin' },
            { stageId: 'stage-1-5', movedAt: '2023-10-02T11:00:00Z', movedBy: 'Super Admin' },
            { stageId: 'stage-1-6', movedAt: '2023-10-05T11:00:00Z', movedBy: 'Super Admin' },
        ],
        notes: "Accepted the offer!",
        attachments: [],
    },
];

export const initialUsers: User[] = [
    { id: 'user-1', name: 'Super Admin', email: 'admin@ats.com', role: 'admin' },
    { id: 'user-2', name: 'Recruiter Rick', email: 'rick@ats.com', role: 'recruiter' },
    { id: 'user-3', name: 'Viewer Vera', email: 'vera@ats.com', role: 'viewer' },
];

export const initialForms: Form[] = [];
export const initialApplications: Application[] = [];

export const initialSettings: AppSettings = {
    database: {
        type: 'mock',
        apiUrl: '',
        apiToken: '',
    },
    fileStorage: {
        type: 'local',
        connected: false,
    },
};

export const initialFormIntegrations: FormIntegration[] = [
    {
        id: 'fi-1',
        platform: 'Tally',
        formName: 'Frontend Developer Application',
        formIdOrUrl: 'w1gL9b',
        processId: 'process-1',
        webhookUrl: 'https://ats-pro.app/api/webhooks/tally/xyz123'
    }
];