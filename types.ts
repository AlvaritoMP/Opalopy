// types.ts

export type StageColorId =
    | 'blue'
    | 'green'
    | 'yellow'
    | 'orange'
    | 'red'
    | 'purple'
    | 'pink'
    | 'cyan'
    | 'indigo'
    | 'slate';

export interface Stage {
    id: string;
    name: string;
    requiredDocuments?: string[]; // IDs de categorías de documentos requeridas para avanzar a esta etapa
    isCritical?: boolean; // Indica si esta etapa es crítica y requiere atención
    color?: StageColorId; // Color para identificar la etapa en la tabla de alta densidad
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

export interface Client {
    id: string;
    razonSocial: string;
    ruc: string;
    createdAt?: string;
    updatedAt?: string;
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
    clientId?: string; // ID del cliente al que pertenece el proceso
    client?: Client; // Información del cliente (opcional, para cuando se carga con JOIN)
    isBulkProcess?: boolean; // Indica si es un proceso masivo (se gestiona en Procesos Masivos, no en Procesos normal)
    bulkConfig?: BulkProcessConfig; // Configuración específica para procesos masivos
    hiredCandidateIds?: string[]; // IDs de candidatos contratados al cerrar el proceso
    closedAt?: string; // Fecha y hora en que se cerró el proceso
}

/** Cómo usa el informe psicolaboral el valor de la columna al armar “Nombre y apellidos” (si no se indica, se infiere del encabezado). */
export type PsycholaboralReportNamePart =
    | 'given_names'
    | 'paternal_surname'
    | 'maternal_surname'
    | 'surnames_combined';

// Columna personalizada para la tabla de alta densidad en procesos masivos
export interface CustomColumn {
    id: string;
    name: string;
    type: 'text' | 'number' | 'checkbox' | 'date' | 'select' | 'route' | 'route_cost';
    options?: string[];
    /** Dirección de destino para columnas tipo ruta (transporte público). */
    routeDestination?: string;
    /** ID de columna tipo route de referencia para estimar costo aproximado del tramo. */
    sourceRouteColumnId?: string;
    /**
     * Costo de ruta: solo se consulta Google Maps cuando el usuario lo pide.
     * Siempre true para columnas route_cost; el valor calculado se persiste en BD.
     */
    routeCostOnDemand?: boolean;
    /** Marca explícita para el PDF psicolaboral (opcional). */
    reportNamePart?: PsycholaboralReportNamePart;
    /**
     * Campo semántico para Panel e informes cuando el encabezado no coincide
     * con nombres estándar (p. ej. "¿Cómo se enteró?" → fuente).
     */
    dashboardSemanticField?: DashboardSemanticField;
}

/** Clasificación de columna para gráficos del Panel y agregaciones. */
export type DashboardSemanticField =
    | 'source'
    | 'province'
    | 'district'
    | 'age'
    | 'interview_attendance'
    | 'interview_date';

export const DASHBOARD_SEMANTIC_FIELD_OPTIONS: {
    value: DashboardSemanticField;
    label: string;
    chartHint: string;
}[] = [
    { value: 'source', label: 'Fuente de candidato', chartHint: 'Fuentes de candidatos' },
    { value: 'district', label: 'Distrito', chartHint: 'Candidatos por distrito' },
    { value: 'province', label: 'Provincia', chartHint: 'Panel / filtros' },
    { value: 'age', label: 'Edad', chartHint: 'Distribución por edad' },
    { value: 'interview_attendance', label: 'Asistencia a cita', chartHint: 'Agendamiento · citas con asistencia' },
    { value: 'interview_date', label: 'Fecha de cita', chartHint: 'Agendamiento · agendas registradas' },
];

// --- Informes psicolaborales ---

export type IntellectualLevelId =
    | 'inferior'
    | 'normal_inferior'
    | 'normal_promedio'
    | 'normal_superior'
    | 'superior';

export type PersonalityLevel = 'bajo' | 'promedio' | 'alto';

export type PsycholaboralSuitability = 'apto' | 'no_apto' | 'apto_reservas';

export interface IntellectualLevelDefinition {
    id: IntellectualLevelId;
    name: string;
    scoreRange: string;
    interpretation: string;
}

export interface PersonalityTraitDefinition {
    id: string;
    name: string;
    definition: string;
}

export interface PsycholaboralCompetency {
    id: string;
    name: string;
    definition: string;
    expectedScore: number;
}

export interface PsycholaboralCompetencySet {
    id: string;
    name: string;
    competencies: PsycholaboralCompetency[];
}

export interface ConclusionTemplate {
    id: string;
    name: string;
    template: string;
}

export interface PsycholaboralInventory {
    intellectualLevels: IntellectualLevelDefinition[];
    personalityTraits: PersonalityTraitDefinition[];
    competencySets: PsycholaboralCompetencySet[];
    conclusionTemplates: ConclusionTemplate[];
}

export interface PsycholaboralProcessConfig {
    enabled?: boolean;
    competencySetId?: string;
    competencies?: PsycholaboralCompetency[];
    defaultPositionTitle?: string;
    defaultConclusionTemplateId?: string;
}

export interface PsycholaboralPersonalityRating {
    traitId: string;
    level: PersonalityLevel;
    observations: string;
}

export interface PsycholaboralCompetencyRating {
    competencyId: string;
    obtainedScore: number;
    observations: string;
}

export interface PsycholaboralEvaluation {
    intellectualLevelId: IntellectualLevelId;
    intellectualScore?: number;
    personality: PsycholaboralPersonalityRating[];
    competencies: PsycholaboralCompetencyRating[];
    conclusions: string;
    suitabilityStatus?: PsycholaboralSuitability;
    reportDate?: string;
    evaluatedAt?: string;
    positionApplied?: string;
}

// Configuración para procesos masivos
export interface BulkProcessConfig {
    killerQuestions?: KillerQuestion[]; // Preguntas automáticas que filtran candidatos
    aiPrompt?: string; // Prompt específico para OpenAI al analizar CVs
    scoreThreshold?: number; // Score mínimo (0-100) para que un candidato aparezca en la vista principal
    whatsappEnabled?: boolean; // Habilitar acceso rápido a WhatsApp
    whatsappMessageTemplate?: string; // Plantilla de mensaje para WhatsApp
    autoFilterEnabled?: boolean; // Activar filtrado automático basado en killer questions y score
    customColumns?: CustomColumn[]; // Columnas personalizadas para la tabla de alta densidad
    hiddenColumns?: string[]; // IDs de columnas ocultas
    columnOrder?: string[]; // Orden de columnas (base + custom_*)
    pinnedColumns?: string[]; // Columnas inmovilizadas al hacer scroll horizontal
    /** Anchos de columna en px (id de columna → ancho). Persistido por proceso. */
    columnWidths?: Record<string, number>;
    /** Colores de etapas por ID (respaldo en JSON del proceso masivo) */
    stageColors?: Record<string, StageColorId>;
    /** Colores de etapas por nombre (respaldo si cambian los IDs) */
    stageColorsByName?: Record<string, StageColorId>;
    /** ID de columna personalizada → nombre (para resolver valores guardados con IDs antiguos) */
    columnKeyAliases?: Record<string, string>;
    psycholaboral?: PsycholaboralProcessConfig;
    /** Perfil ideal para comparar candidatos del proceso masivo */
    idealProfile?: IdealProfileConfig;
    /** Gráficos personalizados del proceso masivo (columna + tipo) */
    customStats?: BulkProcessStatChart[];
    /** Referencias rápidas tipo post-it (título + contenido) visibles en la tabla */
    infoPins?: BulkInfoPin[];
    /** Respuestas rápidas copiables al portapapeles (texto + adjuntos) */
    quickReplies?: BulkQuickReply[];
    /** Plantillas predefinidas de correo y WhatsApp para contactar candidatos */
    contactMessageTemplates?: BulkContactMessageTemplate[];
    /** Proceso específico con vista de tabla alta densidad activada al menos una vez */
    highDensityTableEnabled?: boolean;
}

export type BulkContactMessageChannel = 'email' | 'whatsapp';

/** Plantilla de mensaje para contactar candidatos (correo o WhatsApp) */
export interface BulkContactMessageTemplate {
    id: string;
    name: string;
    channel: BulkContactMessageChannel;
    /** Solo para canal email */
    subject?: string;
    body: string;
}

export type BulkInfoPinColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple';

/** Nota de referencia rápida en procesos masivos */
export interface BulkInfoPin {
    id: string;
    title: string;
    content: string;
    color?: BulkInfoPinColor;
    /** PNG en data URL (base64); permite consulta con desplazamiento en el panel flotante */
    imageDataUrl?: string;
    imageFileName?: string;
}

export type BulkQuickReplyAttachmentType = 'image' | 'video' | 'file';

/** Adjunto de una respuesta rápida (imagen, video o archivo embebido o enlace) */
export interface BulkQuickReplyAttachment {
    id: string;
    type: BulkQuickReplyAttachmentType;
    fileName: string;
    mimeType?: string;
    /** Contenido embebido en data URL (base64) */
    dataUrl?: string;
    /** Enlace externo (YouTube, Drive, etc.) */
    url?: string;
}

/** Respuesta rápida copiable al portapapeles en procesos masivos */
export interface BulkQuickReply {
    id: string;
    title: string;
    content: string;
    color?: BulkInfoPinColor;
    attachments?: BulkQuickReplyAttachment[];
}

/** Tipo de gráfico para estadísticas del proceso masivo */
export type BulkStatChartType = 'bar' | 'horizontalBar' | 'pie' | 'line';

/** Escala del eje numérico */
export type BulkStatAxisScale = 'auto' | 'linear' | 'log';

/** Configuración de un eje del gráfico */
export interface BulkStatAxisConfig {
    label?: string;
    min?: number;
    max?: number;
    scale?: BulkStatAxisScale;
}

/** Serie de datos dentro de un gráfico (permite varias columnas en el mismo gráfico) */
export interface BulkStatSeries {
    id: string;
    columnId: string;
    label?: string;
    color?: string;
}

/** Orden de categorías en el eje X */
export type BulkStatSortBy = 'auto' | 'category' | 'valueDesc' | 'valueAsc';

/** Agrupación temporal para columnas de fecha en el eje X */
export type BulkStatDateGranularity = 'day' | 'week' | 'month' | 'year';

/**
 * Modo al usar varias series:
 * - crossTab: cuántos candidatos cumplen A y B (eje X = A, eje Y = cantidades, leyenda = valores de B)
 * - overlay: superponer conteos de cada columna sobre las mismas etiquetas del eje X
 */
export type BulkStatSeriesMode = 'crossTab' | 'overlay';

/** Configuración de un gráfico personalizado en el proceso masivo */
export interface BulkProcessStatChart {
    id: string;
    /** Columna principal (compatibilidad con gráficos guardados antes de series) */
    columnId: string;
    chartType: BulkStatChartType;
    title?: string;
    /** Varias columnas en el mismo gráfico */
    series?: BulkStatSeries[];
    axisX?: BulkStatAxisConfig;
    axisY?: BulkStatAxisConfig;
    showGrid?: boolean;
    showLegend?: boolean;
    /** Apilar barras cuando hay varias series */
    stacked?: boolean;
    sortBy?: BulkStatSortBy;
    /** Agrupación del eje X cuando la columna es de tipo fecha */
    dateGranularity?: BulkStatDateGranularity;
    /** Cómo combinar varias columnas (cruce vs superposición) */
    seriesMode?: BulkStatSeriesMode;
}

/** Modo de comparación por criterio del perfil ideal */
export type IdealProfileMatchMode =
    | 'exact'
    | 'contains'
    | 'minimum'
    | 'maximum'
    | 'range';

/** Criterio individual del perfil ideal (mapea a una columna del proceso) */
export interface IdealProfileCriterion {
    /** ID de columna: base (p. ej. source) o custom_{uuid} */
    fieldId: string;
    enabled: boolean;
    idealValue?: string | number | boolean;
    /** Valor o texto que NO debe aparecer en el campo del candidato */
    excludeValue?: string | number | boolean;
    /** Valor máximo para modo range o maximum */
    maxValue?: number;
    matchMode?: IdealProfileMatchMode;
    /** Peso relativo en el score total (default 1) */
    weight?: number;
}

/** Configuración del perfil ideal para procesos masivos */
export interface IdealProfileConfig {
    enabled?: boolean;
    criteria: IdealProfileCriterion[];
    /** Umbral verde (>=): default 80 */
    greenThreshold?: number;
    /** Umbral amarillo (>=): default 50 — por debajo es rojo */
    yellowThreshold?: number;
}

// Pregunta "killer" para filtrado automático en procesos masivos
export interface KillerQuestion {
    id: string;
    question: string; // Texto de la pregunta
    type: 'yes_no' | 'multiple_choice'; // Tipo de pregunta
    options?: string[]; // Opciones para multiple_choice
    correctAnswer: string | string[]; // Respuesta(s) correcta(s) que permiten pasar el filtro
    required: boolean; // Si es requerida para pasar
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
    /** Origen de incorporación al proceso masivo: formulario, manual o carga masiva */
    registrationOrigin?: 'formulario' | 'manual' | 'masivo';
    createdBy?: string;
    contactLockUserId?: string;
    contactLockUserName?: string;
    contactLockUntil?: string;
    contactLockReason?: 'upload' | 'success';
    /** Veces que postuló por formulario en este proceso (Tally) */
    applicationCount?: number;
    /** Primera postulación; createdAt refleja la última */
    firstApplicationAt?: string;
    /** Fecha de alta / última actualización del registro en sistema */
    createdAt?: string;
    criticalStageReviewedAt?: string; // Fecha en que un usuario revisó el candidato en etapa crítica (para ocultar alertas)
    /** true cuando post-its, comentarios e historial ya se cargaron desde BD */
    relationsLoaded?: boolean;
    metadataIa?: string; // Resumen/metadata generado por IA (OpenAI)
    scoreIa?: number; // Score/puntuación generado por IA
    psycholaboralEvaluation?: PsycholaboralEvaluation;
    /** Valores de columnas personalizadas (procesos masivos / tabla alta densidad) */
    bulkColumnValues?: Record<string, unknown>;
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

export type WorkerHandoffPackageStatus =
    | 'sent'
    | 'received'
    | 'processing'
    | 'completed'
    | 'rejected'
    | 'partially_completed';

export type WorkerHandoffItemStatus = 'pending' | 'accepted' | 'rejected' | 'assigned';

export interface WorkerSnapshotIdentity {
    fullName?: string;
    dni?: string;
    email?: string;
    phone?: string;
    phone2?: string;
}

export interface WorkerSnapshot {
    identity: WorkerSnapshotIdentity;
    fields: Record<string, string | number | boolean>;
    meta: {
        sourceCandidateId: string;
        sourceProcessId: string;
        sourceApp: string;
        snapshotVersion: number;
        includedFieldKeys: string[];
        capturedAt: string;
    };
}

export type WorkerHandoffDeliveryStatus = 'pending' | 'delivered' | 'failed';

export interface WorkerHandoffPackage {
    id: string;
    sourceApp: string;
    targetApp: string;
    status: WorkerHandoffPackageStatus;
    workerCount: number;
    senderNote?: string;
    createdBy?: string;
    createdByName?: string;
    sentAt: string;
    receivedAt?: string;
    completedAt?: string;
    receiverNote?: string;
    payloadVersion: number;
    deliveryStatus?: WorkerHandoffDeliveryStatus;
    opsflowPackageId?: string;
    deliveryError?: string;
    deliveredAt?: string;
    createdAt: string;
    updatedAt: string;
    items?: WorkerHandoffItem[];
}

export interface WorkerHandoffItem {
    id: string;
    packageId: string;
    sourceCandidateId: string;
    sourceProcessId?: string;
    workerName: string;
    workerSnapshot: WorkerSnapshot;
    itemStatus: WorkerHandoffItemStatus;
    createdAt: string;
}

export interface CandidateHandoffHistoryEntry {
    itemId: string;
    packageId: string;
    sentAt: string;
    deliveryStatus?: WorkerHandoffDeliveryStatus;
    createdByName?: string;
    senderNote?: string;
    opsflowPackageId?: string;
    deliveryError?: string;
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
    | 'bulk-processes'
    | 'opsflow-handoffs'
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
    allowedClientIds?: string[] | null; // IDs de clientes a los que el usuario tiene acceso (null o undefined = acceso a todos si su rol/permisos lo permiten)
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
    rootFolderId?: string; // Carpeta raíz en Google Drive (puede ser "Opalopy" o cualquier otra)
    rootFolderName?: string; // Nombre de la carpeta raíz
}

/** Punto de entrevista / sede para generar rutas en transporte público. */
export interface InterviewLocation {
    id: string;
    name: string;
    address: string;
}

/** Tarifa editable de transporte público (Lima Metropolitana). */
export interface TransportFareSetting {
    id: string;
    label: string;
    fare: number;
    formal: boolean;
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
        /** Imagen de portada del PDF psicolaboral (URL o data URL). Si no hay, se usa la imagen del proceso masivo o una predeterminada. */
        psycholaboralHeroImageUrl?: string | null;
        /** Texto breve bajo el título del informe (invita a leer; editable en Configuración). */
        psycholaboralIntroText?: string | null;
        /** Frase de cierre del PDF psicolaboral (antes del pie legal). */
        psycholaboralClosingText?: string | null;
    };
    candidateSources?: string[]; // Opciones configurables para el campo "fuentes" de candidatos
    provinces?: string[]; // Opciones configurables para el campo "provincia" de candidatos
    districts?: { [province: string]: string[] }; // Opciones configurables para el campo "distrito" de candidatos, organizadas por provincia
    interviewLocations?: InterviewLocation[]; // Sedes para rutas en transporte público hacia entrevistas
    /** Tarifas aproximadas de transporte público para estimación de costos de ruta. */
    transportFares?: TransportFareSetting[];
    psycholaboralInventory?: PsycholaboralInventory;
}

export interface FormIntegration {
    id: string;
    platform: 'Tally' | 'Google Forms' | 'Microsoft Forms' | string;
    formName: string;
    formIdOrUrl: string;
    processId: string;
    webhookUrl: string;
    fieldMapping?: FieldMapping; // Mapeo personalizado de campos
}

// Mapeo de campos: campo de Tally -> campo del candidato
export interface FieldMapping {
    // Campo en Tally (key o label) -> Campo en el candidato
    [tallyField: string]: string;
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