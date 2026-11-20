"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Home, Plus, Search, X } from "lucide-react";
import { COUNTRIES, TOTAL_COUNTRIES, countryByCode } from "@/lib/countries";
import { photoThumbs } from "@/lib/photoScan";
import type { FoundWorld } from "@/lib/tripFinder";
import { tapLight, tapSuccess } from "@/lib/haptics";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="h-[170px] w-full" />,
});

export type CountryPick = {
  /** Countries kept: found ones not tapped off, doubtful ones tapped on, and added ones. */
  codes: string[];
  /** Added by hand: no trips behind them. */
  added: string[];
};

type Tile = { code: string; firstYear: string; trips: number; cover: string | null; sure: boolean };

/**
 * "Your countries": every country found, as a tile with one of their own
 * photos, kept unless tapped off. The ones the photos aren't sure about
 * (a phone's position across a sea, a photo from a plane) wait below, off
 * until tapped. Anything the photos missed is a search away.
 */
export function CountriesWall({
  world,
  next,
  onNext,
}: {
  world: FoundWorld;
  /** What the button says: on to memories, or straight to saving. */
  next: string;
  onNext: (pick: CountryPick) => void;
}) {
  const reduce = useReducedMotion();
  const [off, setOff] = useState<Set<string>>(new Set());
  const [on, setOn] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());

  const tiles: Tile[] = useMemo(() => {
    const by = new Map<string, Tile & { photos: number }>();
    for (const t of world.trips) {
      const cur = by.get(t.code);
      if (!cur) {
        by.set(t.code, { code: t.code, firstYear: t.from.slice(0, 4), trips: 1, cover: t.covers[0] ?? null, sure: t.sure, photos: t.photos });
      } else {
        cur.trips += 1;
        if (t.from.slice(0, 4) < cur.firstYear) cur.firstYear = t.from.slice(0, 4);
        if (t.photos > cur.photos && t.covers[0]) {
          cur.cover = t.covers[0];
          cur.photos = t.photos;
        }
        cur.sure ||= t.sure;
      }
    }
    // The places they've been most first: the strongest photos lead.
    return [...by.values()].sort((a, b) => b.trips - a.trips || a.firstYear.localeCompare(b.firstYear));
  }, [world.trips]);

  const sure = tiles.filter((t) => t.sure && t.code !== world.homeCode);
  const unsure = tiles.filter((t) => !t.sure && t.code !== world.homeCode);
  const isOn = (t: Tile) => (t.sure ? !off.has(t.code) : on.has(t.code));
  const codes = [
    ...(world.homeCode ? [world.homeCode] : []),
    ...sure.filter(isOn).map((t) => t.code),
    ...unsure.filter(isOn).map((t) => t.code),
    ...added,
  ];

  function toggle(t: Tile) {
    tapLight();
    const flip = (set: Set<string>) => {
      const next = new Set(set);
      if (next.has(t.code)) next.delete(t.code);
      else next.add(t.code);
      return next;
    };
    if (t.sure) setOff(flip);
    else setOn(flip);
  }

  const want = useCallback((id: string | null) => {
    if (!id || asked.current.has(id)) return;
    asked.current.add(id);
    void photoThumbs([id], 520).then((got) => setThumbs((prev) => ({ ...prev, ...got })));
  }, []);

  const home = countryByCode(world.homeCode);

  return (
    <div className="mx-auto min-h-[100dvh] max-w-md">
      {/* The globe and the count, changing with every tap */}
      <div className="sticky top-0 z-20 bg-[#1f0822]/85 px-5 pb-3 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="pointer-events-none -my-3 -ml-6 w-36 shrink-0">
            <WorldGlobeInner visitedCodes={codes} homeCode={world.homeCode ?? undefined} interactive={false} labels={false} autoRotate />
          </div>
          <div>
            <p className="font-serif text-2xl leading-tight">Your countries</p>
            <p className="mt-1 text-sm text-white/65">
              <motion.span key={codes.length} className="inline-block font-serif text-3xl font-semibold text-white" initial={reduce ? false : { scale: 1.35, color: "#ff8cc6" }} animate={{ scale: 1, color: "#ffffff" }}>
                {codes.length}
              </motion.span>{" "}
              of {TOTAL_COUNTRIES}
            </p>
            <p className="mt-0.5 text-xs text-white/50">Tap any that aren&apos;t right</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-40 pt-3">
        <div className="grid grid-cols-2 gap-3">
          {home && <HomeTile code={home.code} />}
          {sure.map((t, i) => (
            <CountryTile key={t.code} tile={t} on={isOn(t)} index={i} thumb={t.cover ? thumbs[t.cover] : undefined} onSeen={() => want(t.cover)} onToggle={() => toggle(t)} />
          ))}
          <AnimatePresence>
            {added.map((code) => (
              <motion.button
                key={code}
                type="button"
                layout
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                onClick={() => {
                  tapLight();
                  setAdded((a) => a.filter((c) => c !== code));
                }}
                className="relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br from-[#7a2276] to-[#2b0b2e] p-4 text-left ring-1 ring-white/15"
                aria-label={`Remove ${countryByCode(code)?.name}`}
              >
                <span className="absolute inset-0 flex items-center justify-center text-7xl opacity-90" aria-hidden>
                  {countryByCode(code)?.flag}
                </span>
                <span className="relative font-serif text-xl leading-tight">{countryByCode(code)?.name}</span>
                <span className="relative text-xs text-white/60">Added</span>
                <Badge on />
              </motion.button>
            ))}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => {
              tapLight();
              setAdding(true);
            }}
            className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-white/25 text-white/75 hover:border-white/50 hover:text-white"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <Plus size={24} aria-hidden />
            </span>
            <span className="text-sm font-medium">Add a country</span>
          </button>
        </div>

        {unsure.length > 0 && (
          <section className="mt-10" aria-label="Were you really here?">
            <h2 className="px-1 font-serif text-xl">Were you really here?</h2>
            <p className="mt-0.5 px-1 text-xs text-white/50">A few photos placed here, maybe from a plane or across a border. Tap if you were.</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {unsure.map((t) => {
                const c = countryByCode(t.code);
                const kept = isOn(t);
                return (
                  <button
                    key={t.code}
                    type="button"
                    onClick={() => toggle(t)}
                    aria-pressed={kept}
                    className={`relative flex flex-col items-center rounded-2xl border-2 px-2 py-3 text-center transition-colors ${kept ? "border-[#fa51a2] bg-white/[0.14]" : "border-dashed border-white/20 bg-white/[0.04]"}`}
                  >
                    <span className={`text-3xl ${kept ? "" : "opacity-50 grayscale"}`} aria-hidden>
                      {c?.flag}
                    </span>
                    <span className="mt-1 line-clamp-1 text-xs">{c?.name}</span>
                    <span className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${kept ? "bg-gradient-to-br from-[#fa51a2] to-[#fb7822]" : "bg-white/15"}`} aria-hidden>
                      {kept ? <Check size={12} strokeWidth={3} /> : "?"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#14051a] via-[#14051a]/95 to-transparent px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-10">
        <div className="mx-auto max-w-md">
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
              // A found one that was tapped off comes back on; anything else is added.
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

function Badge({ on }: { on: boolean }) {
  return (
    <span
      className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full ${on ? "bg-gradient-to-br from-[#fa51a2] to-[#fb7822] text-white shadow-lg" : "bg-black/40 text-white ring-1 ring-white/50 backdrop-blur"}`}
      aria-hidden
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={on ? "on" : "off"} initial={{ scale: 0.3, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.3 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
          {on ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={2.5} />}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function HomeTile({ code }: { code: string }) {
  const c = countryByCode(code);
  return (
    <div className="relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br from-[#fa51a2] via-[#f43f5e] to-[#fb7822] p-4">
      <span className="absolute inset-0 flex items-center justify-center text-7xl" aria-hidden>
        {c?.flag}
      </span>
      <span className="relative inline-flex w-fit items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
        <Home size={11} aria-hidden /> Home
      </span>
      <span className="relative mt-1 font-serif text-xl leading-tight">{c?.name}</span>
    </div>
  );
}

function CountryTile({ tile, on, index, thumb, onSeen, onToggle }: { tile: Tile; on: boolean; index: number; thumb?: string; onSeen: () => void; onToggle: () => void }) {
  const reduce = useReducedMotion();
  const c = countryByCode(tile.code);
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      onViewportEnter={onSeen}
      aria-pressed={on}
      aria-label={`${c?.name}${on ? "" : ", removed"}`}
      initial={reduce ? false : { opacity: 0, y: 24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: on ? 1 : 0.96 }}
      transition={{ delay: reduce ? 0 : Math.min(index, 12) * 0.05, type: "spring", stiffness: 260, damping: 24 }}
      className="relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl bg-[#3a1240] p-4 text-left ring-1 ring-white/10"
    >
      <span className={`absolute inset-0 transition-[filter,opacity] duration-300 ${on ? "" : "opacity-35 grayscale"}`}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <motion.img src={thumb} alt="" className="h-full w-full object-cover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#5a1758] to-[#2b0b2e] text-6xl" aria-hidden>
            {c?.flag}
          </span>
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      </span>
      {thumb && (
        <span className={`relative text-2xl transition-opacity ${on ? "" : "opacity-50"}`} aria-hidden>
          {c?.flag}
        </span>
      )}
      <span className={`relative mt-0.5 font-serif text-xl leading-tight ${on ? "" : "text-white/60 line-through decoration-white/40"}`}>{c?.name}</span>
      <span className="relative text-xs text-white/65">
        {on ? `Since ${tile.firstYear}${tile.trips > 1 ? ` · ${tile.trips} trips` : ""}` : "Tap to bring back"}
      </span>
      <Badge on={on} />
    </motion.button>
  );
}

/** Two letters and a tap: a bottom sheet to add a country the photos missed. */
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
    <motion.div className="fixed inset-0 z-50 flex items-end bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Add a country"
        className="mx-auto flex h-[78dvh] w-full max-w-md flex-col rounded-t-[28px] bg-[#24092a] pb-[env(safe-area-inset-bottom)] text-white ring-1 ring-white/10"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 pb-3 pt-5">
          <label className="flex flex-1 items-center gap-2 rounded-full bg-white/10 px-4 py-3 ring-1 ring-white/15 focus-within:ring-[#fa51a2]">
            <Search size={18} className="text-white/60" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Where else have you been?"
              className="w-full bg-transparent text-base outline-none placeholder:text-white/45"
              aria-label="Search countries"
            />
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
          {!list.length && <li className="px-3 py-6 text-center text-sm text-white/50">No country by that name.</li>}
        </ul>
      </motion.div>
    </motion.div>
  );
}
