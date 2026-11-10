"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { countryByNumeric } from "@/lib/countries";
import { splitFrenchGuianaFromFrance, type GeoFeature } from "../WorldGlobeInner";

// The globe on the Touch globes screen: always night-side, no controls,
// turning faster the closer the other phone gets.
export function TouchGlobeInner({
  size,
  colors,
  spin = 0.6,
  glow = "#fa51a2",
}: {
  size: number;
  /** Country code to colour. Countries not listed stay dark. */
  colors: Record<string, string>;
  spin?: number;
  glow?: string;
}) {
  const ref = useRef<GlobeMethods | undefined>(undefined);
  const [features, setFeatures] = useState<GeoFeature[]>([]);

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
    controls.enableZoom = false;
    controls.enableRotate = false;
    g.pointOfView({ lat: 25, lng: 15, altitude: 2.1 });
  }, []);

  useEffect(() => {
    const controls = ref.current?.controls();
    if (!controls) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotate = !reduceMotion;
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
      polygonCapColor={(f) => byFeature.get(String((f as GeoFeature).id)) ?? "rgba(255,255,255,0.05)"}
      polygonSideColor={() => "rgba(0,0,0,0.2)"}
      polygonStrokeColor={() => "rgba(255,255,255,0.12)"}
      polygonAltitude={(f) => (byFeature.has(String((f as GeoFeature).id)) ? 0.012 : 0.004)}
      polygonsTransitionDuration={600}
      enablePointerInteraction={false}
    />
  );
}
