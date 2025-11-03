
import React, { createContext, useContext, useEffect, useReducer, useMemo } from 'react';
import { Dashboard } from './components/Dashboard';
import { ProcessList } from './components/ProcessList';
import { ProcessView } from './components/ProcessView';
import { ReportsView } from './components/ReportsView';
import { Users } from './components/Users';
import { Settings } from './components/Settings';
import { Forms } from './components/Forms';
import { Spinner } from './components/Spinner';
import { Candidate, Process, User, Form, Application } from './types';
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
    currentUser: User | null;
}

type Action =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_DATA'; payload: { processes: Process[]; candidates: Candidate[]; users: User[]; forms: Form[]; applications: Application[] } }
    | { type: 'SET_VIEW'; payload: { view: View; processId?: string | null } }
    | { type: 'ADD_PROCESS'; payload: Process }
    | { type: 'UPDATE_PROCESS'; payload: Process }
    | { type: 'DELETE_PROCESS'; payload: string }
    | { type: 'ADD_CANDIDATE'; payload: Candidate }
    | { type: 'UPDATE_CANDIDATE'; payload: Candidate };

const initialState: AppState = {
    loading: true,
    view: 'dashboard',
    currentProcessId: null,
    processes: [],
    candidates: [],
    users: [],
    forms: [],
    applications: [],
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
        updateCandidate: (candidate: Candidate) => Promise<void>;
    };
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
    currentView: View;
    // Fix: Allow processId to be passed to setView
    setView: (view: View, processId?: string) => void;
    icon: React.ElementType;
    children: React.ReactNode;
}> = ({ view, currentView, setView, icon: Icon, children }) => (
    <button
        onClick={() => setView(view)}
        className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            currentView === view
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
    >
        <Icon className="w-5 h-5 mr-3" />
        {children}
    </button>
);

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { state, actions } = useAppState();

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="h-16 flex items-center justify-center border-b">
                    <h1 className="text-xl font-bold text-primary-600">ATS Pro</h1>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <NavLink view="dashboard" currentView={state.view} setView={actions.setView} icon={LayoutGrid}>Dashboard</NavLink>
                    <NavLink view="processes" currentView={state.view} setView={actions.setView} icon={Briefcase}>Processes</NavLink>
                    <NavLink view="reports" currentView={state.view} setView={actions.setView} icon={BarChart2}>Reports</NavLink>
                    <NavLink view="forms" currentView={state.view} setView={actions.setView} icon={FileText}>Forms</NavLink>
                    <NavLink view="users" currentView={state.view} setView={actions.setView} icon={UsersIcon}>Users</NavLink>
                </nav>
                 <div className="p-4 border-t">
                    <NavLink view="settings" currentView={state.view} setView={actions.setView} icon={SettingsIcon}>Settings</NavLink>
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
            const [processes, candidates, users, forms, applications] = await Promise.all([
                api.getProcesses(),
                api.getCandidates(),
                api.getUsers(),
                api.getForms(),
                api.getApplications(),
            ]);
            dispatch({ type: 'SET_DATA', payload: { processes, candidates, users, forms, applications } });
        };
        loadData();
    }, []);

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
            const newCandidate = await api.addCandidate(candidateData);
            dispatch({ type: 'ADD_CANDIDATE', payload: newCandidate });
        },
        updateCandidate: async (candidate: Candidate) => {
            const updatedCandidate = await api.updateCandidate(candidate);
            dispatch({ type: 'UPDATE_CANDIDATE', payload: updatedCandidate });
        },
    }), []);
    
    return (
        <AppContext.Provider value={{ state, actions }}>
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
