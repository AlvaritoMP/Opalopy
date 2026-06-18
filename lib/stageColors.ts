import { StageColorId, Stage, BulkProcessConfig } from '../types';

export const STAGE_COLOR_OPTIONS: StageColorId[] = [
    'blue',
    'green',
    'yellow',
    'orange',
    'red',
    'purple',
    'pink',
    'cyan',
    'indigo',
    'slate',
];

export const STAGE_COLOR_LABELS: Record<StageColorId, string> = {
    blue: 'Azul',
    green: 'Verde',
    yellow: 'Amarillo',
    orange: 'Naranja',
    red: 'Rojo',
    purple: 'Morado',
    pink: 'Rosa',
    cyan: 'Cian',
    indigo: 'Índigo',
    slate: 'Gris',
};

/** Tailwind classes for color swatches in the picker */
export const stageColorSwatchClasses: Record<StageColorId, string> = {
    blue: 'bg-blue-200 border-blue-400',
    green: 'bg-green-200 border-green-400',
    yellow: 'bg-yellow-200 border-yellow-400',
    orange: 'bg-orange-200 border-orange-400',
    red: 'bg-red-200 border-red-400',
    purple: 'bg-purple-200 border-purple-400',
    pink: 'bg-pink-200 border-pink-400',
    cyan: 'bg-cyan-200 border-cyan-400',
    indigo: 'bg-indigo-200 border-indigo-400',
    slate: 'bg-gray-200 border-gray-400',
};

/** Tailwind classes for the stage select in the high-density table */
export const stageSelectClasses: Record<StageColorId, string> = {
    blue: 'bg-blue-100 border-blue-400 text-blue-900',
    green: 'bg-green-100 border-green-400 text-green-900',
    yellow: 'bg-yellow-100 border-yellow-500 text-yellow-900',
    orange: 'bg-orange-100 border-orange-400 text-orange-900',
    red: 'bg-red-100 border-red-400 text-red-900',
    purple: 'bg-purple-100 border-purple-400 text-purple-900',
    pink: 'bg-pink-100 border-pink-400 text-pink-900',
    cyan: 'bg-cyan-100 border-cyan-400 text-cyan-900',
    indigo: 'bg-indigo-100 border-indigo-400 text-indigo-900',
    slate: 'bg-gray-100 border-gray-400 text-gray-800',
};

const DEFAULT_SELECT_CLASS =
    'bg-white border-primary-300 text-gray-800';

export function getStageSelectClass(color?: StageColorId): string {
    if (!color) return DEFAULT_SELECT_CLASS;
    return stageSelectClasses[color] || DEFAULT_SELECT_CLASS;
}

/** Suggested color when adding a new stage (cycles through palette) */
export function suggestStageColor(stageIndex: number): StageColorId {
    const palette = STAGE_COLOR_OPTIONS.filter(c => c !== 'slate');
    return palette[stageIndex % palette.length];
}

export function buildStageColorMaps(stages: Stage[]): Pick<BulkProcessConfig, 'stageColors' | 'stageColorsByName'> {
    const stageColors: Record<string, StageColorId> = {};
    const stageColorsByName: Record<string, StageColorId> = {};
    for (const stage of stages) {
        if (!stage.color) continue;
        if (stage.id) stageColors[stage.id] = stage.color;
        if (stage.name.trim()) {
            stageColorsByName[stage.name.trim().toLowerCase()] = stage.color;
        }
    }
    return {
        stageColors: Object.keys(stageColors).length > 0 ? stageColors : undefined,
        stageColorsByName: Object.keys(stageColorsByName).length > 0 ? stageColorsByName : undefined,
    };
}

/** Aplica colores guardados en bulkConfig cuando la columna DB no está disponible */
export function applyStageColorsFromBulkConfig(stages: Stage[], bulkConfig?: BulkProcessConfig): Stage[] {
    if (!bulkConfig?.stageColors && !bulkConfig?.stageColorsByName) return stages;
    return stages.map(stage => ({
        ...stage,
        color:
            stage.color ??
            bulkConfig.stageColors?.[stage.id] ??
            bulkConfig.stageColorsByName?.[stage.name.trim().toLowerCase()],
    }));
}
