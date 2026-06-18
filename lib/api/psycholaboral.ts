import { supabase } from '../supabase';
import { APP_NAME } from '../appConfig';
import {
    PsycholaboralEvaluation,
    PsycholaboralInventory,
} from '../../types';
import { createDefaultPsycholaboralInventory } from '../psycholaboralDefaults';
import { mergePsycholaboralInventory } from '../psycholaboralUtils';
import { settingsApi } from './settings';

const INVENTORY_STORAGE_KEY = `psycholaboral_inventory_${APP_NAME}`;

function loadInventoryFromLocal(): PsycholaboralInventory {
    try {
        const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
        if (raw) return mergePsycholaboralInventory(JSON.parse(raw));
    } catch {
        /* ignore */
    }
    return createDefaultPsycholaboralInventory();
}

function saveInventoryToLocal(inventory: PsycholaboralInventory) {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
}

export const psycholaboralApi = {
    async getInventory(): Promise<PsycholaboralInventory> {
        try {
            const settings = await settingsApi.get();
            if (settings.psycholaboralInventory) {
                return mergePsycholaboralInventory(settings.psycholaboralInventory);
            }
        } catch (e) {
            console.warn('No se pudo cargar inventario psicolaboral desde settings:', e);
        }

        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('psycholaboral_inventory')
                .eq('app_name', APP_NAME)
                .maybeSingle();

            if (!error && data?.psycholaboral_inventory) {
                const inv = mergePsycholaboralInventory(
                    typeof data.psycholaboral_inventory === 'string'
                        ? JSON.parse(data.psycholaboral_inventory)
                        : data.psycholaboral_inventory
                );
                saveInventoryToLocal(inv);
                return inv;
            }
        } catch {
            /* columna puede no existir aún */
        }

        return loadInventoryFromLocal();
    },

    async saveInventory(inventory: PsycholaboralInventory): Promise<PsycholaboralInventory> {
        saveInventoryToLocal(inventory);

        try {
            await settingsApi.update({ psycholaboralInventory: inventory });
            return inventory;
        } catch (e) {
            console.warn('Guardado en settings falló, usando localStorage:', e);
        }

        try {
            const { error } = await supabase
                .from('app_settings')
                .update({ psycholaboral_inventory: inventory })
                .eq('app_name', APP_NAME);

            if (!error) return inventory;
        } catch {
            /* ignore */
        }

        return inventory;
    },

    async getEvaluation(candidateId: string): Promise<PsycholaboralEvaluation | null> {
        try {
            const { data, error } = await supabase
                .from('candidates')
                .select('psycholaboral_evaluation')
                .eq('id', candidateId)
                .eq('app_name', APP_NAME)
                .maybeSingle();

            if (error?.message?.includes('psycholaboral_evaluation')) return null;
            if (error) throw error;

            const raw = data?.psycholaboral_evaluation;
            if (!raw) return null;
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
            return null;
        }
    },

    async saveEvaluation(
        candidateId: string,
        evaluation: PsycholaboralEvaluation
    ): Promise<void> {
        const payload = {
            ...evaluation,
            evaluatedAt: new Date().toISOString(),
        };

        const { error } = await supabase
            .from('candidates')
            .update({ psycholaboral_evaluation: payload })
            .eq('id', candidateId)
            .eq('app_name', APP_NAME);

        if (error?.message?.includes('psycholaboral_evaluation')) {
            console.warn(
                'Columna psycholaboral_evaluation no disponible. Ejecute MIGRATION_ADD_PSYCHOLABORAL.sql'
            );
            throw new Error(
                'La base de datos aún no tiene soporte para evaluaciones psicolaborales. Ejecute la migración SQL.'
            );
        }
        if (error) throw error;
    },
};
