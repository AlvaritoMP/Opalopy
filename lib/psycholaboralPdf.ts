import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/** Una sola página A4 en horizontal — escala todo el contenido para encajar mejor el aspect ratio. */
export async function captureElementToPdf(element: HTMLElement): Promise<Blob> {
    const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const marginMm = 6;
    const maxW = pageWidth - marginMm * 2;
    const maxH = pageHeight - marginMm * 2;

    const cw = canvas.width;
    const ch = canvas.height;

    /** Redondear mm para evitar desbordes de coma flotante en algunos visores PDF */
    let drawW = maxW;
    let drawH = (ch * drawW) / cw;
    if (drawH > maxH) {
        drawH = maxH;
        drawW = (cw * drawH) / ch;
    }
    drawW = Math.floor(drawW * 1000) / 1000;
    drawH = Math.floor(drawH * 1000) / 1000;

    const x = marginMm + (maxW - drawW) / 2;
    const y = marginMm + (maxH - drawH) / 2;

    pdf.addImage(imgData, 'PNG', x, y, drawW, drawH, undefined, 'FAST');

    while (pdf.getNumberOfPages() > 1) {
        pdf.deletePage(pdf.getNumberOfPages());
    }

    return pdf.output('blob');
}

export function downloadPsycholaboralPdf(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

/** @deprecated Use captureElementToPdf with PsycholaboralReportDocument */
export async function generatePsycholaboralPdf(): Promise<Blob> {
    throw new Error('Use captureElementToPdf con el componente PsycholaboralReportDocument');
}
