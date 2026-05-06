import { supabase } from '../supabase';
import { Client } from '../../types';
import { APP_NAME } from '../appConfig';

// Convertir de DB a tipo de aplicación
function dbToClient(dbClient: any): Client {
    return {
        id: dbClient.id,
        razonSocial: dbClient.razon_social,
        ruc: dbClient.ruc,
        createdAt: dbClient.created_at,
        updatedAt: dbClient.updated_at,
    };
}

// Convertir de tipo de aplicación a DB
function clientToDb(client: Partial<Client>): any {
    const dbClient: any = {};
    if (client.razonSocial !== undefined) dbClient.razon_social = client.razonSocial;
    if (client.ruc !== undefined) dbClient.ruc = client.ruc;
    return dbClient;
}

export const clientsApi = {
    // Obtener todos los clientes
    async getAll(): Promise<Client[]> {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('app_name', APP_NAME)
            .order('razon_social', { ascending: true });
        
        if (error) throw error;
        return (data || []).map(dbToClient);
    },

    // Obtener un cliente por ID
    async getById(id: string): Promise<Client | null> {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', id)
            .eq('app_name', APP_NAME)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') return null; // No encontrado
            throw error;
        }
        return data ? dbToClient(data) : null;
    },

    // Crear un cliente
    async create(clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client> {
        const dbData = clientToDb(clientData);
        dbData.app_name = APP_NAME;
        
        const { data, error } = await supabase
            .from('clients')
            .insert(dbData)
            .select()
            .single();
        
        if (error) throw error;
        return dbToClient(data);
    },

    // Actualizar un cliente
    async update(id: string, clientData: Partial<Client>): Promise<Client> {
        const dbData = clientToDb(clientData);
        
        const { data, error } = await supabase
            .from('clients')
            .update(dbData)
            .eq('id', id)
            .eq('app_name', APP_NAME)
            .select()
            .single();
        
        if (error) throw error;
        return dbToClient(data);
    },

    // Eliminar un cliente
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', id)
            .eq('app_name', APP_NAME);
        
        if (error) throw error;
    },
};
