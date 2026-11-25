"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { geoArea, geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { ArrowRight, MapPin, X } from "lucide-react";
import { CONTINENTS, countryByCode, countryByNumeric } from "@/lib/countries";
import type { MapCountry } from "@/lib/experienceNetworkData";
import { tapLight } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type Region = "World" | (typeof CONTINENTS)[number];
type Shape = { type: "Feature"; properties: Record<string, never>; id: string; geometry: unknown; code: string | null; continent: string | null };
type Box = { x: number; y: number; w: number; h: number };

// The whole world is drawn once at this size; a region is a view of it (the
// viewBox), so switching regions glides rather than redraws.
const MW = 1000;
const MH = 520;

// How many have been, as depth of pink: 1, 2–3, 4–6, 7 or more.
const SHADES = ["#fcc8df", "#f994c0", "#f45ca1", "#d1257d"];
const shadeOf = (n: number) => (n >= 7 ? SHADES[3] : n >= 4 ? SHADES[2] : n >= 2 ? SHADES[1] : SHADES[0]);
const LEGEND = [
  { label: "1", fill: SHADES[0] },
  { label: "2–3", fill: SHADES[1] },
  { label: "4–6", fill: SHADES[2] },
  { label: "7+", fill: SHADES[3] },
];

/** A country's main land only (France without French Guiana, Spain without the Canaries): what frames a region and holds its number. */
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

/** Grow a box to the frame's shape, around its middle, with a little room. */
function toFrame(b: Box, aspect: number, pad = 0.06): Box {
  let w = b.w * (1 + pad * 2);
  let h = b.h * (1 + pad * 2);
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h };
}

/**
 * Where your friends have been, as a flat map: every country coloured by
 * how many have been (the number on it where it fits), a continent at a
 * time with a smooth glide between them, white borders that stay crisp at
 * any zoom. Tap a country: who's been (and, on the full page, their towns
 * and the countries most of them know). `compact` is Explore's own:
 * nothing below the map but the country tapped.
 */
export function FriendsMap({ countries, circle = "friends", compact = false }: { countries: MapCountry[]; circle?: "friends" | "network"; compact?: boolean }) {
  const [shapes, setShapes] = useState<Shape[] | null>(null);
  const [region, setRegion] = useState<Region>("World");
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    void loadWorld().then(setShapes).catch(() => setShapes([]));
  }, []);

  const byCode = useMemo(() => new Map(countries.map((c) => [c.code, c])), [countries]);
  const regions = useMemo(() => {
    const has = new Set(countries.map((c) => countryByCode(c.code)?.continent).filter(Boolean));
    return ["World", ...CONTINENTS.filter((c) => has.has(c))] as Region[];
  }, [countries]);
  const aspect = compact ? 16 / 10 : 3 / 2;

  // The world, drawn once: each country's outline, where its main land sits, and the box round each continent.
  const map = useMemo(() => {
    if (!shapes?.length) return null;
    const visible = shapes.filter((s) => s.code !== "AQ");
    const projection = geoNaturalEarth1().fitSize([MW, MH], { type: "FeatureCollection", features: visible } as never);
    const path = geoPath(projection);
    const items = visible
      .map((s) => {
        const d = path(s as unknown as GeoPermissibleObjects);
        if (!d) return null;
        const main = mainland(s) as unknown as GeoPermissibleObjects;
        const [[x0, y0], [x1, y1]] = path.bounds(main);
        const [cx, cy] = path.centroid(main);
        return { id: s.id, code: s.code, continent: s.continent, d, cx, cy, bw: x1 - x0, bh: y1 - y0, x0, y0, x1, y1 };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    const boxes = {} as Record<Region, Box>;
    boxes.World = { x: 0, y: 0, w: MW, h: MH };
    for (const c of CONTINENTS) {
      // Europe without Siberia; Oceania without the islands past the date line.
      const of = items.filter((i) => i.continent === c && !(c === "Europe" && i.code === "RU") && !(c === "Oceania" && i.cx < MW / 2));
      if (!of.length) continue;
      const x0 = Math.min(...of.map((i) => i.x0));
      const y0 = Math.min(...of.map((i) => i.y0));
      boxes[c] = { x: x0, y: y0, w: Math.max(...of.map((i) => i.x1)) - x0, h: Math.max(...of.map((i) => i.y1)) - y0 };
    }
    return { items, boxes };
  }, [shapes]);

  const framed = map ? toFrame(map.boxes[region] ?? map.boxes.World, aspect, region === "World" ? 0 : 0.06) : { x: 0, y: 0, w: MW, h: MW / aspect };
  // The key sits over the bottom of the map: grow the view downwards so the countries end above it.
  const keyShare = compact ? 0.14 : 0.11;
  const box = (() => {
    const h = framed.h / (1 - keyShare);
    const w = h * aspect;
    return { x: framed.x + framed.w / 2 - w / 2, y: framed.y, w, h };
  })();
  // A screen pixel in map units (the map is about 360px wide on a phone): numbers keep their size at any zoom.
  const px = box.w / 360;
  const sel = picked ? byCode.get(picked) ?? null : null;
  const top = useMemo(() => countries.filter((c) => region === "World" || countryByCode(c.code)?.continent === region).slice(0, 8), [countries, region]);
  const most = Math.max(1, ...top.map((c) => c.people.length));
  const whoWord = circle === "friends" ? "Friends" : "People";

  const choose = (code: string | null) => {
    if (!code || !byCode.has(code)) return setPicked(null);
    tapLight();
    setPicked((p) => (p === code ? null : code));
  };

  if (countries.length === 0)
    return compact ? null : (
      <p className="mt-10 text-center text-sm text-muted">
        {circle === "friends" ? "No friends' places yet - they show up here as your friends add their trips." : "No places yet - they show up here as people you follow add their trips."}
      </p>
    );

  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      {/* Continents */}
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
      <div className="relative mt-3 overflow-hidden rounded-2xl border border-line bg-[#eef4f7] dark:bg-[#141821]" style={{ aspectRatio: String(aspect) }}>
        {map ? (
          <motion.svg
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="xMidYMid meet"
            initial={false}
            animate={{ viewBox: `${box.x} ${box.y} ${box.w} ${box.h}` }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            role="img"
            aria-label={`Map of ${region === "World" ? "the world" : region}: countries coloured by how many ${circle === "friends" ? "friends" : "people you follow"} have been`}
          >
            {map.items.map((it) => {
              const n = it.code ? byCode.get(it.code)?.people.length ?? 0 : 0;
              const on = !!picked && it.code === picked;
              return (
                <path
                  key={it.id}
                  d={it.d}
                  onClick={() => choose(it.code)}
                  className={cn("transition-[fill] duration-300", n ? "cursor-pointer" : "fill-[#ddd5c9] dark:fill-[#302a38]")}
                  style={n ? { fill: shadeOf(n) } : undefined}
                  stroke={on ? "#2b0b2e" : "#ffffff"}
                  strokeWidth={on ? 2 : 0.8}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {/* The numbers, sized for this view, once it has arrived. */}
            <AnimatePresence>
              <motion.g key={region} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.55, duration: 0.3 } }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
                {map.items.map((it) => {
                  const n = it.code ? byCode.get(it.code)?.people.length ?? 0 : 0;
                  const roomy = (it.bw / px) * (it.bh / px) > 170 && it.cx > box.x + 8 * px && it.cx < box.x + box.w - 8 * px && it.cy > box.y + 8 * px && it.cy < box.y + box.h - 8 * px;
                  if (!n || !roomy) return null;
                  return (
                    <g key={it.id} onClick={() => choose(it.code)} className="cursor-pointer">
                      <circle cx={it.cx} cy={it.cy} r={(n > 9 ? 7.5 : 6.5) * px} fill="#2b0b2e" stroke="#fff" strokeWidth={px} />
                      <text x={it.cx} y={it.cy + 2.6 * px} textAnchor="middle" fontSize={7.5 * px} fontWeight={700} fill="#fff">
                        {n}
                      </text>
                    </g>
                  );
                })}
              </motion.g>
            </AnimatePresence>
          </motion.svg>
        ) : (
          <div className="absolute inset-0 animate-pulse" />
        )}
        {/* Key */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-surface/85 px-3 py-1.5 text-[11px] text-muted backdrop-blur">
          <span>{whoWord} who&rsquo;ve been</span>
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

      {/* The country tapped: who's been (their towns, on the full page), and the way in. */}
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
                <p className="font-serif text-xl leading-tight">
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
            {!compact && sel.towns.length > 0 && (
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

      {/* Where most of them have been (the full page) */}
      {!compact && top.length > 0 && (
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
