import {
    BulkCandidate,
} from './api/bulkCandidates';
import {
    IntellectualLevelId,
    PersonalityLevel,
    PsycholaboralCompetency,
    PsycholaboralEvaluation,
    PsycholaboralInventory,
    PsycholaboralSuitability,
} from '../types';

/** Sin acentos, minúsculas, colapsa espacios — para emparejar encabezados */
export function normalizeImportHeader(raw: string): string {
    return raw
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\s+/g, ' ')
        .replace(/^["']|["']$/g, '');
}

function parseGridLines(text: string): string[][] {
    const lines = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(l => l.trimEnd())
        .filter(l => l.length > 0);

    return lines.map(line => {
        if (line.includes('\t')) return line.split('\t').map(c => c.trim());
        if (line.includes(';')) return line.split(';').map(c => c.trim());
        return line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    });
}

export function buildPsycholaboralImportTemplateTsv(
    inventory: PsycholaboralInventory,
    competencies: PsycholaboralCompetency[]
): string {
    const headers: string[] = [
        'dni',
        'id_candidato',
        'nivel_intelectual',
        ...inventory.personalityTraits.map(t => t.name),
        ...competencies.map(c => `${c.name} (${c.expectedScore})`),
        'resultado',
        'fecha_informe',
        'puesto',
        'conclusiones',
    ];

    const exampleRow = [
        '12345678',
        '',
        'normal_promedio',
        ...inventory.personalityTraits.map(() => 'promedio'),
        ...competencies.map(c => String(c.expectedScore)),
        'apto',
        new Date().toISOString().split('T')[0],
        'Puesto ejemplo',
        'Texto opcional',
    ].join('\t');

    return [
        headers.join('\t'),
        '# Pegue filas debajo; una fila por candidato. Nivel intelectual: id (ej. normal_promedio) o nombre del nivel.',
        '# Personalidad: bajo | promedio | alto (o b, p, a). Resultado: apto | no_apto | apto_reservas.',
        '# Si rellena id_candidato (UUID), tiene prioridad sobre DNI para emparejar.',
        exampleRow,
    ].join('\n');
}

function parsePersonalityLevel(raw: string): PersonalityLevel | null {
    const s = normalizeImportHeader(raw);
    if (!s) return null;
    if (['b', 'bajo', 'low'].includes(s)) return 'bajo';
    if (['p', 'prom', 'promedio', 'medio', 'med'].includes(s)) return 'promedio';
    if (['a', 'alt', 'alto', 'high'].includes(s)) return 'alto';
    return null;
}

function parseSuitability(raw: string): PsycholaboralSuitability | null {
    const s = normalizeImportHeader(raw).replace(/\s+/g, '_');
    if (!s) return null;
    if (['apto'].includes(s)) return 'apto';
    if (['no_apto', 'noapto', 'no', 'negative'].includes(s)) return 'no_apto';
    if (['apto_con_reservas', 'apto_reservas', 'reservas', 'con_reservas'].includes(s)) return 'apto_reservas';
    if (s.includes('reserva')) return 'apto_reservas';
    if (s.includes('no') && s.includes('apto')) return 'no_apto';
    return null;
}

function resolveIntellectualFromCell(
    raw: string,
    levels: { id: IntellectualLevelId; name: string }[]
): IntellectualLevelId | null {
    const s = raw.trim();
    if (!s) return null;
    const norm = normalizeImportHeader(s).replace(/\s+/g, '_');
    const byId = levels.find(l => l.id === norm);
    if (byId) return byId.id;
    const normName = normalizeImportHeader(s);
    const byName = levels.find(l => normalizeImportHeader(l.name) === normName);
    if (byName) return byName.id;
    const fuzzy = levels.find(l => normName.includes(normalizeImportHeader(l.name).slice(0, 6)));
    return fuzzy?.id ?? null;
}

export interface PsycholaboralImportIssue {
    rowIndex: number;
    dniOrId: string;
    message: string;
}

export interface PsycholaboralImportResult {
    /** candidateId -> evaluación sustituida / fusionada lista para setState */
    byCandidateId: Record<string, PsycholaboralEvaluation>;
    matched: number;
    skippedRows: number;
    issues: PsycholaboralImportIssue[];
}

function buildColumnMap(
    headerRow: string[],
    inventory: PsycholaboralInventory,
    competencies: PsycholaboralCompetency[]
): {
    dni: number;
    candidateId: number;
    intellectual: number;
    traitCols: Record<string, number>;
    compCols: Record<string, number>;
    suitability: number;
    reportDate: number;
    position: number;
    conclusions: number;
} | null {
    const normHeaders = headerRow.map(normalizeImportHeader);
    let dni = -1;
    let candidateId = -1;
    let intellectual = -1;
    let suitability = -1;
    let reportDate = -1;
    let position = -1;
    let conclusions = -1;

    normHeaders.forEach((h, i) => {
        if (['dni', 'documento', 'documento_identidad', 'dni_ce'].includes(h) || h === 'ce') dni = i;
        if (['id_candidato', 'candidate_id', 'id_candidato_uuid'].includes(h)) candidateId = i;
        if (intellectual < 0 && (h === 'nivel_intelectual' || h === 'nivel_intel' || (h.includes('nivel') && h.includes('intelect'))))
            intellectual = i;
        if (suitability < 0 && ['resultado', 'situacion', 'marca', 'aptitud', 'estado_final', 'estado'].includes(h))
            suitability = i;
        if (reportDate < 0 && (h === 'fecha' || h === 'fecha_informe' || (h.includes('fecha') && (h.includes('informe') || h.includes('report')))))
            reportDate = i;
        if (position < 0 && ['puesto', 'cargo', 'posicion', 'puesto_aplicado'].includes(h)) position = i;
        if (conclusions < 0 && h.includes('conclus')) conclusions = i;
    });

    if (dni < 0 && candidateId < 0) return null;

    const traitCols: Record<string, number> = {};
    inventory.personalityTraits.forEach(t => {
        const want = normalizeImportHeader(t.name);
        const wantShort = want.slice(0, 12);
        let idx = normHeaders.findIndex(h => h === t.id || h === want);
        if (idx < 0) idx = normHeaders.findIndex(h => h === wantShort || (want.length > 4 && h.includes(wantShort)));
        if (idx >= 0) traitCols[t.id] = idx;
    });

    const compCols: Record<string, number> = {};
    competencies.forEach(c => {
        const want = normalizeImportHeader(c.name);
        let idx = -1;
        for (let i = 0; i < normHeaders.length; i++) {
            const h = normHeaders[i];
            const raw = headerRow[i] || '';
            if (h === normalizeImportHeader(c.id)) {
                idx = i;
                break;
            }
            if (h === want) {
                idx = i;
                break;
            }
            const headCore = normalizeImportHeader(raw.split('(')[0].trim());
            if (
                headCore === want ||
                (want.length >= 6 && (headCore.startsWith(want.slice(0, 6)) || want.startsWith(headCore.slice(0, 6))))
            ) {
                idx = i;
                break;
            }
        }
        if (idx >= 0) compCols[c.id] = idx;
    });

    return {
        dni,
        candidateId,
        intellectual,
        traitCols,
        compCols,
        suitability,
        reportDate,
        position,
        conclusions,
    };
}

export function applyPsycholaboralImportPaste(
    rawText: string,
    candidates: BulkCandidate[],
    baseRows: Record<string, PsycholaboralEvaluation>,
    inventory: PsycholaboralInventory,
    competencies: PsycholaboralCompetency[]
): PsycholaboralImportResult {
    const grid = parseGridLines(rawText).filter(row => {
        const first = row[0]?.trim() ?? '';
        return first.length > 0 && !first.startsWith('#');
    });
    const issues: PsycholaboralImportIssue[] = [];
    const byCandidateId: Record<string, PsycholaboralEvaluation> = {};
    let matched = 0;
    let skippedRows = 0;

    if (grid.length < 2) {
        issues.push({ rowIndex: 0, dniOrId: '', message: 'Pegue al menos encabezados y una fila de datos.' });
        return { byCandidateId, matched, skippedRows, issues };
    }

    const map = buildColumnMap(grid[0], inventory, competencies);
    if (!map) {
        issues.push({
            rowIndex: 0,
            dniOrId: '',
            message: 'Falta columna dni o id_candidato en la primera fila.',
        });
        return { byCandidateId, matched, skippedRows, issues };
    }

    const byDni = new Map<string, BulkCandidate>();
    candidates.forEach(c => {
        const raw = (c.dni || '').trim();
        if (!raw) return;
        const digits = raw.replace(/\D/g, '');
        if (digits) byDni.set(digits, c);
        const compact = normalizeImportHeader(raw).replace(/\s/g, '');
        if (compact) byDni.set(compact, c);
    });

    const byId = new Map(candidates.map(c => [c.id, c]));

    const dataRows = grid.slice(1);
    dataRows.forEach((cells, j) => {
        const rowIndex = j + 2;
        const dniRaw = map.dni >= 0 ? (cells[map.dni] || '').trim() : '';
        const idRaw = map.candidateId >= 0 ? (cells[map.candidateId] || '').trim() : '';

        let cand: BulkCandidate | undefined;
        if (idRaw && byId.has(idRaw)) cand = byId.get(idRaw);
        if (!cand && dniRaw) {
            const digits = dniRaw.replace(/\D/g, '');
            cand = (digits && byDni.get(digits)) || byDni.get(normalizeImportHeader(dniRaw).replace(/\s/g, ''));
        }

        if (!cand) {
            skippedRows++;
            issues.push({
                rowIndex,
                dniOrId: idRaw || dniRaw || '—',
                message: 'Sin candidato en esta carga masiva (revise DNI o id_candidato).',
            });
            return;
        }

        const base = baseRows[cand.id];
        if (!base) {
            skippedRows++;
            issues.push({ rowIndex, dniOrId: dniRaw || idRaw, message: 'Candidato no está en la selección actual.' });
            return;
        }

        const next: PsycholaboralEvaluation = {
            ...base,
            personality: base.personality.map(p => ({ ...p })),
            competencies: base.competencies.map(c => ({ ...c })),
        };

        if (map.intellectual >= 0) {
            const cell = cells[map.intellectual];
            if (cell?.trim()) {
                const id = resolveIntellectualFromCell(cell, inventory.intellectualLevels);
                if (id) next.intellectualLevelId = id;
                else
                    issues.push({
                        rowIndex,
                        dniOrId: dniRaw || idRaw,
                        message: `Nivel intelectual no reconocido: "${cell.slice(0, 40)}".`,
                    });
            }
        }

        inventory.personalityTraits.forEach(t => {
            const col = map.traitCols[t.id];
            if (col === undefined || col < 0) return;
            const cell = cells[col];
            if (!cell?.trim()) return;
            const lvl = parsePersonalityLevel(cell);
            if (!lvl) {
                issues.push({
                    rowIndex,
                    dniOrId: dniRaw || idRaw,
                    message: `Nivel personalidad "${t.name}": valor inválido "${cell}".`,
                });
                return;
            }
            const idx = next.personality.findIndex(p => p.traitId === t.id);
            if (idx >= 0) next.personality[idx] = { ...next.personality[idx], level: lvl };
        });

        competencies.forEach(c => {
            const col = map.compCols[c.id];
            if (col === undefined || col < 0) return;
            const cell = cells[col];
            if (!cell?.trim()) return;
            const n = parseInt(cell.replace(',', '.'), 10);
            if (isNaN(n) || n < 1 || n > 9) {
                issues.push({
                    rowIndex,
                    dniOrId: dniRaw || idRaw,
                    message: `Puntuación competencia "${c.name}": use 1–9 ("${cell}").`,
                });
                return;
            }
            const idx = next.competencies.findIndex(r => r.competencyId === c.id);
            if (idx >= 0) next.competencies[idx] = { ...next.competencies[idx], obtainedScore: n };
        });

        if (map.suitability >= 0) {
            const cell = cells[map.suitability];
            if (cell?.trim()) {
                const s = parseSuitability(cell);
                if (s) next.suitabilityStatus = s;
                else
                    issues.push({
                        rowIndex,
                        dniOrId: dniRaw || idRaw,
                        message: `Resultado no reconocido: "${cell}".`,
                    });
            }
        }

        if (map.reportDate >= 0) {
            const cell = cells[map.reportDate];
            if (cell?.trim()) {
                const iso = cell.trim().slice(0, 10);
                next.reportDate = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : cell.trim();
            }
        }

        if (map.position >= 0) {
            const cell = cells[map.position];
            if (cell?.trim()) next.positionApplied = cell.trim();
        }

        if (map.conclusions >= 0) {
            const cell = cells[map.conclusions];
            if (cell?.trim()) next.conclusions = cell.trim();
        }

        byCandidateId[cand.id] = next;
        matched++;
    });

    return { byCandidateId, matched, skippedRows, issues };
}
