/**
 * Utilidad para convertir números a palabras en español peruano
 * Formato: "Dos mil quinientos y 00/100 soles"
 */

const unidades = [
    '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'
];

const decenas = [
    '', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'
];

const centenas = [
    '', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 
    'seiscientos', 'setecientos', 'ochocientos', 'novecientos'
];

/**
 * Convierte un número menor a 1000 a palabras
 */
function convertirMenorAMil(num: number): string {
    if (num === 0) return '';
    if (num === 100) return 'cien';
    
    let resultado = '';
    const c = Math.floor(num / 100);
    const d = Math.floor((num % 100) / 10);
    const u = num % 10;
    
    // Centenas
    if (c > 0) {
        if (c === 1 && (d > 0 || u > 0)) {
            resultado += 'ciento ';
        } else {
            resultado += centenas[c] + ' ';
        }
    }
    
    // Decenas y unidades
    if (d === 1) {
        // Números del 11 al 19
        resultado += unidades[10 + u];
    } else if (d > 1) {
        resultado += decenas[d];
        if (u > 0) {
            resultado += ' y ' + unidades[u];
        }
    } else if (u > 0) {
        resultado += unidades[u];
    }
    
    return resultado.trim();
}

/**
 * Convierte un número a palabras en español peruano
 */
function numeroAPalabras(num: number): string {
    if (num === 0) return 'cero';
    
    const partes: string[] = [];
    
    // Miles de millones (no aplicable para salarios, pero por completitud)
    const milMillones = Math.floor(num / 1_000_000_000);
    if (milMillones > 0) {
        partes.push(convertirMenorAMil(milMillones) + ' mil millones');
    }
    num = num % 1_000_000_000;
    
    // Millones
    const millones = Math.floor(num / 1_000_000);
    if (millones > 0) {
        partes.push(convertirMenorAMil(millones) + ' millones');
    }
    num = num % 1_000_000;
    
    // Miles
    const miles = Math.floor(num / 1_000);
    if (miles > 0) {
        if (miles === 1) {
            partes.push('mil');
        } else {
            partes.push(convertirMenorAMil(miles) + ' mil');
        }
    }
    num = num % 1_000;
    
    // Unidades, decenas y centenas
    if (num > 0 || partes.length === 0) {
        partes.push(convertirMenorAMil(num));
    }
    
    // Capitalizar primera letra
    let resultado = partes.join(' ');
    resultado = resultado.charAt(0).toUpperCase() + resultado.slice(1);
    
    return resultado;
}

/**
 * Convierte un monto de salario a palabras en formato peruano
 * Ejemplo: 2500 -> "Dos mil quinientos y 00/100 soles"
 * 
 * @param salaryString - String con el salario (puede incluir símbolos como S/, $, comas, etc.)
 * @returns String con el salario en letras en formato peruano
 */
export function convertirSalarioALetras(salaryString: string | undefined | null): string {
    if (!salaryString) return '';
    
    // Limpiar el string: quitar símbolos de moneda, comas, espacios
    let cleanSalary = salaryString
        .replace(/[S\/$\€£,]/g, '') // Quitar símbolos de moneda y comas
        .replace(/\s+/g, '') // Quitar espacios
        .trim();
    
    // Intentar extraer el número
    const match = cleanSalary.match(/^(\d+)(?:\.(\d{1,2}))?/);
    if (!match) return '';
    
    const parteEntera = parseInt(match[1] || '0', 10);
    const parteDecimal = match[2] || '00';
    const decimales = parteDecimal.padEnd(2, '0').substring(0, 2); // Asegurar 2 dígitos
    
    if (parteEntera === 0 && decimales === '00') return '';
    
    // Convertir parte entera a palabras
    const palabras = numeroAPalabras(parteEntera);
    
    // Formato peruano: "Dos mil quinientos y 00/100 soles"
    let resultado = palabras;
    
    // Agregar "y" antes de los centavos si hay parte entera
    if (parteEntera > 0) {
        resultado += ' y ' + decimales + '/100';
    } else {
        resultado = decimales + '/100';
    }
    
    resultado += ' soles';
    
    return resultado;
}

/**
 * Pruebas de la función (para desarrollo)
 */
export function probarConversiones() {
    const casos = [
        'S/2,500',
        '2500',
        'S/ 3.500',
        '$1000',
        '500.50',
        '1.50',
        '0.50'
    ];
    
    casos.forEach(caso => {
        console.log(`${caso} -> ${convertirSalarioALetras(caso)}`);
    });
}

