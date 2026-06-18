import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import {
    buildGeoDistrictCounts,
    boundsFromCoordinates,
    createProjector,
    districtFillColor,
    formatDistrictDisplayName,
    ringCentroid,
    ringToSvgPath,
    ringsFromGeometry,
    type LngLat,
} from '../lib/limaDistrictMap';

const GEOJSON_URL = '/data/lima-callao-distritos.geojson';
const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.28;

type DistrictFeature = GeoJSON.Feature<
    GeoJSON.Polygon | GeoJSON.MultiPolygon,
    { distrito: string; distrito2?: string | null; provincia?: string }
>;

interface MapView {
    scale: number;
    tx: number;
    ty: number;
}

interface LimaDistrictMapProps {
    countsByLabel: Map<string, number>;
    height?: number;
    width?: number;
    className?: string;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function clientToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] {
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const x = ((clientX - rect.left) / rect.width) * vb.width;
    const y = ((clientY - rect.top) / rect.height) * vb.height;
    return [x, y];
}

function zoomAtPoint(view: MapView, factor: number, px: number, py: number): MapView {
    const newScale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
    if (Math.abs(newScale - view.scale) < 0.001) return view;
    const cx = (px - view.tx) / view.scale;
    const cy = (py - view.ty) / view.scale;
    return {
        scale: newScale,
        tx: px - cx * newScale,
        ty: py - cy * newScale,
    };
}

function buildShapes(
    features: DistrictFeature[],
    geoCounts: Map<string, number>,
    maxCount: number,
    viewWidth: number,
    viewHeight: number
) {
    const allCoords: LngLat[] = [];
    for (const feature of features) {
        for (const ring of ringsFromGeometry(feature.geometry)) {
            allCoords.push(...ring);
        }
    }
    const bounds = boundsFromCoordinates(allCoords);
    const project = createProjector(bounds, viewWidth, viewHeight, 18);

    return features.map(feature => {
        const geoKey = feature.properties.distrito;
        const rings = ringsFromGeometry(feature.geometry);
        const outerRing = rings.reduce(
            (best, ring) => (ring.length > best.length ? ring : best),
            rings[0] ?? []
        );
        const centroid = outerRing.length > 0 ? ringCentroid(outerRing) : ([0, 0] as LngLat);
        const [cx, cy] = project(centroid);
        const count = geoCounts.get(geoKey) ?? 0;

        return {
            geoKey,
            displayName: formatDistrictDisplayName(geoKey, feature.properties.distrito2),
            count,
            cx,
            cy,
            fill: districtFillColor(count, maxCount),
            paths: rings.map(ring => ringToSvgPath(ring, project)),
        };
    });
}

const MapCanvas: React.FC<{
    shapes: ReturnType<typeof buildShapes>;
    viewWidth: number;
    viewHeight: number;
    view: MapView;
    onViewChange: (view: MapView) => void;
    hovered: string | null;
    onHover: (key: string | null) => void;
    showControls?: boolean;
    onExpand?: () => void;
    isExpanded?: boolean;
}> = ({
    shapes,
    viewWidth,
    viewHeight,
    view,
    onViewChange,
    hovered,
    onHover,
    showControls = true,
    onExpand,
    isExpanded = false,
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

    const handleWheel = useCallback(
        (e: React.WheelEvent<SVGSVGElement>) => {
            e.preventDefault();
            const svg = svgRef.current;
            if (!svg) return;
            const [px, py] = clientToSvgPoint(svg, e.clientX, e.clientY);
            const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
            onViewChange(zoomAtPoint(view, factor, px, py));
        },
        [view, onViewChange]
    );

    const handlePointerDown = useCallback(
        (e: React.PointerEvent<SVGSVGElement>) => {
            if (e.button !== 0) return;
            panRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
            e.currentTarget.setPointerCapture(e.pointerId);
        },
        [view.tx, view.ty]
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent<SVGSVGElement>) => {
            if (!panRef.current || !svgRef.current) return;
            const rect = svgRef.current.getBoundingClientRect();
            const vb = svgRef.current.viewBox.baseVal;
            const scaleX = vb.width / rect.width;
            const scaleY = vb.height / rect.height;
            const dx = (e.clientX - panRef.current.x) * scaleX;
            const dy = (e.clientY - panRef.current.y) * scaleY;
            onViewChange({
                ...view,
                tx: panRef.current.tx + dx,
                ty: panRef.current.ty + dy,
            });
        },
        [view, onViewChange]
    );

    const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
        panRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
    }, []);

    const zoomFromCenter = useCallback(
        (factor: number) => {
            onViewChange(zoomAtPoint(view, factor, viewWidth / 2, viewHeight / 2));
        },
        [view, onViewChange, viewWidth, viewHeight]
    );

    const labelScale = 1 / Math.sqrt(view.scale);

    return (
        <div className="relative w-full h-full min-h-0">
            {showControls && (
                <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                    <button
                        type="button"
                        onClick={() => zoomFromCenter(ZOOM_STEP)}
                        className="p-1.5 rounded-md bg-white/95 border border-gray-200 shadow-sm text-gray-700 hover:bg-gray-50"
                        title="Acercar"
                        aria-label="Acercar mapa"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => zoomFromCenter(1 / ZOOM_STEP)}
                        className="p-1.5 rounded-md bg-white/95 border border-gray-200 shadow-sm text-gray-700 hover:bg-gray-50"
                        title="Alejar"
                        aria-label="Alejar mapa"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewChange({ scale: 1, tx: 0, ty: 0 })}
                        className="p-1.5 rounded-md bg-white/95 border border-gray-200 shadow-sm text-gray-700 hover:bg-gray-50"
                        title="Restablecer vista"
                        aria-label="Restablecer vista del mapa"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    {onExpand && (
                        <button
                            type="button"
                            onClick={onExpand}
                            className="p-1.5 rounded-md bg-white/95 border border-gray-200 shadow-sm text-gray-700 hover:bg-gray-50"
                            title={isExpanded ? 'Cerrar pantalla completa' : 'Pantalla completa'}
                            aria-label={isExpanded ? 'Cerrar pantalla completa' : 'Expandir mapa'}
                        >
                            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            )}

            <svg
                ref={svgRef}
                viewBox={`0 0 ${viewWidth} ${viewHeight}`}
                className="w-full h-full touch-none select-none"
                style={{ minHeight: viewHeight, cursor: view.scale > 1 ? 'grab' : 'default' }}
                role="img"
                aria-label="Mapa de candidatos por distrito en Lima y Callao"
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                <rect x={0} y={0} width={viewWidth} height={viewHeight} fill="#f8fafc" rx={8} />
                <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
                    {shapes.map(shape => (
                        <g
                            key={shape.geoKey}
                            onMouseEnter={() => onHover(shape.geoKey)}
                            onMouseLeave={() => onHover(null)}
                            style={{ cursor: 'pointer' }}
                        >
                            {shape.paths.map((d, i) => (
                                <path
                                    key={`${shape.geoKey}-${i}`}
                                    d={d}
                                    fill={shape.fill}
                                    stroke="#ffffff"
                                    strokeWidth={(hovered === shape.geoKey ? 2 : 1) / view.scale}
                                    vectorEffect="non-scaling-stroke"
                                    opacity={hovered && hovered !== shape.geoKey ? 0.72 : 1}
                                />
                            ))}
                            {shape.count > 0 && (
                                <g transform={`translate(${shape.cx}, ${shape.cy}) scale(${labelScale})`}>
                                    <circle
                                        r={shape.count >= 100 ? 14 : shape.count >= 10 ? 11 : 9}
                                        fill="white"
                                        fillOpacity={0.94}
                                        stroke="#6d28d9"
                                        strokeWidth={1.5}
                                    />
                                    <text
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fontSize={shape.count >= 100 ? 9 : 10}
                                        fontWeight={700}
                                        fill="#4c1d95"
                                        pointerEvents="none"
                                    >
                                        {shape.count}
                                    </text>
                                </g>
                            )}
                        </g>
                    ))}
                </g>
            </svg>
        </div>
    );
};

export const LimaDistrictMap: React.FC<LimaDistrictMapProps> = ({
    countsByLabel,
    height = 480,
    width,
    className = '',
}) => {
    const [features, setFeatures] = useState<DistrictFeature[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);
    const [view, setView] = useState<MapView>({ scale: 1, tx: 0, ty: 0 });
    const [expanded, setExpanded] = useState(false);

    const viewWidth = width && width > 0 ? Math.max(520, width) : 720;
    const viewHeight = Math.max(400, height);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(GEOJSON_URL);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = (await res.json()) as GeoJSON.FeatureCollection;
                if (!cancelled) {
                    setFeatures((data.features || []) as DistrictFeature[]);
                    setLoadError(null);
                }
            } catch {
                if (!cancelled) {
                    setFeatures([]);
                    setLoadError('No se pudo cargar el mapa de distritos.');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!expanded) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setExpanded(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [expanded]);

    const geoCounts = useMemo(() => buildGeoDistrictCounts(countsByLabel), [countsByLabel]);
    const maxCount = useMemo(() => Math.max(0, ...geoCounts.values()), [geoCounts]);
    const totalOnMap = useMemo(
        () => [...geoCounts.values()].reduce((sum, n) => sum + n, 0),
        [geoCounts]
    );

    const shapes = useMemo(
        () => buildShapes(features, geoCounts, maxCount, viewWidth, viewHeight),
        [features, geoCounts, maxCount, viewWidth, viewHeight]
    );

    const hoveredShape = hovered ? shapes.find(s => s.geoKey === hovered) : null;

    const footer = (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[11px] text-gray-500 shrink-0">
            <span>
                {totalOnMap > 0
                    ? `${totalOnMap} candidato${totalOnMap !== 1 ? 's' : ''} en Lima / Callao`
                    : 'Sin candidatos emparejados a un distrito del mapa'}
                {' · '}
                rueda del ratón o botones para zoom; arrastre para mover
            </span>
            <span className="inline-flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-[#e5e7eb]" />
                0
                <span className="inline-block w-3 h-3 rounded-sm bg-[#7c3aed] ml-2" />
                más
            </span>
        </div>
    );

    if (loadError) {
        return (
            <div
                className={`flex items-center justify-center text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg ${className}`}
                style={{ height }}
            >
                {loadError}
            </div>
        );
    }

    if (features.length === 0) {
        return (
            <div
                className={`flex items-center justify-center text-sm text-gray-500 ${className}`}
                style={{ height }}
            >
                Cargando mapa…
            </div>
        );
    }

    const mapBody = (mapHeight: number, mapWidth: number, fullscreen: boolean) => (
        <>
            {hoveredShape && (
                <div className="absolute top-2 left-2 z-10 bg-white/95 border border-gray-200 shadow-sm rounded-md px-2.5 py-1.5 text-xs pointer-events-none max-w-[220px]">
                    <span className="font-semibold text-gray-900">{hoveredShape.displayName}</span>
                    <span className="text-gray-600">
                        {' '}
                        · {hoveredShape.count} candidato{hoveredShape.count !== 1 ? 's' : ''}
                    </span>
                </div>
            )}
            <MapCanvas
                shapes={buildShapes(features, geoCounts, maxCount, mapWidth, mapHeight)}
                viewWidth={mapWidth}
                viewHeight={mapHeight}
                view={view}
                onViewChange={setView}
                hovered={hovered}
                onHover={setHovered}
                onExpand={() => setExpanded(v => !v)}
                isExpanded={fullscreen}
            />
        </>
    );

    return (
        <>
            <div className={`relative flex flex-col w-full ${className}`} style={{ height }}>
                <div className="relative flex-1 min-h-0">
                    {mapBody(viewHeight, viewWidth, false)}
                </div>
                {footer}
            </div>

            {expanded && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center p-4 md:p-8 bg-black/55"
                    onClick={() => setExpanded(false)}
                >
                    <div
                        className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[min(88vh,820px)] flex flex-col p-4 md:p-5"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Mapa de candidatos — Lima y Callao
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Use zoom y arrastre para ver el detalle de cada distrito
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setExpanded(false)}
                                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                                aria-label="Cerrar"
                            >
                                <Minimize2 className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="relative flex-1 min-h-0">
                            {mapBody(640, 960, true)}
                        </div>
                        {footer}
                    </div>
                </div>
            )}
        </>
    );
};
