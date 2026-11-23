/* eslint-disable @next/next/no-img-element -- drawn into a picture (next/og), not a page */
// The Year Wrapped finale, as a picture: a travel poster of someone's year.
// Wide (16:9, 1920×1080) to share anywhere, tall (9:16, 1080×1920) for
// Stories: their chosen photo, the year big, a few numbers that are really
// theirs, and a small world map with their year's countries lit.

import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { ImageResponse } from "next/og";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { countryByCode } from "@/lib/countries";
import type { WrappedYear } from "@/lib/wrapped";

const fontCache = new Map<string, Promise<ArrayBuffer | null>>();
function loadFont(query: string): Promise<ArrayBuffer | null> {
  let p = fontCache.get(query);
  if (!p) {
    p = (async () => {
      try {
        const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${query}`)).text();
        const url = /src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
        return url ? await (await fetch(url)).arrayBuffer() : null;
      } catch {
        return null;
      }
    })();
    fontCache.set(query, p);
  }
  return p;
}

let logo: Promise<string> | null = null;
const loadLogo = () => (logo ??= readFile(path.join(process.cwd(), "public", "wordmark.svg")).then((b) => `data:image/svg+xml;base64,${b.toString("base64")}`));

// The world, flat (equirectangular, without Antarctica): one path per country, made once.
type Shape = { numeric: string; d: string };
let world: Promise<Shape[]> | null = null;
function loadWorld(): Promise<Shape[]> {
  world ??= readFile(path.join(process.cwd(), "public", "data", "world-110m.json"), "utf8").then((raw) => {
    const topo = JSON.parse(raw) as Topology;
    const fc = feature(topo, topo.objects.countries as GeometryCollection) as unknown as { features: { id: string; geometry: { type: string; coordinates: unknown } | null }[] };
    const W = 360;
    const top = 84;
    const bottom = -58;
    const H = ((top - bottom) / 360) * W;
    const pt = ([lng, lat]: number[]) => `${(((lng + 180) / 360) * W).toFixed(1)},${(((top - lat) / (top - bottom)) * H).toFixed(1)}`;
    return fc.features
      .filter((f) => f.geometry && f.id !== "010")
      .map((f) => {
        const g = f.geometry!;
        const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as number[][][][];
        // Outlines that wrap round the map's edge (Russia, Fiji) break there instead of crossing the whole map.
        const ringPath = (ring: number[][]) =>
          ring.map((p, i) => (i === 0 || Math.abs(p[0] - ring[i - 1][0]) > 180 ? "M" : "L") + pt(p)).join("") + "Z";
        const d = polys.map((poly) => poly.map(ringPath).join("")).join("");
        return { numeric: String(f.id), d };
      });
  });
  return world;
}
const MAP_W = 360;
const MAP_H = ((84 + 58) / 360) * MAP_W;

async function photoData(url: string | null, w: number, h: number): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const out = await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize(w, h, { fit: "cover" }).jpeg({ quality: 84 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

/** A few numbers that are really theirs (never zeros, never guesses). */
export function posterFacts(w: WrappedYear): { value: string; label: string }[] {
  const facts: { value: string; label: string }[] = [];
  const n = w.countries.length;
  if (n) facts.push({ value: String(n), label: n === 1 ? "country" : "countries" });
  if (w.newCountries.length) facts.push({ value: String(w.newCountries.length), label: w.newCountries.length === 1 ? "new country" : "new countries" });
  if (w.trips) facts.push({ value: String(w.trips), label: w.trips === 1 ? "trip" : "trips" });
  if (w.events.length) facts.push({ value: String(w.events.length), label: w.events.length === 1 ? "moment" : "moments" });
  if (w.places.length >= 2) facts.push({ value: String(w.places.length), label: "places" });
  return facts.slice(0, 4);
}

function WorldMap({ shapes, lit, home, width }: { shapes: Shape[]; lit: Set<string>; home: string | null; width: number }) {
  return (
    <svg width={width} height={(width / MAP_W) * MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`}>
      {shapes.map((s) => (
        <path key={s.numeric} d={s.d} fill={s.numeric === home ? "#fb7822" : lit.has(s.numeric) ? "#fa51a2" : "rgba(255,255,255,0.16)"} />
      ))}
    </svg>
  );
}

export async function renderWrappedPoster(w: WrappedYear, format: "wide" | "story", photoId: string | null): Promise<ImageResponse> {
  const wide = format === "wide";
  const W = wide ? 1920 : 1080;
  const H = wide ? 1080 : 1920;
  const chosen = (photoId && w.photos.find((p) => p.id === photoId)) || w.photos[0] || null;
  const photoUrl = chosen?.url ?? w.events.find((e) => e.photo)?.photo ?? null;
  const [photo, serif, serifItalic, inter, interBold, wordmark, shapes] = await Promise.all([
    photoData(photoUrl, wide ? 1120 : 1080, wide ? 1080 : 860),
    loadFont("Fraunces:opsz,wght@72,600"),
    loadFont("Fraunces:ital,opsz,wght@1,72,400"),
    loadFont("Inter:wght@400"),
    loadFont("Inter:wght@700"),
    loadLogo(),
    loadWorld(),
  ]);
  const fonts = [
    serif && { name: "Fraunces", data: serif, weight: 600 as const, style: "normal" as const },
    serifItalic && { name: "Fraunces", data: serifItalic, weight: 400 as const, style: "italic" as const },
    inter && { name: "Inter", data: inter, weight: 400 as const, style: "normal" as const },
    interBold && { name: "Inter", data: interBold, weight: 700 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => !!f);
  const lit = new Set(w.countries.map((c) => countryByCode(c)?.numeric).filter((x): x is string => !!x));
  const home = w.homeCode ? countryByCode(w.homeCode)?.numeric ?? null : null;
  // Wide: three numbers in a row; tall: four.
  const facts = posterFacts(w).slice(0, wide ? 3 : 4);
  // Wide only (tall has its map in their place).
  const flags = wide ? w.countries.slice(0, 12).map((c) => countryByCode(c)?.flag ?? "").join(" ") : "";
  const PHOTO_H = wide ? H : 860;
  const tagline = w.firstName ? `${w.firstName}’s year, remembered.` : "A year, remembered.";

  const text = (
    <div style={{ display: "flex", flexDirection: "column", color: "white" }}>
      <img alt="" src={wordmark} width={wide ? 260 : 300} height={wide ? 76 : 88} style={{ width: wide ? 260 : 300, height: wide ? 76 : 88 }} />
      <div style={{ display: "flex", marginTop: wide ? 40 : 28, fontFamily: "Fraunces", fontWeight: 600, fontSize: wide ? 230 : 200, lineHeight: 0.9, letterSpacing: -6 }}>{String(w.year)}</div>
      <div style={{ display: "flex", marginTop: 18, fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 400, fontSize: wide ? 48 : 52, color: "#ffb3d6" }}>{tagline}</div>
      {facts.length > 0 && (
        <div style={{ display: "flex", marginTop: wide ? 44 : 40, gap: wide ? 48 : 40 }}>
          {facts.map((f) => (
            <div key={f.label} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontFamily: "Fraunces", fontWeight: 600, fontSize: wide ? 76 : 72, lineHeight: 1 }}>{f.value}</div>
              <div style={{ display: "flex", marginTop: 8, fontSize: wide ? 24 : 24, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 3 }}>{f.label}</div>
            </div>
          ))}
        </div>
      )}
      {flags && <div style={{ display: "flex", marginTop: wide ? 36 : 40, fontSize: wide ? 40 : 46, letterSpacing: 4 }}>{flags}</div>}
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: wide ? "row" : "column", width: W, height: H, background: "#14051a", fontFamily: "Inter", position: "relative" }}>
        {/* Their photo */}
        <div style={{ display: "flex", position: "relative", width: wide ? 1120 : W, height: PHOTO_H, background: "linear-gradient(135deg, #5a1758, #2b0b2e)" }}>
          {photo && <img alt="" src={photo} width={wide ? 1120 : W} height={PHOTO_H} style={{ width: wide ? 1120 : W, height: PHOTO_H, objectFit: "cover" }} />}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: wide ? 1120 : W,
              height: PHOTO_H,
              display: "flex",
              background: wide ? "linear-gradient(90deg, rgba(20,5,26,0) 55%, rgba(20,5,26,1) 100%)" : "linear-gradient(180deg, rgba(20,5,26,0) 60%, rgba(20,5,26,1) 100%)",
            }}
          />
          {chosen?.label && (
            <div style={{ position: "absolute", left: wide ? 40 : 80, bottom: wide ? 40 : 140, display: "flex", padding: "10px 22px", borderRadius: 999, background: "rgba(0,0,0,0.4)", color: "white", fontSize: 26 }}>
              {chosen.label}
            </div>
          )}
        </div>
        {/* The year */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: wide ? "80px 80px 70px 40px" : "0px 80px 250px" }}>
          {text}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
            <WorldMap shapes={shapes} lit={lit} home={home} width={wide ? 640 : 760} />
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, emoji: "twemoji", fonts: fonts.length ? fonts : undefined, headers: { "Cache-Control": "private, max-age=600" } }
  );
}
