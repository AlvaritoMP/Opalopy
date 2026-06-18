import type { BulkContactMessageTemplate, BulkProcessConfig } from '../types';

export interface ContactMessageTemplateVars {
    nombre?: string;
    email?: string;
    telefono?: string;
    puesto?: string;
}

export const DEFAULT_CONTACT_MESSAGE_TEMPLATES: BulkContactMessageTemplate[] = [
    {
        id: 'default-invitation-email',
        name: 'Invitación a entrevista',
        channel: 'email',
        subject: 'Invitación a entrevista - {{nombre}}',
        body: `Estimado/a {{nombre}},

Nos complace informarte que has sido seleccionado/a para continuar con el proceso de selección para {{puesto}}.

Te invitamos a una entrevista en la que podremos conocerte mejor y resolver cualquier duda que tengas.

Por favor, confirma tu disponibilidad respondiendo a este correo.

Saludos cordiales,
Equipo de Recursos Humanos`,
    },
    {
        id: 'default-rejection-email',
        name: 'Rechazo',
        channel: 'email',
        subject: 'Actualización sobre tu postulación - {{nombre}}',
        body: `Estimado/a {{nombre}},

Agradecemos tu interés en formar parte de nuestro equipo.

Después de una cuidadosa revisión de tu perfil, lamentamos informarte que en esta ocasión no podremos continuar con tu proceso de selección.

Te deseamos mucho éxito en tu búsqueda profesional.

Saludos cordiales,
Equipo de Recursos Humanos`,
    },
    {
        id: 'default-offer-email',
        name: 'Oferta de trabajo',
        channel: 'email',
        subject: 'Oferta de trabajo - {{nombre}}',
        body: `Estimado/a {{nombre}},

Nos complace hacerte una oferta formal para unirte a nuestro equipo en el puesto de {{puesto}}.

Por favor, revisa los detalles y no dudes en contactarnos si tienes alguna pregunta.

Esperamos tu respuesta.

Saludos cordiales,
Equipo de Recursos Humanos`,
    },
    {
        id: 'default-invitation-whatsapp',
        name: 'Invitación a entrevista',
        channel: 'whatsapp',
        body: `Hola {{nombre}}, nos interesa tu perfil para el puesto de {{puesto}}. ¿Tienes disponibilidad para una entrevista?`,
    },
    {
        id: 'default-followup-whatsapp',
        name: 'Seguimiento',
        channel: 'whatsapp',
        body: `Hola {{nombre}}, te escribimos del proceso de {{puesto}}. ¿Podrías confirmarnos si sigues interesado/a?`,
    },
];

export function createContactMessageTemplate(
    partial?: Partial<BulkContactMessageTemplate>
): BulkContactMessageTemplate {
    return {
        id: partial?.id || `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: partial?.name ?? 'Nueva plantilla',
        channel: partial?.channel ?? 'email',
        subject: partial?.subject ?? '',
        body: partial?.body ?? '',
    };
}

/** Sustituye {{var}} y {var} por los valores del candidato/proceso. */
export function applyContactMessageTemplate(
    text: string,
    vars: ContactMessageTemplateVars
): string {
    const map: Record<string, string> = {
        nombre: vars.nombre?.trim() || 'Candidato',
        email: vars.email?.trim() || '',
        telefono: vars.telefono?.trim() || '',
        puesto: vars.puesto?.trim() || 'el puesto',
    };

    let result = text;
    for (const [key, value] of Object.entries(map)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), value);
        result = result.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);
    }
    return result;
}

export function filterContactTemplatesByChannel(
    templates: BulkContactMessageTemplate[],
    channel: BulkContactMessageTemplate['channel']
): BulkContactMessageTemplate[] {
    return templates.filter(t => t.channel === channel);
}

/**
 * Plantillas del proceso: personalizadas + defaults no sobrescritos + plantilla legacy de WhatsApp.
 */
export function resolveContactMessageTemplates(
    bulkConfig?: BulkProcessConfig | null
): BulkContactMessageTemplate[] {
    const custom = bulkConfig?.contactMessageTemplates ?? [];
    const customIds = new Set(custom.map(t => t.id));

    const defaults = DEFAULT_CONTACT_MESSAGE_TEMPLATES.filter(t => !customIds.has(t.id));
    const merged = [...custom, ...defaults];

    const legacyWhatsapp = bulkConfig?.whatsappMessageTemplate?.trim();
    const hasWhatsappTemplate = merged.some(
        t => t.channel === 'whatsapp' && t.id !== 'legacy-whatsapp'
    );
    if (legacyWhatsapp && !hasWhatsappTemplate && !customIds.has('legacy-whatsapp')) {
        merged.unshift({
            id: 'legacy-whatsapp',
            name: 'Plantilla WhatsApp (legacy)',
            channel: 'whatsapp',
            body: legacyWhatsapp,
        });
    }

    return merged;
}

export async function copyContactMessageToClipboard(
    channel: BulkContactMessageTemplate['channel'],
    subject: string,
    body: string
): Promise<boolean> {
    const text =
        channel === 'email' && subject.trim()
            ? `Asunto: ${subject}\n\n${body}`
            : body;
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
