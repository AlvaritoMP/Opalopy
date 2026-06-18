export type NormalizeImportTextCaseOptions = {
    field?: string;
    columnType?: string;
    selectOptions?: string[];
};

export {
    isImportTextAllCaps,
    toImportProperCase,
    normalizeImportTextCase,
    applyImportTextCaseToCandidate,
    IMPORT_TEXT_CASE_CANDIDATE_FIELDS,
} from './importTextCase.js';
