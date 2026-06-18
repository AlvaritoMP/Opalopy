import { supabase } from '../supabase';
import { PostIt } from '../../types';
import { APP_NAME } from '../appConfig';

export const postItsApi = {
    // Crear post-it
    async create(candidateId: string, postIt: Omit<PostIt, 'id' | 'createdAt'>): Promise<PostIt> {
        const { data, error } = await supabase
            .from('post_its')
            .insert({
                candidate_id: candidateId,
                text: postIt.text,
                color: postIt.color,
                created_by: postIt.createdBy,
                app_name: APP_NAME, // Agregar app_name para multi-tenant
            })
            .select()
            .single();
        
        if (error) throw error;
        
        return {
            id: data.id,
            text: data.text,
            color: data.color,
            createdBy: data.created_by,
            createdAt: data.created_at,
        };
    },

    // Eliminar post-it
    async delete(postItId: string): Promise<void> {
        const { error } = await supabase
            .from('post_its')
            .delete()
            .eq('id', postItId)
            .eq('app_name', APP_NAME); // Filtrar por app_name para multi-tenant
        
        if (error) throw error;
    },
};

