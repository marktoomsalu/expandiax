/* eslint-disable @next/next/no-img-element -- drawn into a picture (next/og), not a page */
// The Year Wrapped finale, as one picture for Instagram Stories (1080×1920):
// "My 2026 Wrapped", their photos (their chosen one big, a few around it),
// the Earth at night rising like a horizon with their countries lit and
// lines from place to place, and three facts that are really theirs. No
// place names on the photos.

import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { ImageResponse } from "next/og";
import type { Topology } from "topojson-specification";
import { drawGlobe, worldFeatures, type WorldFeature } from "@/lib/globeArt";
import type { WrappedYear } from "@/lib/wrapped";

const W = 1080;
const H = 1920;

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

let world: Promise<WorldFeature[]> | null = null;
const loadWorld = () => (world ??= readFile(path.join(process.cwd(), "public", "data", "world-110m.json"), "utf8").then((raw) => worldFeatures(JSON.parse(raw) as Topology)));

async function photoData(url: string | null | undefined, w: number, h: number): Promise<string | null> {
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

type Fact = { value: number; label: string; before: number | null; icon: "plane" | "globe" | "calendar" | "pin" | "spark" };

/** Three facts that are really theirs: trips, countries, events first; places and new countries if those are missing. */
export function storyFacts(w: WrappedYear): Fact[] {
  const p = w.previous;
  const all: Fact[] = [
    { value: w.trips, label: w.trips === 1 ? "trip" : "trips", before: p?.trips ?? null, icon: "plane" },
    { value: w.countries.length, label: w.countries.length === 1 ? "country" : "countries", before: p?.countries ?? null, icon: "globe" },
    { value: w.events.length, label: w.events.length === 1 ? "event" : "events", before: p?.events ?? null, icon: "calendar" },
    { value: w.places.length, label: w.places.length === 1 ? "place" : "places", before: null, icon: "pin" },
    { value: w.newCountries.length, label: "new countries", before: null, icon: "spark" },
  ];
  return all.filter((f) => f.value > 0).slice(0, 3);
}

// Lucide's shapes, drawn here.
const ICONS: Record<Fact["icon"], string[]> = {
  plane: ["M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"],
  globe: ["M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
  calendar: ["M8 2v4", "M16 2v4", "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M3 10h18"],
  pin: ["M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0", "M12 7a3 3 0 1 0 0 6 3 3 0 1 0 0-6"],
  spark: ["M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"],
};

// Where the photos sit around the big one: [left, top, width, height, turn].
const AROUND: [number, number, number, number, number][] = [
  [52, 676, 270, 210, -8],
  [36, 905, 255, 235, -5],
  [762, 666, 262, 225, 7],
  [780, 905, 250, 235, 6],
];

export async function renderWrappedPoster(w: WrappedYear, photoId: string | null): Promise<ImageResponse> {
  // Their chosen photo big; others around it (their highlights first), never the same twice.
  const urls: string[] = [];
  const chosen = (photoId && (w.photos.find((p) => p.id === photoId)?.url ?? w.highlights.find((h) => h.id === photoId)?.photo)) || w.highlights[0]?.photo || w.photos[0]?.url;
  if (chosen) urls.push(chosen);
  for (const u of [...w.highlights.map((h) => h.photo), ...w.photos.map((p) => p.url)]) if (u && !urls.includes(u)) urls.push(u);
  const around = urls.slice(1, 5);

  const [main, ...others] = await Promise.all([photoData(urls[0], 1040, 940), ...around.map((u, i) => photoData(u, AROUND[i][2] * 2, AROUND[i][3] * 2))]);
  const [titleFont, inter, interSemi, interBold, wordmark, features] = await Promise.all([
    loadFont("Fraunces:ital,opsz,wght@1,72,700"),
    loadFont("Inter:wght@400"),
    loadFont("Inter:wght@600"),
    loadFont("Inter:wght@700"),
    loadLogo(),
    loadWorld(),
  ]);
  const fonts = [
    titleFont && { name: "Fraunces", data: titleFont, weight: 700 as const, style: "italic" as const },
    inter && { name: "Inter", data: inter, weight: 400 as const, style: "normal" as const },
    interSemi && { name: "Inter", data: interSemi, weight: 600 as const, style: "normal" as const },
    interBold && { name: "Inter", data: interBold, weight: 700 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => !!f);

  // The Earth as a horizon: their countries near the top of it.
  const G = 1640;
  const globe = drawGlobe(features, { size: G, countries: w.countries, home: w.homeCode, route: w.journey.map((s) => s.code), tilt: 50, scale: 1 });
  const facts = storyFacts(w);
  const year = String(w.year);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: W,
          height: H,
          fontFamily: "Inter",
          color: "white",
          background: "linear-gradient(180deg, #160a2b 0%, #2c1250 26%, #5b2577 46%, #a2508a 58%, #e9907a 66%, #3a1a52 78%, #120818 100%)",
          overflow: "hidden",
        }}
      >
        {/* A soft pink sun behind the photos */}
        <div style={{ position: "absolute", left: 140, top: 560, width: 800, height: 800, display: "flex", borderRadius: 999, background: "radial-gradient(circle, rgba(255,179,214,0.45) 0%, rgba(255,179,214,0) 65%)" }} />

        {/* The Earth at night, rising */}
        <svg width={G} height={G} viewBox={`0 0 ${G} ${G}`} style={{ position: "absolute", left: (W - G) / 2, top: 1100 }}>
          <defs>
            <radialGradient id="o" cx="50%" cy="20%" r="70%">
              <stop offset="0" stopColor="#24356a" />
              <stop offset="0.6" stopColor="#111a3a" />
              <stop offset="1" stopColor="#090e22" />
            </radialGradient>
            <linearGradient id="l" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff6cb5" />
              <stop offset="1" stopColor="#fb7822" />
            </linearGradient>
          </defs>
          <circle cx={G / 2} cy={G / 2} r={G / 2 + 26} fill="rgba(196,140,255,0.28)" />
          <circle cx={G / 2} cy={G / 2} r={G / 2 + 10} fill="rgba(226,190,255,0.45)" />
          <path d={globe.sphere} fill="url(#o)" />
          <path d={globe.land} fill="#26386a" stroke="#3a4f8a" strokeWidth={1} />
          {globe.lit.map((c) => (
            <path key={c.code} d={c.d} fill={c.home ? "#fb7822" : "url(#l)"} stroke="#ffd1e8" strokeWidth={1.2} />
          ))}
          {globe.arcs.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#ffd1e8" strokeWidth={4} strokeLinecap="round" />
          ))}
          {globe.dots.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={8} fill="#ffffff" />
          ))}
        </svg>

        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <img alt="" src={wordmark} width={330} height={97} style={{ marginTop: 100, width: 330, height: 97 }} />

          {/* My 2026 Wrapped */}
          <div style={{ display: "flex", position: "relative", flexDirection: "column", alignItems: "center", marginTop: 34 }}>
            <svg width={860} height={360} viewBox="0 0 860 360" style={{ position: "absolute", left: -110, top: 0 }}>
              <path d="M150 326 C 360 350, 640 338, 820 262" fill="none" stroke="#e7c6ff" strokeWidth={5} strokeLinecap="round" />
            </svg>
            <svg width={70} height={70} viewBox="0 0 24 24" style={{ position: "absolute", right: -70, top: -18 }}>
              <path d="M12 1 L14.2 9.8 L23 12 L14.2 14.2 L12 23 L9.8 14.2 L1 12 L9.8 9.8 Z" fill="#f3dcff" />
            </svg>
            <div style={{ display: "flex", fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 700, fontSize: 150, lineHeight: 1, letterSpacing: -3 }}>
              <span style={{ marginRight: 34 }}>My</span>
              <span style={{ color: "#e7c6ff" }}>{year}</span>
            </div>
            <div style={{ display: "flex", fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 700, fontSize: 150, lineHeight: 1, letterSpacing: -3, marginTop: 4 }}>Wrapped</div>
          </div>
          <div style={{ display: "flex", marginTop: 34, fontSize: 42, color: "rgba(255,255,255,0.88)" }}>A year in experiences</div>
        </div>

        {/* Their photos around the big one */}
        {others.map((src, i) =>
          src ? (
            <div
              key={i}
              style={{
                position: "absolute",
                left: AROUND[i][0],
                top: AROUND[i][1],
                width: AROUND[i][2],
                height: AROUND[i][3],
                display: "flex",
                borderRadius: 26,
                border: "6px solid white",
                overflow: "hidden",
                transform: `rotate(${AROUND[i][4]}deg)`,
                boxShadow: "0 24px 50px rgba(0,0,0,0.45)",
              }}
            >
              <img alt="" src={src} width={AROUND[i][2]} height={AROUND[i][3]} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ) : null
        )}
        {main && (
          <div
            style={{
              position: "absolute",
              left: 280,
              top: 640,
              width: 520,
              height: 470,
              display: "flex",
              borderRadius: 34,
              border: "7px solid white",
              overflow: "hidden",
              transform: "rotate(-2deg)",
              boxShadow: "0 34px 70px rgba(0,0,0,0.55)",
            }}
          >
            <img alt="" src={main} width={520} height={470} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}

        {/* My year at a glance */}
        {facts.length > 0 && (
          <div
            style={{
              position: "absolute",
              left: 90,
              top: 1420,
              width: 900,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "26px 10px 28px",
              borderRadius: 42,
              background: "rgba(22,11,40,0.72)",
              border: "2px solid rgba(255,255,255,0.16)",
            }}
          >
            <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginBottom: 22 }}>My year at a glance</div>
            <div style={{ display: "flex", width: "100%" }}>
              {facts.map((f, i) => {
                const up = f.before != null && f.value > f.before;
                return (
                  <div key={f.label} style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", borderLeft: i ? "2px solid rgba(255,255,255,0.12)" : "none" }}>
                    <svg width={46} height={46} viewBox="0 0 24 24" fill="none" stroke="#e7c6ff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      {ICONS[f.icon].map((d) => (
                        <path key={d} d={d} />
                      ))}
                    </svg>
                    <div style={{ display: "flex", marginTop: 10, fontSize: 92, fontWeight: 700, lineHeight: 1 }}>{f.value}</div>
                    <div style={{ display: "flex", marginTop: 6, fontSize: 36 }}>{f.label}</div>
                    {up && (
                      <div style={{ display: "flex", marginTop: 10, fontSize: 28, fontWeight: 600, color: "#86efac" }}>
                        ↑ +{f.value - (f.before ?? 0)} vs {w.previous?.year}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    ),
    { width: W, height: H, fonts: fonts.length ? fonts : undefined, headers: { "Cache-Control": "private, max-age=600" } }
  );
}
