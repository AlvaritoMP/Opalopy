import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { initialProcesses, initialCandidates, initialUsers, initialSettings, initialFormIntegrations, initialInterviewEvents } from './lib/data';
import { Process, Candidate, User, AppSettings, FormIntegration, InterviewEvent, CandidateHistory, Application, PostIt, Comment } from './types';
import { getSettings, saveSettings as saveSettingsToStorage } from './lib/settings';
import { Dashboard } from './components/Dashboard';
import { ProcessList } from './components/ProcessList';
import { ProcessView } from './components/ProcessView';
import { ReportsView } from './components/ReportsView';
import { Settings } from './components/Settings';
import { Users } from './components/Users';
import { Forms } from './components/Forms';
import { CalendarView } from './components/CalendarView';
import { BulkImportView } from './components/BulkImportView';
import { Spinner } from './components/Spinner';
import { ArchivedCandidates } from './components/ArchivedCandidates';
import { LayoutDashboard, Briefcase, FileText, Settings as SettingsIcon, Users as UsersIcon, ChevronsLeft, ChevronsRight, BarChart2, Calendar, FileUp, LogOut, X, Archive } from 'lucide-react';


// State and Actions types
interface AppState {
    processes: Process[];
    candidates: Candidate[];
    users: User[];
    applications: Application[];
    settings: AppSettings | null;
    formIntegrations: FormIntegration[];
    interviewEvents: InterviewEvent[];
    currentUser: User | null;
    view: { type: string; payload?: any };
    loading: boolean;
}

interface AppActions {
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    addProcess: (processData: Omit<Process, 'id'>) => Promise<void>;
    updateProcess: (processData: Process) => Promise<void>;
    deleteProcess: (processId: string) => Promise<void>;
    addCandidate: (candidateData: Omit<Candidate, 'id' | 'history'>) => Promise<void>;
    updateCandidate: (candidateData: Candidate, movedBy?: string) => Promise<void>;
    deleteCandidate: (candidateId: string) => Promise<void>;
    moveCandidateToProcess: (candidateId: string, targetProcessId: string) => Promise<void>;
    duplicateCandidateToProcess: (candidateId: string, targetProcessId: string) => Promise<void>;
    addUser: (userData: Omit<User, 'id'>) => Promise<void>;
    updateUser: (userData: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    saveSettings: (settings: AppSettings) => Promise<void>;
    addFormIntegration: (integrationData: Omit<FormIntegration, 'id' | 'webhookUrl'>) => Promise<void>;
    deleteFormIntegration: (integrationId: string) => Promise<void>;
    addInterviewEvent: (eventData: Omit<InterviewEvent, 'id'>) => Promise<void>;
    updateInterviewEvent: (eventData: InterviewEvent) => Promise<void>;
    deleteInterviewEvent: (eventId: string) => Promise<void>;
    addPostIt: (candidateId: string, postIt: Omit<PostIt, 'id' | 'createdAt'>) => Promise<void>;
    deletePostIt: (candidateId: string, postItId: string) => Promise<void>;
    addComment: (candidateId: string, comment: Omit<Comment, 'id' | 'createdAt'>) => Promise<void>;
    deleteComment: (candidateId: string, commentId: string) => Promise<void>;
    archiveCandidate: (candidateId: string) => Promise<void>;
    restoreCandidate: (candidateId: string) => Promise<void>;
    setView: (type: string, payload?: any) => void;
}

interface AppContextType {
    state: AppState;
    actions: AppActions;
    getLabel: (key: string, fallback: string) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const ForgotPasswordModal: React.FC<{onClose: () => void}> = ({ onClose }) => {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    const handleSendLink = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage('');

        // Simulate API call
        setTimeout(() => {
            setMessage('If an account with this email exists, a password reset link has been sent.');
            setIsSubmitting(false);
        }, 1500);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-xl shadow-lg relative">
                 <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full hover:bg-gray-100"><X className="w-5 h-5"/></button>
                 <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
                    <p className="mt-2 text-sm text-gray-600">Enter your email to receive a reset link.</p>
                </div>

                {message ? (
                    <div className="text-center p-4 bg-green-50 text-green-700 rounded-md">
                        {message}
                    </div>
                ) : (
                    <form className="space-y-6" onSubmit={handleSendLink}>
                        <div>
                            <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700">Email Address</label>
                            <input
                                id="reset-email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                        <div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300"
                            >
                                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

const LoginPage: React.FC = () => {
    const { state, actions } = useAppState();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoggingIn(true);
        const success = await actions.login(email, password);
        if (!success) {
            setError('Invalid credentials. Please try again.');
        }
        setIsLoggingIn(false);
    };

    return (
        <>
            <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
                <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-xl shadow-lg">
                    <div className="text-center">
                        {state.settings?.logoUrl && <img src={state.settings.logoUrl} alt="Logo" className="h-12 mx-auto mb-4 object-contain" />}
                        <h1 className="text-3xl font-bold text-gray-900">{state.settings?.appName || 'ATS Pro'}</h1>
                        <p className="mt-2 text-sm text-gray-600">Please sign in to your account</p>
                    </div>
                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between">
                                <label htmlFor="password"className="block text-sm font-medium text-gray-700">Password</label>
                                <div className="text-sm">
                                    <a href="#" onClick={(e) => { e.preventDefault(); setIsForgotPasswordOpen(true); }} className="font-medium text-primary-600 hover:text-primary-500">
                                        Forgot your password?
                                    </a>
                                </div>
                            </div>
                             <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>
                        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                        <div>
                            <button
                                type="submit"
                                disabled={isLoggingIn}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300"
                            >
                                {isLoggingIn ? 'Signing In...' : 'Sign In'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            {isForgotPasswordOpen && <ForgotPasswordModal onClose={() => setIsForgotPasswordOpen(false)} />}
        </>
    );
};

// --- Sidebar Components (defined in App.tsx to avoid creating new files) ---
const NavItem: React.FC<{
    icon: React.ElementType,
    label: string,
    view: string,
    currentView: string,
    setView: (view: string) => void,
    isCollapsed: boolean,
}> = ({ icon: Icon, label, view, currentView, setView, isCollapsed }) => {
    const isActive = currentView === view;
    return (
        <button
            onClick={() => setView(view)}
            className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
            } ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? label : undefined}
        >
            <Icon className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
            {!isCollapsed && label}
        </button>
    );
};

const Sidebar: React.FC = () => {
    const { state, actions, getLabel } = useAppState();
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    
    if (!state.currentUser) return null;

    return (
        <div className={`flex flex-col bg-white border-r transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
            <div className={`flex items-center border-b p-4 h-16 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                {!isCollapsed && (
                     <div className="flex items-center overflow-hidden">
                        {state.settings?.logoUrl && <img src={state.settings.logoUrl} alt="Logo" className="h-8 mr-2 object-contain" />}
                        <span className="font-bold text-xl text-gray-800 truncate">{state.settings?.appName || 'ATS Pro'}</span>
                    </div>
                )}
                <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-2 rounded-md hover:bg-gray-100 flex-shrink-0">
                    {isCollapsed ? <ChevronsRight className="w-5 h-5 text-gray-600" /> : <ChevronsLeft className="w-5 h-5 text-gray-600" />}
                </button>
            </div>
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                <NavItem icon={LayoutDashboard} label={getLabel('sidebar_dashboard', 'Panel')} view="dashboard" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
                <NavItem icon={Briefcase} label={getLabel('sidebar_processes', 'Procesos')} view="processes" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
                <NavItem icon={Archive} label={getLabel('sidebar_archived', 'Archivados')} view="archived" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
                <NavItem icon={FileText} label={getLabel('sidebar_forms', 'Formularios')} view="forms" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
                <NavItem icon={Calendar} label={getLabel('sidebar_calendar', 'Calendario')} view="calendar" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
                <NavItem icon={BarChart2} label={getLabel('sidebar_reports', 'Reportes')} view="reports" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
                <NavItem icon={FileUp} label={getLabel('sidebar_bulk_import', 'Importación Masiva')} view="bulk-import" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
            </nav>
            <div className="p-2 border-t space-y-2">
                 <div className="p-2">
                    <NavItem icon={UsersIcon} label={getLabel('sidebar_users', 'Usuarios')} view="users" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
                    <NavItem icon={SettingsIcon} label={getLabel('sidebar_settings', 'Configuración')} view="settings" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
                </div>
                 <div className="p-2 border-t">
                    <div className="flex items-center">
                        <div className={`overflow-hidden transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 flex-1'}`}>
                            <p className="font-semibold text-sm text-gray-800 truncate">{state.currentUser.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{state.currentUser.role}</p>
                        </div>
                        <button 
                            onClick={() => actions.logout()} 
                            className={`p-2 rounded-md hover:bg-red-100 hover:text-red-600 text-gray-500 transition-colors ${isCollapsed ? 'w-full' : 'ml-auto'}`}
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---

const App: React.FC = () => {
    const [state, setState] = useState<AppState>({
        processes: [],
        candidates: [],
        users: [],
        applications: [],
        settings: null,
        formIntegrations: [],
        interviewEvents: [],
        currentUser: null,
        view: { type: 'dashboard' },
        loading: true,
    });

    useEffect(() => {
        const loadedSettings = getSettings();
        const initialData = {
            processes: initialProcesses,
            candidates: initialCandidates,
            users: initialUsers,
            applications: [],
            settings: loadedSettings || initialSettings,
            formIntegrations: initialFormIntegrations,
            interviewEvents: initialInterviewEvents,
        };

        const sessionUserId = localStorage.getItem('ats_pro_user');
        const currentUser = sessionUserId ? initialUsers.find(u => u.id === sessionUserId) || null : null;

        setState({
            ...initialData,
            currentUser,
            view: { type: 'dashboard' },
            loading: false,
        });
    }, []);

    const actions: AppActions = useMemo(() => ({
        login: async (email, password) => {
            const user = state.users.find(u => u.email.toLowerCase() === email.toLowerCase());
            if (user && user.password === password) {
                localStorage.setItem('ats_pro_user', user.id);
                setState(s => ({ ...s, currentUser: user }));
                return true;
            }
            return false;
        },
        logout: () => {
            localStorage.removeItem('ats_pro_user');
            setState(s => ({ ...s, currentUser: null, view: { type: 'dashboard' } }));
        },
        setView: (type, payload) => setState(s => ({ ...s, view: { type, payload } })),
        saveSettings: async (settings) => {
            saveSettingsToStorage(settings);
            setState(s => ({ ...s, settings }));
        },
        addProcess: async (processData) => {
            const newProcess: Process = { ...processData, id: `proc-${Date.now()}`, attachments: processData.attachments || [] };
            setState(s => ({ ...s, processes: [...s.processes, newProcess] }));
        },
        updateProcess: async (processData) => {
            setState(s => ({ ...s, processes: s.processes.map(p => p.id === processData.id ? processData : p) }));
        },
        deleteProcess: async (processId) => {
            setState(s => ({
                ...s,
                processes: s.processes.filter(p => p.id !== processId),
                candidates: s.candidates.filter(c => c.processId !== processId),
            }));
        },
        addCandidate: async (candidateData) => {
            const newCandidate: Candidate = {
                ...candidateData,
                id: `cand-${Date.now()}`,
                history: [{
                    stageId: candidateData.stageId,
                    movedAt: new Date().toISOString(),
                    movedBy: state.currentUser?.name || 'System',
                }],
                archived: false,
            };
            setState(s => ({ ...s, candidates: [...s.candidates, newCandidate] }));
        },
        updateCandidate: async (candidateData, movedBy) => {
            setState(s => {
                const oldCandidate = s.candidates.find(c => c.id === candidateData.id);
                let newHistory: CandidateHistory[] = oldCandidate ? [...oldCandidate.history] : [];

                if (oldCandidate && oldCandidate.stageId !== candidateData.stageId) {
                    newHistory.push({
                        stageId: candidateData.stageId,
                        movedAt: new Date().toISOString(),
                        movedBy: movedBy || state.currentUser?.name || 'System',
                    });
                }
                const updatedCandidate = { ...candidateData, history: newHistory };
                return { ...s, candidates: s.candidates.map(c => c.id === candidateData.id ? updatedCandidate : c) };
            });
        },
        deleteCandidate: async (candidateId) => {
            setState(s => ({ ...s, candidates: s.candidates.filter(c => c.id !== candidateId) }));
        },
        moveCandidateToProcess: async (candidateId, targetProcessId) => {
            setState(s => {
                const candidate = s.candidates.find(c => c.id === candidateId);
                const targetProcess = s.processes.find(p => p.id === targetProcessId);

                if (!candidate || !targetProcess || !targetProcess.stages.length) return s;

                const firstStageId = targetProcess.stages[0].id;
                const movedBy = s.currentUser?.name || 'System';
                
                const updatedHistory = [
                    ...candidate.history,
                    {
                        stageId: firstStageId,
                        movedAt: new Date().toISOString(),
                        movedBy: `Moved from ${s.processes.find(p => p.id === candidate.processId)?.title || 'previous process'} by ${movedBy}`
                    }
                ];

                const updatedCandidate: Candidate = {
                    ...candidate,
                    processId: targetProcessId,
                    stageId: firstStageId,
                    history: updatedHistory
                };

                return { ...s, candidates: s.candidates.map(c => c.id === candidateId ? updatedCandidate : c) };
            });
        },
        duplicateCandidateToProcess: async (candidateId, targetProcessId) => {
            setState(s => {
                const originalCandidate = s.candidates.find(c => c.id === candidateId);
                const targetProcess = s.processes.find(p => p.id === targetProcessId);

                if (!originalCandidate || !targetProcess || !targetProcess.stages.length) return s;

                const firstStageId = targetProcess.stages[0].id;
                const movedBy = s.currentUser?.name || 'System';

                const newCandidate: Candidate = {
                    ...originalCandidate,
                    id: `cand-${Date.now()}`,
                    processId: targetProcessId,
                    stageId: firstStageId,
                    history: [{
                        stageId: firstStageId,
                        movedAt: new Date().toISOString(),
                        movedBy: `Duplicated from ${s.processes.find(p => p.id === originalCandidate.processId)?.title || 'another process'} by ${movedBy}`
                    }],
                    archived: false,
                };
                
                return { ...s, candidates: [...s.candidates, newCandidate] };
            });
        },
        addUser: async (userData) => {
            const newUser: User = { ...userData, id: `user-${Date.now()}` };
            setState(s => ({ ...s, users: [...s.users, newUser] }));
        },
        updateUser: async (userData) => {
            setState(s => ({ ...s, users: s.users.map(u => u.id === userData.id ? userData : u) }));
        },
        deleteUser: async (userId) => {
            setState(s => ({ ...s, users: s.users.filter(u => u.id !== userId) }));
        },
        addFormIntegration: async (integrationData) => {
            const newIntegration: FormIntegration = {
                ...integrationData,
                id: `fi-${Date.now()}`,
                webhookUrl: `https://example.com/webhook/${Date.now()}`
            };
            setState(s => ({ ...s, formIntegrations: [...s.formIntegrations, newIntegration] }));
        },
        deleteFormIntegration: async (integrationId) => {
            setState(s => ({ ...s, formIntegrations: s.formIntegrations.filter(fi => fi.id !== integrationId) }));
        },
        addInterviewEvent: async (eventData) => {
            const newEvent: InterviewEvent = { ...eventData, id: `evt-${Date.now()}` };
            setState(s => ({ ...s, interviewEvents: [...s.interviewEvents, newEvent] }));
        },
        updateInterviewEvent: async (eventData) => {
            setState(s => ({ ...s, interviewEvents: s.interviewEvents.map(e => e.id === eventData.id ? eventData : e) }));
        },
        deleteInterviewEvent: async (eventId) => {
            setState(s => ({ ...s, interviewEvents: s.interviewEvents.filter(e => e.id !== eventId) }));
        },
        addPostIt: async (candidateId, postItData) => {
            setState(s => {
                const candidate = s.candidates.find(c => c.id === candidateId);
                if (!candidate) return s;
                
                const newPostIt: PostIt = {
                    ...postItData,
                    id: `postit-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                };
                
                const updatedPostIts = [...(candidate.postIts || []), newPostIt];
                const updatedCandidate = { ...candidate, postIts: updatedPostIts };
                
                return { ...s, candidates: s.candidates.map(c => c.id === candidateId ? updatedCandidate : c) };
            });
        },
        deletePostIt: async (candidateId, postItId) => {
            setState(s => {
                const candidate = s.candidates.find(c => c.id === candidateId);
                if (!candidate) return s;
                
                const updatedPostIts = (candidate.postIts || []).filter(p => p.id !== postItId);
                const updatedCandidate = { ...candidate, postIts: updatedPostIts };
                
                return { ...s, candidates: s.candidates.map(c => c.id === candidateId ? updatedCandidate : c) };
            });
        },
        addComment: async (candidateId, commentData) => {
            setState(s => {
                const candidate = s.candidates.find(c => c.id === candidateId);
                if (!candidate) return s;
                
                const newComment: Comment = {
                    ...commentData,
                    id: `comment-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                };
                
                const updatedComments = [...(candidate.comments || []), newComment];
                const updatedCandidate = { ...candidate, comments: updatedComments };
                
                return { ...s, candidates: s.candidates.map(c => c.id === candidateId ? updatedCandidate : c) };
            });
        },
        deleteComment: async (candidateId, commentId) => {
            setState(s => {
                const candidate = s.candidates.find(c => c.id === candidateId);
                if (!candidate) return s;
                
                const updatedComments = (candidate.comments || []).filter(c => c.id !== commentId);
                const updatedCandidate = { ...candidate, comments: updatedComments };
                
                return { ...s, candidates: s.candidates.map(c => c.id === candidateId ? updatedCandidate : c) };
            });
        },
        archiveCandidate: async (candidateId) => {
            setState(s => ({
                ...s,
                candidates: s.candidates.map(c => c.id === candidateId ? { ...c, archived: true, archivedAt: new Date().toISOString() } : c)
            }));
        },
        restoreCandidate: async (candidateId) => {
            setState(s => ({
                ...s,
                candidates: s.candidates.map(c => c.id === candidateId ? { ...c, archived: false, archivedAt: undefined } : c)
            }));
        },
    }), [state.currentUser, state.users]);

    const getLabel = (key: string, fallback: string): string => {
        return state.settings?.customLabels?.[key] || fallback;
    };
    
    const renderView = () => {
        switch (state.view.type) {
            case 'dashboard': return <Dashboard />;
            case 'processes': return <ProcessList />;
            case 'process-view': return <ProcessView processId={state.view.payload} />;
            case 'reports': return <ReportsView />;
            case 'forms': return <Forms />;
            case 'calendar': return <CalendarView />;
            case 'users': return <Users />;
            case 'settings': return <Settings />;
            case 'bulk-import': return <BulkImportView />;
            case 'archived': return <ArchivedCandidates />;
            default: return <Dashboard />;
        }
    };

    if (state.loading) {
        return <div className="w-full h-screen flex items-center justify-center"><Spinner /></div>;
    }

    const appContextValue = { state, actions, getLabel };
    
    if (!state.currentUser) {
        return (
            <AppContext.Provider value={appContextValue}>
                <LoginPage />
            </AppContext.Provider>
        );
    }

    return (
        <AppContext.Provider value={appContextValue}>
            <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
                <Sidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                    {renderView()}
                </div>
            </div>
        </AppContext.Provider>
    );
};

export const useAppState = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppState must be used within an AppProvider');
    }
    return context;
};

export default App;