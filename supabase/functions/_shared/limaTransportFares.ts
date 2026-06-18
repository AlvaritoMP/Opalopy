/** Mantener alineado con lib/limaTransportFares.ts */

export type LimaTransportType =
    | 'metro_linea_1'
    | 'metro_linea_2'
    | 'metropolitano_troncal'
    | 'metropolitano_alimentador'
    | 'metropolitano_integrado'
    | 'corredor_complementario'
    | 'bus_local'
    | 'bus_interdistrital'
    | 'bus_cono_a_cono'
    | 'colectivo'
    | 'mototaxi';

export interface LimaTransportFare {
    id: LimaTransportType;
    label: string;
    fare: number;
    formal: boolean;
}

export const LIMA_TRANSPORT_FARES: Record<LimaTransportType, LimaTransportFare> = {
    metro_linea_1: { id: 'metro_linea_1', label: 'Línea 1 (Metro de Lima)', fare: 1.5, formal: true },
    metro_linea_2: { id: 'metro_linea_2', label: 'Línea 2 (Metro de Lima)', fare: 1.5, formal: true },
    metropolitano_troncal: { id: 'metropolitano_troncal', label: 'Metropolitano (Troncal)', fare: 3.2, formal: true },
    metropolitano_alimentador: { id: 'metropolitano_alimentador', label: 'Metropolitano (Alimentador)', fare: 1.5, formal: true },
    metropolitano_integrado: { id: 'metropolitano_integrado', label: 'Metropolitano (Integrado)', fare: 3.5, formal: true },
    corredor_complementario: { id: 'corredor_complementario', label: 'Corredores Complementarios', fare: 2.5, formal: true },
    bus_local: { id: 'bus_local', label: 'Bus / Combi Tradicional (Local)', fare: 2.0, formal: false },
    bus_interdistrital: { id: 'bus_interdistrital', label: 'Bus Tradicional (Interdistrital)', fare: 3.5, formal: false },
    bus_cono_a_cono: { id: 'bus_cono_a_cono', label: 'Bus Tradicional (Cono a Cono)', fare: 5.5, formal: false },
    colectivo: { id: 'colectivo', label: 'Auto Colectivo / Informal', fare: 7.0, formal: false },
    mototaxi: { id: 'mototaxi', label: 'Mototaxi de aproximación', fare: 1.5, formal: false },
};

export const PERIPHERAL_DISTRICTS = new Set([
    'villa el salvador', 'san juan de lurigancho', 'comas', 'los olivos', 'carabayllo',
    'san martin de porres', 'villa maria del triunfo', 'puente piedra', 'ventanilla',
    'ate', 'pachacamac', 'lurin', 'chaclacayo', 'ancon', 'santa rosa', 'cieneguilla',
]);

export interface DirectionsTransitStep {
    travel_mode?: string;
    distance?: { value?: number };
    duration?: { value?: number };
    html_instructions?: string;
    transit_details?: {
        num_stops?: number;
        line?: {
            short_name?: string;
            name?: string;
            color?: string;
            vehicle?: { type?: string; name?: string };
            agencies?: { name?: string }[];
        };
    };
}

export interface RouteCostBreakdownItem {
    type: LimaTransportType;
    label: string;
    fare: number;
}

export interface RouteCostResult {
    total: number;
    currency: 'PEN';
    breakdown: RouteCostBreakdownItem[];
}

function normalizeDistrictKey(district?: string): string {
    return (district || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function isPeripheralDistrict(district?: string): boolean {
    const key = normalizeDistrictKey(district);
    return key ? PERIPHERAL_DISTRICTS.has(key) : false;
}

function stepText(step: DirectionsTransitStep): string {
    const line = step.transit_details?.line;
    const parts = [
        line?.short_name, line?.name, line?.vehicle?.name, line?.vehicle?.type,
        line?.agencies?.map(a => a.name).join(' '), line?.color,
        step.html_instructions?.replace(/<[^>]+>/g, ' '),
    ];
    return parts.filter(Boolean).join(' ').toLowerCase();
}

export function classifyTransitStep(step: DirectionsTransitStep): LimaTransportType | null {
    const mode = (step.travel_mode || '').toUpperCase();
    if (mode !== 'TRANSIT') return null;

    const text = stepText(step);
    const vehicleType = (step.transit_details?.line?.vehicle?.type || '').toUpperCase();
    const distanceM = step.distance?.value ?? 0;
    const shortName = (step.transit_details?.line?.short_name || '').toLowerCase();

    if (/l[ií]nea\s*1|\bl1\b|metro.*1|tren verde/.test(text)) return 'metro_linea_1';
    if (/l[ií]nea\s*2|\bl2\b|metro.*2/.test(text)) return 'metro_linea_2';

    const isMetropolitano = /metropolitano|\bbrt\b/.test(text);
    const isAlimentador =
        /alimentador|feed|bus amarill|letras amarill|amarill/.test(text) ||
        (/^[a-z]{1,3}\d{0,2}$/.test(shortName) && /amarill|#ff|yellow/i.test(step.transit_details?.line?.color || ''));
    const isTroncal =
        /troncal|expres|[\s"']A[\s"']|[\s"']B[\s"']|[\s"']C[\s"']|corredor metropolitano/.test(text) ||
        /^[abc]$/i.test(shortName);

    if (isMetropolitano || isAlimentador || isTroncal) {
        if (isAlimentador && !isTroncal) return 'metropolitano_alimentador';
        if (isTroncal && !isAlimentador) return 'metropolitano_troncal';
        if (isAlimentador) return 'metropolitano_alimentador';
        return 'metropolitano_troncal';
    }

    if (/corredor\s*(complementario|rojo|azul|morado|amarillo)|\bcr[\d-]/.test(text)) return 'corredor_complementario';
    if (vehicleType === 'TAXI' || /colectivo/.test(text)) return 'colectivo';
    if (vehicleType === 'SUBWAY' || vehicleType === 'METRO_RAIL' || /metro|tren/.test(text)) {
        return /2|este/.test(text) ? 'metro_linea_2' : 'metro_linea_1';
    }
    if (vehicleType === 'BUS' || vehicleType === 'INTERCITY_BUS' || /bus|combi|ómnibus|omnibus/.test(text)) {
        if (distanceM >= 20000) return 'bus_cono_a_cono';
        if (distanceM >= 8000) return 'bus_interdistrital';
        return 'bus_local';
    }
    if (distanceM >= 20000) return 'bus_cono_a_cono';
    if (distanceM >= 8000) return 'bus_interdistrital';
    if (distanceM > 0) return 'bus_local';
    return null;
}

export function buildTransportFaresMap(
    overrides: { id: string; label?: string; fare?: number; formal?: boolean }[] = []
): Record<LimaTransportType, LimaTransportFare> {
    const map = { ...LIMA_TRANSPORT_FARES };
    for (const item of overrides) {
        const id = item.id as LimaTransportType;
        if (!map[id]) continue;
        map[id] = {
            ...map[id],
            label: item.label?.trim() || map[id].label,
            fare: Number.isFinite(Number(item.fare)) ? Number(item.fare) : map[id].fare,
            formal: item.formal ?? map[id].formal,
        };
    }
    return map;
}

export function calculateRouteCostFromSteps(
    steps: DirectionsTransitStep[],
    originDistrict?: string,
    faresMap: Record<LimaTransportType, LimaTransportFare> = LIMA_TRANSPORT_FARES
): RouteCostResult {
    const transitTypes: LimaTransportType[] = [];
    let mototaxiSegments = 0;

    for (const step of steps) {
        const mode = (step.travel_mode || '').toUpperCase();
        if (mode === 'WALKING') {
            if ((step.distance?.value ?? 0) >= 500 && isPeripheralDistrict(originDistrict)) mototaxiSegments++;
            continue;
        }
        const type = classifyTransitStep(step);
        if (type) transitTypes.push(type);
    }

    const alimentadorCount = transitTypes.filter(t => t === 'metropolitano_alimentador').length;
    const troncalCount = transitTypes.filter(t => t === 'metropolitano_troncal').length;
    const otherTypes = transitTypes.filter(t => t !== 'metropolitano_alimentador' && t !== 'metropolitano_troncal');
    const breakdown: RouteCostBreakdownItem[] = [];

    for (const type of otherTypes) {
        const fare = faresMap[type];
        breakdown.push({ type, label: fare.label, fare: fare.fare });
    }

    if (alimentadorCount > 0 && troncalCount > 0) {
        const fare = faresMap.metropolitano_integrado;
        breakdown.push({ type: 'metropolitano_integrado', label: fare.label, fare: fare.fare });
    } else {
        for (let i = 0; i < alimentadorCount; i++) {
            const fare = faresMap.metropolitano_alimentador;
            breakdown.push({ type: 'metropolitano_alimentador', label: fare.label, fare: fare.fare });
        }
        for (let i = 0; i < troncalCount; i++) {
            const fare = faresMap.metropolitano_troncal;
            breakdown.push({ type: 'metropolitano_troncal', label: fare.label, fare: fare.fare });
        }
    }

    for (let i = 0; i < mototaxiSegments; i++) {
        const fare = faresMap.mototaxi;
        breakdown.push({ type: 'mototaxi', label: fare.label, fare: fare.fare });
    }

    const total = breakdown.reduce((sum, item) => sum + item.fare, 0);
    return { total: Math.round(total * 100) / 100, currency: 'PEN', breakdown };
}
