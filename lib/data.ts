// Populated `lib/data.ts` with initial seed data for processes, candidates, users, and settings. This provides default content for the application on first load and resolves module-related errors.
import { Process, Candidate, User, Form, Application, AppSettings, FormIntegration, InterviewEvent } from '../types';

export const initialProcesses: Process[] = [
    {
        id: 'process-1',
        title: 'Senior Frontend Engineer',
        description: 'Looking for an experienced frontend engineer to join our team. Must be proficient in React, TypeScript, and Tailwind CSS.',
        stages: [
            { id: 'stage-1-1', name: 'Applied' },
            { id: 'stage-1-2', name: 'Screening' },
            { id: 'stage-1-3', name: 'Technical Interview' },
            { id: 'stage-1-4', name: 'Final Interview' },
            { id: 'stage-1-5', name: 'Offer' },
            { id: 'stage-1-6', name: 'Hired' },
        ],
        salaryRange: '$120k - $150k',
        experienceLevel: '5+ Years',
        seniority: 'Senior',
        flyerUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c7da?w=800',
        attachments: [],
        serviceOrderCode: 'OS-2024-FE01',
    },
    {
        id: 'process-2',
        title: 'UX/UI Designer',
        description: 'Creative and talented UX/UI designer needed to create amazing user experiences.',
        stages: [
            { id: 'stage-2-1', name: 'Applied' },
            { id: 'stage-2-2', name: 'Portfolio Review' },
            { id: 'stage-2-3', name: 'Design Challenge' },
            { id: 'stage-2-4', name: 'Interview' },
            { id: 'stage-2-5', name: 'Offer' },
        ],
        salaryRange: '$90k - $110k',
        experienceLevel: '3+ Years',
        seniority: 'Mid-Level',
        flyerUrl: 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=800',
        attachments: [],
    }
];

export const initialCandidates: Candidate[] = [
    {
        id: 'candidate-1',
        name: 'Alice Johnson',
        email: 'alice.j@example.com',
        phone: '123-456-7890',
        processId: 'process-1',
        stageId: 'stage-1-3',
        description: 'Highly skilled frontend developer with over 8 years of experience in building scalable and responsive web applications. Expert in React, Redux, and modern JavaScript frameworks. Proven ability to lead projects and mentor junior developers.',
        history: [
            { stageId: 'stage-1-1', movedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), movedBy: 'System' },
            { stageId: 'stage-1-2', movedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), movedBy: 'John Doe' },
            { stageId: 'stage-1-3', movedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), movedBy: 'Jane Smith' },
        ],
        avatarUrl: 'https://i.pravatar.cc/150?u=alice',
        attachments: [{
            id: 'att-1',
            name: 'Alice_Johnson_Resume.pdf',
            url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            type: 'application/pdf',
            size: 13264
        }],
        source: 'LinkedIn',
        salaryExpectation: '$140,000',
        age: 32,
        dni: '12345678A',
        linkedinUrl: 'https://linkedin.com/in/alicejohnson',
        address: 'New York, NY'
    },
    {
        id: 'candidate-2',
        name: 'Bob Williams',
        email: 'bob.w@example.com',
        phone: '234-567-8901',
        processId: 'process-1',
        stageId: 'stage-1-2',
        history: [
            { stageId: 'stage-1-1', movedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), movedBy: 'System' },
            { stageId: 'stage-1-2', movedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), movedBy: 'John Doe' },
        ],
        avatarUrl: 'https://i.pravatar.cc/150?u=bob',
        attachments: [],
        source: 'Referral',
        salaryExpectation: '$130,000',
        age: 28,
        dni: '87654321B',
        linkedinUrl: 'https://linkedin.com/in/bobwilliams',
        address: 'San Francisco, CA'
    },
    {
        id: 'candidate-3',
        name: 'Charlie Brown',
        email: 'charlie.b@example.com',
        phone: '345-678-9012',
        processId: 'process-2',
        stageId: 'stage-2-1',
        history: [
            { stageId: 'stage-2-1', movedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), movedBy: 'System' },
        ],
        avatarUrl: 'https://i.pravatar.cc/150?u=charlie',
        attachments: [],
        source: 'Website',
        salaryExpectation: '$100,000',
        age: 29,
        dni: '45678912C',
        linkedinUrl: 'https://linkedin.com/in/charliebrown',
        address: 'Austin, TX'
    },
     {
        id: 'candidate-4',
        name: 'Diana Prince',
        email: 'diana.p@example.com',
        phone: '456-789-0123',
        processId: 'process-2',
        stageId: 'stage-2-2',
        history: [
            { stageId: 'stage-2-1', movedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), movedBy: 'System' },
            { stageId: 'stage-2-2', movedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), movedBy: 'Jane Smith' },
        ],
        avatarUrl: 'https://i.pravatar.cc/150?u=diana',
        attachments: [],
        source: 'LinkedIn',
        salaryExpectation: '$110,000',
        age: 35,
        dni: '78912345D',
        linkedinUrl: 'https://linkedin.com/in/dianaprince',
        address: 'Chicago, IL'
    },
];

export const initialUsers: User[] = [
    { id: 'user-1', name: 'Super Admin', email: 'admin@ats.com', role: 'admin' },
    { id: 'user-2', name: 'John Doe', email: 'john.d@ats.com', role: 'recruiter' },
    { id: 'user-3', name: 'Jane Smith', email: 'jane.s@ats.com', role: 'recruiter' },
    { id: 'user-4', name: 'Peter Jones', email: 'peter.j@ats.com', role: 'viewer' },
    { id: 'user-5', name: 'Hiring Manager', email: 'manager@client.com', role: 'client' },
];

export const initialForms: Form[] = [];
export const initialApplications: Application[] = [];

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
    appName: 'ATS Pro',
    logoUrl: '',
    customLabels: {},
};

export const initialFormIntegrations: FormIntegration[] = [
    {
        id: 'fi-1',
        platform: 'Tally',
        formName: 'Senior FE Application (Tally)',
        formIdOrUrl: 'https://tally.so/r/some-form',
        processId: 'process-1',
        webhookUrl: 'https://ats-pro.app/api/webhooks/tally/12345'
    }
];

const today = new Date();
export const initialInterviewEvents: InterviewEvent[] = [
    {
        id: 'event-1',
        title: 'Tech Interview with Alice Johnson',
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 10, 0),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 11, 0),
        candidateId: 'candidate-1',
        interviewerId: 'user-2',
        notes: 'Focus on React hooks and state management.'
    },
    {
        id: 'event-2',
        title: 'Portfolio Review with Diana Prince',
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 14, 0),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 14, 45),
        candidateId: 'candidate-4',
        interviewerId: 'user-3',
        notes: 'Discuss her latest design project.'
    }
];