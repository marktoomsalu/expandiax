"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { countryByNumeric } from "@/lib/countries";

const GEO_URL = "/data/world-110m.json";

type GeoFeature = {
  id: string;
  properties: { name: string };
  geometry: unknown;
};

type Props = {
  visitedCodes: string[];
  visitCounts?: Record<string, number>;
  onSelect?: (code: string) => void;
  interactive?: boolean;
  className?: string;
};

export function WorldGlobeInner({ visitedCodes, visitCounts, onSelect, interactive = true, className }: Props) {
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
        if (alive) setFeatures(collection.features.filter((f) => f.id !== "010"));
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

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = false;
    controls.enableZoom = interactive;
    controls.enableRotate = true;
    g.pointOfView({ lat: 18, lng: 14, altitude: 1.8 });
  }, [interactive]);

  function countryOf(f: GeoFeature) {
    return countryByNumeric(String(f.id));
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
            const c = countryOf(f as GeoFeature);
            const isVisited = c ? visited.has(c.code) : false;
            const isHover = (f as GeoFeature).id === hoverId;
            const count = c ? visitCounts?.[c.code] ?? 0 : 0;
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
            const c = countryOf(f as GeoFeature);
            if (!c) return "";
            const count = visitCounts?.[c.code] ?? 0;
            return count >= 2 ? `${c.flag} ${c.name} · visited ${count}×` : `${c.flag} ${c.name}`;
          }}
          onPolygonHover={(f) => setHoverId(f ? (f as GeoFeature).id : null)}
          onPolygonClick={(f) => {
            if (!interactive || !onSelect) return;
            const c = countryOf(f as GeoFeature);
            if (c) onSelect(c.code);
          }}
          showPointerCursor={interactive}
        />
      </div>
    </div>
  );
}
