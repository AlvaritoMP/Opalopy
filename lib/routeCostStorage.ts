import type { RouteCostBreakdownItem, RouteCostResult } from './limaTransportFares';
import { formatRouteCostDisplay } from './limaTransportFares';

/** Valor persistido en bulk_column_values para una celda de costo de ruta. */
export interface StoredRouteCostValue {
    total: number;
    breakdown: RouteCostBreakdownItem[];
    calculatedAt: string;
}

export function encodeStoredRouteCost(result: RouteCostResult): StoredRouteCostValue {
    return {
        total: result.total,
        breakdown: result.breakdown,
        calculatedAt: new Date().toISOString(),
    };
}

export function buildRouteCostTooltip(
    breakdown: RouteCostBreakdownItem[],
    total?: number
): string {
    if (!breakdown.length) {
        return total != null ? `Total: ${formatRouteCostDisplay(total)}` : '';
    }

    const groups = new Map<string, { label: string; fare: number; count: number }>();
    for (const item of breakdown) {
        const key = `${item.type}|${item.fare}`;
        const existing = groups.get(key);
        if (existing) existing.count += 1;
        else groups.set(key, { label: item.label, fare: item.fare, count: 1 });
    }

    const lines = [...groups.values()].map(
        g => `${g.label}: ${g.count} × S/ ${g.fare.toFixed(2)} = S/ ${(g.count * g.fare).toFixed(2)}`
    );
    if (total != null) lines.push(`Total: ${formatRouteCostDisplay(total)}`);
    return lines.join('\n');
}

export function parseRouteCostCellValue(raw: unknown): {
    total: number | null;
    breakdown: RouteCostBreakdownItem[];
    tooltip: string;
    calculatedAt?: string;
} {
    if (raw === undefined || raw === null || raw === '') {
        return { total: null, breakdown: [], tooltip: '' };
    }

    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return {
            total: raw,
            breakdown: [],
            tooltip: formatRouteCostDisplay(raw),
        };
    }

    let parsed: unknown = raw;
    if (typeof raw === 'string') {
        const asNum = Number(raw.replace(',', '.'));
        if (raw.trim() !== '' && Number.isFinite(asNum) && !raw.trim().startsWith('{')) {
            return { total: asNum, breakdown: [], tooltip: formatRouteCostDisplay(asNum) };
        }
        try {
            parsed = JSON.parse(raw);
        } catch {
            return { total: null, breakdown: [], tooltip: '' };
        }
    }

    if (parsed && typeof parsed === 'object' && 'total' in parsed) {
        const obj = parsed as StoredRouteCostValue;
        const total = Number(obj.total);
        const breakdown = Array.isArray(obj.breakdown) ? obj.breakdown : [];
        if (!Number.isFinite(total)) {
            return { total: null, breakdown: [], tooltip: '' };
        }
        return {
            total,
            breakdown,
            tooltip: buildRouteCostTooltip(breakdown, total),
            calculatedAt: obj.calculatedAt,
        };
    }

    const fallback = Number(raw);
    if (Number.isFinite(fallback)) {
        return { total: fallback, breakdown: [], tooltip: formatRouteCostDisplay(fallback) };
    }

    return { total: null, breakdown: [], tooltip: '' };
}

export function extractRouteCostTotal(raw: unknown): number | null {
    return parseRouteCostCellValue(raw).total;
}

export function hasStoredRouteCost(raw: unknown): boolean {
    return extractRouteCostTotal(raw) != null;
}
