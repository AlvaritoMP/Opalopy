import type { BulkCandidate } from './api/bulkCandidates';
import type { Candidate, Process } from '../types';
import {
    buildLegacyColumnIdToName,
    resolveCandidateAgeForProcess,
    resolveCandidateHomonymField,
} from './bulkTableColumns';

/** Convierte candidato masivo (API ligera) al shape usado por el Panel. */
export function mapBulkCandidateForDashboard(b: BulkCandidate): Candidate {
    return {
        id: b.id,
        name: b.name,
        email: b.email || '',
        phone: b.phone,
        processId: b.processId,
        stageId: b.stageId,
        history: b.history ?? [],
        attachments: [],
        source: b.source,
        age: b.age,
        dni: b.dni,
        district: b.district,
        province: b.province,
        discarded: b.discarded,
        archived: b.archived,
        applicationCount: b.applicationCount,
        firstApplicationAt: b.firstApplicationAt,
        createdAt: b.createdAt,
        registrationOrigin: b.registrationOrigin,
        createdBy: b.createdBy,
        hireDate: b.hireDate,
        offerAcceptedDate: b.offerAcceptedDate,
        applicationStartedDate: b.applicationStartedDate || b.createdAt,
        applicationCompletedDate: b.applicationCompletedDate,
        bulkColumnValues: b.bulkColumnValues,
        metadataIa: b.metadataIa,
        scoreIa: b.scoreIa,
    };
}

/** Enriquece candidato masivo con columnas personalizadas y clasificación semántica del proceso. */
export function enrichBulkCandidateForDashboard(
    b: BulkCandidate,
    process: Process | undefined,
    columnValuesRow: Record<string, unknown> = {}
): Candidate {
    const customColumns = process?.bulkConfig?.customColumns ?? [];
    const legacyColumnIdToName = buildLegacyColumnIdToName(process?.bulkConfig, customColumns);
    const enrichedRow = {
        ...(b.bulkColumnValues || {}),
        ...columnValuesRow,
    };
    const homonymBase = {
        id: b.id,
        source: b.source,
        province: b.province,
        district: b.district,
        age: b.age,
        bulkColumnValues: Object.keys(enrichedRow).length > 0 ? enrichedRow : undefined,
    };
    const columnValues =
        Object.keys(enrichedRow).length > 0 ? { [b.id]: enrichedRow } : {};

    const resolvedSource = resolveCandidateHomonymField(
        homonymBase,
        'source',
        customColumns,
        columnValues,
        legacyColumnIdToName
    );
    const resolvedProvince = resolveCandidateHomonymField(
        homonymBase,
        'province',
        customColumns,
        columnValues,
        legacyColumnIdToName
    );
    const resolvedDistrict = resolveCandidateHomonymField(
        homonymBase,
        'district',
        customColumns,
        columnValues,
        legacyColumnIdToName
    );
    const resolvedAge = resolveCandidateAgeForProcess(
        {
            id: b.id,
            age: b.age,
            bulkColumnValues: homonymBase.bulkColumnValues,
        },
        process,
        columnValuesRow ? { [b.id]: enrichedRow } : {}
    );

    return mapBulkCandidateForDashboard({
        ...b,
        source: resolvedSource != null && resolvedSource !== '' ? String(resolvedSource) : b.source,
        province: resolvedProvince != null && resolvedProvince !== '' ? String(resolvedProvince) : b.province,
        district: resolvedDistrict != null && resolvedDistrict !== '' ? String(resolvedDistrict) : b.district,
        age: resolvedAge ?? b.age,
        bulkColumnValues: Object.keys(enrichedRow).length > 0 ? enrichedRow : b.bulkColumnValues,
    });
}

/** Fecha de postulación para filtros del Panel (historial, primera postulación o alta). */
export function resolveDashboardApplicationDate(candidate: Candidate): string | undefined {
    return (
        candidate.history[0]?.movedAt ||
        candidate.firstApplicationAt ||
        candidate.applicationStartedDate ||
        undefined
    );
}

export type BulkDashboardFieldExtras = {
    bulkColumnValues?: Record<string, unknown>;
    age?: number;
    source?: string;
    province?: string;
    district?: string;
};

export function bulkDashboardFieldExtrasFromCandidate(c: Candidate): BulkDashboardFieldExtras {
    return {
        age: c.age,
        source: c.source,
        province: c.province,
        district: c.district,
        bulkColumnValues: c.bulkColumnValues,
    };
}
