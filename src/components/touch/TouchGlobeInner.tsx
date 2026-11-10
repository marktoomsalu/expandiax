"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { countryByNumeric } from "@/lib/countries";
import { splitFrenchGuianaFromFrance, type GeoFeature } from "../WorldGlobeInner";

// The globe on the World Connect screen: always night-side, turning faster
// the closer the other phone gets. On the result it can be turned, zoomed
// and tapped like the one on My World.
export function TouchGlobeInner({
  size,
  colors,
  spin = 0.6,
  glow = "#fa51a2",
  interactive = false,
  labelOf,
}: {
  size: number;
  /** Country code to colour. Countries not listed stay dark. */
  colors: Record<string, string>;
  spin?: number;
  glow?: string;
  /** Drag to turn, pinch to zoom, tap a country for its name. */
  interactive?: boolean;
  /** A second line for a country's label, e.g. "You both". */
  labelOf?: (code: string) => string;
}) {
  const ref = useRef<GlobeMethods | undefined>(undefined);
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const touched = useRef(false);

  useEffect(() => {
    let alive = true;
    fetch("/data/world-110m.json")
      .then((r) => r.json())
      .then((topology: Topology) => {
        const c = feature(topology, topology.objects.countries as GeometryCollection) as unknown as { features: GeoFeature[] };
        if (alive) setFeatures(splitFrenchGuianaFromFrance(c.features.filter((f) => f.id !== "010")));
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    const controls = g.controls();
    controls.enableZoom = interactive;
    controls.enableRotate = interactive;
    controls.enablePan = false;
    // Once you take hold of it, it stays where you put it.
    const stop = () => {
      touched.current = true;
      controls.autoRotate = false;
    };
    if (interactive) controls.addEventListener("start", stop);
    const camera = g.camera() as unknown as { near: number; updateProjectionMatrix: () => void };
    camera.near = 10;
    camera.updateProjectionMatrix();
    controls.minDistance = 100 + camera.near * 1.1;
    controls.maxDistance = 450;
    g.pointOfView({ lat: 25, lng: 15, altitude: 2.1 });
    return () => controls.removeEventListener("start", stop);
  }, [interactive]);

  useEffect(() => {
    const controls = ref.current?.controls();
    if (!controls) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotate = !reduceMotion && !touched.current;
    controls.autoRotateSpeed = spin;
  }, [spin]);

  const byFeature = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of features) {
      const c = countryByNumeric(String(f.id));
      if (c && colors[c.code]) m.set(String(f.id), colors[c.code]);
    }
    return m;
  }, [features, colors]);

  return (
    <Globe
      ref={ref}
      width={size}
      height={size}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
      showAtmosphere
      atmosphereColor={glow}
      atmosphereAltitude={0.2}
      polygonsData={features}
      polygonCapColor={(f) => {
        const id = String((f as GeoFeature).id);
        const c = byFeature.get(id);
        if (id === hoverId) return c ?? "rgba(255,255,255,0.22)";
        return c ?? "rgba(255,255,255,0.05)";
      }}
      polygonSideColor={() => "rgba(0,0,0,0.2)"}
      polygonStrokeColor={() => "rgba(255,255,255,0.12)"}
      polygonAltitude={(f) => {
        const id = String((f as GeoFeature).id);
        return id === hoverId ? 0.03 : byFeature.has(id) ? 0.012 : 0.004;
      }}
      polygonsTransitionDuration={300}
      enablePointerInteraction={interactive}
      polygonLabel={(f) => {
        const c = countryByNumeric(String((f as GeoFeature).id));
        if (!c) return "";
        // The label is HTML, and this part carries a person's name.
        const more = escapeHtml(labelOf?.(c.code) ?? "");
        return `<div style="padding:6px 10px;border-radius:12px;background:rgba(20,6,26,.88);color:#fff;font:500 13px system-ui;text-align:center">${c.flag} ${c.name}${more ? `<div style="opacity:.7;font-size:11px;margin-top:2px">${more}</div>` : ""}</div>`;
      }}
      onPolygonHover={(f) => interactive && setHoverId(f ? String((f as GeoFeature).id) : null)}
      onPolygonClick={(f) => interactive && setHoverId(String((f as GeoFeature).id))}
    />
  );
}

const escapeHtml = (t: string) => t.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
