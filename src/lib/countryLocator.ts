// Which country a point is in, on the device, from the world's outlines
// (Natural Earth 1:50m via world-atlas, public/data/world-50m.json). Used to
// turn photo places into countries without sending them anywhere.

import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { countryByName, countryByNumeric } from "./countries";

type Ring = [number, number][];
type Shape = { code: string; rings: Ring[]; box: [number, number, number, number] };

let shapes: Promise<Shape[]> | null = null;

function boxOf(rings: Ring[]): [number, number, number, number] {
  let minX = 180;
  let minY = 90;
  let maxX = -180;
  let maxY = -90;
  for (const r of rings)
    for (const [x, y] of r) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  return [minX, minY, maxX, maxY];
}

export function loadShapes(url = "/data/world-50m.json"): Promise<Shape[]> {
  shapes ??= fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error("Could not load the world map.");
      return r.json() as Promise<Topology>;
    })
    .then(shapesFromTopology)
    .catch((e) => {
      shapes = null;
      throw e;
    });
  return shapes;
}

export function shapesFromTopology(topology: Topology): Shape[] {
  const collection = feature(topology, topology.objects.countries as GeometryCollection) as unknown as {
    features: { id?: string; properties?: { name?: string }; geometry: { type: string; coordinates: unknown } | null }[];
  };
  const out: Shape[] = [];
  for (const f of collection.features) {
    if (!f.geometry) continue;
    const code = (f.id && countryByNumeric(f.id)?.code) || countryByName(f.properties?.name)?.code;
    if (!code) continue;
    const polygons = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][];
    // Each polygon on its own, so the box test rules most out cheaply.
    for (const rings of polygons) out.push({ code, rings, box: boxOf(rings) });
  }
  return out;
}

function inside(x: number, y: number, rings: Ring[]): boolean {
  // Even-odd over all rings: holes (lakes, enclaves) count as outside.
  let hit = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  return hit;
}

/** Squared distance (in degrees, longitude scaled for latitude) from a point to a ring's edges. */
function edgeDistance(x: number, y: number, rings: Ring[], k: number): number {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = ring[j][0] * k;
      const ay = ring[j][1];
      const bx = ring[i][0] * k;
      const by = ring[i][1];
      const px = x * k;
      const dx = bx - ax;
      const dy = by - ay;
      const len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (y - ay) * dy) / len)) : 0;
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - y;
      const d = ex * ex + ey * ey;
      if (d < best) best = d;
    }
  }
  return best;
}

/** How far off the coast a photo can be and still count (beaches, harbours, small islands): about 25 km. */
const NEAR = 0.25;

const VATICAN = [41.9035, 12.4525];

/** A function telling the country (ISO alpha-2) at a point, or null at sea. */
export function makeLocator(all: Shape[]): (lat: number, lng: number) => string | null {
  const cache = new Map<string, string | null>();
  return (lat, lng) => {
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    // Vatican City is too small for the 1:50m outlines to place right.
    if (Math.abs(lat - VATICAN[0]) < 0.006 && Math.abs(lng - VATICAN[1]) < 0.008) {
      cache.set(key, "VA");
      return "VA";
    }

    // The smallest outline containing it wins: Vatican City and San Marino
    // sit inside Italy's outline, which has no holes for them.
    let found: string | null = null;
    let area = Infinity;
    for (const s of all) {
      const [minX, minY, maxX, maxY] = s.box;
      if (lng < minX || lng > maxX || lat < minY || lat > maxY) continue;
      const a = (maxX - minX) * (maxY - minY);
      if (a < area && inside(lng, lat, s.rings)) {
        found = s.code;
        area = a;
      }
    }
    if (!found) {
      const k = Math.cos((lat * Math.PI) / 180);
      let best = NEAR * NEAR;
      for (const s of all) {
        const [minX, minY, maxX, maxY] = s.box;
        if (lng < minX - NEAR / Math.max(k, 0.2) || lng > maxX + NEAR / Math.max(k, 0.2) || lat < minY - NEAR || lat > maxY + NEAR) continue;
        const d = edgeDistance(lng, lat, s.rings, k);
        if (d < best) {
          best = d;
          found = s.code;
        }
      }
    }
    cache.set(key, found);
    return found;
  };
}
