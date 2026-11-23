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
  /** The globe's disc, as a path and as a circle. */
  sphere: string;
  disc: { cx: number; cy: number; r: number };
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

const mean = (points: [number, number][]): [number, number] => {
  let x = 0, y = 0, z = 0;
  for (const [lng, lat] of points) {
    const l = (lng * Math.PI) / 180, p = (lat * Math.PI) / 180;
    x += Math.cos(p) * Math.cos(l);
    y += Math.cos(p) * Math.sin(l);
    z += Math.sin(p);
  }
  return [(Math.atan2(y, x) * 180) / Math.PI, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI];
};

/** The middle of the view that shows the most of these places well (each counts more the nearer the front it is). */
export function bestView(points: [number, number][], reach: number): [number, number] {
  if (!points.length) return [15, 30];
  const avg = mean(points);
  const score = (c: [number, number]) => points.reduce((sum, p) => sum + Math.max(0, 1 - geoDistance(c, p) / reach), 0);
  let best = avg;
  let top = score(avg);
  for (const p of points) {
    // Halfway between a place and the average too: a cluster's middle, not just its edge.
    for (const c of [p, mean([p, avg])]) {
      const v = score(c);
      if (v > top + 1e-6) {
        top = v;
        best = c;
      }
    }
  }
  return best;
}

/**
 * The globe, centred over the places (or `center`), `size` across. `tilt`
 * turns it so they sit higher up (for a globe seen as a horizon).
 */
export function drawGlobe(
  features: WorldFeature[],
  opts: {
    size: number;
    countries: string[];
    home?: string | null;
    route?: string[];
    tilt?: number;
    scale?: number;
    /** How far from the middle a place still shows well (radians); smaller when only the globe's top is seen. */
    reach?: number;
    /** Step back for someone who's been all over. */
    widen?: boolean;
    /** Turn towards these places (default: the route and the countries). */
    focus?: string[];
  }
): GlobeArt {
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
  // Look down where most of their places are: their average direction is
  // right for one region, but for someone who's been all over (Americas,
  // Asia, Europe…) it can land in an empty ocean with half the places round
  // the back. So each place (and that average) is tried as the middle, and
  // the one that shows the most of their places, nearest the front, wins.
  const points = [...new Set(opts.focus ?? [...(opts.route ?? []), ...opts.countries])].map(at).filter((p): p is [number, number] => !!p);
  let reach = opts.reach ?? 1.1;
  let center = bestView(points, reach);
  // All over the world (most places out of that view): step back a little
  // and turn it less, so more of the world, and more of their places, shows.
  const baseScale = opts.scale ?? 0.96;
  let scale = baseScale;
  let tilt = opts.tilt ?? 0;
  if (opts.widen && points.length > 2 && points.filter((p) => geoDistance(center, p) < reach).length / points.length < 0.7) {
    reach = 1.4;
    center = bestView(points, reach);
    scale = baseScale * 0.78;
    tilt *= 0.6;
  }
  const r = (size / 2) * scale;
  // The globe's top stays where it would be at full size (it's a horizon on the Story picture).
  const cx = size / 2;
  const cy = size / 2 - (size / 2) * baseScale + r;
  const projection = geoOrthographic()
    .rotate([-center[0], -(center[1] - tilt)])
    .translate([cx, cy])
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
      const x = cx + (px - cx) * k;
      const y = cy + (py - cy) * k;
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
  return { size, sphere: path({ type: "Sphere" }) ?? "", disc: { cx, cy, r }, land: land.join(""), lit: litPaths, arcs, dots };
}

