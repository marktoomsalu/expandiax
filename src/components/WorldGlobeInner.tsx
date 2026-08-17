"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Minus, Plus } from "lucide-react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { countryByCode, countryByNumeric } from "@/lib/countries";
import { territoryByNumeric, territoryFlagFor } from "@/lib/territories";

const GEO_URL = "/data/world-110m.json";
const MIN_ALTITUDE = 0.5;
const MAX_ALTITUDE = 3.5;

// Antarctica has no shape at this map's resolution (and would look odd as
// a giant polygon wrapped around the globe's underside anyway), so instead
// of a polygon it gets one clickable point, placed on the continent itself.
const ANTARCTICA_POINTS = [{ lat: -82, lng: 20 }];

type GeoFeature = {
  id: string;
  properties: { name: string };
  geometry: unknown;
};

type Ring = number[][];
type PolygonCoords = Ring[];
type MultiPolygonGeometry = { type: "MultiPolygon"; coordinates: PolygonCoords[] };

// At this map's resolution, France's feature (id 250) is a MultiPolygon
// whose parts are mainland France, Corsica, and — unlike every other
// French/UK/Dutch overseas territory in our list, which simply has no
// shape at all here — French Guiana, bundled in as if it were part of the
// same landmass. Left alone, visiting France would paint French Guiana
// too, with no way to select it on its own. So it gets carved out into
// its own feature (id 254, French Guiana's ISO numeric) before render.
function splitFrenchGuianaFromFrance(features: GeoFeature[]): GeoFeature[] {
  const franceIdx = features.findIndex((f) => f.id === "250");
  if (franceIdx === -1) return features;
  const france = features[franceIdx];
  const geometry = france.geometry as { type: string; coordinates: PolygonCoords[] };
  if (geometry.type !== "MultiPolygon") return features;

  const guiana: PolygonCoords[] = [];
  const mainland: PolygonCoords[] = [];
  for (const poly of geometry.coordinates) {
    const [lon] = poly[0][0];
    (lon < -40 ? guiana : mainland).push(poly);
  }
  if (guiana.length === 0) return features;

  const next = [...features];
  next[franceIdx] = { ...france, geometry: { type: "MultiPolygon", coordinates: mainland } as MultiPolygonGeometry };
  next.push({
    id: "254",
    properties: { name: "French Guiana" },
    geometry:
      guiana.length > 1
        ? ({ type: "MultiPolygon", coordinates: guiana } as MultiPolygonGeometry)
        : { type: "Polygon", coordinates: guiana[0] },
  });
  return next;
}

// Rough (non-area-weighted) centroid from a feature's outer ring(s) — good
// enough to fly the camera roughly to the right place, not for anything
// that needs precision.
function centroidOf(geometry: unknown): { lat: number; lng: number } | null {
  const g = geometry as { type: string; coordinates: unknown };
  const rings: number[][][] =
    g.type === "Polygon"
      ? (g.coordinates as number[][][])
      : g.type === "MultiPolygon"
        ? (g.coordinates as number[][][][]).flat()
        : [];
  const points = rings.flat();
  if (points.length === 0) return null;
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of points) {
    sumLng += lng;
    sumLat += lat;
  }
  return { lat: sumLat / points.length, lng: sumLng / points.length };
}

// Logo-matched palette: home is the logo's pink (#FA51A2), a first-time
// visit is the logo's orange (#FB7822) — together they read as the same
// brand gradient rather than two arbitrary map colors. The more times a
// country's been visited, the further its orange drifts toward home's
// pink (almost a second home) — but capped well short of actually
// reaching it, so home always reads as uniquely "home."
const HOME_RGB = { r: 250, g: 81, b: 162 }; // #FA51A2
const VISITED_RGB = { r: 251, g: 120, b: 34 }; // #FB7822
const VISITED_MAX_BLEND = 0.7;
const VISITED_BLEND_VISITS = 5;

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function visitedColor(count: number, alpha: number): string {
  const progress = Math.min(1, Math.max(0, (count - 1) / VISITED_BLEND_VISITS));
  const t = progress * VISITED_MAX_BLEND;
  const r = lerp(VISITED_RGB.r, HOME_RGB.r, t);
  const g = lerp(VISITED_RGB.g, HOME_RGB.g, t);
  const b = lerp(VISITED_RGB.b, HOME_RGB.b, t);
  return `rgba(${r},${g},${b},${alpha})`;
}

export type WorldGlobeHandle = {
  /** Animates the camera to roughly the given country's location. No-op if the country's shape hasn't loaded (or doesn't exist) at this map's resolution. */
  flyTo: (code: string) => void;
};

type Props = {
  // Territories (Greenland, New Caledonia, Puerto Rico — whichever ones
  // happen to have their own shape at this map's resolution) share the
  // same visited_countries table as countries now, so they arrive here
  // mixed into visitedCodes and light up/click through identically.
  visitedCodes: string[];
  visitCounts?: Record<string, number>;
  homeCode?: string | null;
  onSelect?: (code: string) => void;
  interactive?: boolean;
  className?: string;
  // Slow ambient rotation for a marketing/cold-open moment — not used
  // anywhere else in the app today. Off (and unforced) by default;
  // honours prefers-reduced-motion regardless of this prop.
  autoRotate?: boolean;
};

export const WorldGlobeInner = forwardRef<WorldGlobeHandle, Props>(function WorldGlobeInner(
  { visitedCodes, visitCounts, homeCode, onSelect, interactive = true, className, autoRotate = false },
  ref
) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 320, height: 320 });

  const visited = useMemo(() => new Set(visitedCodes), [visitedCodes]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo(code: string) {
        const g = globeRef.current;
        const country = countryByCode(code);
        if (!g || !country) return;
        const target = features.find((f) => f.id === country.numeric);
        const center = target && centroidOf(target.geometry);
        if (!center) return;
        g.pointOfView({ lat: center.lat, lng: center.lng, altitude: 1.5 }, 1200);
      },
    }),
    [features]
  );

  useEffect(() => {
    let alive = true;
    fetch(GEO_URL)
      .then((r) => r.json())
      .then((topology: Topology) => {
        const collection = feature(
          topology,
          topology.objects.countries as GeometryCollection
        ) as unknown as { features: GeoFeature[] };
        if (alive) setFeatures(splitFrenchGuianaFromFrance(collection.features.filter((f) => f.id !== "010")));
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setSize({ width: w, height: Math.round(Math.min(w * 0.8, 680)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Stop mouse-wheel scrolling from being hijacked as globe zoom — the page
  // should scroll normally when the cursor happens to be over the globe.
  // Pinch-to-zoom (touch) and the explicit +/- buttons below still work,
  // since they don't go through the wheel event at all.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const blockWheelZoom = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", blockWheelZoom, { capture: true });
    return () => el.removeEventListener("wheel", blockWheelZoom, { capture: true });
  }, []);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotate = autoRotate && !reduceMotion;
    controls.autoRotateSpeed = 0.6;
    controls.enableZoom = interactive;
    controls.enableRotate = true;
    g.pointOfView({ lat: 18, lng: 14, altitude: 1.8 });
  }, [interactive, autoRotate]);

  function placeOf(f: GeoFeature): { code: string; name: string; flag: string; isTerritory: boolean } | undefined {
    const c = countryByNumeric(String(f.id));
    if (c) return { code: c.code, name: c.name, flag: c.flag, isTerritory: false };
    const t = territoryByNumeric(String(f.id));
    if (t) return { code: t.code, name: t.name, flag: territoryFlagFor(t), isTerritory: true };
    return undefined;
  }

  function zoomBy(factor: number) {
    const g = globeRef.current;
    if (!g) return;
    const pov = g.pointOfView();
    const altitude = Math.max(MIN_ALTITUDE, Math.min(MAX_ALTITUDE, pov.altitude * factor));
    g.pointOfView({ altitude }, 300);
  }

  return (
    <div ref={containerRef} className={className}>
      <div className="relative overflow-hidden rounded-card" style={{ height: size.height }}>
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={
            isDark
              ? "//unpkg.com/three-globe/example/img/earth-night.jpg"
              : "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          }
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          showAtmosphere
          atmosphereColor={isDark ? "#2dd4c5" : "#7dd3fc"}
          atmosphereAltitude={0.22}
          polygonsData={features}
          polygonCapColor={(f) => {
            const p = placeOf(f as GeoFeature);
            const isHome = p && !p.isTerritory && homeCode ? p.code === homeCode : false;
            const isVisited = p ? visited.has(p.code) : false;
            const isHover = (f as GeoFeature).id === hoverId;
            const count = p ? visitCounts?.[p.code] ?? 0 : 0;
            if (isHome) return isHover ? `rgba(${HOME_RGB.r},${HOME_RGB.g},${HOME_RGB.b},1)` : `rgba(${HOME_RGB.r},${HOME_RGB.g},${HOME_RGB.b},0.95)`;
            if (isVisited) return visitedColor(count, isHover ? 1 : 0.9);
            if (isDark) return isHover ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)";
            return isHover ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.02)";
          }}
          polygonSideColor={() => "rgba(20,16,10,0.25)"}
          polygonStrokeColor={() => "rgba(10,8,6,0.55)"}
          polygonAltitude={(f) => ((f as GeoFeature).id === hoverId ? 0.02 : 0.006)}
          polygonsTransitionDuration={200}
          polygonLabel={(f) => {
            const p = placeOf(f as GeoFeature);
            if (!p) return "";
            const isHome = !p.isTerritory && homeCode && p.code === homeCode;
            const count = visitCounts?.[p.code] ?? 0;
            const suffix = count >= 2 ? ` · visited ${count}×` : "";
            return `${p.flag} ${p.name}${isHome ? " · Home" : p.isTerritory ? " · Territory" : ""}${suffix}`;
          }}
          onPolygonHover={(f) => setHoverId(f ? (f as GeoFeature).id : null)}
          onPolygonClick={(f) => {
            if (!interactive || !onSelect) return;
            const p = placeOf(f as GeoFeature);
            if (p) onSelect(p.code);
          }}
          pointsData={ANTARCTICA_POINTS}
          pointLat="lat"
          pointLng="lng"
          pointRadius={0.45}
          pointAltitude={0.012}
          pointColor={() => (visited.has("AQ") ? visitedColor(visitCounts?.["AQ"] ?? 1, 0.95) : isDark ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.45)")}
          pointLabel={() => `🇦🇶 Antarctica${visited.has("AQ") ? " · visited" : ""}`}
          onPointClick={() => {
            if (interactive && onSelect) onSelect("AQ");
          }}
          showPointerCursor={interactive}
        />
        {interactive && (
          <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-full border border-line bg-surface/90 shadow-sm backdrop-blur">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => zoomBy(0.8)}
              className="flex h-8 w-8 items-center justify-center text-muted hover:text-accent"
            >
              <Plus size={15} />
            </button>
            <div className="h-px bg-line" aria-hidden />
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => zoomBy(1.25)}
              className="flex h-8 w-8 items-center justify-center text-muted hover:text-accent"
            >
              <Minus size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
