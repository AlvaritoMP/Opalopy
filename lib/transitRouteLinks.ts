import { Candidate, CustomColumn, InterviewLocation } from '../types';
import { resolveStandardFieldValue } from './bulkTableColumns';

/** Arma el texto de origen para Google Maps a partir de los datos del candidato. */
export function buildCandidateOrigin(candidate: Pick<Candidate, 'address' | 'district' | 'province'>): string | null {
    const address = candidate.address?.trim();
    const district = candidate.district?.trim();
    const province = candidate.province?.trim();

    const parts: string[] = [];
    if (address) parts.push(address);
    if (district) parts.push(district);
    if (province) parts.push(province);
    if (parts.length === 0) return null;

    parts.push('Perú');
    return parts.join(', ');
}

/** Origen para candidatos en tabla masiva (campos estándar + columnas homónimas). */
export function buildBulkCandidateOrigin(
    candidate: Pick<Candidate, 'address' | 'district' | 'province'> & { id: string },
    customColumns: CustomColumn[],
    columnValues: Record<string, Record<string, unknown>>
): string | null {
    const address =
        candidate.address?.trim() ||
        resolveStandardFieldValue('address', candidate.id, candidate, columnValues, customColumns) ||
        undefined;
    const district =
        candidate.district?.trim() ||
        resolveStandardFieldValue('district', candidate.id, candidate, columnValues, customColumns) ||
        undefined;
    const province =
        candidate.province?.trim() ||
        resolveStandardFieldValue('province', candidate.id, candidate, columnValues, customColumns) ||
        undefined;

    return buildCandidateOrigin({ address, district, province });
}

function normalizeDestinationAddress(destination: string): string {
    const trimmed = destination.trim();
    if (!trimmed) return trimmed;
    const lower = trimmed.toLowerCase();
    if (lower.includes('perú') || lower.includes('peru')) return trimmed;
    return `${trimmed}, Perú`;
}

export function buildGoogleMapsTransitUrl(origin: string, destination: string): string {
    const params = new URLSearchParams({
        api: '1',
        origin,
        destination: normalizeDestinationAddress(destination),
        travelmode: 'transit',
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildTransitRouteShareMessage(locationName: string, url: string): string {
    return `Para tu entrevista en ${locationName}, esta es la ruta en transporte público: ${url}`;
}

/** Enlace de ruta para una columna tipo route en procesos masivos. */
export function buildRouteColumnLink(
    candidate: Pick<Candidate, 'address' | 'district' | 'province'> & { id: string },
    column: CustomColumn,
    customColumns: CustomColumn[],
    columnValues: Record<string, Record<string, unknown>>
): string | null {
    if (column.type !== 'route') return null;
    const destination = column.routeDestination?.trim();
    if (!destination) return null;

    const origin = buildBulkCandidateOrigin(candidate, customColumns, columnValues);
    if (!origin) return null;

    return buildGoogleMapsTransitUrl(origin, destination);
}

export interface CandidateTransitRoute {
    location: InterviewLocation;
    url: string;
}

export function buildCandidateTransitRoutes(
    candidate: Pick<Candidate, 'address' | 'district' | 'province'>,
    locations: InterviewLocation[] | undefined
): { origin: string | null; routes: CandidateTransitRoute[] } {
    const origin = buildCandidateOrigin(candidate);
    const validLocations = (locations || []).filter(
        loc => loc.name?.trim() && loc.address?.trim()
    );

    if (!origin) {
        return { origin: null, routes: [] };
    }

    const routes = validLocations.map(location => ({
        location,
        url: buildGoogleMapsTransitUrl(origin, location.address.trim()),
    }));

    return { origin, routes };
}
