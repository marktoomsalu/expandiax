// A globe as a picture (no 3D, nothing to load but the map): the Earth seen
// from above the places someone went, their countries lit and curved lines
// from each place to the next, lifted off the surface like flight paths.
// Pure geometry, the same on the phone (Year Wrapped) and on the server
// (the Story picture): it returns SVG path data to draw however you like.

import { geoArea, geoCentroid, geoDistance, geoInterpolate, geoOrthographic, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { countryByNumeric } from "@/lib/countries";

export type WorldFeature = { id: string; geometry: { type: string; coordinates: unknown } };

export function worldFeatures(topology: Topology): WorldFeature[] {
  const fc = feature(topology, topology.objects.countries as GeometryCollection) as unknown as { features: WorldFeature[] };
  return fc.features.filter((f) => f.geometry && f.id !== "010");
}

export type GlobeArt = {
  size: number;
  /** The globe's disc. */
  sphere: string;
  land: string;
  lit: { code: string; d: string; home: boolean }[];
  /** Each leg of the route, as a path (the parts in view). */
  arcs: string[];
  /** Where each stop is, when it's in view. */
  dots: { x: number; y: number }[];
};

/** A country's main land: its biggest piece (France without its overseas parts). */
function mainLand(f: WorldFeature): [number, number] {
  const g = f.geometry;
  if (g.type !== "MultiPolygon") return geoCentroid(f as never);
  let best: [number, number] = [0, 0];
  let area = -1;
  for (const poly of g.coordinates as number[][][][]) {
    const piece = { type: "Polygon", coordinates: poly } as never;
    const a = geoArea(piece);
    if (a > area) {
      area = a;
      best = geoCentroid(piece);
    }
  }
  return best;
}

/**
 * The globe, centred over the places (or `center`), `size` across. `tilt`
 * turns it so they sit higher up (for a globe seen as a horizon).
 */
export function drawGlobe(features: WorldFeature[], opts: { size: number; countries: string[]; home?: string | null; route?: string[]; tilt?: number; scale?: number }): GlobeArt {
  const { size } = opts;
  const byCode = new Map<string, WorldFeature>();
  for (const f of features) {
    const c = countryByNumeric(String(f.id));
    if (c) byCode.set(c.code, f);
  }
  const at = (code: string) => {
    const f = byCode.get(code);
    return f ? mainLand(f) : null;
  };
  // Look down on the middle of their places (the average direction).
  const points = [...new Set([...(opts.route ?? []), ...opts.countries])].map(at).filter((p): p is [number, number] => !!p);
  let center: [number, number] = [15, 30];
  if (points.length) {
    let x = 0, y = 0, z = 0;
    for (const [lng, lat] of points) {
      const l = (lng * Math.PI) / 180, p = (lat * Math.PI) / 180;
      x += Math.cos(p) * Math.cos(l);
      y += Math.cos(p) * Math.sin(l);
      z += Math.sin(p);
    }
    center = [(Math.atan2(y, x) * 180) / Math.PI, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI];
  }
  const r = (size / 2) * (opts.scale ?? 0.96);
  const projection = geoOrthographic()
    .rotate([-center[0], -(center[1] - (opts.tilt ?? 0))])
    .translate([size / 2, size / 2])
    .scale(r)
    .clipAngle(90);
  const path = geoPath(projection);
  const lit = new Set(opts.countries);
  const land: string[] = [];
  const litPaths: GlobeArt["lit"] = [];
  for (const f of features) {
    const d = path(f as unknown as GeoPermissibleObjects);
    if (!d) continue;
    const code = countryByNumeric(String(f.id))?.code;
    if (code && lit.has(code)) litPaths.push({ code, d, home: code === opts.home });
    else land.push(d);
  }

  // The route: great circles, lifted off the ground in the middle (higher for a longer leg).
  const view = projection.rotate();
  const lookingAt: [number, number] = [-view[0], -view[1]];
  const arcs: string[] = [];
  const route = (opts.route ?? []).map(at).filter((p): p is [number, number] => !!p);
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    const dist = geoDistance(a, b);
    if (dist < 0.002) continue;
    const between = geoInterpolate(a, b);
    const lift = 0.08 + Math.min(0.34, dist * 0.26);
    let d = "";
    let pen = false;
    for (let s = 0; s <= 40; s++) {
      const t = s / 40;
      const p = between(t);
      if (geoDistance(p, lookingAt) > Math.PI / 2 - 0.02) {
        pen = false;
        continue;
      }
      const [px, py] = projection(p) ?? [0, 0];
      const k = 1 + lift * Math.sin(Math.PI * t);
      const x = size / 2 + (px - size / 2) * k;
      const y = size / 2 + (py - size / 2) * k;
      d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      pen = true;
    }
    if (d) arcs.push(d);
  }
  const dots = route
    .filter((p) => geoDistance(p, lookingAt) < Math.PI / 2 - 0.02)
    .map((p) => {
      const [x, y] = projection(p) ?? [0, 0];
      return { x, y };
    });
  return { size, sphere: path({ type: "Sphere" }) ?? "", land: land.join(""), lit: litPaths, arcs, dots };
}

