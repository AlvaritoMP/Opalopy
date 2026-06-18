import { supabase } from '../supabase';
import type { RouteCostResult } from '../limaTransportFares';
import type { TransportFareSetting } from '../../types';

const FUNCTION_NAME = 'transit-route-cost';

export interface TransitRouteCostRequest {
    origin: string;
    destination: string;
    originDistrict?: string;
    transportFares?: TransportFareSetting[];
}

type TransitRouteCostResponse = RouteCostResult & {
    success?: boolean;
    error?: string;
    details?: string;
};

export async function fetchTransitRouteCost(
    request: TransitRouteCostRequest
): Promise<RouteCostResult> {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
        body: request,
    });

    if (error) {
        throw new Error(
            error.message ||
                'No se pudo calcular el costo de ruta. Verifica que la Edge Function transit-route-cost esté desplegada.'
        );
    }

    const result = data as TransitRouteCostResponse | null;
    if (result?.error) {
        throw new Error(result.details || result.error);
    }

    if (result?.total == null) {
        throw new Error('Respuesta inválida al calcular costo de ruta');
    }

    return {
        total: result.total,
        currency: result.currency || 'PEN',
        breakdown: result.breakdown || [],
    };
}
