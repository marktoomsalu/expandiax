import { readFileSync } from "node:fs";
import path from "node:path";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

type Position = [number, number];
type PolygonCoords = Position[][];
type MultiPolygonCoords = PolygonCoords[];

type CountryFeature = {
  id: string;
  geometry: { type: "Polygon"; coordinates: PolygonCoords } | { type: "MultiPolygon"; coordinates: MultiPolygonCoords };
};

let featuresByNumeric: Map<string, CountryFeature> | null = null;

function loadFeatures(): Map<string, CountryFeature> {
  if (featuresByNumeric) return featuresByNumeric;
  const filePath = path.join(process.cwd(), "public", "data", "world-110m.json");
  const topology = JSON.parse(readFileSync(filePath, "utf-8")) as Topology;
  const collection = feature(topology, topology.objects.countries as GeometryCollection) as unknown as {
    features: CountryFeature[];
  };
  featuresByNumeric = new Map(collection.features.map((f) => [f.id, f]));
  return featuresByNumeric;
}

function polygonsOf(f: CountryFeature): PolygonCoords[] {
  return f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
}

/**
 * Renders a country's real geographic outline as an SVG path `d`, fit inside
 * a `size x size` box (equirectangular, cos(lat)-corrected — plenty accurate
 * at icon scale, not meant for navigation). Returns null for tiny countries
 * absent from the 110m-resolution dataset (fine — callers fall back gracefully).
 */
export function countryPathD(numericId: string | undefined, size: number): string | null {
  if (!numericId) return null;
  const f = loadFeatures().get(numericId);
  if (!f) return null;

  const polygons = polygonsOf(f);
  const allPoints = polygons.flatMap((poly) => poly.flatMap((ring) => ring));
  if (allPoints.length === 0) return null;

  // Antimeridian fix (Fiji, far-east Russia, Aleutians): shift negative
  // longitudes up by 360 when a feature's raw span implausibly exceeds 180°.
  const rawLons = allPoints.map((p) => p[0]);
  const spansAntimeridian = Math.max(...rawLons) - Math.min(...rawLons) > 180;
  const fixLon = (lon: number) => (spansAntimeridian && lon < 0 ? lon + 360 : lon);

  const lats = allPoints.map((p) => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const cosMid = Math.max(0.15, Math.cos((midLat * Math.PI) / 180));

  const project = (pos: Position) => ({ x: fixLon(pos[0]) * cosMid, y: -pos[1] });

  const projected = polygons.map((poly) => poly.map((ring) => ring.map(project)));
  const flat = projected.flatMap((poly) => poly.flatMap((ring) => ring));
  const minX = Math.min(...flat.map((p) => p.x));
  const maxX = Math.max(...flat.map((p) => p.x));
  const minY = Math.min(...flat.map((p) => p.y));
  const maxY = Math.max(...flat.map((p) => p.y));
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;

  const pad = size * 0.05;
  const inner = size - pad * 2;
  const scale = Math.min(inner / w, inner / h);
  const offsetX = (size - w * scale) / 2 - minX * scale;
  const offsetY = (size - h * scale) / 2 - minY * scale;
  const px = (x: number) => (x * scale + offsetX).toFixed(1);
  const py = (y: number) => (y * scale + offsetY).toFixed(1);

  let d = "";
  for (const poly of projected) {
    for (const ring of poly) {
      if (ring.length < 3) continue;
      d += `M${px(ring[0].x)},${py(ring[0].y)} `;
      for (const pt of ring.slice(1)) d += `L${px(pt.x)},${py(pt.y)} `;
      d += "Z ";
    }
  }
  return d.trim() || null;
}
