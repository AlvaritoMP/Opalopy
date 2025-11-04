
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { initialProcesses, initialCandidates, initialUsers, initialSettings, initialFormIntegrations, initialInterviewEvents } from './lib/data';
import { Process, Candidate, User, AppSettings, FormIntegration, InterviewEvent, CandidateHistory, Application } from './types';
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
import { LayoutDashboard, Briefcase, FileText, Settings as SettingsIcon, Users as UsersIcon, ChevronsLeft, ChevronsRight, BarChart2, Calendar, FileUp } from 'lucide-react';


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
    addProcess: (processData: Omit<Process, 'id' | 'attachments'>) => Promise<void>;
    updateProcess: (processData: Process) => Promise<void>;
    deleteProcess: (processId: string) => Promise<void>;
    addCandidate: (candidateData: Omit<Candidate, 'id' | 'history'>) => Promise<void>;
    updateCandidate: (candidateData: Candidate, movedBy?: string) => Promise<void>;
    deleteCandidate: (candidateId: string) => Promise<void>;
    addUser: (userData: Omit<User, 'id'>) => Promise<void>;
    updateUser: (userData: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    saveSettings: (settings: AppSettings) => Promise<void>;
    addFormIntegration: (integrationData: Omit<FormIntegration, 'id' | 'webhookUrl'>) => Promise<void>;
    deleteFormIntegration: (integrationId: string) => Promise<void>;
    addInterviewEvent: (eventData: Omit<InterviewEvent, 'id'>) => Promise<void>;
    updateInterviewEvent: (eventData: InterviewEvent) => Promise<void>;
    deleteInterviewEvent: (eventId: string) => Promise<void>;
    setView: (type: string, payload?: any) => void;
}

interface AppContextType {
    state: AppState;
    actions: AppActions;
    getLabel: (key: string, fallback: string) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

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
                <NavItem icon={LayoutDashboard} label={getLabel('sidebar_dashboard', 'Dashboard')} view="dashboard" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
                <NavItem icon={Briefcase} label={getLabel('sidebar_processes', 'Processes')} view="processes" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
                <NavItem icon={FileText} label={getLabel('sidebar_forms', 'Forms')} view="forms" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
                <NavItem icon={Calendar} label={getLabel('sidebar_calendar', 'Calendar')} view="calendar" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
                <NavItem icon={BarChart2} label={getLabel('sidebar_reports', 'Reports')} view="reports" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
                <NavItem icon={FileUp} label={getLabel('sidebar_bulk_import', 'Bulk Import')} view="bulk-import" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
            </nav>
            <div className="p-4 border-t space-y-2">
                <NavItem icon={UsersIcon} label={getLabel('sidebar_users', 'Users')} view="users" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
                <NavItem icon={SettingsIcon} label="Settings" view="settings" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />
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
        setTimeout(() => {
            const loadedSettings = getSettings();
            setState({
                processes: initialProcesses,
                candidates: initialCandidates,
                users: initialUsers,
                applications: [],
                settings: loadedSettings || initialSettings,
                formIntegrations: initialFormIntegrations,
                interviewEvents: initialInterviewEvents,
                currentUser: initialUsers.find(u => u.role === 'admin') || initialUsers[0],
                view: { type: 'dashboard' },
                loading: false,
            });
        }, 500);
    }, []);

    const actions: AppActions = useMemo(() => ({
        setView: (type, payload) => setState(s => ({ ...s, view: { type, payload } })),
        saveSettings: async (settings) => {
            saveSettingsToStorage(settings);
            setState(s => ({ ...s, settings }));
        },
        addProcess: async (processData) => {
            const newProcess: Process = { ...processData, id: `proc-${Date.now()}`, attachments: [] };
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
                }]
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
    }), [state.currentUser]);

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
            default: return <Dashboard />;
        }
    };

    if (state.loading) {
        return <div className="w-full h-screen flex items-center justify-center"><Spinner /></div>;
    }

    return (
        <AppContext.Provider value={{ state, actions, getLabel }}>
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
