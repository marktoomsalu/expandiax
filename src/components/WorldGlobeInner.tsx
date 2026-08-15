"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Minus, Plus } from "lucide-react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { countryByNumeric } from "@/lib/countries";
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
};

export function WorldGlobeInner({
  visitedCodes,
  visitCounts,
  homeCode,
  onSelect,
  interactive = true,
  className,
}: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 320, height: 320 });

  const visited = useMemo(() => new Set(visitedCodes), [visitedCodes]);

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
    controls.autoRotate = false;
    controls.enableZoom = interactive;
    controls.enableRotate = true;
    g.pointOfView({ lat: 18, lng: 14, altitude: 1.8 });
  }, [interactive]);

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
            if (isHome) return isHover ? "rgba(250,176,63,1)" : "rgba(245,158,11,0.95)";
            if (isVisited) {
              // Countries visited more than once glow a shade brighter.
              if (count >= 2) return isHover ? "rgba(255,166,133,1)" : "rgba(255,125,96,0.95)";
              return isHover ? "rgba(255,125,96,0.95)" : "rgba(255,99,71,0.85)";
            }
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
          pointColor={() => (visited.has("AQ") ? "rgba(255,125,96,0.95)" : isDark ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.45)")}
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
}
