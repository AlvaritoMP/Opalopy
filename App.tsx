import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { initialProcesses, initialCandidates, initialUsers, initialSettings, initialFormIntegrations, initialInterviewEvents } from './lib/data';
import { Process, Candidate, User, AppSettings, FormIntegration, InterviewEvent, CandidateHistory, Application, PostIt, Comment, Section, UserRole } from './types';
import { getSettings, saveSettings as saveSettingsToStorage } from './lib/settings';
import { usersApi, processesApi, candidatesApi, postItsApi, commentsApi, interviewsApi, settingsApi, setCurrentUser } from './lib/api/index';
import { isCorsError, getErrorMessage } from './lib/supabase';
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
import { ToastContainer } from './components/Toast';
import { LayoutDashboard, Briefcase, FileText, Settings as SettingsIcon, Users as UsersIcon, ChevronsLeft, ChevronsRight, BarChart2, Calendar, FileUp, LogOut, X, Archive, RefreshCw, Menu } from 'lucide-react';
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
    toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'loading' | 'info'; duration?: number }>;
}

interface AppActions {
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    addProcess: (processData: Omit<Process, 'id'>) => Promise<Process>;
    updateProcess: (processData: Process) => Promise<void>;
    deleteProcess: (processId: string) => Promise<void>;
    reloadProcesses: () => Promise<void>;
    reloadCandidates: () => Promise<void>;
    addCandidate: (candidateData: Omit<Candidate, 'id' | 'history'>) => Promise<void>;
    updateCandidate: (candidateData: Candidate, movedBy?: string) => Promise<void>;
    deleteCandidate: (candidateId: string) => Promise<void>;
    moveCandidateToProcess: (candidateId: string, targetProcessId: string) => Promise<void>;
    duplicateCandidateToProcess: (candidateId: string, targetProcessId: string) => Promise<void>;
    addUser: (userData: Omit<User, 'id'>) => Promise<void>;
    updateUser: (userData: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    saveSettings: (settings: AppSettings) => Promise<void>;
    reloadSettings: () => Promise<void>;
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
    discardCandidate: (candidateId: string, reason: string) => Promise<void>;
    loadArchivedCandidates: () => Promise<void>;
    setView: (type: string, payload?: any) => void;
    showToast: (message: string, type: 'success' | 'error' | 'loading' | 'info', duration?: number) => string;
    hideToast: (id: string) => void;
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
    const [isMobileOpen, setIsMobileOpen] = React.useState(false);
    
    if (!state.currentUser) return null;
    
    const visibleSections = getVisibleSections(state.currentUser);
    const canSeeSection = (section: Section) => visibleSections.includes(section);

    return (
        <>
            {/* Botón hamburguesa para móvil */}
            <button
                onClick={() => setIsMobileOpen(true)}
                className="fixed top-4 left-4 z-50 md:hidden p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50"
                aria-label="Abrir menú"
            >
                <Menu className="w-6 h-6 text-gray-700" />
            </button>
            
            {/* Overlay para móvil */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}
            
            {/* Sidebar */}
            <div className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col bg-white border-r transition-all duration-300 ${
                isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            } ${isCollapsed ? 'w-20' : 'w-64'}`}>
                <div className={`flex items-center border-b p-4 h-16 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                    {!isCollapsed && (
                         <div className="flex items-center overflow-hidden">
                            {state.settings?.logoUrl && <img src={state.settings.logoUrl} alt="Logo" className="h-8 mr-2 object-contain" />}
                            <span className="font-bold text-xl text-gray-800 truncate">{state.settings?.appName || 'ATS Pro'}</span>
                        </div>
                    )}
                    <button 
                        onClick={() => {
                            setIsCollapsed(!isCollapsed);
                            if (isMobileOpen) setIsMobileOpen(false);
                        }} 
                        className="p-2 rounded-md hover:bg-gray-100 flex-shrink-0"
                    >
                        {isCollapsed ? <ChevronsRight className="w-5 h-5 text-gray-600" /> : <ChevronsLeft className="w-5 h-5 text-gray-600" />}
                    </button>
                    {/* Botón cerrar para móvil */}
                    <button
                        onClick={() => setIsMobileOpen(false)}
                        className="md:hidden p-2 rounded-md hover:bg-gray-100 ml-2"
                        aria-label="Cerrar menú"
                    >
                        <X className="w-5 h-5 text-gray-600" />
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
                    <button
                        onClick={async () => {
                            const refreshToastId = actions.showToast('Actualizando datos...', 'loading', 0);
                            try {
                                await Promise.all([
                                    actions.reloadProcesses(),
                                    actions.reloadCandidates()
                                ]);
                                actions.hideToast(refreshToastId);
                                actions.showToast('Datos actualizados', 'success', 2000);
                            } catch (error: any) {
                                actions.hideToast(refreshToastId);
                                const errorMessage = error?.message || '';
                                const isQuotaError = errorMessage.includes('quota') || 
                                                    errorMessage.includes('egress') || 
                                                    errorMessage.includes('limit') ||
                                                    errorMessage.includes('exceeded');
                                if (isQuotaError) {
                                    actions.showToast('⚠️ Límite de transferencia alcanzado. Intenta más tarde.', 'error', 5000);
                                } else {
                                    actions.showToast('Error al actualizar. Intenta nuevamente.', 'error', 3000);
                                }
                            }
                        }}
                        className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors text-gray-600 hover:bg-gray-100 ${isCollapsed ? 'justify-center' : ''}`}
                        title="Actualizar datos"
                    >
                        <RefreshCw className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
                        {!isCollapsed && 'Actualizar'}
                    </button>
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
                {/* POWERED BY Logo Section */}
                {state.settings?.poweredByLogoUrl && (
                    <div className="p-4 border-t bg-gray-50 dark:bg-gray-800">
                        {!isCollapsed ? (
                            <div className="flex flex-col items-center space-y-2">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">POWERED BY</p>
                                <img 
                                    src={state.settings.poweredByLogoUrl} 
                                    alt="Powered By" 
                                    className="h-8 object-contain max-w-full opacity-80 hover:opacity-100 transition-opacity"
                                />
                            </div>
                        ) : (
                            <div className="flex justify-center">
                                <img 
                                    src={state.settings.poweredByLogoUrl} 
                                    alt="Powered By" 
                                    className="h-6 object-contain opacity-80"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
        </>
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
        toasts: [],
    });

    // Referencia para evitar mostrar el mensaje de CORS repetidamente
    const lastCorsErrorTime = useRef<number>(0);
    const CORS_ERROR_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutos

    useEffect(() => {
        const loadData = async () => {
            try {
                console.log('Loading data from Supabase...');
                
                // Cargar datos de Supabase con timeouts aumentados y reintentos
                const loadWithEmptyFallback = async <T,>(
                    apiCall: () => Promise<T>,
                    emptyFallback: T,
                    name: string,
                    useEmptyFallback: boolean = false
                ): Promise<T> => {
                    const maxRetries = 2;
                    const timeoutMs = 30000; // 30 segundos (aumentado de 10s)
                    
                    for (let attempt = 0; attempt <= maxRetries; attempt++) {
                        try {
                            if (attempt > 0) {
                                console.log(`🔄 Reintentando cargar ${name} (intento ${attempt + 1}/${maxRetries + 1})...`);
                                // Esperar antes de reintentar (backoff exponencial)
                                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                            }
                            
                            const result = await Promise.race([
                                apiCall(),
                                new Promise<T>((_, reject) => 
                                    setTimeout(() => reject(new Error(`Timeout después de ${timeoutMs/1000}s`)), timeoutMs)
                                )
                            ]);
                            console.log(`✓ Loaded ${name} from Supabase`);
                            return result;
                        } catch (error: any) {
                            const errorMessage = error?.message || error?.toString() || 'Error desconocido';
                            const isTimeout = errorMessage.includes('Timeout');
                            
                            if (attempt < maxRetries) {
                                console.warn(`⚠ Intento ${attempt + 1} fallido para ${name}: ${errorMessage}. Reintentando...`);
                                continue;
                            }
                            
                            // Último intento falló
                            console.error(`❌ Failed to load ${name} from Supabase después de ${maxRetries + 1} intentos:`, error);
                            
                            if (isTimeout) {
                                console.error(`⏱️ Timeout: La base de datos puede estar pausada o hay problemas de conexión. Verifica el estado de Supabase.`);
                            }
                            
                            if (useEmptyFallback) {
                                console.warn(`⚠ Using empty array for ${name} instead of fallback data`);
                                return (Array.isArray(emptyFallback) ? [] : emptyFallback) as T;
                            }
                            console.warn(`⚠ Using fallback data for ${name}`);
                            return emptyFallback;
                        }
                    }
                    
                    // Nunca debería llegar aquí, pero por si acaso
                    return useEmptyFallback ? (Array.isArray(emptyFallback) ? [] : emptyFallback) as T : emptyFallback;
                };

                // Para procesos, candidatos y usuarios, usar arrays vacíos si falla (no datos de prueba)
                // Solo settings puede usar fallback porque puede venir de localStorage
                // Cargar candidatos activos y descartados (aunque estén archivados) para el Dashboard
                const [processes, activeCandidates, users, interviewEvents, settings] = await Promise.all([
                    loadWithEmptyFallback(() => processesApi.getAll(false), initialProcesses, 'processes', true), // false = no attachments por defecto
                    loadWithEmptyFallback(() => candidatesApi.getAll(false, true), initialCandidates, 'candidates', true), // false = no archived, true = include relations (post-its, comments, history)
                    loadWithEmptyFallback(() => usersApi.getAll(), initialUsers, 'users', true),
                    loadWithEmptyFallback(() => interviewsApi.getAll(), initialInterviewEvents, 'interviewEvents', true),
                    loadWithEmptyFallback(() => settingsApi.get(), getSettings() || initialSettings, 'settings', false),
                ]);
                
                // Log detallado de settings cargados inicialmente
                console.log('🚀 Initial load - settings.candidateSources:', settings.candidateSources);
                console.log('🚀 Initial load - Length:', Array.isArray(settings.candidateSources) ? settings.candidateSources.length : 'N/A');
                
                // Cargar candidatos descartados (aunque estén archivados) para el conteo del Dashboard
                let discardedCandidates: Candidate[] = [];
                try {
                    const allArchived = await candidatesApi.getAll(true, true); // true = include archived
                    discardedCandidates = allArchived.filter(c => c.discarded === true);
                } catch (error) {
                    console.warn('Error cargando candidatos descartados:', error);
                }
                
                // Combinar candidatos activos y descartados, evitando duplicados
                const activeIds = new Set(activeCandidates.map(c => c.id));
                const newDiscarded = discardedCandidates.filter(c => !activeIds.has(c.id));
                const candidates = [...activeCandidates, ...newDiscarded];

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
                    toasts: [],
                });
            } catch (error) {
                console.error('Error loading data:', error);
                // NO usar datos de prueba como fallback - usar arrays vacíos
                const loadedSettings = getSettings();
                const sessionUserId = localStorage.getItem('ats_pro_user');
                let currentUser: User | null = null;
                
                if (sessionUserId) {
                    try {
                        currentUser = await usersApi.getById(sessionUserId);
                    } catch (err) {
                        console.error('Error loading current user:', err);
                    }
                }
                
                console.warn('⚠ Using empty arrays - no fallback data');
                setState({
                    processes: [],
                    candidates: [],
                    users: [],
                    applications: [],
                    settings: loadedSettings || initialSettings,
                    formIntegrations: initialFormIntegrations,
                    interviewEvents: [],
                    currentUser,
                    view: { type: 'dashboard' },
                    lastViewedProcessId: null,
                    loading: false,
                    toasts: [],
                });
            }
        };

        loadData();
    }, []);

    // Helper functions para toasts (deben estar fuera de actions para evitar dependencias circulares)
    const showToastHelper = (message: string, type: 'success' | 'error' | 'loading' | 'info', duration?: number) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setState(s => ({
            ...s,
            toasts: [...s.toasts, { id, message, type, duration }]
        }));
        return id;
    };

    const hideToastHelper = (id: string) => {
        setState(s => ({
            ...s,
            toasts: s.toasts.filter(t => t.id !== id)
        }));
    };

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
                
                // Log detallado para debuggear candidateSources
                console.log('💾 saveSettings - updatedSettings.candidateSources:', updatedSettings.candidateSources);
                console.log('💾 saveSettings - Length:', Array.isArray(updatedSettings.candidateSources) ? updatedSettings.candidateSources.length : 'N/A');
                
                // Inicializar Google Drive si está configurado
                if (updatedSettings?.googleDrive?.connected && updatedSettings.googleDrive.accessToken) {
                    googleDriveService.initialize(updatedSettings.googleDrive);
                } else {
                    // Limpiar si se desconectó
                    googleDriveService.setTokens('', '');
                }
                
                saveSettingsToStorage(updatedSettings); // Backup local
                setState(s => ({ ...s, settings: updatedSettings }));
                console.log('✅ Settings actualizados en el estado. candidateSources en estado:', updatedSettings.candidateSources);
            } catch (error) {
                console.error('Error saving settings:', error);
                saveSettingsToStorage(settings);
                setState(s => ({ ...s, settings }));
            }
        },
        reloadSettings: async () => {
            try {
                // Intentar obtener settings, pero si no existen, intentar crearlos
                const settings = await settingsApi.get(true); // Permitir crear si no existe
                console.log('🔄 reloadSettings - candidateSources:', settings.candidateSources);
                console.log('🔄 reloadSettings - Length:', Array.isArray(settings.candidateSources) ? settings.candidateSources.length : 'N/A');
                setState(s => ({ ...s, settings }));
                saveSettingsToStorage(settings); // Actualizar backup local también
            } catch (error: any) {
                console.error('Error reloading settings:', error);
                // Si el error es que no existe o hay un problema de permisos, usar localStorage como fallback
                if (error.code === 'PGRST116' || error.code === '42501' || error.message?.includes('permission')) {
                    console.warn('⚠️ No se pueden cargar settings desde la BD, usando localStorage como fallback');
                    const localSettings = getSettings();
                    if (localSettings) {
                        console.log('📦 Usando settings del localStorage:', localSettings.candidateSources);
                        setState(s => ({ ...s, settings: localSettings }));
                    } else {
                        console.warn('⚠️ No hay settings en localStorage, usando valores por defecto');
                    }
                }
            }
        },
        addProcess: async (processData) => {
            const loadingToastId = showToastHelper('Creando proceso...', 'loading', 0);
            try {
                // Si Google Drive está conectado, crear carpeta automáticamente
                let folderId = processData.googleDriveFolderId;
                let folderName = processData.googleDriveFolderName;
                
                const googleDriveConfig = state.settings?.googleDrive;
                const isGoogleDriveConnected = googleDriveConfig?.connected && googleDriveConfig?.accessToken;
                
                if (isGoogleDriveConnected && googleDriveConfig && !folderId) {
                    try {
                        hideToastHelper(loadingToastId);
                        const folderToastId = showToastHelper('Creando carpeta en Google Drive...', 'loading', 0);
                        const { googleDriveService } = await import('./lib/googleDrive');
                        googleDriveService.initialize(googleDriveConfig);
                        
                        // Crear carpeta con el nombre del proceso
                        const folderNameToCreate = processData.title || `Proceso ${Date.now()}`;
                        const rootFolderId = googleDriveConfig.rootFolderId;
                        const folder = await googleDriveService.createFolder(folderNameToCreate, rootFolderId);
                        folderId = folder.id;
                        folderName = folder.name;
                        console.log(`✅ Carpeta creada automáticamente en Google Drive: ${folderName}`);
                        hideToastHelper(folderToastId);
                        const savingToastId = showToastHelper('Guardando proceso...', 'loading', 0);
                        hideToastHelper(savingToastId);
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
                
                hideToastHelper(loadingToastId);
                showToastHelper('Proceso creado exitosamente', 'success');
                
                return newProcess;
            } catch (error: any) {
                console.error('Error adding process:', error);
                hideToastHelper(loadingToastId);
                // Verificar si es un error de permisos
                const errorMessage = error.message || 'No se pudo crear el proceso en la base de datos.';
                const isPermissionError = error.code === '42501' || error.code === 'PGRST301' || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('permiso');
                
                if (isPermissionError) {
                    showToastHelper('Error de permisos: No tienes permisos para crear procesos. Verifica tu rol de usuario.', 'error', 7000);
                } else {
                    showToastHelper(`Error al crear proceso: ${errorMessage}`, 'error', 7000);
                }
                
                // NO crear proceso local si falla en BD - esto causa que aparezca pero no se guarde
                // Re-lanzar el error para que el componente pueda manejarlo
                throw error;
            }
        },
        updateProcess: async (processData) => {
            const loadingToastId = showToastHelper('Guardando cambios del proceso...', 'loading', 0);
            try {
                const updated = await processesApi.update(processData.id, processData);
                
                // Recargar el proceso completo desde la BD para asegurar que tiene todos los datos actualizados
                // (stages, documentCategories, attachments, etc.)
                try {
                    const reloadedProcess = await processesApi.getById(processData.id);
                    if (reloadedProcess) {
                        setState(s => ({ ...s, processes: s.processes.map(p => p.id === processData.id ? reloadedProcess : p) }));
                    } else {
                        // Si no se puede recargar, usar el actualizado
                setState(s => ({ ...s, processes: s.processes.map(p => p.id === processData.id ? updated : p) }));
                    }
                } catch (reloadError) {
                    console.warn('Error recargando proceso después de actualizar, usando el retornado:', reloadError);
                    setState(s => ({ ...s, processes: s.processes.map(p => p.id === processData.id ? updated : p) }));
                }
                
                hideToastHelper(loadingToastId);
                showToastHelper('Proceso actualizado exitosamente', 'success');
            } catch (error: any) {
                console.error('Error updating process:', error);
                hideToastHelper(loadingToastId);
                
                // Verificar si es un error de permisos
                const errorMessage = error.message || 'No se pudo actualizar el proceso en la base de datos.';
                const isPermissionError = error.code === '42501' || error.code === 'PGRST301' || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('permiso');
                
                if (isPermissionError) {
                    showToastHelper('Error de permisos: No tienes permisos para actualizar procesos. Verifica tu rol de usuario.', 'error', 7000);
                } else {
                    showToastHelper(`Error al actualizar proceso: ${errorMessage}`, 'error', 7000);
                }
                
                // NO actualizar estado local si falla en BD - esto causa que parezca guardado pero no se guarde
                // Re-lanzar el error para que el componente pueda manejarlo
                throw error;
            }
        },
        reloadProcesses: async () => {
            try {
                const processes = await processesApi.getAll();
                setState(s => ({ ...s, processes }));
            } catch (error: any) {
                console.error('Error reloading processes:', error);
                
                // Detectar errores de CORS (con debouncing para evitar mensajes repetitivos)
                if (isCorsError(error)) {
                    const now = Date.now();
                    const timeSinceLastError = now - lastCorsErrorTime.current;
                    
                    // Solo mostrar el mensaje si han pasado al menos 5 minutos desde el último
                    if (timeSinceLastError >= CORS_ERROR_DEBOUNCE_MS) {
                        lastCorsErrorTime.current = now;
                        const corsMessage = getErrorMessage(error);
                        showToastHelper(
                            corsMessage,
                            'error',
                            15000
                        );
                    } else {
                        // Silenciar el error si ya se mostró recientemente
                        console.warn('CORS error detected but message suppressed (debounced)');
                    }
                    return;
                }
                
                const errorMessage = error.message || '';
                const errorCode = error.code || '';
                
                // Detectar errores de límite de egress/quota de Supabase
                const isQuotaError = errorMessage.includes('quota') || 
                                    errorMessage.includes('egress') || 
                                    errorMessage.includes('limit') ||
                                    errorMessage.includes('exceeded') ||
                                    errorCode === 'PGRST301' ||
                                    errorCode === 'PGRST302';
                
                if (isQuotaError) {
                    showToastHelper(
                        '⚠️ Límite de transferencia de Supabase alcanzado. Algunos cambios pueden no verse. Considera actualizar tu plan.',
                        'error',
                        10000
                    );
                } else {
                    // Solo mostrar error si no es silencioso (errores de red, permisos, etc.)
                    const isNetworkError = errorMessage.includes('network') || 
                                         errorMessage.includes('timeout') ||
                                         errorMessage.includes('fetch');
                    if (isNetworkError) {
                        showToastHelper(
                            '⚠️ Problema de conexión. Los cambios pueden no verse en tiempo real.',
                            'info',
                            5000
                        );
                    }
                }
            }
        },
        reloadCandidates: async () => {
            try {
                // Cargar relaciones (post-its, comments, history) para que persistan después de recargar
                const activeCandidates = await candidatesApi.getAll(false, true); // false = no archived, true = include relations
                
                // Preservar candidatos archivados existentes en el estado (incluyendo descartados)
                let preservedArchived: Candidate[] = [];
                setState(s => {
                    const archivedCandidates = s.candidates.filter(c => c.archived === true);
                    const activeIds = new Set(activeCandidates.map(c => c.id));
                    
                    // Mantener solo candidatos archivados que no están en los activos (para evitar duplicados)
                    preservedArchived = archivedCandidates.filter(c => !activeIds.has(c.id));
                    
                    return { 
                        ...s, 
                        candidates: [...activeCandidates, ...preservedArchived]
                    };
                });
                
                // Verificar y corregir carpetas de Google Drive si está conectado (en background, sin bloquear)
                const googleDriveConfig = state.settings?.googleDrive;
                const isGoogleDriveConnected = googleDriveConfig?.connected && googleDriveConfig?.accessToken;
                if (isGoogleDriveConnected && googleDriveConfig) {
                    // Ejecutar verificación en background sin bloquear la UI
                    (async () => {
                        try {
                            const { googleDriveService } = await import('./lib/googleDrive');
                            googleDriveService.initialize(googleDriveConfig);
                            
                            // Usar los candidatos combinados (activos + archivados preservados)
                            const allCandidates = [...activeCandidates, ...preservedArchived];
                            
                            // Verificar carpetas de candidatos que tienen proceso con carpeta configurada
                            for (const candidate of allCandidates) {
                                const process = state.processes.find(p => p.id === candidate.processId);
                                if (!process?.googleDriveFolderId) continue;
                                
                                try {
                                    // Buscar carpeta (incluso si no tiene una guardada, para encontrar carpetas huérfanas)
                                    const folder = await googleDriveService.getOrCreateCandidateFolder(
                                        candidate.name,
                                        process.googleDriveFolderId,
                                        candidate.googleDriveFolderId // Puede ser undefined
                                    );
                                    
                                    // Si el candidato no tenía carpeta o la carpeta encontrada es diferente, actualizar
                                    if (!candidate.googleDriveFolderId || folder.id !== candidate.googleDriveFolderId) {
                                        console.log(`🔄 ${!candidate.googleDriveFolderId ? 'Asociando' : 'Actualizando'} carpeta de candidato ${candidate.name}: ${candidate.googleDriveFolderId || '(sin carpeta)'} → ${folder.id}`);
                                        await candidatesApi.update(candidate.id, {
                                            ...candidate,
                                            googleDriveFolderId: folder.id,
                                            googleDriveFolderName: folder.name,
                                        }, state.currentUser?.id);
                                        
                                        // Actualizar estado local
                                        setState(s => ({
                                            ...s,
                                            candidates: s.candidates.map(c => 
                                                c.id === candidate.id 
                                                    ? { ...c, googleDriveFolderId: folder.id, googleDriveFolderName: folder.name }
                                                    : c
                                            )
                                        }));
                                    }
                                } catch (error) {
                                    // Ignorar errores individuales para no bloquear el proceso
                                    console.warn(`Error verificando carpeta para candidato ${candidate.name}:`, error);
                                }
                            }
                        } catch (error) {
                            console.warn('Error verificando carpetas de Google Drive:', error);
                            // No mostrar error al usuario, es una verificación en background
                        }
                    })();
                }
            } catch (error: any) {
                console.error('Error reloading candidates:', error);
                
                // Detectar errores de CORS (con debouncing para evitar mensajes repetitivos)
                if (isCorsError(error)) {
                    const now = Date.now();
                    const timeSinceLastError = now - lastCorsErrorTime.current;
                    
                    // Solo mostrar el mensaje si han pasado al menos 5 minutos desde el último
                    if (timeSinceLastError >= CORS_ERROR_DEBOUNCE_MS) {
                        lastCorsErrorTime.current = now;
                        const corsMessage = getErrorMessage(error);
                        showToastHelper(
                            corsMessage,
                            'error',
                            15000
                        );
                    } else {
                        // Silenciar el error si ya se mostró recientemente
                        console.warn('CORS error detected but message suppressed (debounced)');
                    }
                    return;
                }
                
                const errorMessage = error.message || '';
                const errorCode = error.code || '';
                
                // Detectar errores de límite de egress/quota de Supabase
                const isQuotaError = errorMessage.includes('quota') || 
                                    errorMessage.includes('egress') || 
                                    errorMessage.includes('limit') ||
                                    errorMessage.includes('exceeded') ||
                                    errorCode === 'PGRST301' ||
                                    errorCode === 'PGRST302';
                
                if (isQuotaError) {
                    showToastHelper(
                        '⚠️ Límite de transferencia de Supabase alcanzado. Algunos cambios pueden no verse. Considera actualizar tu plan.',
                        'error',
                        10000
                    );
                } else {
                    // Solo mostrar error si no es silencioso (errores de red, permisos, etc.)
                    const isNetworkError = errorMessage.includes('network') || 
                                         errorMessage.includes('timeout') ||
                                         errorMessage.includes('fetch');
                    if (isNetworkError) {
                        showToastHelper(
                            '⚠️ Problema de conexión. Los cambios pueden no verse en tiempo real.',
                            'info',
                            5000
                        );
                    }
                }
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
            const loadingToastId = showToastHelper('Creando candidato...', 'loading', 0);
            try {
                // Si Google Drive está conectado y el proceso tiene carpeta, crear carpeta del candidato
                let folderId = candidateData.googleDriveFolderId;
                let folderName = candidateData.googleDriveFolderName;
                
                const googleDriveConfig = state.settings?.googleDrive;
                const isGoogleDriveConnected = googleDriveConfig?.connected && googleDriveConfig?.accessToken;
                const process = state.processes.find(p => p.id === candidateData.processId);
                const processHasFolder = process?.googleDriveFolderId;
                
                if (isGoogleDriveConnected && googleDriveConfig && processHasFolder) {
                    try {
                        hideToastHelper(loadingToastId);
                        const folderToastId = showToastHelper('Verificando carpeta en Google Drive...', 'loading', 0);
                        const { googleDriveService } = await import('./lib/googleDrive');
                        googleDriveService.initialize(googleDriveConfig);
                        
                        // Usar getOrCreateCandidateFolder para evitar duplicados
                        // Si ya hay una carpeta guardada, la verifica. Si no, busca por nombre o crea una nueva.
                        const candidateFolderName = candidateData.name || `Candidato_${Date.now()}`;
                        const folder = await googleDriveService.getOrCreateCandidateFolder(
                            candidateFolderName,
                            process.googleDriveFolderId,
                            folderId // Pasar la carpeta existente si hay una
                        );
                        folderId = folder.id;
                        folderName = folder.name;
                        console.log(`✅ Carpeta del candidato identificada/creada en Google Drive: ${folderName} (${folderId}) dentro de ${process.googleDriveFolderName}`);
                        hideToastHelper(folderToastId);
                        const savingToastId = showToastHelper('Guardando candidato...', 'loading', 0);
                        hideToastHelper(savingToastId);
                    } catch (error: any) {
                        console.error('Error verificando/creando carpeta del candidato:', error);
                        // Continuar sin carpeta si falla
                    }
                }
                
                const candidateDataWithFolder = {
                    ...candidateData,
                    googleDriveFolderId: folderId,
                    googleDriveFolderName: folderName,
                };
                
                const newCandidate = await candidatesApi.create(candidateDataWithFolder, state.currentUser?.id);
                
                // Recargar el candidato desde la BD para asegurar que tiene todos los datos (attachments, history, etc.)
                try {
                    const reloadedCandidate = await candidatesApi.getById(newCandidate.id);
                    if (reloadedCandidate) {
                        // Actualizar estado con el candidato completo recargado desde la BD
                        setState(s => {
                            // Verificar si ya existe (por si acaso)
                            const existingIndex = s.candidates.findIndex(c => c.id === reloadedCandidate.id);
                            if (existingIndex >= 0) {
                                // Reemplazar el existente
                                const updated = [...s.candidates];
                                updated[existingIndex] = reloadedCandidate;
                                return { ...s, candidates: updated };
                            } else {
                                // Agregar nuevo
                                return { ...s, candidates: [...s.candidates, reloadedCandidate] };
                            }
                        });
                    } else {
                        // Si no se puede recargar, usar el que se creó
                setState(s => ({ ...s, candidates: [...s.candidates, newCandidate] }));
                    }
                } catch (reloadError) {
                    console.warn('Error recargando candidato después de crear, usando el retornado:', reloadError);
                    // Si falla la recarga, usar el candidato retornado
                setState(s => ({ ...s, candidates: [...s.candidates, newCandidate] }));
                }
                
                hideToastHelper(loadingToastId);
                showToastHelper('Candidato creado exitosamente', 'success');
            } catch (error: any) {
                console.error('Error adding candidate:', error);
                hideToastHelper(loadingToastId);
                
                // Verificar si es un error de permisos
                const errorMessage = error.message || 'No se pudo crear el candidato en la base de datos.';
                const isPermissionError = error.code === '42501' || error.code === 'PGRST301' || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('permiso');
                
                if (isPermissionError) {
                    showToastHelper('Error de permisos: No tienes permisos para crear candidatos. Verifica tu rol de usuario.', 'error', 7000);
                } else {
                    showToastHelper(`Error al crear candidato: ${errorMessage}`, 'error', 7000);
                }
                
                // NO crear candidato local si falla en BD - esto causa que aparezca pero no se guarde
                // Re-lanzar el error para que el componente pueda manejarlo si es necesario
                throw error;
            }
        },
        updateCandidate: async (candidateData, movedBy) => {
            const loadingToastId = showToastHelper('Guardando cambios del candidato...', 'loading', 0);
            try {
                // Si se está cambiando la etapa (stageId), limpiar criticalStageReviewedAt
                const currentCandidate = state.candidates.find(c => c.id === candidateData.id);
                let updatedCandidateData = candidateData;
                
                if (currentCandidate && candidateData.stageId !== currentCandidate.stageId) {
                    // El candidato se movió a otra etapa, limpiar la marca de revisado
                    updatedCandidateData = {
                        ...candidateData,
                        criticalStageReviewedAt: undefined
                    };
                }
                
                const updated = await candidatesApi.update(updatedCandidateData.id, updatedCandidateData, movedBy || state.currentUser?.name || 'System');
                // Actualizar candidato en el estado, preservando si está archivado
                setState(s => {
                    const existingIndex = s.candidates.findIndex(c => c.id === candidateData.id);
                    if (existingIndex >= 0) {
                        // Reemplazar el candidato existente
                        const updatedCandidates = [...s.candidates];
                        updatedCandidates[existingIndex] = updated;
                        return { ...s, candidates: updatedCandidates };
                    } else {
                        // Si no existe (puede ser un candidato archivado), agregarlo
                        return { ...s, candidates: [...s.candidates, updated] };
                    }
                });
                hideToastHelper(loadingToastId);
                showToastHelper('Candidato actualizado exitosamente', 'success');
            } catch (error: any) {
                console.error('Error updating candidate:', error);
                hideToastHelper(loadingToastId);
                
                // Verificar si es un error de permisos
                const errorMessage = error.message || 'No se pudo actualizar el candidato en la base de datos.';
                const isPermissionError = error.code === '42501' || error.code === 'PGRST301' || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('permiso');
                
                if (isPermissionError) {
                    showToastHelper('Error de permisos: No tienes permisos para actualizar candidatos. Verifica tu rol de usuario.', 'error', 7000);
                } else {
                    showToastHelper(`Error al actualizar candidato: ${errorMessage}`, 'error', 7000);
                }
                
                // NO actualizar estado local si falla en BD - esto causa que parezca guardado pero no se guarde
                // Re-lanzar el error para que el componente pueda manejarlo
                throw error;
            }
        },
        deleteCandidate: async (candidateId) => {
            try {
                await candidatesApi.delete(candidateId);
                setState(s => ({ ...s, candidates: s.candidates.filter(c => c.id !== candidateId) }));
            } catch (error: any) {
                console.error('Error deleting candidate:', error);
                // Verificar si es un error de permisos
                const errorMessage = error.message || 'No se pudo eliminar el candidato de la base de datos.';
                const isPermissionError = error.code === '42501' || error.code === 'PGRST301' || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('permiso');
                
                if (isPermissionError) {
                    showToastHelper('Error de permisos: No tienes permisos para eliminar candidatos. Verifica tu rol de usuario.', 'error', 7000);
                } else {
                    showToastHelper(`Error al eliminar candidato: ${errorMessage}`, 'error', 7000);
                }
                
                // NO eliminar del estado local si falla en BD - esto causa que parezca eliminado pero no se eliminó
                throw error;
            }
        },
        moveCandidateToProcess: async (candidateId, targetProcessId) => {
            const candidate = state.candidates.find(c => c.id === candidateId);
            const targetProcess = state.processes.find(p => p.id === targetProcessId);

            if (!candidate || !targetProcess || !targetProcess.stages.length) {
                throw new Error('Candidato o proceso no encontrado, o el proceso no tiene etapas');
            }

                const firstStageId = targetProcess.stages[0].id;
            const movedBy = state.currentUser?.name || 'System';

            try {
                // Actualizar en la base de datos usando updateCandidate
                const updatedCandidate: Candidate = {
                    ...candidate,
                    processId: targetProcessId,
                    stageId: firstStageId,
                };

                await actions.updateCandidate(updatedCandidate, movedBy);
            } catch (error: any) {
                console.error('Error moving candidate to process:', error);
                const errorMessage = error.message || 'No se pudo mover el candidato al proceso.';
                showToastHelper(`Error al mover candidato: ${errorMessage}`, 'error', 7000);
                throw error;
            }
        },
        duplicateCandidateToProcess: async (candidateId, targetProcessId) => {
            const originalCandidate = state.candidates.find(c => c.id === candidateId);
            const targetProcess = state.processes.find(p => p.id === targetProcessId);

            if (!originalCandidate || !targetProcess || !targetProcess.stages.length) {
                throw new Error('Candidato o proceso no encontrado, o el proceso no tiene etapas');
            }

                const firstStageId = targetProcess.stages[0].id;

            try {
                // Crear nuevo candidato en la base de datos usando addCandidate
                const { id, history, ...candidateData } = originalCandidate;
                await actions.addCandidate({
                    ...candidateData,
                    processId: targetProcessId,
                    stageId: firstStageId,
                    archived: false,
                });
            } catch (error: any) {
                console.error('Error duplicating candidate to process:', error);
                const errorMessage = error.message || 'No se pudo duplicar el candidato al proceso.';
                showToastHelper(`Error al duplicar candidato: ${errorMessage}`, 'error', 7000);
                throw error;
            }
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
            } catch (error: any) {
                console.error('Error archiving candidate:', error);
                const errorMessage = error.message || 'No se pudo archivar el candidato.';
                const isPermissionError = error.code === '42501' || error.code === 'PGRST301' || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('permiso');
                
                if (isPermissionError) {
                    showToastHelper('Error de permisos: No tienes permisos para archivar candidatos. Verifica tu rol de usuario.', 'error', 7000);
                } else {
                    showToastHelper(`Error al archivar candidato: ${errorMessage}`, 'error', 7000);
                }
                
                // NO actualizar estado local si falla en BD
                throw error;
            }
        },
        restoreCandidate: async (candidateId) => {
            try {
                const updated = await candidatesApi.restore(candidateId);
                setState(s => ({ ...s, candidates: s.candidates.map(c => c.id === candidateId ? updated : c) }));
            } catch (error: any) {
                console.error('Error restoring candidate:', error);
                const errorMessage = error.message || 'No se pudo restaurar el candidato.';
                const isPermissionError = error.code === '42501' || error.code === 'PGRST301' || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('permiso');
                
                if (isPermissionError) {
                    showToastHelper('Error de permisos: No tienes permisos para restaurar candidatos. Verifica tu rol de usuario.', 'error', 7000);
                } else {
                    showToastHelper(`Error al restaurar candidato: ${errorMessage}`, 'error', 7000);
                }
                
                // NO actualizar estado local si falla en BD
                throw error;
            }
        },
        discardCandidate: async (candidateId, reason) => {
            const loadingToastId = showToastHelper('Descartando candidato...', 'loading', 0);
            try {
                const candidate = state.candidates.find(c => c.id === candidateId);
                if (!candidate) {
                    throw new Error('Candidato no encontrado');
                }

                // Marcar como descartado y archivado
                const updatedCandidate: Candidate = {
                    ...candidate,
                    discarded: true,
                    discardReason: reason,
                    discardedAt: new Date().toISOString(),
                    archived: true,
                    archivedAt: new Date().toISOString(),
                };

                const updated = await candidatesApi.update(candidateId, updatedCandidate, state.currentUser?.id);
                // Actualizar candidato en el estado, asegurándose de que se mantenga aunque esté archivado
                setState(s => {
                    const existingIndex = s.candidates.findIndex(c => c.id === candidateId);
                    if (existingIndex >= 0) {
                        // Reemplazar el candidato existente con el actualizado (que incluye discarded y archived)
                        const updatedCandidates = [...s.candidates];
                        updatedCandidates[existingIndex] = updated;
                        return { ...s, candidates: updatedCandidates };
                    } else {
                        // Si no existe (no debería pasar), agregarlo
                        return { ...s, candidates: [...s.candidates, updated] };
                    }
                });
                hideToastHelper(loadingToastId);
                showToastHelper('Candidato descartado y archivado exitosamente', 'success', 3000);
            } catch (error: any) {
                console.error('Error discarding candidate:', error);
                hideToastHelper(loadingToastId);
                const errorMessage = error.message || 'No se pudo descartar el candidato.';
                const isPermissionError = error.code === '42501' || error.code === 'PGRST301' || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('permiso');
                
                if (isPermissionError) {
                    showToastHelper('Error de permisos: No tienes permisos para descartar candidatos. Verifica tu rol de usuario.', 'error', 7000);
                } else {
                    showToastHelper(`Error al descartar candidato: ${errorMessage}`, 'error', 7000);
                }
                
                throw error;
            }
        },
        loadArchivedCandidates: async () => {
            try {
                // Cargar solo candidatos archivados (incluye descartados) con relaciones
                const archivedCandidates = await candidatesApi.getAll(true, true); // true = include archived, true = include relations
                // Agregar/actualizar candidatos archivados en el estado sin eliminar los no archivados
                setState(s => {
                    const existingCandidatesMap = new Map(s.candidates.map(c => [c.id, c]));
                    const updatedCandidates = [...s.candidates];
                    
                    // Actualizar candidatos existentes o agregar nuevos
                    archivedCandidates.forEach(archivedCandidate => {
                        const existingIndex = updatedCandidates.findIndex(c => c.id === archivedCandidate.id);
                        if (existingIndex >= 0) {
                            // Actualizar candidato existente (importante para mantener campos como discarded)
                            updatedCandidates[existingIndex] = archivedCandidate;
                        } else {
                            // Agregar nuevo candidato archivado
                            updatedCandidates.push(archivedCandidate);
                        }
                    });
                    
                    return {
                        ...s,
                        candidates: updatedCandidates
                    };
                });
            } catch (error: any) {
                console.error('Error loading archived candidates:', error);
                const errorMessage = error.message || '';
                const isQuotaError = errorMessage.includes('quota') || 
                                    errorMessage.includes('egress') || 
                                    errorMessage.includes('limit') ||
                                    errorMessage.includes('exceeded');
                if (isQuotaError) {
                    showToastHelper(
                        '⚠️ Límite de transferencia alcanzado. No se pudieron cargar candidatos archivados.',
                        'error',
                        5000
                    );
                } else {
                    showToastHelper('Error al cargar candidatos archivados', 'error', 3000);
                }
            }
        },
        showToast: (message: string, type: 'success' | 'error' | 'loading' | 'info', duration?: number) => {
            return showToastHelper(message, type, duration);
        },
        hideToast: (id: string) => {
            hideToastHelper(id);
        },
    }), [state.currentUser, state.users]);

    // Sincronización automática DESHABILITADA para reducir consumo de compute hours
    // La sincronización ahora es manual mediante el botón "Actualizar" en el sidebar
    // Esto evita llamadas innecesarias a Supabase cuando no hay usuarios activos
    // 
    // Si necesitas sincronización automática en el futuro, puedes:
    // 1. Habilitarla solo cuando detectes actividad del usuario (clicks, teclas, etc.)
    // 2. Usar un intervalo mucho más largo (ej: 10-15 minutos)
    // 3. Verificar que el usuario esté realmente activo (no solo la pestaña visible)
    //
    // useEffect(() => {
    //     if (!state.currentUser) return;
    //     // ... código de sincronización
    // }, [state.currentUser, actions]);

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
                <div className="flex-1 flex flex-col overflow-y-auto min-h-0 pt-16 md:pt-0">
                    {renderView()}
                </div>
                <ToastContainer toasts={state.toasts || []} onClose={(id) => hideToastHelper(id)} />
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