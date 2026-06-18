import {
    PsycholaboralInventory,
    IntellectualLevelDefinition,
    PersonalityTraitDefinition,
    PsycholaboralCompetencySet,
    ConclusionTemplate,
} from '../types';

export const DEFAULT_INTELLECTUAL_LEVELS: IntellectualLevelDefinition[] = [
    {
        id: 'inferior',
        name: 'Inferior',
        scoreRange: '0-15',
        interpretation:
            'Presenta dificultades para el aprendizaje de tareas nuevas y la resolución de problemas de complejidad media. Se recomienda supervisión constante y tareas estructuradas con instrucciones claras.',
    },
    {
        id: 'normal_inferior',
        name: 'Normal Inferior',
        scoreRange: '16-25',
        interpretation:
            'Puede desempeñar tareas de baja a media complejidad con apoyo y seguimiento. Requiere tiempo adicional para adaptarse a cambios y asimilar procedimientos nuevos.',
    },
    {
        id: 'normal_promedio',
        name: 'Normal Promedio',
        scoreRange: '26-40',
        interpretation:
            'Cuenta con capacidad adecuada para el desempeño de tareas de complejidad media, análisis de información, resolución de problemas y adaptación a rutinas laborales con autonomía moderada.',
    },
    {
        id: 'normal_superior',
        name: 'Normal Superior',
        scoreRange: '41-50',
        interpretation:
            'Demuestra buena capacidad de análisis, aprendizaje ágil y resolución de problemas. Puede asumir responsabilidades de mayor complejidad con mínima supervisión.',
    },
    {
        id: 'superior',
        name: 'Superior',
        scoreRange: '51-60',
        interpretation:
            'Presenta excelente capacidad intelectual para tareas de alta complejidad, planificación estratégica, análisis crítico y toma de decisiones bajo presión.',
    },
];

export const DEFAULT_PERSONALITY_TRAITS: PersonalityTraitDefinition[] = [
    {
        id: 'estabilidad_emocional',
        name: 'Estabilidad Emocional',
        definition:
            'Capacidad para regular los estados emocionales ante las dificultades de la vida cotidiana.',
    },
    {
        id: 'autoconcepto',
        name: 'Autoconcepto',
        definition:
            'Nivel de seguridad y autovaloración respecto a sus habilidades y aptitudes.',
    },
    {
        id: 'sociabilidad',
        name: 'Sociabilidad',
        definition:
            'Capacidad para interactuar con los demás de manera equilibrada.',
    },
];

export const DEFAULT_COMPETENCY_SET: PsycholaboralCompetencySet = {
    id: 'default-ventas',
    name: 'Competencias psicolaborales - Ventas',
    competencies: [
        {
            id: 'comp_calidad',
            name: 'Compromiso con la calidad de trabajo',
            definition:
                'Capacidad para realizar las tareas asignadas con precisión, cuidado y atención a los detalles, cumpliendo estándares de calidad.',
            expectedScore: 7,
        },
        {
            id: 'comp_planificacion',
            name: 'Capacidad de Planificación y Organización',
            definition:
                'Habilidad para establecer prioridades, organizar recursos y cumplir objetivos en los plazos establecidos.',
            expectedScore: 7,
        },
        {
            id: 'comp_equipo',
            name: 'Trabajo en equipo',
            definition:
                'Capacidad para colaborar con otros, compartir información y contribuir al logro de metas comunes.',
            expectedScore: 7,
        },
        {
            id: 'comp_resultados',
            name: 'Orientación a los resultados con calidad',
            definition:
                'Enfoque en alcanzar metas y objetivos manteniendo estándares de calidad en el desempeño.',
            expectedScore: 7,
        },
        {
            id: 'comp_presion',
            name: 'Tolerancia a la presión de trabajo',
            definition:
                'Capacidad para mantener el rendimiento y la calma ante situaciones de alta demanda o estrés laboral.',
            expectedScore: 7,
        },
    ],
};

export const DEFAULT_CONCLUSION_TEMPLATES: ConclusionTemplate[] = [
    {
        id: 'conclusion-apto-estandar',
        name: 'Apto - Estándar',
        template:
            'De acuerdo con la evaluación psicolaboral realizada, {{nombre}} se encuentra {{estado}} para el puesto de {{puesto}}. Presenta un nivel intelectual {{nivel_intelectual}}. En cuanto a sus recursos de personalidad, se observa {{personalidad_resumen}}. En competencias psicolaborales alcanzó un {{porcentaje_competencias}}% de las competencias evaluadas, destacando en {{competencias_destacadas}}.',
    },
    {
        id: 'conclusion-apto-reservas',
        name: 'Apto con reservas',
        template:
            '{{nombre}} se encuentra {{estado}} para el puesto de {{puesto}}, con reservas en {{areas_mejora}}. Su nivel intelectual es {{nivel_intelectual}}. Se recomienda reforzar {{recomendaciones}} durante el periodo de prueba.',
    },
    {
        id: 'conclusion-no-apto',
        name: 'No apto',
        template:
            'Luego de la evaluación psicolaboral, {{nombre}} no cumple con el perfil requerido para el puesto de {{puesto}}. Las principales áreas de oportunidad son: {{areas_mejora}}.',
    },
];

export function createDefaultPsycholaboralInventory(): PsycholaboralInventory {
    return {
        intellectualLevels: [...DEFAULT_INTELLECTUAL_LEVELS],
        personalityTraits: [...DEFAULT_PERSONALITY_TRAITS],
        competencySets: [{ ...DEFAULT_COMPETENCY_SET, competencies: [...DEFAULT_COMPETENCY_SET.competencies] }],
        conclusionTemplates: [...DEFAULT_CONCLUSION_TEMPLATES],
    };
}
