"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { geoArea, geoCentroid, geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { ArrowRight, MapPin, X } from "lucide-react";
import { CONTINENTS, countryByCode, countryByNumeric } from "@/lib/countries";
import type { MapCountry } from "@/lib/experienceNetworkData";
import { tapLight } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type Region = "World" | (typeof CONTINENTS)[number];
type Shape = { type: "Feature"; properties: Record<string, never>; id: string; geometry: unknown; code: string | null; continent: string | null };

const W = 360;

// How many have been, as depth of pink: 1, 2–3, 4–6, 7 or more.
const SHADES = ["#fcd3e6", "#f9a2c9", "#f76aa8", "#d92f86"];
const shadeOf = (n: number) => (n >= 7 ? SHADES[3] : n >= 4 ? SHADES[2] : n >= 2 ? SHADES[1] : SHADES[0]);
const LEGEND = [
  { label: "1", fill: SHADES[0] },
  { label: "2–3", fill: SHADES[1] },
  { label: "4–6", fill: SHADES[2] },
  { label: "7+", fill: SHADES[3] },
];

/** A country's main land only (France without French Guiana, Spain without the Canaries): what a region is framed by. */
function mainland(s: Shape) {
  const g = s.geometry as { type: string; coordinates: unknown };
  if (g.type !== "MultiPolygon") return { type: "Feature", geometry: g, properties: {} };
  let best: unknown = null;
  let area = -1;
  for (const poly of g.coordinates as unknown[]) {
    const a = geoArea({ type: "Polygon", coordinates: poly } as never);
    if (a > area) {
      area = a;
      best = poly;
    }
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: best }, properties: {} };
}

let world: Promise<Shape[]> | null = null;
const loadWorld = () =>
  (world ??= fetch("/data/world-110m.json")
    .then((r) => r.json() as Promise<Topology>)
    .then((t) =>
      (feature(t, t.objects.countries as GeometryCollection) as unknown as { features: { id: string; geometry: unknown }[] }).features
        .filter((f) => f.geometry && f.id !== "010")
        .map((f) => {
          const c = countryByNumeric(String(f.id));
          return { type: "Feature" as const, properties: {}, id: String(f.id), geometry: f.geometry, code: c?.code ?? null, continent: c?.continent ?? null };
        })
    ));

/**
 * "Places your friends know" as a map: every country coloured by how many
 * of your friends (or people you follow) have been, a number on the ones
 * big enough to hold it, a region at a time to see more. Tap a country:
 * who's been, the towns they logged, and the way to explore it. The
 * countries most of them know are listed underneath.
 */
export function FriendsMap({ countries, circle }: { countries: MapCountry[]; circle: "friends" | "network" }) {
  const [shapes, setShapes] = useState<Shape[] | null>(null);
  const [region, setRegion] = useState<Region>("World");
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    void loadWorld().then(setShapes).catch(() => setShapes([]));
  }, []);

  const byCode = useMemo(() => new Map(countries.map((c) => [c.code, c])), [countries]);
  // Regions worth a tab: the ones with someone in them.
  const regions = useMemo(() => {
    const has = new Set(countries.map((c) => countryByCode(c.code)?.continent).filter(Boolean));
    return ["World", ...CONTINENTS.filter((c) => has.has(c))] as Region[];
  }, [countries]);

  // The map for this region: fitted to its countries (Russia aside for Europe, so Europe isn't mostly Siberia), centred on them.
  const drawn = useMemo(() => {
    if (!shapes?.length) return null;
    const inRegion = (s: Shape) => region === "World" || s.continent === region;
    const fitTo = shapes.filter((s) => inRegion(s) && !(region === "Europe" && s.code === "RU") && s.code !== "AQ");
    const H = region === "World" ? 200 : 300;
    const projection = geoNaturalEarth1();
    if (region !== "World") {
      const lngs = fitTo.map((s) => geoCentroid(mainland(s) as never)[0]);
      const mid = lngs.reduce((a, b) => a + b, 0) / Math.max(1, lngs.length);
      projection.rotate([-mid, 0]);
    }
    projection.fitExtent(
      [
        [8, 8],
        [W - 8, H - 8],
      ],
      { type: "FeatureCollection", features: region === "World" ? shapes.filter((s) => s.code !== "AQ") : fitTo.map(mainland) } as never
    );
    const path = geoPath(projection);
    const items = shapes
      .filter((s) => s.code !== "AQ")
      .map((s) => {
        const d = path(s as unknown as GeoPermissibleObjects);
        if (!d) return null;
        const c = s.code ? byCode.get(s.code) : undefined;
        // Where the number goes: the middle of the country's main land (France's on France, not out at sea for French Guiana).
        const main = mainland(s) as unknown as GeoPermissibleObjects;
        const [[x0, y0], [x1, y1]] = path.bounds(main);
        const [cx, cy] = path.centroid(main);
        // A number only where it fits (and inside the frame).
        const roomy = (x1 - x0) * (y1 - y0) > (region === "World" ? 260 : 300) && cx > 10 && cx < W - 10 && cy > 10 && cy < H - 10;
        return { id: s.id, code: s.code, d, n: c?.people.length ?? 0, cx, cy, roomy };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    return { H, items };
  }, [shapes, region, byCode]);

  const sel = picked ? byCode.get(picked) ?? null : null;
  const top = useMemo(() => countries.filter((c) => region === "World" || countryByCode(c.code)?.continent === region).slice(0, 8), [countries, region]);
  const most = Math.max(1, ...top.map((c) => c.people.length));

  const choose = (code: string | null) => {
    if (!code || !byCode.has(code)) return setPicked(null);
    tapLight();
    setPicked((p) => (p === code ? null : code));
  };

  if (countries.length === 0)
    return (
      <p className="mt-10 text-center text-sm text-muted">
        {circle === "friends" ? "No friends' places yet - they show up here as your friends add their trips." : "No places yet - they show up here as people you follow add their trips."}
      </p>
    );

  return (
    <div className="mt-4">
      {/* Regions */}
      <div role="tablist" aria-label="Region" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {regions.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={region === r}
            onClick={() => {
              tapLight();
              setRegion(r);
              setPicked(null);
            }}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              region === r ? "border-accent bg-accent text-white" : "border-line bg-surface text-muted hover:border-accent/50 hover:text-ink"
            )}
          >
            {r}
          </button>
        ))}
      </div>

      {/* The map */}
      <div className="relative mt-3 overflow-hidden rounded-2xl border border-line bg-[#f4f0ea] dark:bg-[#17131c]">
        {drawn ? (
          <AnimatePresence mode="wait">
            <motion.svg
              key={region}
              viewBox={`0 0 ${W} ${drawn.H}`}
              className="block h-auto w-full"
              role="img"
              aria-label={`Map of ${region === "World" ? "the world" : region}: countries coloured by how many ${circle === "friends" ? "friends" : "people you follow"} have been`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {drawn.items.map((it) => (
                <path
                  key={it.id}
                  d={it.d}
                  onClick={() => choose(it.code)}
                  className={cn("transition-[fill] duration-200", it.n ? "cursor-pointer" : "fill-[#e4ddd2] dark:fill-[#2c2633]")}
                  style={it.n ? { fill: shadeOf(it.n) } : undefined}
                  stroke={picked && it.code === picked ? "#2b0b2e" : "rgba(255,255,255,0.9)"}
                  strokeWidth={picked && it.code === picked ? 1.4 : 0.35}
                  strokeLinejoin="round"
                />
              ))}
              {/* Numbers on the countries roomy enough for one */}
              {drawn.items
                .filter((it) => it.n > 0 && it.roomy)
                .map((it) => (
                  <g key={`n-${it.id}`} onClick={() => choose(it.code)} className="cursor-pointer">
                    <circle cx={it.cx} cy={it.cy} r={it.n > 9 ? 7.5 : 6.5} fill="#2b0b2e" stroke="#fff" strokeWidth={1} />
                    <text x={it.cx} y={it.cy + 2.6} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#fff">
                      {it.n}
                    </text>
                  </g>
                ))}
            </motion.svg>
          </AnimatePresence>
        ) : (
          <div className="aspect-[9/5] w-full animate-pulse" />
        )}
        {/* Key */}
        <div className="flex items-center justify-between gap-2 border-t border-line/70 bg-surface/80 px-3 py-2 text-[11px] text-muted backdrop-blur">
          <span>{circle === "friends" ? "Friends" : "People"} who&rsquo;ve been</span>
          <span className="flex items-center gap-2">
            {LEGEND.map((l) => (
              <span key={l.label} className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.fill }} />
                {l.label}
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* The country tapped: who's been, their towns, and the way in. */}
      <AnimatePresence>
        {sel && (
          <motion.div
            key={sel.code}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="mt-3 rounded-2xl border border-accent/40 bg-surface p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-serif text-2xl leading-tight">
                  {countryByCode(sel.code)?.flag} {countryByCode(sel.code)?.name}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {sel.people.length} {circle === "friends" ? (sel.people.length === 1 ? "friend has" : "friends have") : sel.people.length === 1 ? "person you follow has" : "people you follow have"} been
                </p>
              </div>
              <button type="button" onClick={() => setPicked(null)} aria-label="Close" className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-raised">
                <X size={16} />
              </button>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {sel.people.slice(0, 12).map((p) => (
                <li key={p.id}>
                  <Link href={`/u/${p.username}`} className="flex items-center gap-2 rounded-full bg-raised py-1 pl-1 pr-3 text-sm hover:bg-accent-soft">
                    <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-serif text-accent">
                      {p.avatar_url ? <Image src={p.avatar_url} alt="" fill sizes="28px" className="object-cover" /> : p.display_name.charAt(0)}
                    </span>
                    {p.display_name.split(" ")[0]}
                  </Link>
                </li>
              ))}
            </ul>
            {sel.towns.length > 0 && (
              <p className="mt-3 flex items-start gap-1.5 text-sm text-muted">
                <MapPin size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <span>{sel.towns.slice(0, 6).map((t) => t.name).join(" · ")}</span>
              </p>
            )}
            <Link href={`/explore/country/${sel.code.toLowerCase()}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
              Explore {countryByCode(sel.code)?.name} <ArrowRight size={14} aria-hidden />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Where most of them have been */}
      {top.length > 0 && (
        <section className="mt-6" aria-labelledby="most-h">
          <h2 id="most-h" className="font-serif text-xl">
            {circle === "friends" ? "Where your friends have been most" : "Where people you follow have been most"}
          </h2>
          <ol className="mt-3 space-y-1.5">
            {top.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => choose(c.code)}
                  className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-raised", picked === c.code && "bg-accent-soft")}
                >
                  <span className="w-6 text-lg" aria-hidden>
                    {countryByCode(c.code)?.flag}
                  </span>
                  <span className="w-28 shrink-0 truncate text-sm">{countryByCode(c.code)?.name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-raised" aria-hidden>
                    <span className="block h-full rounded-full" style={{ width: `${(c.people.length / most) * 100}%`, background: shadeOf(c.people.length) }} />
                  </span>
                  <span className="w-6 text-right text-sm font-semibold tabular-nums">{c.people.length}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
