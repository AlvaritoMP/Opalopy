import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { initialProcesses, initialCandidates, initialUsers, initialSettings, initialFormIntegrations, initialInterviewEvents } from './lib/data';
import { Process, Candidate, User, AppSettings, FormIntegration, InterviewEvent, CandidateHistory, Application, PostIt, Comment, Section, UserRole } from './types';
import { getSettings, saveSettings as saveSettingsToStorage } from './lib/settings';
import { usersApi, processesApi, candidatesApi, postItsApi, commentsApi, interviewsApi, settingsApi, setCurrentUser } from './lib/api/index';
import { googleDriveService } from './lib/googleDrive';
import { Dashboard } from './components/Dashboard';
import { ProcessList } from './components/ProcessList';
import { ProcessView } from './components/ProcessView';
import { ReportsView } from './components/ReportsView';
import { Settings } from './components/Settings';
import { Users } from './components/Users';
import { Candidates as CandidatesView } from './components/Candidates';
import { Forms } from './components/Forms';
import { CalendarView } from './components/CalendarView';
import { BulkImportView } from './components/BulkImportView';
import { Spinner } from './components/Spinner';
import { ArchivedCandidates } from './components/ArchivedCandidates';
import { Letters } from './components/Letters';
import { LayoutDashboard, Briefcase, FileText, Settings as SettingsIcon, Users as UsersIcon, ChevronsLeft, ChevronsRight, BarChart2, Calendar, FileUp, LogOut, X, Archive } from 'lucide-react';
import { CandidateComparator } from './components/CandidateComparator';


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
    lastViewedProcessId: string | null; // ID del último proceso visto
    loading: boolean;
}

interface AppActions {
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    addProcess: (processData: Omit<Process, 'id'>) => Promise<Process>;
    updateProcess: (processData: Process) => Promise<void>;
    deleteProcess: (processId: string) => Promise<void>;
    reloadProcesses: () => Promise<void>;
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

// Helper para obtener las secciones visibles de un usuario
const getVisibleSections = (user: User | null): Section[] => {
    if (!user) return [];
    if (user.visibleSections && user.visibleSections.length > 0) {
        return user.visibleSections;
    }
    // Secciones por defecto según rol
    const defaultSections: Record<UserRole, Section[]> = {
        admin: ['dashboard', 'processes', 'archived', 'candidates', 'forms', 'letters', 'calendar', 'reports', 'compare', 'bulk-import', 'users', 'settings'],
        recruiter: ['dashboard', 'processes', 'archived', 'candidates', 'forms', 'letters', 'calendar', 'reports', 'compare', 'bulk-import'],
        client: ['dashboard', 'processes', 'candidates', 'calendar', 'reports', 'compare'],
        viewer: ['dashboard', 'processes', 'candidates', 'calendar', 'reports']
    };
    return defaultSections[user.role] || [];
};

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
    
    const visibleSections = getVisibleSections(state.currentUser);
    const canSeeSection = (section: Section) => visibleSections.includes(section);

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
                {canSeeSection('dashboard') && <NavItem icon={LayoutDashboard} label={getLabel('sidebar_dashboard', 'Panel')} view="dashboard" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />}
                {canSeeSection('processes') && <NavItem icon={Briefcase} label={getLabel('sidebar_processes', 'Procesos')} view="processes" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />}
                {canSeeSection('archived') && <NavItem icon={Archive} label={getLabel('sidebar_archived', 'Archivados')} view="archived" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />}
                {canSeeSection('candidates') && <NavItem icon={UsersIcon} label={getLabel('menu_candidates', 'Candidatos')} view="candidates" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />}
                {canSeeSection('forms') && <NavItem icon={FileText} label={getLabel('sidebar_forms', 'Formularios')} view="forms" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />}
                {canSeeSection('letters') && <NavItem icon={FileText} label={getLabel('sidebar_letters', 'Cartas')} view="letters" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />}
                {canSeeSection('calendar') && <NavItem icon={Calendar} label={getLabel('sidebar_calendar', 'Calendario')} view="calendar" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />}
                {canSeeSection('reports') && <NavItem icon={BarChart2} label={getLabel('sidebar_reports', 'Reportes')} view="reports" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />}
                {canSeeSection('compare') && <NavItem icon={BarChart2} label={getLabel('sidebar_compare', 'Comparador')} view="compare" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />}
                {canSeeSection('bulk-import') && <NavItem icon={FileUp} label={getLabel('sidebar_bulk_import', 'Importación Masiva')} view="bulk-import" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />}
            </nav>
            <div className="p-2 border-t space-y-2">
                 <div className="p-2">
                    {canSeeSection('users') && <NavItem icon={UsersIcon} label={getLabel('sidebar_users', 'Usuarios')} view="users" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />}
                    {canSeeSection('settings') && <NavItem icon={SettingsIcon} label={getLabel('sidebar_settings', 'Configuración')} view="settings" currentView={state.view.type} setView={actions.setView} isCollapsed={isCollapsed} />}
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
        lastViewedProcessId: null,
        loading: true,
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                console.log('Loading data from Supabase...');
                
                // Cargar datos de Supabase con timeouts y mejor manejo de errores
                const loadWithFallback = async <T,>(
                    apiCall: () => Promise<T>,
                    fallback: T,
                    name: string
                ): Promise<T> => {
                    try {
                        const result = await Promise.race([
                            apiCall(),
                            new Promise<T>((_, reject) => 
                                setTimeout(() => reject(new Error('Timeout')), 5000)
                            )
                        ]);
                        console.log(`✓ Loaded ${name} from Supabase`);
                        return result;
                    } catch (error) {
                        console.warn(`⚠ Failed to load ${name} from Supabase, using fallback:`, error);
                        return fallback;
                    }
                };

                const [processes, candidates, users, interviewEvents, settings] = await Promise.all([
                    loadWithFallback(() => processesApi.getAll(), initialProcesses, 'processes'),
                    loadWithFallback(() => candidatesApi.getAll(), initialCandidates, 'candidates'),
                    loadWithFallback(() => usersApi.getAll(), initialUsers, 'users'),
                    loadWithFallback(() => interviewsApi.getAll(), initialInterviewEvents, 'interviewEvents'),
                    loadWithFallback(() => settingsApi.get(), getSettings() || initialSettings, 'settings'),
                ]);

                const sessionUserId = localStorage.getItem('ats_pro_user');
                let currentUser: User | null = null;
                
                if (sessionUserId) {
                    try {
                        currentUser = await usersApi.getById(sessionUserId);
                        if (currentUser) {
                            await setCurrentUser(currentUser.id).catch(() => {
                                // No crítico si falla
                            });
                        }
                    } catch (error) {
                        // Buscar en los usuarios cargados
                        currentUser = users.find(u => u.id === sessionUserId) || null;
                    }
                }

                console.log('✓ Data loaded successfully');
                
                // Inicializar Google Drive si está configurado
                if (settings?.googleDrive?.connected && settings.googleDrive.accessToken) {
                    googleDriveService.initialize(settings.googleDrive);
                }
                
                setState({
                    processes,
                    candidates,
                    users,
                    applications: [],
                    settings,
                    formIntegrations: initialFormIntegrations, // TODO: Implementar API
                    interviewEvents,
                    currentUser,
                    view: { type: 'dashboard' },
                    lastViewedProcessId: null,
                    loading: false,
                });
            } catch (error) {
                console.error('Error loading data:', error);
                // Fallback a datos locales
                const loadedSettings = getSettings();
                const sessionUserId = localStorage.getItem('ats_pro_user');
                const currentUser = sessionUserId ? initialUsers.find(u => u.id === sessionUserId) || null : null;
                
                console.log('Using local fallback data');
                setState({
                    processes: initialProcesses,
                    candidates: initialCandidates,
                    users: initialUsers,
                    applications: [],
                    settings: loadedSettings || initialSettings,
                    formIntegrations: initialFormIntegrations,
                    interviewEvents: initialInterviewEvents,
                    currentUser,
                    view: { type: 'dashboard' },
                    lastViewedProcessId: null,
                    loading: false,
                });
            }
        };

        loadData();
    }, []);

    const actions: AppActions = useMemo(() => ({
        login: async (email, password) => {
            try {
                const user = await usersApi.login(email, password);
                if (user) {
                    localStorage.setItem('ats_pro_user', user.id);
                    await setCurrentUser(user.id);
                    setState(s => ({ ...s, currentUser: user }));
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Login error:', error);
                // Fallback a búsqueda local
                const user = state.users.find(u => u.email.toLowerCase() === email.toLowerCase());
                if (user && user.password === password) {
                    localStorage.setItem('ats_pro_user', user.id);
                    setState(s => ({ ...s, currentUser: user }));
                    return true;
                }
                return false;
            }
        },
        logout: () => {
            localStorage.removeItem('ats_pro_user');
            setState(s => ({ ...s, currentUser: null, view: { type: 'dashboard' }, lastViewedProcessId: null }));
        },
        setView: (type, payload) => {
            setState(s => {
                // Si se está navegando a un proceso específico, guardar como último proceso visto
                if (type === 'process-view' && payload) {
                    console.log('📌 Guardando último proceso visto:', payload);
                    return { ...s, view: { type, payload }, lastViewedProcessId: payload };
                }
                // Si se está navegando a la lista de procesos
                if (type === 'processes') {
                    // Si payload es explícitamente null, limpiar y mostrar lista (botón retroceso)
                    if (payload === null) {
                        console.log('🔙 Limpiando último proceso visto (botón retroceso)');
                        return { ...s, view: { type, payload: undefined }, lastViewedProcessId: null };
                    }
                    // Si hay un último proceso visto (navegación desde sidebar o cualquier otra)
                    // ir directamente a ese proceso, a menos que payload sea explícitamente null
                    if (s.lastViewedProcessId) {
                        // Verificar que el proceso aún existe
                        const processExists = s.processes.some(p => p.id === s.lastViewedProcessId);
                        if (processExists) {
                            console.log('🔄 Navegando al último proceso visto:', s.lastViewedProcessId);
                            return { ...s, view: { type: 'process-view', payload: s.lastViewedProcessId } };
                        } else {
                            console.log('⚠️ Último proceso visto ya no existe, limpiando');
                            return { ...s, view: { type, payload: undefined }, lastViewedProcessId: null };
                        }
                    }
                    // Si no hay último proceso visto, mostrar lista
                    console.log('📋 Mostrando lista de procesos (sin último proceso visto)');
                    return { ...s, view: { type, payload: undefined } };
                }
                // Para cualquier otra navegación, mantener el último proceso visto
                console.log('📍 Navegando a:', type, '(manteniendo último proceso visto:', s.lastViewedProcessId, ')');
                return { ...s, view: { type, payload } };
            });
        },
        saveSettings: async (settings) => {
            try {
                // Actualizar en Supabase y obtener los settings actualizados
                const updatedSettings = await settingsApi.update(settings);
                
                // Inicializar Google Drive si está configurado
                if (updatedSettings?.googleDrive?.connected && updatedSettings.googleDrive.accessToken) {
                    googleDriveService.initialize(updatedSettings.googleDrive);
                } else {
                    // Limpiar si se desconectó
                    googleDriveService.setTokens('', '');
                }
                
                saveSettingsToStorage(updatedSettings); // Backup local
                setState(s => ({ ...s, settings: updatedSettings }));
                console.log('✅ Settings actualizados en el estado:', updatedSettings.googleDrive);
            } catch (error) {
                console.error('Error saving settings:', error);
                saveSettingsToStorage(settings);
                setState(s => ({ ...s, settings }));
            }
        },
        addProcess: async (processData) => {
            try {
                // Si Google Drive está conectado, crear carpeta automáticamente
                let folderId = processData.googleDriveFolderId;
                let folderName = processData.googleDriveFolderName;
                
                const googleDriveConfig = state.settings?.googleDrive;
                const isGoogleDriveConnected = googleDriveConfig?.connected && googleDriveConfig?.accessToken;
                
                if (isGoogleDriveConnected && googleDriveConfig && !folderId) {
                    try {
                        const { googleDriveService } = await import('./lib/googleDrive');
                        googleDriveService.initialize(googleDriveConfig);
                        
                        // Crear carpeta con el nombre del proceso
                        const folderNameToCreate = processData.title || `Proceso ${Date.now()}`;
                        const rootFolderId = googleDriveConfig.rootFolderId;
                        const folder = await googleDriveService.createFolder(folderNameToCreate, rootFolderId);
                        folderId = folder.id;
                        folderName = folder.name;
                        console.log(`✅ Carpeta creada automáticamente en Google Drive: ${folderName}`);
                    } catch (error: any) {
                        console.error('Error creando carpeta automáticamente:', error);
                        // Continuar sin carpeta si falla
                    }
                }
                
                const processDataWithFolder = {
                    ...processData,
                    googleDriveFolderId: folderId,
                    googleDriveFolderName: folderName,
                };
                
                // Crear proceso en la base de datos
                const newProcess = await processesApi.create(processDataWithFolder, state.currentUser?.id);
                console.log('✅ Proceso creado en la base de datos:', newProcess.id);
                
                // Actualizar estado local
                setState(s => ({ ...s, processes: [...s.processes, newProcess] }));
                
                return newProcess;
            } catch (error: any) {
                console.error('Error adding process:', error);
                // Verificar si es un error de permisos
                const errorMessage = error.message || 'No se pudo crear el proceso en la base de datos.';
                const isPermissionError = error.code === '42501' || error.code === 'PGRST301' || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('permiso');
                
                if (isPermissionError) {
                    throw new Error(`Error de permisos: No tienes permisos para crear procesos. Verifica tu rol de usuario. (${errorMessage})`);
                }
                
                // NO crear proceso local si falla en BD
                throw new Error(`Error al crear proceso: ${errorMessage}`);
            }
        },
        updateProcess: async (processData) => {
            try {
                const updated = await processesApi.update(processData.id, processData);
                setState(s => ({ ...s, processes: s.processes.map(p => p.id === processData.id ? updated : p) }));
            } catch (error: any) {
                console.error('Error updating process:', error);
                // Actualizar estado local como fallback
                setState(s => ({ ...s, processes: s.processes.map(p => p.id === processData.id ? processData : p) }));
                // Lanzar el error para que el componente pueda manejarlo
                const errorMessage = error.message || 'No se pudo actualizar el proceso en la base de datos.';
                const isPermissionError = error.code === '42501' || error.code === 'PGRST301' || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('permiso');
                
                if (isPermissionError) {
                    throw new Error(`Error de permisos: No tienes permisos para actualizar procesos. Verifica tu rol de usuario. (${errorMessage})`);
                }
                
                throw new Error(`Error al actualizar proceso: ${errorMessage}`);
            }
        },
        reloadProcesses: async () => {
            try {
                const processes = await processesApi.getAll();
                setState(s => ({ ...s, processes }));
            } catch (error: any) {
                console.error('Error reloading processes:', error);
                // No lanzar error, solo loguear para no interrumpir el flujo
                // El error puede ser por permisos o problemas de conexión
            }
        },
        deleteProcess: async (processId) => {
            try {
                // Obtener el proceso antes de eliminarlo para acceder a la carpeta de Google Drive
                const processToDelete = state.processes.find(p => p.id === processId);
                
                // Eliminar en la base de datos PRIMERO (esto también eliminará candidatos y relaciones)
                await processesApi.delete(processId);
                console.log(`✅ Proceso eliminado de la base de datos: ${processId}`);
                
                // Eliminar carpeta de Google Drive si existe (después de eliminar en BD)
                if (processToDelete?.googleDriveFolderId) {
                    const googleDriveConfig = state.settings?.googleDrive;
                    const isGoogleDriveConnected = googleDriveConfig?.connected && googleDriveConfig?.accessToken;
                    
                    if (isGoogleDriveConnected && googleDriveConfig) {
                        try {
                            const { googleDriveService } = await import('./lib/googleDrive');
                            googleDriveService.initialize(googleDriveConfig);
                            await googleDriveService.deleteFolder(processToDelete.googleDriveFolderId);
                            console.log(`✅ Carpeta eliminada de Google Drive: ${processToDelete.googleDriveFolderName}`);
                        } catch (error: any) {
                            console.error('Error eliminando carpeta de Google Drive:', error);
                            // No lanzar error, la carpeta puede no existir o ya estar eliminada
                            // La eliminación del proceso ya fue exitosa
                        }
                    }
                }
                
                // Solo actualizar el estado local si la eliminación en BD fue exitosa
                setState(s => ({
                    ...s,
                    processes: s.processes.filter(p => p.id !== processId),
                    candidates: s.candidates.filter(c => c.processId !== processId),
                }));
            } catch (error: any) {
                console.error('Error deleting process:', error);
                // Mostrar error al usuario
                alert(`Error al eliminar el proceso: ${error.message || 'No se pudo eliminar el proceso. Verifique los permisos y la conexión a la base de datos.'}`);
                // NO actualizar el estado local si falla la eliminación en BD
                throw error; // Re-lanzar el error para que el componente pueda manejarlo
            }
        },
        addCandidate: async (candidateData) => {
            try {
                // Si Google Drive está conectado y el proceso tiene carpeta, crear carpeta del candidato
                let folderId = candidateData.googleDriveFolderId;
                let folderName = candidateData.googleDriveFolderName;
                
                const googleDriveConfig = state.settings?.googleDrive;
                const isGoogleDriveConnected = googleDriveConfig?.connected && googleDriveConfig?.accessToken;
                const process = state.processes.find(p => p.id === candidateData.processId);
                const processHasFolder = process?.googleDriveFolderId;
                
                if (isGoogleDriveConnected && googleDriveConfig && processHasFolder && !folderId) {
                    try {
                        const { googleDriveService } = await import('./lib/googleDrive');
                        googleDriveService.initialize(googleDriveConfig);
                        
                        // Crear carpeta del candidato dentro de la carpeta del proceso
                        const candidateFolderName = `${candidateData.name || `Candidato_${Date.now()}`}`.replace(/[^a-zA-Z0-9_\- ]/g, '_');
                        const folder = await googleDriveService.createFolder(candidateFolderName, process.googleDriveFolderId);
                        folderId = folder.id;
                        folderName = folder.name;
                        console.log(`✅ Carpeta del candidato creada automáticamente en Google Drive: ${folderName} (dentro de ${process.googleDriveFolderName})`);
                    } catch (error: any) {
                        console.error('Error creando carpeta del candidato automáticamente:', error);
                        // Continuar sin carpeta si falla
                    }
                }
                
                const candidateDataWithFolder = {
                    ...candidateData,
                    googleDriveFolderId: folderId,
                    googleDriveFolderName: folderName,
                };
                
                const newCandidate = await candidatesApi.create(candidateDataWithFolder, state.currentUser?.id);
                setState(s => ({ ...s, candidates: [...s.candidates, newCandidate] }));
            } catch (error) {
                console.error('Error adding candidate:', error);
                const newCandidate: Candidate = {
                    ...candidateData,
                    id: `cand-${Date.now()}`,
                    history: [{
                        stageId: candidateData.stageId,
                        movedAt: new Date().toISOString(),
                        movedBy: state.currentUser?.id || 'System',
                    }],
                    archived: false,
                };
                setState(s => ({ ...s, candidates: [...s.candidates, newCandidate] }));
            }
        },
        updateCandidate: async (candidateData, movedBy) => {
            try {
                const updated = await candidatesApi.update(candidateData.id, candidateData, movedBy || state.currentUser?.id);
                setState(s => ({ ...s, candidates: s.candidates.map(c => c.id === candidateData.id ? updated : c) }));
            } catch (error) {
                console.error('Error updating candidate:', error);
                setState(s => {
                    const oldCandidate = s.candidates.find(c => c.id === candidateData.id);
                    let newHistory: CandidateHistory[] = oldCandidate ? [...oldCandidate.history] : [];

                    if (oldCandidate && oldCandidate.stageId !== candidateData.stageId) {
                        newHistory.push({
                            stageId: candidateData.stageId,
                            movedAt: new Date().toISOString(),
                            movedBy: movedBy || state.currentUser?.id || 'System',
                        });
                    }
                    const updatedCandidate = { ...candidateData, history: newHistory };
                    return { ...s, candidates: s.candidates.map(c => c.id === candidateData.id ? updatedCandidate : c) };
                });
            }
        },
        deleteCandidate: async (candidateId) => {
            try {
                await candidatesApi.delete(candidateId);
                setState(s => ({ ...s, candidates: s.candidates.filter(c => c.id !== candidateId) }));
            } catch (error) {
                console.error('Error deleting candidate:', error);
                setState(s => ({ ...s, candidates: s.candidates.filter(c => c.id !== candidateId) }));
            }
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
            try {
                const newUser = await usersApi.create(userData);
                setState(s => ({ ...s, users: [...s.users, newUser] }));
            } catch (error) {
                console.error('Error adding user:', error);
                const newUser: User = { ...userData, id: `user-${Date.now()}` };
                setState(s => ({ ...s, users: [...s.users, newUser] }));
            }
        },
        updateUser: async (userData) => {
            try {
                const updated = await usersApi.update(userData.id, userData);
                setState(s => ({ ...s, users: s.users.map(u => u.id === userData.id ? updated : u) }));
            } catch (error) {
                console.error('Error updating user:', error);
                setState(s => ({ ...s, users: s.users.map(u => u.id === userData.id ? userData : u) }));
            }
        },
        deleteUser: async (userId) => {
            try {
                console.log('Deleting user:', userId);
                await usersApi.delete(userId);
                console.log('User deleted successfully from Supabase');
                // Actualizar estado local
                setState(s => ({ ...s, users: s.users.filter(u => u.id !== userId) }));
            } catch (error) {
                console.error('Error deleting user from Supabase:', error);
                // Aún así, actualizar el estado local para que la UI se actualice
                // El usuario verá que desapareció, aunque no se haya eliminado en la BD
                setState(s => ({ ...s, users: s.users.filter(u => u.id !== userId) }));
                // Mostrar mensaje de error al usuario
                alert('Error al eliminar el usuario. Por favor, verifica la consola para más detalles.');
            }
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
            try {
                const newEvent = await interviewsApi.create(eventData, state.currentUser?.id);
                setState(s => ({ ...s, interviewEvents: [...s.interviewEvents, newEvent] }));
            } catch (error) {
                console.error('Error adding interview event:', error);
                const newEvent: InterviewEvent = { ...eventData, id: `evt-${Date.now()}` };
                setState(s => ({ ...s, interviewEvents: [...s.interviewEvents, newEvent] }));
            }
        },
        updateInterviewEvent: async (eventData) => {
            try {
                const updated = await interviewsApi.update(eventData.id, eventData);
                setState(s => ({ ...s, interviewEvents: s.interviewEvents.map(e => e.id === eventData.id ? updated : e) }));
            } catch (error) {
                console.error('Error updating interview event:', error);
                setState(s => ({ ...s, interviewEvents: s.interviewEvents.map(e => e.id === eventData.id ? eventData : e) }));
            }
        },
        deleteInterviewEvent: async (eventId) => {
            try {
                await interviewsApi.delete(eventId);
                setState(s => ({ ...s, interviewEvents: s.interviewEvents.filter(e => e.id !== eventId) }));
            } catch (error) {
                console.error('Error deleting interview event:', error);
                setState(s => ({ ...s, interviewEvents: s.interviewEvents.filter(e => e.id !== eventId) }));
            }
        },
        addPostIt: async (candidateId, postItData) => {
            try {
                const newPostIt = await postItsApi.create(candidateId, postItData);
                setState(s => {
                    const candidate = s.candidates.find(c => c.id === candidateId);
                    if (!candidate) return s;
                    const updatedPostIts = [...(candidate.postIts || []), newPostIt];
                    const updatedCandidate = { ...candidate, postIts: updatedPostIts };
                    return { ...s, candidates: s.candidates.map(c => c.id === candidateId ? updatedCandidate : c) };
                });
            } catch (error) {
                console.error('Error adding post-it:', error);
                setState(s => {
                    const candidate = s.candidates.find(c => c.id === candidateId);
                    if (!candidate) return s;
                    const newPostIt: PostIt = { ...postItData, id: `postit-${Date.now()}`, createdAt: new Date().toISOString() };
                    const updatedPostIts = [...(candidate.postIts || []), newPostIt];
                    const updatedCandidate = { ...candidate, postIts: updatedPostIts };
                    return { ...s, candidates: s.candidates.map(c => c.id === candidateId ? updatedCandidate : c) };
                });
            }
        },
        deletePostIt: async (candidateId, postItId) => {
            try {
                await postItsApi.delete(postItId);
                setState(s => {
                    const candidate = s.candidates.find(c => c.id === candidateId);
                    if (!candidate) return s;
                    const updatedPostIts = (candidate.postIts || []).filter(p => p.id !== postItId);
                    const updatedCandidate = { ...candidate, postIts: updatedPostIts };
                    return { ...s, candidates: s.candidates.map(c => c.id === candidateId ? updatedCandidate : c) };
                });
            } catch (error) {
                console.error('Error deleting post-it:', error);
                setState(s => {
                    const candidate = s.candidates.find(c => c.id === candidateId);
                    if (!candidate) return s;
                    const updatedPostIts = (candidate.postIts || []).filter(p => p.id !== postItId);
                    const updatedCandidate = { ...candidate, postIts: updatedPostIts };
                    return { ...s, candidates: s.candidates.map(c => c.id === candidateId ? updatedCandidate : c) };
                });
            }
        },
        addComment: async (candidateId, commentData) => {
            try {
                const newComment = await commentsApi.create(candidateId, commentData);
                setState(s => {
                    const candidate = s.candidates.find(c => c.id === candidateId);
                    if (!candidate) return s;
                    const updatedComments = [...(candidate.comments || []), newComment];
                    const updatedCandidate = { ...candidate, comments: updatedComments };
                    return { ...s, candidates: s.candidates.map(c => c.id === candidateId ? updatedCandidate : c) };
                });
            } catch (error) {
                console.error('Error adding comment:', error);
                setState(s => {
                    const candidate = s.candidates.find(c => c.id === candidateId);
                    if (!candidate) return s;
                    const newComment: Comment = { ...commentData, id: `comment-${Date.now()}`, createdAt: new Date().toISOString() };
                    const updatedComments = [...(candidate.comments || []), newComment];
                    const updatedCandidate = { ...candidate, comments: updatedComments };
                    return { ...s, candidates: s.candidates.map(c => c.id === candidateId ? updatedCandidate : c) };
                });
            }
        },
        deleteComment: async (candidateId, commentId) => {
            try {
                await commentsApi.delete(commentId);
                setState(s => {
                    const candidate = s.candidates.find(c => c.id === candidateId);
                    if (!candidate) return s;
                    const updatedComments = (candidate.comments || []).filter(c => c.id !== commentId);
                    const updatedCandidate = { ...candidate, comments: updatedComments };
                    return { ...s, candidates: s.candidates.map(c => c.id === candidateId ? updatedCandidate : c) };
                });
            } catch (error) {
                console.error('Error deleting comment:', error);
                setState(s => {
                    const candidate = s.candidates.find(c => c.id === candidateId);
                    if (!candidate) return s;
                    const updatedComments = (candidate.comments || []).filter(c => c.id !== commentId);
                    const updatedCandidate = { ...candidate, comments: updatedComments };
                    return { ...s, candidates: s.candidates.map(c => c.id === candidateId ? updatedCandidate : c) };
                });
            }
        },
        archiveCandidate: async (candidateId) => {
            try {
                const updated = await candidatesApi.archive(candidateId);
                setState(s => ({ ...s, candidates: s.candidates.map(c => c.id === candidateId ? updated : c) }));
            } catch (error) {
                console.error('Error archiving candidate:', error);
                setState(s => ({
                    ...s,
                    candidates: s.candidates.map(c => c.id === candidateId ? { ...c, archived: true, archivedAt: new Date().toISOString() } : c)
                }));
            }
        },
        restoreCandidate: async (candidateId) => {
            try {
                const updated = await candidatesApi.restore(candidateId);
                setState(s => ({ ...s, candidates: s.candidates.map(c => c.id === candidateId ? updated : c) }));
            } catch (error) {
                console.error('Error restoring candidate:', error);
                setState(s => ({
                    ...s,
                    candidates: s.candidates.map(c => c.id === candidateId ? { ...c, archived: false, archivedAt: undefined } : c)
                }));
            }
        },
    }), [state.currentUser, state.users]);

    const getLabel = (key: string, fallback: string): string => {
        return state.settings?.customLabels?.[key] || fallback;
    };
    
    const renderView = () => {
        // Verificar si el usuario tiene acceso a la sección actual
        if (state.currentUser) {
            const visibleSections = getVisibleSections(state.currentUser);
            const viewSectionMap: Record<string, Section> = {
                'dashboard': 'dashboard',
                'processes': 'processes',
                'process-view': 'processes',
                'archived': 'archived',
                'candidates': 'candidates',
                'forms': 'forms',
                'letters': 'letters',
                'calendar': 'calendar',
                'reports': 'reports',
                'compare': 'compare',
                'users': 'users',
                'settings': 'settings',
                'bulk-import': 'bulk-import'
            };
            
            const requiredSection = viewSectionMap[state.view.type];
            if (requiredSection && !visibleSections.includes(requiredSection)) {
                // Redirigir al dashboard si no tiene acceso
                actions.setView('dashboard');
                return <Dashboard />;
            }
        }
        
        switch (state.view.type) {
            case 'dashboard': return <Dashboard />;
            case 'processes': return <ProcessList />;
            case 'process-view': 
                if (!state.view.payload) {
                    // Si no hay payload, redirigir a lista de procesos
                    actions.setView('processes', null);
                    return <ProcessList />;
                }
                return <ProcessView processId={state.view.payload} />;
            case 'reports': return <ReportsView />;
            case 'forms': return <Forms />;
            case 'letters': return <Letters />;
            case 'calendar': return <CalendarView />;
            case 'candidates': return <CandidatesView />;
            case 'compare': return <CandidateComparator />;
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
                <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
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