import { supabase } from '../supabase';
import { Comment, Attachment } from '../../types';
import { APP_NAME } from '../appConfig';

export const commentsApi = {
    // Crear comentario
    async create(candidateId: string, comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
        const { data, error } = await supabase
            .from('comments')
            .insert({
                candidate_id: candidateId,
                text: comment.text,
                user_id: comment.userId,
                app_name: APP_NAME,
            })
            .select()
            .single();
        
        if (error) throw error;

        // Si hay adjuntos, crearlos
        if (comment.attachments && comment.attachments.length > 0) {
            const attachmentsToInsert = comment.attachments.map(att => ({
                name: att.name,
                url: att.url,
                type: att.type,
                size: att.size,
                category: att.category,
                comment_id: data.id,
                uploaded_by: comment.userId,
                app_name: APP_NAME,
            }));

            await supabase.from('attachments').insert(attachmentsToInsert);
        }

        // Obtener comentario con adjuntos
        const { data: attachments } = await supabase
            .from('attachments')
            .select('*')
            .eq('comment_id', data.id)
            .eq('app_name', APP_NAME);

        return {
            id: data.id,
            text: data.text,
            userId: data.user_id,
            createdAt: data.created_at,
            attachments: (attachments || []).map(att => ({
                id: att.id,
                name: att.name,
                url: att.url,
                type: att.type,
                size: att.size,
                category: att.category,
                uploadedAt: att.uploaded_at,
            })),
        };
    },

    // Eliminar comentario
    async delete(commentId: string): Promise<void> {
        // Los adjuntos se eliminan automáticamente por CASCADE
        const { error } = await supabase
            .from('comments')
            .delete()
            .eq('id', commentId)
            .eq('app_name', APP_NAME);
        
        if (error) throw error;
    },
};

