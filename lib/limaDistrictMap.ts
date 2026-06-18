/** Normaliza texto de distrito para emparejar con el GeoJSON IGN (Lima / Callao). */
export function normalizeDistrictLabel(raw?: string | null): string | null {
    if (!raw?.trim()) return null;
    return raw
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

function districtLookupKey(raw: string): string {
    return raw
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');
}

/** Alias frecuentes en formularios / Excel → clave del GeoJSON (campo distrito). */
const DISTRICT_ALIASES: Record<string, string> = {
    surco: 'SANTIAGO DE SURCO',
    'santiago de surco': 'SANTIAGO DE SURCO',
    sjl: 'SAN JUAN DE LURIGANCHO',
    'san juan de lurigancho': 'SAN JUAN DE LURIGANCHO',
    ves: 'VILLA EL SALVADOR',
    'villa el salvador': 'VILLA EL SALVADOR',
    vmt: 'VILLA MARIA DEL TRIUNFO',
    'villa maria del triunfo': 'VILLA MARIA DEL TRIUNFO',
    smp: 'SAN MARTIN DE PORRES',
    'san martin de porres': 'SAN MARTIN DE PORRES',
    sjm: 'SAN JUAN DE MIRAFLORES',
    'san juan de miraflores': 'SAN JUAN DE MIRAFLORES',
    'cercado de lima': 'LIMA',
    'lima cercado': 'LIMA',
    magdalena: 'MAGDALENA DEL MAR',
    'magdalena del mar': 'MAGDALENA DEL MAR',
    'jesus maria': 'JESUS MARIA',
    'pueblo libre': 'PUEBLO LIBRE',
    'san borja': 'SAN BORJA',
    'san isidro': 'SAN ISIDRO',
    'san miguel': 'SAN MIGUEL',
    'la molina': 'LA MOLINA',
    'los olivos': 'LOS OLIVOS',
    'puente piedra': 'PUENTE PIEDRA',
    'santa anita': 'SANTA ANITA',
    'la victoria': 'LA VICTORIA',
    'el agustino': 'EL AGUSTINO',
    rimac: 'RIMAC',
    brena: 'BREÑA',
    'mi peru': 'MI PERÃz',
    'mi perú': 'MI PERÃz',
};

export function resolveGeoDistrictKey(label: string): string | null {
    const key = districtLookupKey(label);
    if (DISTRICT_ALIASES[key]) return DISTRICT_ALIASES[key];
    return label
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

export function buildGeoDistrictCounts(
    countsByLabel: Map<string, number> | Iterable<[string, number]>
): Map<string, number> {
    const out = new Map<string, number>();
    for (const [label, count] of countsByLabel) {
        if (!label || label === 'Sin distrito' || label === 'Otros') continue;
        const geoKey = resolveGeoDistrictKey(label);
        if (!geoKey) continue;
        out.set(geoKey, (out.get(geoKey) ?? 0) + count);
    }
    return out;
}

export function districtFillColor(count: number, maxCount: number): string {
    if (count <= 0 || maxCount <= 0) return '#e5e7eb';
    const t = Math.min(1, count / maxCount);
    const r = Math.round(237 - t * (237 - 124));
    const g = Math.round(233 - t * (233 - 58));
    const b = Math.round(254 - t * (254 - 237));
    return `rgb(${r},${g},${b})`;
}

export type LngLat = [number, number];

export interface GeoBounds {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
}

export function boundsFromCoordinates(coords: LngLat[]): GeoBounds {
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of coords) {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
    }
    return { minLng, maxLng, minLat, maxLat };
}

export function mergeBounds(a: GeoBounds, b: GeoBounds): GeoBounds {
    return {
        minLng: Math.min(a.minLng, b.minLng),
        maxLng: Math.max(a.maxLng, b.maxLng),
        minLat: Math.min(a.minLat, b.minLat),
        maxLat: Math.max(a.maxLat, b.maxLat),
    };
}

export function createProjector(
    bounds: GeoBounds,
    width: number,
    height: number,
    padding = 12
): (point: LngLat) => [number, number] {
    const spanLng = bounds.maxLng - bounds.minLng || 1;
    const spanLat = bounds.maxLat - bounds.minLat || 1;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;
    const scale = Math.min(innerW / spanLng, innerH / spanLat);

    return ([lng, lat]) => {
        const x = padding + (lng - bounds.minLng) * scale;
        const y = padding + (bounds.maxLat - lat) * scale;
        return [x, y];
    };
}

export function ringsFromGeometry(geometry: GeoJSON.Geometry): LngLat[][] {
    if (geometry.type === 'Polygon') {
        return geometry.coordinates as LngLat[][];
    }
    if (geometry.type === 'MultiPolygon') {
        return (geometry.coordinates as LngLat[][][]).flat();
    }
    return [];
}

export function ringCentroid(ring: LngLat[]): LngLat {
    const n = Math.max(1, ring.length - 1);
    let lng = 0;
    let lat = 0;
    for (let i = 0; i < n; i++) {
        lng += ring[i][0];
        lat += ring[i][1];
    }
    return [lng / n, lat / n];
}

export function ringToSvgPath(ring: LngLat[], project: (p: LngLat) => [number, number]): string {
    if (ring.length === 0) return '';
    const [x0, y0] = project(ring[0]);
    let d = `M ${x0.toFixed(2)} ${y0.toFixed(2)}`;
    for (let i = 1; i < ring.length; i++) {
        const [x, y] = project(ring[i]);
        d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return `${d} Z`;
}

export function formatDistrictDisplayName(geoKey: string, distrito2?: string | null): string {
    if (distrito2?.trim()) {
        return distrito2
            .trim()
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
    }
    return geoKey
        .toLowerCase()
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}
