import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { COUNTRIES } from "./countries";

type Position = [number, number];
type Feature = { id: string; geometry: { type: "Polygon"; coordinates: Position[][] } | { type: "MultiPolygon"; coordinates: Position[][][] } | null };

let cache: Feature[] | null = null;
function features(): Feature[] {
  if (cache) return cache;
  const topology = JSON.parse(readFileSync(path.join(process.cwd(), "public", "data", "world-110m.json"), "utf-8")) as Topology;
  cache = (feature(topology, topology.objects.countries as GeometryCollection) as unknown as { features: Feature[] }).features;
  return cache;
}

const numericOf = new Map(COUNTRIES.map((c) => [c.code, c.numeric]));

// The inhabited world, Antarctica left off: 168°W to 190°E, 83°N to 56°S.
const WEST = -168;
const EAST = 192;
const NORTH = 83;
const SOUTH = -56;

/**
 * The world as one SVG, every country drawn, the visited ones in the brand
 * gradient: for Story posters and stickers (next/og draws it as an image).
 * Equirectangular, which reads as "a map of the world" at a glance.
 */
export function worldMapSvg(visitedCodes: string[], opts: { width: number; land?: string; stroke?: string; glow?: boolean }): { svg: string; height: number } {
  const W = opts.width;
  const H = Math.round((W * (NORTH - SOUTH)) / (EAST - WEST) * 1.12);
  const visited = new Set(visitedCodes.map((c) => numericOf.get(c)).filter(Boolean) as string[]);
  const x = (lon: number) => (((lon < WEST ? lon + 360 : lon) - WEST) / (EAST - WEST)) * W;
  const y = (lat: number) => ((NORTH - lat) / (NORTH - SOUTH)) * H;

  const paths: { d: string; on: boolean }[] = [];
  for (const f of features()) {
    if (!f.geometry) continue;
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    let d = "";
    for (const poly of polys) {
      for (const ring of poly) {
        if (ring.length < 3 || ring.every(([, lat]) => lat < SOUTH)) continue;
        // A ring that jumps across the map's edge would draw a line across the world: skip the jump.
        let started = false;
        let prevX = 0;
        for (const [lon, lat] of ring) {
          const px = x(lon);
          const py = y(Math.max(lat, SOUTH - 2));
          if (!started || Math.abs(px - prevX) > W / 2) {
            d += `M${px.toFixed(1)} ${py.toFixed(1)}`;
            started = true;
          } else d += `L${px.toFixed(1)} ${py.toFixed(1)}`;
          prevX = px;
        }
        d += "Z";
      }
    }
    if (d) paths.push({ d, on: visited.has(f.id) });
  }

  const land = opts.land ?? "rgba(255,255,255,0.16)";
  const stroke = opts.stroke ?? "rgba(255,255,255,0.10)";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fa51a2"/><stop offset="0.55" stop-color="#f43f5e"/><stop offset="1" stop-color="#fb7822"/></linearGradient></defs>
<g stroke="${stroke}" stroke-width="0.6" stroke-linejoin="round">${paths
    .filter((p) => !p.on)
    .map((p) => `<path d="${p.d}" fill="${land}"/>`)
    .join("")}</g>
<g stroke="rgba(255,255,255,0.55)" stroke-width="0.7" stroke-linejoin="round">${paths
    .filter((p) => p.on)
    .map((p) => `<path d="${p.d}" fill="url(#g)"/>`)
    .join("")}</g>
</svg>`;
  return { svg, height: H };
}

export const svgDataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
