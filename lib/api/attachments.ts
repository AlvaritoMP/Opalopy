import { supabase } from '../supabase';
import { Attachment } from '../../types';
import { APP_NAME } from '../appConfig';

export const attachmentsApi = {
    // Crear adjunto
    async create(attachment: Omit<Attachment, 'id' | 'uploadedAt'>, uploadedBy?: string): Promise<Attachment> {
        const { data, error } = await supabase
            .from('attachments')
            .insert({
                name: attachment.name,
                url: attachment.url,
                type: attachment.type,
                size: attachment.size,
                category: attachment.category,
                candidate_id: (attachment as any).candidateId || null,
                process_id: (attachment as any).processId || null,
                comment_id: (attachment as any).commentId || null,
                uploaded_by: uploadedBy || null,
                app_name: APP_NAME, // Asegurar que siempre se asigne el app_name
            })
            .select()
            .single();
        
        if (error) throw error;
        
        return {
            id: data.id,
            name: data.name,
            url: data.url,
            type: data.type,
            size: data.size,
            category: data.category,
            uploadedAt: data.uploaded_at,
        };
    },

    // Eliminar adjunto
    async delete(attachmentId: string): Promise<void> {
        const { error } = await supabase
            .from('attachments')
            .delete()
            .eq('id', attachmentId);
        
        if (error) throw error;
    },
};

