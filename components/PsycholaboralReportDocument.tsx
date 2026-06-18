import React from 'react';
import {
    Candidate,
    Process,
    PsycholaboralEvaluation,
    PsycholaboralInventory,
    PsycholaboralCompetency,
    PersonalityLevel,
    PsycholaboralSuitability,
} from '../types';
import { formatearFechaPeruana } from '../lib/dateFormatter';
import {
    calculateCompetencyTotals,
    getCompetencyLevelLabel,
    mergePsycholaboralInventory,
} from '../lib/psycholaboralUtils';

/**
 * Ancho CSS alineado a A4 apaisado: mismo DPI de referencia que 794≈210mm, escalado √2 al largo 297mm.
 * El pdf usa `orientation: landscape` para que ese ancho coincida mejor con la hoja física.
 */
const PAGE_W = Math.round((794 * 297) / 210);
/** Alto mínimo (~lado corto A4 apaisado) para que el informe use mejor la hoja en vertical. */
const PAGE_H_MIN = Math.round((PAGE_W * 210) / 297);

export interface PsycholaboralReportDocumentProps {
    candidate: Pick<Candidate, 'name' | 'dni' | 'age' | 'avatarUrl'>;
    /** Nombre y apellidos ya unidos (p. ej. desde columnas personalizadas). Si no, se usa candidate.name */
    fullNameForReport?: string;
    process?: Process;
    evaluation: PsycholaboralEvaluation;
    competencies: PsycholaboralCompetency[];
    inventory: PsycholaboralInventory;
    /** Logo "Powered by" (Opalo) — prioridad sobre logo de empresa. */
    poweredByLogoUrl?: string | null;
    /** Logo empresa (solo si no hay powered by). */
    logoUrl?: string;
    companyName?: string;
    primaryColor?: string;
    accentColor?: string;
    /** Desactivados en layout compacto (ahorra altura vertical). */
    heroImageUrl?: string | null;
    introText?: string | null;
    closingText?: string | null;
    footerLegalText?: string | null;
}

const SUITABILITY_STYLES: Record<
    PsycholaboralSuitability,
    { bg: string; text: string; label: string }
> = {
    apto: { bg: '#dcfce7', text: '#166534', label: 'APTO' },
    apto_reservas: { bg: '#fef9c3', text: '#854d0e', label: 'RESERVAS' },
    no_apto: { bg: '#fee2e2', text: '#991b1b', label: 'NO APTO' },
};

const LEVEL_COLORS: Record<PersonalityLevel, string> = {
    bajo: '#ea580c',
    promedio: '#2563eb',
    alto: '#059669',
};

const LEVEL_SHORT: Record<PersonalityLevel, string> = {
    bajo: 'Baj.',
    promedio: 'Prom.',
    alto: 'Alt.',
};

function clampInterpretation(raw: string | undefined): string {
    if (!raw) return '—';
    const t = raw.replace(/\s+/g, ' ').trim();
    if (t.length <= 480) return t;
    return `${t.slice(0, 477)}…`;
}

export const PsycholaboralReportDocument = React.forwardRef<
    HTMLDivElement,
    PsycholaboralReportDocumentProps
>(function PsycholaboralReportDocument(
    {
        candidate,
        process,
        evaluation,
        competencies,
        inventory: rawInventory,
        poweredByLogoUrl,
        logoUrl,
        companyName = 'Opalo',
        primaryColor = '#0f766e',
        accentColor = '#4338ca',
        introText: introTextProp,
        closingText,
        footerLegalText,
        fullNameForReport,
    },
    ref
) {
    const inventory = mergePsycholaboralInventory(rawInventory);
    const personName = (fullNameForReport?.trim() || candidate.name || '—').trim();
    const intellectual = inventory.intellectualLevels.find(l => l.id === evaluation.intellectualLevelId);
    const { totalExpected, totalObtained, percentage } = calculateCompetencyTotals(
        competencies,
        evaluation.competencies
    );
    const status = evaluation.suitabilityStatus || 'apto';
    const suitStyle = SUITABILITY_STYLES[status];

    const position =
        evaluation.positionApplied ||
        process?.bulkConfig?.psycholaboral?.defaultPositionTitle ||
        process?.title ||
        '';

    const reportDate = evaluation.reportDate
        ? formatearFechaPeruana(evaluation.reportDate)
        : formatearFechaPeruana();

    const headerLogoSrc = ((poweredByLogoUrl ?? '').trim() || (logoUrl ?? '').trim() || '').trim();

    /** Intro muy corto si lo configuran; si no, una sola línea para no ocupar bloque alto. */
    const introOverlay =
        (introTextProp && introTextProp.trim()) ||
        'Resultado sintético; complementar con otros criterios de selección.';
    const shortIntro =
        introOverlay.length > 130 ? `${introOverlay.slice(0, 127).trim()}…` : introOverlay;

    const closingLine =
        (closingText && closingText.trim()) || 'Combinar con otros insumos técnicos y de proceso.';

    const fs = {
        nano: 7,
        micro: 8,
        sm: 9,
        body: 9.25,
        title: 14,
        sub: 10,
    } as const;

    return (
        <div
            ref={ref}
            style={{
                width: PAGE_W,
                maxWidth: PAGE_W,
                minHeight: PAGE_H_MIN,
                fontFamily: "'Segoe UI', system-ui, sans-serif",
                color: '#0f172a',
                background: '#fff',
                lineHeight: 1.38,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            {/* Cabecera mínima: sin hero ni gradientes grandes */}
            <header
                style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 10px',
                    borderBottom: `2px solid ${primaryColor}`,
                    background: '#fff',
                }}
            >
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', minWidth: 72 }}>
                    {headerLogoSrc ? (
                        <img
                            src={headerLogoSrc}
                            alt=""
                            style={{
                                height: 28,
                                maxWidth: 132,
                                width: 'auto',
                                display: 'block',
                                objectFit: 'contain',
                            }}
                            crossOrigin="anonymous"
                        />
                    ) : (
                        <span style={{ fontSize: fs.sub, fontWeight: 800, color: primaryColor }}>Opalo</span>
                    )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h1 style={{ margin: 0, fontSize: fs.title, fontWeight: 800, lineHeight: 1.08 }}>
                        INFORME PSICOLABORAL
                    </h1>
                    <p style={{ margin: '1px 0 0', fontSize: fs.sm, color: '#475569', fontWeight: 600 }}>
                        {personName} · {position || '—'} · {reportDate}
                        {companyName ? ` · ${companyName}` : ''}
                    </p>
                    <p
                        style={{
                            margin: '2px 0 0',
                            fontSize: fs.micro,
                            color: '#64748b',
                            lineHeight: 1.32,
                        }}
                    >
                        {shortIntro}
                    </p>
                </div>
                <div style={{ flexShrink: 0 }}>
                    <span
                        style={{
                            display: 'block',
                            background: suitStyle.bg,
                            color: suitStyle.text,
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontWeight: 800,
                            fontSize: fs.sm,
                            textAlign: 'center',
                            lineHeight: 1.18,
                            border: `1px solid ${suitStyle.text}40`,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {suitStyle.label}
                    </span>
                </div>
            </header>

            <main
                style={{
                    flex: '1 1 auto',
                    padding: '8px 9px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: fs.body,
                }}
            >
                <section
                    style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'stretch',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 4,
                        padding: '8px 10px',
                    }}
                >
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 4,
                            overflow: 'hidden',
                            flexShrink: 0,
                            background: '#e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {candidate.avatarUrl ? (
                            <img
                                src={candidate.avatarUrl}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                crossOrigin="anonymous"
                            />
                        ) : (
                            <span style={{ fontSize: 17, fontWeight: 700, color: primaryColor }}>
                                {personName.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                        <div>
                            <div style={{ fontSize: fs.nano, color: '#64748b', fontWeight: 700, marginBottom: 2 }}>
                                Nombre y apellidos
                            </div>
                            <div
                                style={{
                                    fontSize: fs.body,
                                    fontWeight: 700,
                                    lineHeight: 1.32,
                                    wordBreak: 'break-word',
                                }}
                            >
                                {personName}
                            </div>
                        </div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                                gap: '6px 12px',
                            }}
                        >
                            {[
                                ['DNI', candidate.dni || '—'],
                                ['Edad', candidate.age != null && candidate.age > 0 ? `${candidate.age}` : '—'],
                                ['Puesto', position || '—'],
                            ].map(([k, v]) => (
                                <div key={String(k)}>
                                    <div style={{ fontSize: fs.nano, color: '#64748b', fontWeight: 700 }}>{k}</div>
                                    <div style={{ fontSize: fs.sm, fontWeight: 600, lineHeight: 1.35, wordBreak: 'break-word' }}>
                                        {String(v)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Tres columnas (apaisado): menos altura vertical, más lectura lateral */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 0.82fr) minmax(0, 1.22fr) minmax(0, 1fr)',
                        gap: 8,
                        alignItems: 'stretch',
                        flex: '1 1 auto',
                        minHeight: 0,
                    }}
                >
                    {/* 1 · Nivel intelectual */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, height: '100%' }}>
                        <BlockTitle n={1} title="Nivel intelectual" color={primaryColor} compact />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {inventory.intellectualLevels.map(level => {
                                const active = level.id === evaluation.intellectualLevelId;
                                return (
                                    <div
                                        key={level.id}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            textAlign: 'center',
                                            minHeight: 48,
                                            padding: '8px 6px',
                                            borderRadius: 3,
                                            background: active ? primaryColor : '#f1f5f9',
                                            color: active ? '#fff' : '#64748b',
                                            fontSize: fs.micro,
                                            fontWeight: active ? 700 : 600,
                                            lineHeight: 1.22,
                                        }}
                                    >
                                        <div style={{ wordBreak: 'break-word' }}>{level.name}</div>
                                        <div style={{ fontSize: fs.nano, opacity: 0.92 }}>{level.scoreRange}</div>
                                    </div>
                                );
                            })}
                        </div>
                        <div
                            style={{
                                fontSize: fs.sm,
                                color: '#334155',
                                borderLeft: `3px solid ${primaryColor}`,
                                padding: '12px 12px',
                                background: '#fafafa',
                                lineHeight: 1.42,
                                wordBreak: 'break-word',
                                minHeight: 120,
                                flex: '1 1 auto',
                            }}
                        >
                            {clampInterpretation(intellectual?.interpretation)}
                        </div>
                    </div>

                    {/* 2 · Personalidad */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, height: '100%' }}>
                        <BlockTitle n={2} title="Personalidad" color={accentColor} compact />
                        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: fs.micro }}>
                            <colgroup>
                                <col style={{ width: '36%' }} />
                                <col style={{ width: '15%' }} />
                                <col style={{ width: '49%' }} />
                            </colgroup>
                            <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                    <th
                                        style={{
                                            padding: '7px 8px',
                                            textAlign: 'left',
                                            border: '1px solid #e2e8f0',
                                            fontSize: fs.nano,
                                            lineHeight: 1.28,
                                            fontWeight: 700,
                                            verticalAlign: 'middle',
                                        }}
                                    >
                                        Rasgo
                                    </th>
                                    <th
                                        style={{
                                            padding: '7px 6px',
                                            textAlign: 'center',
                                            border: '1px solid #e2e8f0',
                                            fontSize: fs.nano,
                                            lineHeight: 1.28,
                                            fontWeight: 700,
                                            verticalAlign: 'middle',
                                        }}
                                    >
                                        Nivel
                                    </th>
                                    <th
                                        style={{
                                            padding: '7px 8px',
                                            textAlign: 'left',
                                            border: '1px solid #e2e8f0',
                                            fontSize: fs.nano,
                                            lineHeight: 1.28,
                                            fontWeight: 700,
                                            verticalAlign: 'middle',
                                        }}
                                    >
                                        Obs.
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {inventory.personalityTraits.map(trait => {
                                    const rating = evaluation.personality.find(p => p.traitId === trait.id);
                                    const level = rating?.level || 'promedio';
                                    return (
                                        <tr key={trait.id}>
                                            <td
                                                style={{
                                                    padding: '7px 8px',
                                                    border: '1px solid #e2e8f0',
                                                    verticalAlign: 'middle',
                                                    lineHeight: 1.32,
                                                    fontWeight: 600,
                                                    fontSize: fs.micro,
                                                    wordBreak: 'break-word',
                                                    overflowWrap: 'break-word',
                                                }}
                                            >
                                                {trait.name}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '7px 6px',
                                                    border: '1px solid #e2e8f0',
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    color: LEVEL_COLORS[level],
                                                    fontWeight: 700,
                                                    fontSize: fs.micro,
                                                    lineHeight: 1.28,
                                                    wordBreak: 'break-word',
                                                }}
                                            >
                                                {LEVEL_SHORT[level]}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '7px 8px',
                                                    border: '1px solid #e2e8f0',
                                                    fontSize: fs.micro,
                                                    lineHeight: 1.32,
                                                    verticalAlign: 'middle',
                                                    wordBreak: 'break-word',
                                                    overflowWrap: 'break-word',
                                                }}
                                            >
                                                {rating?.observations?.trim() ? rating.observations.trim() : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* 3 · Competencias + 4 · Conclusiones */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, height: '100%' }}>
                        <BlockTitle n={3} title="Competencias" color={primaryColor} compact />
                        <div
                            style={{
                                padding: '8px 10px',
                                background: `#f8fafc`,
                                borderRadius: 3,
                                border: `1px solid ${primaryColor}40`,
                                fontSize: fs.sm,
                                fontWeight: 700,
                                lineHeight: 1.32,
                            }}
                        >
                            {percentage}% cumplimiento · {totalObtained}/{totalExpected} pts. (esp. máx.)
                        </div>
                        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: fs.micro }}>
                            <colgroup>
                                <col style={{ width: '22%' }} />
                                <col style={{ width: '38%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '20%' }} />
                            </colgroup>
                            <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                    {['Competencia', 'Significado', 'Esp.', 'Obt.', 'Nivel'].map((h, i) => (
                                        <th
                                            key={h}
                                            style={{
                                                padding: '7px 6px',
                                                textAlign: i >= 2 && i <= 3 ? 'center' : 'left',
                                                border: '1px solid #e2e8f0',
                                                fontSize: fs.nano,
                                                fontWeight: 700,
                                                verticalAlign: 'middle',
                                                lineHeight: 1.25,
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {competencies.map(comp => {
                                    const rating = evaluation.competencies.find(r => r.competencyId === comp.id);
                                    const obtained = rating?.obtainedScore ?? 0;
                                    const levelLabel = getCompetencyLevelLabel(obtained);
                                    const obs = rating?.observations?.trim();
                                    return (
                                        <React.Fragment key={comp.id}>
                                            <tr>
                                                <td
                                                    style={{
                                                        padding: '7px 8px',
                                                        border: '1px solid #e2e8f0',
                                                        verticalAlign: 'middle',
                                                        fontWeight: 600,
                                                        wordBreak: 'break-word',
                                                        lineHeight: 1.3,
                                                    }}
                                                >
                                                    {comp.name}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: '7px 8px',
                                                        border: '1px solid #e2e8f0',
                                                        verticalAlign: 'middle',
                                                        color: '#475569',
                                                        fontSize: fs.nano,
                                                        wordBreak: 'break-word',
                                                        lineHeight: 1.35,
                                                    }}
                                                >
                                                    {comp.definition?.trim() ? comp.definition.trim() : '—'}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: '7px 6px',
                                                        border: '1px solid #e2e8f0',
                                                        textAlign: 'center',
                                                        verticalAlign: 'middle',
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {comp.expectedScore}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: '7px 6px',
                                                        border: '1px solid #e2e8f0',
                                                        textAlign: 'center',
                                                        verticalAlign: 'middle',
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {obtained}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: '7px 6px',
                                                        border: '1px solid #e2e8f0',
                                                        textAlign: 'center',
                                                        verticalAlign: 'middle',
                                                        fontWeight: 600,
                                                        fontSize: fs.nano,
                                                    }}
                                                >
                                                    {levelLabel}
                                                </td>
                                            </tr>
                                            {obs ? (
                                                <tr>
                                                    <td
                                                        colSpan={5}
                                                        style={{
                                                            padding: '6px 10px',
                                                            border: '1px solid #e2e8f0',
                                                            background: '#fafafa',
                                                            fontSize: fs.nano,
                                                            color: '#64748b',
                                                            verticalAlign: 'middle',
                                                            wordBreak: 'break-word',
                                                            lineHeight: 1.35,
                                                        }}
                                                    >
                                                        <span style={{ fontWeight: 700, color: '#334155' }}>Obs.: </span>
                                                        {obs}
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div
                            style={{
                                marginTop: 16,
                                paddingTop: 14,
                                borderTop: '1px solid #cbd5e1',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                                flex: '1 1 auto',
                                minHeight: 0,
                            }}
                        >
                            <BlockTitle n={4} title="Conclusiones" color={accentColor} compact />
                            <div
                                style={{
                                    fontSize: fs.sm,
                                    lineHeight: 1.45,
                                    color: '#334155',
                                    padding: '14px 12px',
                                    borderLeft: `3px solid ${accentColor}`,
                                    background: '#fafafa',
                                    textAlign: 'justify',
                                    border: '1px solid #e2e8f0',
                                    borderLeftWidth: 3,
                                    flex: '1 1 auto',
                                    minHeight: 150,
                                    maxHeight: 280,
                                    overflow: 'hidden',
                                    wordBreak: 'break-word',
                                }}
                            >
                                {evaluation.conclusions?.trim()
                                    ? evaluation.conclusions.trim()
                                    : 'Sin conclusiones registradas.'}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer
                style={{
                    flexShrink: 0,
                    padding: '5px 8px',
                    fontSize: fs.nano,
                    color: '#64748b',
                    borderTop: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    lineHeight: 1.34,
                    textAlign: 'center',
                }}
            >
                <span style={{ fontWeight: 600 }}>{closingLine}</span>
                {' · '}
                {['Conf.', footerLegalText?.trim?.(), companyName, reportDate].filter(Boolean).join(' · ')}
            </footer>
        </div>
    );
});

function BlockTitle({ n, title, color, compact }: { n: number; title: string; color: string; compact?: boolean }) {
    /** Unos píxeles extra ayudan a que el rasterizado PDF no “corte” la caja de fuente */
    const chip = compact ? 18 : 20;
    const fontSize = compact ? 10 : 11;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
                style={{
                    display: 'inline-table',
                    width: chip,
                    height: chip,
                    borderRadius: 3,
                    background: color,
                    verticalAlign: 'middle',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    tableLayout: 'fixed',
                }}
            >
                <span
                    style={{
                        display: 'table-cell',
                        width: chip,
                        height: chip,
                        verticalAlign: 'middle',
                        textAlign: 'center',
                        color: '#fff',
                        fontSize,
                        fontWeight: 800,
                        lineHeight: 1,
                        padding: 0,
                        margin: 0,
                        fontFamily: 'system-ui, Segoe UI, Roboto, "Helvetica Neue", Arial, sans-serif',
                    }}
                >
                    {n}
                </span>
            </span>
            <strong style={{ fontSize: 9.25, color: '#0f172a', lineHeight: 1.25 }}>{title}</strong>
        </div>
    );
}
