/**
 * Abre composición de correo sin congelar la SPA.
 * Usa mailto: en pestaña nueva — el navegador/OS abre el gestor configurado
 * (cliente de escritorio o webmail predeterminado: Gmail, Outlook, Yahoo, etc.).
 * No forzamos Google ni Microsoft.
 */

export interface OpenMailComposeOptions {
    to: string[];
    subject: string;
    body: string;
}

export interface OpenMailComposeResult {
    recipientCount: number;
    /** true si el cuerpo completo solo está en el portapapeles (URL mailto demasiado larga) */
    bodyTruncatedInMailto: boolean;
    copiedToClipboard: boolean;
}

/** Límite práctico de longitud para mailto en navegadores */
const MAILTO_MAX_HREF_LENGTH = 1800;

export function buildMailtoHref(to: string[], subject: string, body: string): string {
    const emails = to.map(e => e?.trim()).filter(Boolean).join(';');
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (body) params.set('body', body);
    const qs = params.toString();
    return qs ? `mailto:${emails}?${qs}` : `mailto:${emails}`;
}

function openInNewTab(url: string): boolean {
    try {
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (win) return true;
    } catch {
        /* ignore */
    }

    try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        return true;
    } catch {
        return false;
    }
}

export async function copyMailComposeDraft(
    to: string[],
    subject: string,
    body: string
): Promise<boolean> {
    const validTo = to.map(e => e?.trim()).filter(Boolean);
    const text = [`Para: ${validTo.join(', ')}`, `Asunto: ${subject}`, '', body].join('\n');

    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

/**
 * Abre mailto en pestaña nueva (no navega la app) y copia borrador al portapapeles.
 */
export async function openMailCompose(
    options: OpenMailComposeOptions
): Promise<OpenMailComposeResult> {
    const validTo = options.to.map(e => e?.trim()).filter(Boolean);
    const { subject, body } = options;

    const copiedToClipboard = await copyMailComposeDraft(validTo, subject, body);

    const fullHref = buildMailtoHref(validTo, subject, body);
    let bodyTruncatedInMailto = false;

    if (fullHref.length > MAILTO_MAX_HREF_LENGTH) {
        const shortHref = buildMailtoHref(validTo, subject, '');
        openInNewTab(shortHref.length <= MAILTO_MAX_HREF_LENGTH ? shortHref : buildMailtoHref(validTo, '', ''));
        bodyTruncatedInMailto = true;
    } else {
        openInNewTab(fullHref);
    }

    return {
        recipientCount: validTo.length,
        bodyTruncatedInMailto,
        copiedToClipboard,
    };
}

export function getMailComposeToastMessage(result: OpenMailComposeResult): string {
    const n = result.recipientCount;
    const countLabel = n === 1 ? '1 destinatario' : `${n} destinatarios`;

    if (result.bodyTruncatedInMailto) {
        return result.copiedToClipboard
            ? `Correo abierto (${countLabel}). El mensaje completo está en el portapapeles — pégalo en tu cliente web.`
            : `Correo abierto (${countLabel}). El mensaje es largo: copia el texto manualmente si hace falta.`;
    }

    return result.copiedToClipboard
        ? `Correo abierto (${countLabel}). Se usará tu cliente predeterminado. Borrador copiado por si usas correo web.`
        : `Correo abierto (${countLabel}). Se usará el cliente de correo configurado en tu navegador.`;
}
