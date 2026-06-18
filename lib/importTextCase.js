/** Campos de texto que no deben normalizarse (identificadores, URLs, etc.) */
const IMPORT_PROPER_CASE_EXCLUDE_KEYS = new Set([
    'email',
    'linkedinurl',
    'phone',
    'phone2',
    'dni',
    'age',
]);

const IMPORT_TEXT_LETTER_RE = /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/g;
const IMPORT_WORD_RE = /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+(?:'[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+)*/g;

function normalizeFieldKey(field) {
    if (!field) return undefined;
    return field.toLowerCase().replace(/_/g, '');
}

function isExcludedImportField(field) {
    const key = normalizeFieldKey(field);
    return key ? IMPORT_PROPER_CASE_EXCLUDE_KEYS.has(key) : false;
}

export function isImportTextAllCaps(text) {
    const letters = text.match(IMPORT_TEXT_LETTER_RE);
    if (!letters?.length) return false;
    return letters.every(c => c === c.toUpperCase() && c !== c.toLowerCase());
}

export function isImportTextAllLower(text) {
    const letters = text.match(IMPORT_TEXT_LETTER_RE);
    if (!letters?.length) return false;
    return letters.every(c => c === c.toLowerCase() && c !== c.toUpperCase());
}

function shouldNormalizeImportWord(word) {
    return isImportTextAllCaps(word) || isImportTextAllLower(word);
}

export function toImportProperCase(text) {
    return text.replace(IMPORT_WORD_RE, word => {
        const lower = word.toLowerCase();
        return lower.charAt(0).toUpperCase() + lower.slice(1);
    });
}

export function normalizeImportTextCase(value, opts = {}) {
    const { field, columnType, selectOptions } = opts;

    if (isExcludedImportField(field)) return value;
    if (columnType === 'number' || columnType === 'date' || columnType === 'checkbox') {
        return value;
    }

    if (columnType === 'select' && selectOptions?.length) {
        const match = selectOptions.find(o => o.toLowerCase() === value.toLowerCase());
        if (match) return match;
    }

    // Nombre: siempre título por palabra ("juan perez" → "Juan Perez")
    if (normalizeFieldKey(field) === 'name') {
        return toImportProperCase(value);
    }

    // Palabra a palabra si todo mayúsculas o todo minúsculas
    return value.replace(IMPORT_WORD_RE, word =>
        shouldNormalizeImportWord(word) ? toImportProperCase(word) : word
    );
}

export const IMPORT_TEXT_CASE_CANDIDATE_FIELDS = [
    'name',
    'description',
    'source',
    'salaryExpectation',
    'salary_expectation',
    'agreedSalary',
    'agreed_salary',
    'address',
    'province',
    'district',
];

export function applyImportTextCaseToCandidate(candidate, fields = IMPORT_TEXT_CASE_CANDIDATE_FIELDS) {
    for (const field of fields) {
        const val = candidate[field];
        if (typeof val === 'string' && val.trim()) {
            candidate[field] = normalizeImportTextCase(val, { field });
        }
    }
    return candidate;
}
