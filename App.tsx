import React, { createContext, useContext, useEffect, useReducer, useMemo } from 'react';
import { Dashboard } from './components/Dashboard';
import { ProcessList } from './components/ProcessList';
import { ProcessView } from './components/ProcessView';
import { ReportsView } from './components/ReportsView';
import { Users } from './components/Users';
import { Settings } from './components/Settings';
import { Forms } from './components/Forms';
import { Spinner } from './components/Spinner';
import { Candidate, Process, User, Form, Application, AppSettings, FormIntegration } from './types';
import { api } from './lib/api';
import { Briefcase, LayoutGrid, BarChart2, Users as UsersIcon, Settings as SettingsIcon, FileText } from 'lucide-react';


type View = 'dashboard' | 'processes' | 'process-view' | 'reports' | 'users' | 'settings' | 'forms';

interface AppState {
    loading: boolean;
    view: View;
    currentProcessId: string | null;
    processes: Process[];
    candidates: Candidate[];
    users: User[];
    forms: Form[];
    applications: Application[];
    formIntegrations: FormIntegration[];
    settings: AppSettings | null;
    currentUser: User | null;
}

type Action =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_DATA'; payload: { processes: Process[]; candidates: Candidate[]; users: User[]; forms: Form[]; applications: Application[]; formIntegrations: FormIntegration[]; settings: AppSettings | null } }
    | { type: 'SET_VIEW'; payload: { view: View; processId?: string | null } }
    | { type: 'ADD_PROCESS'; payload: Process }
    | { type: 'UPDATE_PROCESS'; payload: Process }
    | { type: 'DELETE_PROCESS'; payload: string }
    | { type: 'ADD_CANDIDATE'; payload: Candidate }
    | { type: 'UPDATE_CANDIDATE'; payload: Candidate }
    | { type: 'SAVE_SETTINGS'; payload: AppSettings }
    | { type: 'ADD_FORM_INTEGRATION'; payload: FormIntegration }
    | { type: 'DELETE_FORM_INTEGRATION'; payload: string }
    | { type: 'ADD_USER'; payload: User }
    | { type: 'UPDATE_USER'; payload: User }
    | { type: 'DELETE_USER'; payload: string };


const initialState: AppState = {
    loading: true,
    view: 'dashboard',
    currentProcessId: null,
    processes: [],
    candidates: [],
    users: [],
    forms: [],
    applications: [],
    formIntegrations: [],
    settings: null,
    currentUser: { id: 'user-1', name: 'Super Admin', email: 'admin@ats.com', role: 'admin' }, // mock current user
};

const appReducer = (state: AppState, action: Action): AppState => {
    switch (action.type) {
        case 'SET_LOADING':
            return { ...state, loading: action.payload };
        case 'SET_DATA':
            return { ...state, ...action.payload, loading: false };
        case 'SET_VIEW':
            return { ...state, view: action.payload.view, currentProcessId: action.payload.processId || null };
        case 'ADD_PROCESS':
            return { ...state, processes: [...state.processes, action.payload] };
        case 'UPDATE_PROCESS':
            return {
                ...state,
                processes: state.processes.map(p => p.id === action.payload.id ? action.payload : p),
            };
        case 'DELETE_PROCESS':
            return {
                ...state,
                processes: state.processes.filter(p => p.id !== action.payload),
                candidates: state.candidates.filter(c => c.processId !== action.payload),
            };
        case 'ADD_CANDIDATE':
            return { ...state, candidates: [...state.candidates, action.payload] };
        case 'UPDATE_CANDIDATE':
             return {
                ...state,
                candidates: state.candidates.map(c => c.id === action.payload.id ? action.payload : c),
            };
        case 'SAVE_SETTINGS':
            return { ...state, settings: action.payload };
        case 'ADD_FORM_INTEGRATION':
            return { ...state, formIntegrations: [...state.formIntegrations, action.payload] };
        case 'DELETE_FORM_INTEGRATION':
            return { ...state, formIntegrations: state.formIntegrations.filter(fi => fi.id !== action.payload) };
        case 'ADD_USER':
            return { ...state, users: [...state.users, action.payload] };
        case 'UPDATE_USER':
            return { ...state, users: state.users.map(u => u.id === action.payload.id ? action.payload : u) };
        case 'DELETE_USER':
            return { ...state, users: state.users.filter(u => u.id !== action.payload) };
        default:
            return state;
    }
};

interface AppContextType {
    state: AppState;
    actions: {
        setView: (view: View, processId?: string) => void;
        addProcess: (processData: Omit<Process, 'id'>) => Promise<void>;
        updateProcess: (process: Process) => Promise<void>;
        deleteProcess: (processId: string) => Promise<void>;
        addCandidate: (candidateData: Omit<Candidate, 'id' | 'history'>) => Promise<void>;
        updateCandidate: (candidate: Candidate, movedBy?: string) => Promise<void>;
        saveSettings: (settings: AppSettings) => Promise<void>;
        addFormIntegration: (integrationData: Omit<FormIntegration, 'id' | 'webhookUrl'>) => Promise<void>;
        deleteFormIntegration: (integrationId: string) => Promise<void>;
        addUser: (userData: Omit<User, 'id'>) => Promise<void>;
        updateUser: (user: User) => Promise<void>;
        deleteUser: (userId: string) => Promise<void>;
    };
    getLabel: (key: string, defaultLabel: string) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppState = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppState must be used within an AppProvider');
    }
    return context;
};

const NavLink: React.FC<{
    view: View;
    labelKey: string;
    defaultLabel: string;
    currentView: View;
    setView: (view: View, processId?: string) => void;
    icon: React.ElementType;
}> = ({ view, labelKey, defaultLabel, currentView, setView, icon: Icon }) => {
    const { getLabel } = useAppState();
    return (
        <button
            onClick={() => setView(view)}
            className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                currentView === view
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
        >
            <Icon className="w-5 h-5 mr-3" />
            {getLabel(labelKey, defaultLabel)}
        </button>
    );
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { state, actions, getLabel } = useAppState();
    const isAdmin = state.currentUser?.role === 'admin';

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="h-16 flex items-center justify-center border-b px-4">
                     {state.settings?.logoUrl ? (
                        <img src={state.settings.logoUrl} alt="App Logo" className="h-8 object-contain" />
                    ) : (
                        <h1 className="text-xl font-bold text-primary-600">{state.settings?.appName || 'ATS Pro'}</h1>
                    )}
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <NavLink view="dashboard" labelKey="sidebar_dashboard" defaultLabel="Dashboard" currentView={state.view} setView={actions.setView} icon={LayoutGrid} />
                    <NavLink view="processes" labelKey="sidebar_processes" defaultLabel="Processes" currentView={state.view} setView={actions.setView} icon={Briefcase} />
                    <NavLink view="reports" labelKey="sidebar_reports" defaultLabel="Reports" currentView={state.view} setView={actions.setView} icon={BarChart2} />
                    <NavLink view="forms" labelKey="sidebar_forms" defaultLabel="Forms" currentView={state.view} setView={actions.setView} icon={FileText} />
                    {isAdmin && <NavLink view="users" labelKey="sidebar_users" defaultLabel="Users" currentView={state.view} setView={actions.setView} icon={UsersIcon} />}
                </nav>
                 <div className="p-4 border-t">
                    {isAdmin && <NavLink view="settings" labelKey="sidebar_settings" defaultLabel="Settings" currentView={state.view} setView={actions.setView} icon={SettingsIcon} />}
                </div>
            </aside>
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
};


const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);

    useEffect(() => {
        const loadData = async () => {
            dispatch({ type: 'SET_LOADING', payload: true });
            const [processes, candidates, users, forms, applications, formIntegrations, settings] = await Promise.all([
                api.getProcesses(),
                api.getCandidates(),
                api.getUsers(),
                api.getForms(),
                api.getApplications(),
                api.getFormIntegrations(),
                api.getSettings(),
            ]);
            dispatch({ type: 'SET_DATA', payload: { processes, candidates, users, forms, applications, formIntegrations, settings } });
        };
        loadData();
    }, []);
    
    const getLabel = (key: string, defaultLabel: string): string => {
        return state.settings?.customLabels?.[key] || defaultLabel;
    };


    const actions = useMemo(() => ({
        setView: (view: View, processId: string | null = null) => {
            dispatch({ type: 'SET_VIEW', payload: { view, processId } });
        },
        addProcess: async (processData: Omit<Process, 'id'>) => {
            const newProcess = await api.addProcess(processData);
            dispatch({ type: 'ADD_PROCESS', payload: newProcess });
        },
        updateProcess: async (process: Process) => {
            const updatedProcess = await api.updateProcess(process);
            dispatch({ type: 'UPDATE_PROCESS', payload: updatedProcess });
        },
        deleteProcess: async (processId: string) => {
            await api.deleteProcess(processId);
            dispatch({ type: 'DELETE_PROCESS', payload: processId });
        },
        addCandidate: async (candidateData: Omit<Candidate, 'id'| 'history'>) => {
            const newCandidate = await api.addCandidate(candidateData, state.currentUser?.name || 'System');
            dispatch({ type: 'ADD_CANDIDATE', payload: newCandidate });
        },
        updateCandidate: async (candidate: Candidate, movedBy: string | undefined = undefined) => {
            let updatedCandidate = { ...candidate };
            const originalCandidate = state.candidates.find(c => c.id === candidate.id);

            if (movedBy && originalCandidate && originalCandidate.stageId !== candidate.stageId) {
                updatedCandidate.history = [
                    ...candidate.history,
                    { stageId: candidate.stageId, movedAt: new Date().toISOString(), movedBy }
                ];
            }
            const savedCandidate = await api.updateCandidate(updatedCandidate);
            dispatch({ type: 'UPDATE_CANDIDATE', payload: savedCandidate });
        },
        saveSettings: async (settings: AppSettings) => {
            const savedSettings = await api.saveSettings(settings);
            dispatch({ type: 'SAVE_SETTINGS', payload: savedSettings });
        },
        addFormIntegration: async (integrationData: Omit<FormIntegration, 'id' | 'webhookUrl'>) => {
            const newIntegration = await api.addFormIntegration(integrationData);
            dispatch({ type: 'ADD_FORM_INTEGRATION', payload: newIntegration });
        },
        deleteFormIntegration: async (integrationId: string) => {
            await api.deleteFormIntegration(integrationId);
            dispatch({ type: 'DELETE_FORM_INTEGRATION', payload: integrationId });
        },
        addUser: async (userData: Omit<User, 'id'>) => {
            const newUser = await api.addUser(userData);
            dispatch({ type: 'ADD_USER', payload: newUser });
        },
        updateUser: async (user: User) => {
            const updatedUser = await api.updateUser(user);
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
        },
        deleteUser: async (userId: string) => {
            await api.deleteUser(userId);
            dispatch({ type: 'DELETE_USER', payload: userId });
        },
    }), [state.candidates, state.currentUser]);
    
    return (
        <AppContext.Provider value={{ state, actions, getLabel }}>
            {children}
        </AppContext.Provider>
    );
};


const App: React.FC = () => {
    return (
        <AppProvider>
            <Main />
        </AppProvider>
    );
};

const Main: React.FC = () => {
    const { state } = useAppState();

    const renderView = () => {
        if (state.loading) {
            return <div className="flex items-center justify-center h-screen"><Spinner /></div>;
        }
        switch (state.view) {
            case 'dashboard':
                return <Dashboard />;
            case 'processes':
                return <ProcessList />;
            case 'process-view':
                return state.currentProcessId ? <ProcessView processId={state.currentProcessId} /> : <ProcessList />;
            case 'reports':
                return <ReportsView />;
            case 'users':
                return <Users />;
            case 'settings':
                return <Settings />;
            case 'forms':
                return <Forms />;
            default:
                return <Dashboard />;
        }
    };
    
    return (
        <Layout>
            {renderView()}
        </Layout>
    );
};

export default App;