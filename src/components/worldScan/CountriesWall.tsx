"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Home, Plus, Search, X } from "lucide-react";
import { COUNTRIES, TOTAL_COUNTRIES, countryByCode } from "@/lib/countries";
import { stockPhotoFor, stockUrl } from "@/lib/stockPhotos";
import type { FoundWorld } from "@/lib/tripFinder";
import { tapLight, tapSuccess } from "@/lib/haptics";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <GlobeSpot />,
});

/** Where the little globe goes, until it's drawn: a faint sphere of the same size. */
function GlobeSpot() {
  return (
    <div className="flex h-[77px] w-full items-center justify-center">
      <span className="h-14 w-14 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.18),rgba(255,255,255,0.04)_70%)]" />
    </div>
  );
}

/** The countries that open the wall, most visited first (home has its own tile). */
function wallOrder(world: FoundWorld): Tile[] {
  const by = new Map<string, Tile>();
  for (const t of world.trips) {
    const cur = by.get(t.code);
    if (!cur) by.set(t.code, { code: t.code, firstYear: t.from.slice(0, 4), trips: 1, sure: t.sure });
    else {
      cur.trips += 1;
      if (t.from.slice(0, 4) < cur.firstYear) cur.firstYear = t.from.slice(0, 4);
      cur.sure ||= t.sure;
    }
  }
  // The places they've been most lead.
  return [...by.values()].sort((a, b) => b.trips - a.trips || a.firstYear.localeCompare(b.firstYear));
}

const tileUrl = (raw: string) => stockUrl(raw, 440, "4:5", 72);

/**
 * Fetch the photos of the first tiles while the count is still on screen, so
 * the wall opens with them already there instead of filling in as it fades in.
 */
export function warmUpWall(world: FoundWorld) {
  for (const t of wallOrder(world)
    .filter((t) => t.sure && t.code !== world.homeCode)
    .slice(0, 6)) {
    const photo = stockPhotoFor(t.code, "wall");
    if (photo) new Image().src = tileUrl(photo.raw);
  }
}

export type CountryPick = {
  /** Countries kept: found ones not tapped off, doubtful ones tapped on, and added ones. */
  codes: string[];
  /** Added by hand: no trips behind them. */
  added: string[];
};

type Tile = { code: string; firstYear: string; trips: number; sure: boolean };

/**
 * "Your countries": every country found, each as a tile with a photo of it
 * (curated Unsplash: their own photos stay theirs), kept unless tapped off.
 * The ones the photos aren't sure about (a phone's position across a sea, a
 * photo from a plane) wait at the end, off until tapped. "+ Add" for
 * anything missed. It scrolls; the count and the button stay in view.
 */
export function CountriesWall({ world, next, onNext }: { world: FoundWorld; next: string; onNext: (pick: CountryPick) => void }) {
  const reduce = useReducedMotion();
  const [off, setOff] = useState<Set<string>>(new Set());
  const [on, setOn] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<{ code: string; kept: boolean; n: number } | null>(null);

  const tiles: Tile[] = useMemo(() => wallOrder(world), [world]);
  // The little globe starts up (a WebGL scene) once the screen has faded in,
  // not during it, where it would stall the fade.
  const [globeOn, setGlobeOn] = useState(false);
  useEffect(() => {
    // After the tiles have landed: a WebGL scene starting up mid-animation makes it stutter.
    const t = setTimeout(() => setGlobeOn(true), 900);
    return () => clearTimeout(t);
  }, []);

  const sure = tiles.filter((t) => t.sure && t.code !== world.homeCode);
  const unsure = tiles.filter((t) => !t.sure && t.code !== world.homeCode);
  const isOn = (t: Tile) => (t.sure ? !off.has(t.code) : on.has(t.code));
  const codes = [...(world.homeCode ? [world.homeCode] : []), ...sure.filter(isOn).map((t) => t.code), ...unsure.filter(isOn).map((t) => t.code), ...added];

  function toggle(t: Tile) {
    tapLight();
    const flip = (set: Set<string>) => {
      const n = new Set(set);
      if (n.has(t.code)) n.delete(t.code);
      else n.add(t.code);
      return n;
    };
    const keptNow = !isOn(t);
    if (t.sure) setOff(flip);
    else setOn(flip);
    setToast({ code: t.code, kept: keptNow, n: Date.now() });
  }

  const home = countryByCode(world.homeCode);

  return (
    <div className="mx-auto min-h-[100dvh] max-w-md">
      {/* The globe and the count, changing with every tap */}
      {/* Solid, not frosted: iPhone can't draw a blur inside a page that's fading in, so it flashed. */}
      <div className="sticky top-0 z-20 flex items-center gap-3 bg-[#1f0822] px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] shadow-[0_8px_20px_-12px_rgba(0,0,0,0.7)]">
        <div className="pointer-events-none -my-2 -ml-3 w-24 shrink-0">
          {globeOn ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <WorldGlobeInner visitedCodes={codes} homeCode={world.homeCode ?? undefined} interactive={false} labels={false} autoRotate />
            </motion.div>
          ) : (
            <GlobeSpot />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-serif text-xl leading-tight">Your countries</p>
          <p className="text-sm text-white/65">
            <motion.span key={codes.length} className="inline-block font-serif text-2xl font-semibold text-white" initial={reduce ? false : { scale: 1.35, color: "#ff8cc6" }} animate={{ scale: 1, color: "#ffffff" }}>
              {codes.length}
            </motion.span>{" "}
            of {TOTAL_COUNTRIES} · tap any that aren&apos;t right
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pb-44 pt-3">
        {home && (
          <div className="relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br from-[#fa51a2] via-[#f43f5e] to-[#fb7822] p-4">
            <span className="absolute inset-0 flex items-center justify-center text-7xl" aria-hidden>
              {home.flag}
            </span>
            <span className="relative inline-flex w-fit items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
              <Home size={11} aria-hidden /> Home
            </span>
            <span className="relative mt-1 font-serif text-xl leading-tight">{home.name}</span>
          </div>
        )}
        {sure.map((t, i) => (
          <PhotoTile key={t.code} tile={t} on={isOn(t)} index={i} onToggle={() => toggle(t)} />
        ))}
        <AnimatePresence>
          {added.map((code) => (
            <PhotoTile
              key={code}
              tile={{ code, firstYear: "", trips: 0, sure: true }}
              on
              index={0}
              label="Added"
              onToggle={() => {
                tapLight();
                setAdded((a) => a.filter((c) => c !== code));
              }}
            />
          ))}
        </AnimatePresence>
        <button
          type="button"
          onClick={() => {
            tapLight();
            setAdding(true);
          }}
          className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-white/25 text-white/75"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <Plus size={24} aria-hidden />
          </span>
          <span className="text-sm font-medium">Add a country</span>
        </button>

        {/* The doubtful ones */}
        {unsure.length > 0 && (
          <div className="col-span-2 mt-4">
            <p className="font-serif text-lg">Were you really here?</p>
            <p className="text-xs text-white/55">A few photos placed here, maybe from a plane or across a border at sea. Tap if you were.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {unsure.map((t) => {
                const kept = isOn(t);
                const c = countryByCode(t.code);
                return (
                  <button
                    key={t.code}
                    type="button"
                    onClick={() => toggle(t)}
                    aria-pressed={kept}
                    className={`flex h-9 items-center gap-1.5 rounded-full border-2 px-2.5 text-xs transition-colors ${kept ? "border-[#fa51a2] bg-white/15" : "border-dashed border-white/25 text-white/70"}`}
                  >
                    <span className={kept ? "" : "grayscale"} aria-hidden>
                      {c?.flag}
                    </span>
                    <span className="max-w-[7rem] truncate">{c?.name}</span>
                    <span aria-hidden>{kept ? <Check size={12} strokeWidth={3} /> : "?"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* What a tap just did, and the way on */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#14051a] via-[#14051a]/95 to-transparent px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-8">
        <div className="mx-auto max-w-md">
          <div className="relative h-7">
            <AnimatePresence>
              {toast && (
                <motion.p key={toast.n} className="absolute inset-x-0 text-center text-xs text-white/80" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  {countryByCode(toast.code)?.flag} {countryByCode(toast.code)?.name} {toast.kept ? "kept" : "removed"} ·{" "}
                  <button type="button" className="font-semibold text-white underline underline-offset-2" onClick={() => toggle(tiles.find((t) => t.code === toast.code)!)}>
                    Undo
                  </button>
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <button
            type="button"
            onClick={() => {
              tapSuccess();
              onNext({ codes, added });
            }}
            className="btn-accent w-full py-4 text-lg shadow-[0_12px_30px_-8px_rgba(250,81,162,0.7)]"
          >
            {next}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {adding && (
          <AddCountry
            have={new Set(codes)}
            near={codes}
            onAdd={(code) => {
              tapSuccess();
              const t = tiles.find((x) => x.code === code);
              if (t) {
                if (t.sure) setOff((s) => new Set([...s].filter((c) => c !== code)));
                else setOn((s) => new Set([...s, code]));
              } else setAdded((a) => [...a, code]);
            }}
            onClose={() => setAdding(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PhotoTile({ tile, on, index, onToggle, label }: { tile: Tile; on: boolean; index: number; onToggle: () => void; label?: string }) {
  const reduce = useReducedMotion();
  const c = countryByCode(tile.code);
  const photo = stockPhotoFor(tile.code, "wall");
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={`${c?.name}${on ? "" : ", removed"}`}
      // One calm move in: up and into view, one after another. (No zoom: with the page fading in too, it read as a wobble.)
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, scale: on ? 1 : 0.95 }}
      transition={{
        opacity: { duration: 0.45, ease: "easeOut", delay: reduce ? 0 : 0.12 + Math.min(index, 6) * 0.04 },
        y: { duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.12 + Math.min(index, 6) * 0.04 },
        scale: { type: "spring", stiffness: 260, damping: 24 },
      }}
      className="relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl p-3.5 text-left ring-1 ring-white/10"
      style={{ background: photo?.color ?? "#3a1240" }}
    >
      <span className={`absolute inset-0 transition-[filter,opacity] duration-300 ${on ? "" : "opacity-35 grayscale"}`}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tileUrl(photo.raw)} alt="" className="h-full w-full object-cover" loading={index < 6 ? "eager" : "lazy"} />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      </span>
      <span className={`relative text-2xl leading-none ${on ? "" : "opacity-60"}`} aria-hidden>
        {c?.flag}
      </span>
      <span className={`relative mt-1 truncate font-serif text-xl leading-tight ${on ? "" : "text-white/60 line-through"}`}>{c?.name}</span>
      <span className="relative truncate text-xs text-white/65">
        {!on ? "Tap to bring back" : label ?? `Since ${tile.firstYear}${tile.trips > 1 ? ` · ${tile.trips} trips` : ""}`}
      </span>
      {photo && <span className="absolute bottom-1 right-2 max-w-[70%] truncate text-[8px] text-white/55 drop-shadow">Photo: {photo.author} / Unsplash</span>}
      <span
        className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full ${on ? "bg-gradient-to-br from-[#fa51a2] to-[#fb7822] text-white shadow-lg" : "bg-black/50 text-white ring-1 ring-white/50"}`}
        aria-hidden
      >
        {on ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={2.5} />}
      </span>
    </motion.button>
  );
}

function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="mx-auto flex h-[78dvh] w-full max-w-md flex-col rounded-t-[28px] bg-[#24092a] pb-[env(safe-area-inset-bottom)] text-white ring-1 ring-white/10"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Two letters and a tap: add a country the photos missed. */
function AddCountry({ have, near, onAdd, onClose }: { have: Set<string>; near: string[]; onAdd: (code: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [justAdded, setJustAdded] = useState<string[]>([]);
  const query = q.trim().toLowerCase();
  // With nothing typed: countries on the same continents as theirs, not yet kept.
  const continents = new Set(near.map((c) => countryByCode(c)?.continent));
  const list = (query
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(query) || c.code.toLowerCase() === query).sort((a, b) => Number(!a.name.toLowerCase().startsWith(query)) - Number(!b.name.toLowerCase().startsWith(query)))
    : COUNTRIES.filter((c) => continents.has(c.continent))
  )
    .filter((c) => !have.has(c.code) || justAdded.includes(c.code))
    .slice(0, 40);

  return (
    <Sheet label="Add a country" onClose={onClose}>
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <label className="flex flex-1 items-center gap-2 rounded-full bg-white/10 px-4 py-3 ring-1 ring-white/15 focus-within:ring-[#fa51a2]">
          <Search size={18} className="text-white/60" aria-hidden />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Where else have you been?" className="w-full bg-transparent text-base outline-none placeholder:text-white/45" aria-label="Search countries" />
        </label>
        <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10" aria-label="Done">
          <X size={20} aria-hidden />
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto px-3 pb-6">
        {list.map((c) => {
          const done = justAdded.includes(c.code);
          return (
            <li key={c.code}>
              <button
                type="button"
                disabled={done}
                onClick={() => {
                  setJustAdded((a) => [...a, c.code]);
                  onAdd(c.code);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/5"
              >
                <span className="text-3xl" aria-hidden>
                  {c.flag}
                </span>
                <span className="flex-1 text-base">{c.name}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${done ? "bg-gradient-to-br from-[#fa51a2] to-[#fb7822]" : "ring-1 ring-white/30"}`} aria-hidden>
                  {done ? <Check size={16} strokeWidth={3} /> : <Plus size={16} />}
                </span>
              </button>
            </li>
          );
        })}
        {!list.length && <li className="px-3 py-6 text-center text-sm text-white/55">No country by that name.</li>}
      </ul>
    </Sheet>
  );
}
