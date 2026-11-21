"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Home, Plus, Search, X } from "lucide-react";
import { COUNTRIES, TOTAL_COUNTRIES, countryByCode } from "@/lib/countries";
import { stockPhotoFor, stockUrl } from "@/lib/stockPhotos";
import type { FoundWorld } from "@/lib/tripFinder";
import { tapLight, tapSuccess } from "@/lib/haptics";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="h-[80px] w-full" />,
});

export type CountryPick = {
  /** Countries kept: found ones not tapped off, doubtful ones tapped on, and added ones. */
  codes: string[];
  /** Added by hand: no trips behind them. */
  added: string[];
};

type Tile = { code: string; firstYear: string; trips: number; sure: boolean };

/** Big photo tiles for the countries they've been to most; the rest as flags. */
const BIG = 6;
/** Flags shown before "+N" (the rest are in the full list). */
const FLAGS = 21;

/**
 * "Your countries", all on one screen (nothing to scroll): the places
 * they've been most as photo tiles (curated Unsplash: their own photos stay
 * theirs), the rest as flags, all kept unless tapped off. The ones the
 * photos aren't sure about (a phone's position across a sea, a photo from a
 * plane) wait in their own row, off until tapped. "+ Add" for anything missed.
 */
export function CountriesWall({ world, next, onNext }: { world: FoundWorld; next: string; onNext: (pick: CountryPick) => void }) {
  const reduce = useReducedMotion();
  const [off, setOff] = useState<Set<string>>(new Set());
  const [on, setOn] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<string[]>([]);
  const [sheet, setSheet] = useState<"add" | "all" | null>(null);
  const [toast, setToast] = useState<{ code: string; kept: boolean; n: number } | null>(null);

  const tiles: Tile[] = useMemo(() => {
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
  }, [world.trips]);

  const sure = tiles.filter((t) => t.sure && t.code !== world.homeCode);
  const unsure = tiles.filter((t) => !t.sure && t.code !== world.homeCode);
  const isOn = (t: Tile) => (t.sure ? !off.has(t.code) : on.has(t.code));
  const codes = [...(world.homeCode ? [world.homeCode] : []), ...sure.filter(isOn).map((t) => t.code), ...unsure.filter(isOn).map((t) => t.code), ...added];

  const big = sure.slice(0, BIG);
  const small = sure.slice(BIG);
  const flags = small.slice(0, FLAGS);
  const more = small.length - flags.length;

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
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(0.5rem+env(safe-area-inset-top))]">
      {/* The globe and the count, changing with every tap */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="pointer-events-none -my-2 -ml-3 w-24 shrink-0">
          <WorldGlobeInner visitedCodes={codes} homeCode={world.homeCode ?? undefined} interactive={false} labels={false} autoRotate />
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

      {/* The places they've been most */}
      <div className="mt-2 grid min-h-0 flex-1 grid-cols-3 grid-rows-[repeat(3,minmax(0,1fr))] gap-2">
        {home && (
          <div className="relative flex flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br from-[#fa51a2] via-[#f43f5e] to-[#fb7822] p-2.5">
            <span className="absolute inset-0 flex items-center justify-center text-5xl" aria-hidden>
              {home.flag}
            </span>
            <span className="relative inline-flex w-fit items-center gap-1 rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              <Home size={10} aria-hidden /> Home
            </span>
            <span className="relative mt-0.5 truncate font-serif text-base leading-tight">{home.name}</span>
          </div>
        )}
        {big.map((t, i) => (
          <PhotoTile key={t.code} tile={t} on={isOn(t)} index={i} onToggle={() => toggle(t)} />
        ))}
        {/* Fill the grid's last spaces with "+ Add" and, when there are fewer countries, nothing. */}
        <button
          type="button"
          onClick={() => {
            tapLight();
            setSheet("add");
          }}
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-white/25 text-white/75"
        >
          <Plus size={22} aria-hidden />
          <span className="text-xs font-medium">Add a country</span>
        </button>
      </div>

      {/* The rest, as flags */}
      {(flags.length > 0 || more > 0 || added.length > 0) && (
        <div className="mt-3 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {flags.map((t) => {
              const kept = isOn(t);
              const c = countryByCode(t.code);
              return (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => toggle(t)}
                  aria-pressed={kept}
                  aria-label={`${c?.name}${kept ? "" : ", removed"}`}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-full text-xl transition ${kept ? "bg-white/15 ring-1 ring-white/25" : "bg-white/[0.04] opacity-40 grayscale"}`}
                >
                  <span aria-hidden>{c?.flag}</span>
                </button>
              );
            })}
            {added.map((code) => (
              <motion.button
                key={code}
                type="button"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                onClick={() => {
                  tapLight();
                  setAdded((a) => a.filter((c) => c !== code));
                }}
                aria-label={`${countryByCode(code)?.name}, added: tap to remove`}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl ring-2 ring-[#fa51a2]"
              >
                <span aria-hidden>{countryByCode(code)?.flag}</span>
              </motion.button>
            ))}
            {more > 0 && (
              <button type="button" onClick={() => setSheet("all")} className="flex h-10 items-center justify-center rounded-full bg-white/15 px-3 text-sm font-semibold ring-1 ring-white/25">
                +{more}
              </button>
            )}
          </div>
        </div>
      )}

      {/* The doubtful ones */}
      {unsure.length > 0 && (
        <div className="mt-3 shrink-0">
          <p className="text-xs text-white/55">Were you really here? (a plane, a border at sea…) Tap if you were.</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {unsure.slice(0, 8).map((t) => {
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
                  <span className="max-w-[6rem] truncate">{c?.name}</span>
                  <span aria-hidden>{kept ? <Check size={12} strokeWidth={3} /> : "?"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* What a tap just did */}
      <div className="relative mt-2 h-7 shrink-0">
        <AnimatePresence>
          {toast && (
            <motion.p
              key={toast.n}
              className="absolute inset-x-0 text-center text-xs text-white/75"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
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
        className="btn-accent w-full shrink-0 py-4 text-lg shadow-[0_12px_30px_-8px_rgba(250,81,162,0.7)]"
      >
        {next}
      </button>

      <AnimatePresence>
        {sheet === "add" && (
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
            onClose={() => setSheet(null)}
          />
        )}
        {sheet === "all" && <AllCountries tiles={sure} isOn={isOn} onToggle={toggle} onClose={() => setSheet(null)} />}
      </AnimatePresence>
    </div>
  );
}

function PhotoTile({ tile, on, index, onToggle }: { tile: Tile; on: boolean; index: number; onToggle: () => void }) {
  const reduce = useReducedMotion();
  const c = countryByCode(tile.code);
  const photo = stockPhotoFor(tile.code, "wall");
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={`${c?.name}${on ? "" : ", removed"}`}
      initial={reduce ? false : { opacity: 0, y: 18, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: on ? 1 : 0.95 }}
      transition={{ delay: reduce ? 0 : index * 0.06, type: "spring", stiffness: 260, damping: 24 }}
      className="relative flex flex-col justify-end overflow-hidden rounded-2xl p-2.5 text-left ring-1 ring-white/10"
      style={{ background: photo?.color ?? "#3a1240" }}
    >
      <span className={`absolute inset-0 transition-[filter,opacity] duration-300 ${on ? "" : "opacity-35 grayscale"}`}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stockUrl(photo.raw, 320, "4:5", 70)} alt="" className="h-full w-full object-cover" />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      </span>
      <span className={`relative text-lg leading-none ${on ? "" : "opacity-60"}`} aria-hidden>
        {c?.flag}
      </span>
      <span className={`relative mt-0.5 truncate font-serif text-base leading-tight ${on ? "" : "text-white/60 line-through"}`}>{c?.name}</span>
      <span className="relative truncate text-[10px] text-white/65">{on ? `Since ${tile.firstYear}${tile.trips > 1 ? ` · ${tile.trips} trips` : ""}` : "Tap to bring back"}</span>
      {photo && <span className="absolute left-2 top-1.5 max-w-[70%] truncate text-[8px] text-white/60 drop-shadow">Photo: {photo.author} / Unsplash</span>}
      <span
        className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full ${on ? "bg-gradient-to-br from-[#fa51a2] to-[#fb7822] text-white" : "bg-black/40 text-white ring-1 ring-white/50"}`}
        aria-hidden
      >
        {on ? <Check size={13} strokeWidth={3} /> : <Plus size={13} strokeWidth={2.5} />}
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

/** Every found country, to check them all at once. */
function AllCountries({ tiles, isOn, onToggle, onClose }: { tiles: Tile[]; isOn: (t: Tile) => boolean; onToggle: (t: Tile) => void; onClose: () => void }) {
  return (
    <Sheet label="All your countries" onClose={onClose}>
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <p className="font-serif text-xl">All your countries</p>
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10" aria-label="Done">
          <X size={20} aria-hidden />
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto px-3 pb-6">
        {tiles.map((t) => {
          const c = countryByCode(t.code);
          const kept = isOn(t);
          return (
            <li key={t.code}>
              <button type="button" onClick={() => onToggle(t)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-white/5" aria-pressed={kept}>
                <span className={`text-2xl ${kept ? "" : "grayscale opacity-50"}`} aria-hidden>
                  {c?.flag}
                </span>
                <span className={`flex-1 ${kept ? "" : "text-white/50 line-through"}`}>{c?.name}</span>
                <span className="text-xs text-white/50">{t.trips > 1 ? `${t.trips} trips` : `since ${t.firstYear}`}</span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full ${kept ? "bg-gradient-to-br from-[#fa51a2] to-[#fb7822]" : "ring-1 ring-white/30"}`} aria-hidden>
                  {kept ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
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
