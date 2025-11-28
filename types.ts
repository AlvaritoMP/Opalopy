// types.ts

export interface Stage {
    id: string;
    name: string;
    requiredDocuments?: string[]; // IDs de categorías de documentos requeridas para avanzar a esta etapa
    isCritical?: boolean; // Indica si esta etapa es crítica y requiere atención
}

export interface Attachment {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
    category?: string; // Categoría del documento (ej: "CV", "DNI", "Contrato", etc.)
    uploadedAt?: string; // Fecha de subida
}

export type ProcessStatus = 'en_proceso' | 'standby' | 'terminado';

export interface DocumentCategory {
    id: string;
    name: string;
    description?: string;
    required: boolean; // Si es requerido para el proceso
}

export interface Process {
    id: string;
    title: string;
    description: string;
    stages: Stage[];
    salaryRange?: string;
    experienceLevel?: string;
    seniority?: string;
    flyerUrl?: string;
    flyerPosition?: string; // Posición del background (ej: "50% 30%", "center top", etc.)
    attachments: Attachment[];
    serviceOrderCode?: string;
    startDate?: string;
    endDate?: string;
    status: ProcessStatus;
    vacancies: number;
    documentCategories?: DocumentCategory[]; // Categorías de documentos definidas para este proceso
    googleDriveFolderId?: string; // ID de la carpeta de Google Drive para este proceso
    googleDriveFolderName?: string; // Nombre de la carpeta (para mostrar)
    publishedDate?: string; // Fecha de publicación de la oferta (para Time to Hire)
    needIdentifiedDate?: string; // Fecha de identificación de necesidad (para Time to Fill)
}

export interface CandidateHistory {
    stageId: string;
    movedAt: string;
    movedBy: string;
}

export type CandidateSource = 'LinkedIn' | 'Referral' | 'Website' | 'Other' | string; // Permite strings personalizados desde configuración

export interface PostIt {
    id: string;
    text: string;
    color: 'yellow' | 'pink' | 'blue' | 'green' | 'orange';
    createdBy: string; // userId
    createdAt: string; // ISO date string
}

export interface Comment {
    id: string;
    text: string;
    userId: string; // userId del usuario que hizo el comentario
    createdAt: string; // ISO date string
    attachments?: Attachment[]; // Fotos o capturas de pantalla
}

export interface Candidate {
    id: string;
    name: string;
    email: string;
    phone?: string;
    phone2?: string; // Segundo número de teléfono
    processId: string;
    stageId: string;
    description?: string;
    history: CandidateHistory[];
    avatarUrl?: string;
    attachments: Attachment[];
    source?: CandidateSource | string;
    salaryExpectation?: string;
    agreedSalary?: string; // Salario acordado con el candidato
    agreedSalaryInWords?: string; // Salario acordado en letras (generado automáticamente)
    age?: number;
    dni?: string;
    linkedinUrl?: string;
    address?: string;
    province?: string; // Provincia del candidato
    district?: string; // Distrito del candidato
    postIts?: PostIt[]; // Post-its para el board
    comments?: Comment[]; // Comentarios/chat sobre el candidato
    archived?: boolean;
    archivedAt?: string;
    discarded?: boolean; // Si el candidato fue descartado del proceso
    discardReason?: string; // Motivo del descarte
    discardedAt?: string; // Fecha de descarte
    hireDate?: string;
    googleDriveFolderId?: string; // Carpeta del candidato en Google Drive (dentro de la carpeta del proceso)
    googleDriveFolderName?: string; // Nombre de la carpeta del candidato
    visibleToClients?: boolean; // Si es visible para usuarios tipo cliente/viewer
    offerAcceptedDate?: string; // Fecha de aceptación de oferta (para Time to Hire)
    applicationStartedDate?: string; // Fecha de inicio de solicitud (para Application Completion Rate)
    applicationCompletedDate?: string; // Fecha de finalización de solicitud (para Application Completion Rate)
    criticalStageReviewedAt?: string; // Fecha en que un usuario revisó el candidato en etapa crítica (para ocultar alertas)
}

export type UserRole = 'admin' | 'recruiter' | 'client' | 'viewer';

// Sistema de permisos por categorías
export type Permission = 
    // Procesos
    | 'processes.view' | 'processes.create' | 'processes.edit' | 'processes.delete'
    // Candidatos
    | 'candidates.view' | 'candidates.create' | 'candidates.edit' | 'candidates.delete' | 'candidates.archive' | 'candidates.export'
    // Calendario
    | 'calendar.view' | 'calendar.create' | 'calendar.edit' | 'calendar.delete'
    // Reportes
    | 'reports.view' | 'reports.export'
    // Usuarios
    | 'users.view' | 'users.create' | 'users.edit' | 'users.delete'
    // Configuración
    | 'settings.view' | 'settings.edit'
    // Cartas/Documentos
    | 'letters.view' | 'letters.create' | 'letters.download'
    // Comparador
    | 'comparator.view' | 'comparator.export'
    // Formularios
    | 'forms.view' | 'forms.edit';

export interface PermissionCategory {
    id: string;
    name: string;
    description?: string;
    permissions: Permission[];
}

export type Section = 
    | 'dashboard' 
    | 'processes' 
    | 'archived' 
    | 'candidates' 
    | 'forms' 
    | 'letters' 
    | 'calendar' 
    | 'reports' 
    | 'compare' 
    | 'bulk-import' 
    | 'users' 
    | 'settings';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    password?: string;
    avatarUrl?: string;
    permissions?: Permission[]; // Permisos personalizados (sobrescribe los del rol)
    visibleSections?: Section[]; // Secciones visibles en el menú (si no se define, usa las del rol por defecto)
}

// Basic definitions for unused types to satisfy compiler
export interface Form {
    id: string;
    name: string;
}

export interface Application {
    id: string;
    candidateId: string;
    processId: string;
}

export interface GoogleDriveConfig {
    connected: boolean;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: string;
    userEmail?: string;
    userName?: string;
    rootFolderId?: string; // Carpeta raíz en Google Drive (puede ser "ATS Pro" o cualquier otra)
    rootFolderName?: string; // Nombre de la carpeta raíz
}

export interface AppSettings {
    database: {
        apiUrl: string;
        apiToken: string;
    };
    fileStorage: {
        provider: string;
        connected: boolean;
    };
    googleDrive?: GoogleDriveConfig;
    currencySymbol: string;
    appName: string;
    logoUrl: string;
    poweredByLogoUrl?: string; // Logo para mostrar en el footer del sidebar con "POWERED BY"
    customLabels: { [key: string]: string };
    dashboardLayout?: string[]; // orden de widgets del dashboard
    templates?: { id: string; name: string; docxBase64: string }[]; // plantillas DOCX guardadas
    reportTheme?: {
        primaryColor?: string; // hex
        accentColor?: string;  // hex
        coverTitle?: string;
        footerText?: string;
    };
    candidateSources?: string[]; // Opciones configurables para el campo "fuentes" de candidatos
    provinces?: string[]; // Opciones configurables para el campo "provincia" de candidatos
    districts?: { [province: string]: string[] }; // Opciones configurables para el campo "distrito" de candidatos, organizadas por provincia
}

export interface FormIntegration {
    id: string;
    platform: 'Tally' | 'Google Forms' | 'Microsoft Forms' | string;
    formName: string;
    formIdOrUrl: string;
    processId: string;
    webhookUrl: string;
}

export interface InterviewEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    candidateId: string;
    interviewerId: string;
    notes?: string;
    attendeeEmails?: string[]; // Emails de los asistentes a la reunión
}