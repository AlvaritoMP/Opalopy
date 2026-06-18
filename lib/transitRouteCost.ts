import { Candidate, CustomColumn, TransportFareSetting } from '../types';
import { buildBulkCandidateOrigin } from './transitRouteLinks';
import type { RouteCostResult } from './limaTransportFares';
import { fetchTransitRouteCost } from './api/transitRouteCost';
import { resolveStandardFieldValue } from './bulkTableColumns';
import {
    hasStoredRouteCost,
    parseRouteCostCellValue,
    extractRouteCostTotal,
} from './routeCostStorage';

export type { StoredRouteCostValue } from './routeCostStorage';
export {
    encodeStoredRouteCost,
    parseRouteCostCellValue,
    hasStoredRouteCost,
    extractRouteCostTotal,
    buildRouteCostTooltip,
} from './routeCostStorage';

export interface RouteCostRequest {
    origin: string;
    destination: string;
    originDistrict?: string;
    transportFares?: TransportFareSetting[];
}

/** Arma origen, destino y distrito para estimar costo desde una columna route_cost. */
export function buildRouteCostRequest(
    candidate: Pick<Candidate, 'address' | 'district' | 'province'> & { id: string },
    costColumn: CustomColumn,
    customColumns: CustomColumn[],
    columnValues: Record<string, Record<string, unknown>>
): RouteCostRequest | null {
    if (costColumn.type !== 'route_cost' || !costColumn.sourceRouteColumnId) return null;

    const sourceColumn = customColumns.find(c => c.id === costColumn.sourceRouteColumnId);
    if (!sourceColumn || sourceColumn.type !== 'route' || !sourceColumn.routeDestination?.trim()) {
        return null;
    }

    const origin = buildBulkCandidateOrigin(candidate, customColumns, columnValues);
    if (!origin) return null;

    const district =
        candidate.district?.trim() ||
        resolveStandardFieldValue('district', candidate.id, candidate, columnValues, customColumns) ||
        undefined;

    return {
        origin,
        destination: sourceColumn.routeDestination.trim(),
        originDistrict: district ? String(district) : undefined,
    };
}

export async function estimateRouteCostForCandidate(
    candidate: Pick<Candidate, 'address' | 'district' | 'province'> & { id: string },
    costColumn: CustomColumn,
    customColumns: CustomColumn[],
    columnValues: Record<string, Record<string, unknown>>,
    transportFares?: TransportFareSetting[]
): Promise<RouteCostResult> {
    const request = buildRouteCostRequest(candidate, costColumn, customColumns, columnValues);
    if (!request) {
        throw new Error('Faltan datos de origen o columna de ruta de referencia');
    }
    return fetchTransitRouteCost({
        ...request,
        transportFares,
    });
}

export interface RouteCostBulkCounts {
    pending: number;
    calculated: number;
    skippedNoOrigin: number;
}

/** Cuenta celdas pendientes vs ya calculadas para un lote masivo. */
export function countRouteCostCells(
    candidates: { id: string; address?: string; district?: string; province?: string }[],
    costColumns: CustomColumn[],
    customColumns: CustomColumn[],
    columnValues: Record<string, Record<string, unknown>>,
    getColumnValue: (candidateId: string, columnId: string, candidate: { id: string; address?: string; district?: string; province?: string }) => unknown
): RouteCostBulkCounts {
    let pending = 0;
    let calculated = 0;
    let skippedNoOrigin = 0;

    for (const candidate of candidates) {
        for (const costColumn of costColumns) {
            const request = buildRouteCostRequest(candidate, costColumn, customColumns, columnValues);
            if (!request) {
                skippedNoOrigin++;
                continue;
            }
            const stored = getColumnValue(candidate.id, costColumn.id, candidate);
            if (hasStoredRouteCost(stored)) calculated++;
            else pending++;
        }
    }

    return { pending, calculated, skippedNoOrigin };
}
