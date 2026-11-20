"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Music2, Plus, Tent, Ticket, Trophy } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { photoThumbs } from "@/lib/photoScan";
import { tripDates, tripLength, type FoundTrip, type FoundWorld } from "@/lib/tripFinder";
import type { FoundEvent, TripTown } from "@/lib/worldStory";
import { keptCountries, type KeptWorld } from "@/lib/worldScan";
import { tapLight, tapSuccess } from "@/lib/haptics";

type Journey = {
  kind: "journey";
  id: string;
  trips: FoundTrip[];
  codes: string[];
  from: string;
  to: string;
  photos: number;
  covers: string[];
  lived: boolean;
  sure: boolean;
};
type EventItem = { kind: "event"; id: string; event: FoundEvent; sure: boolean };
type Item = Journey | EventItem;

const dateOf = (i: Item) => (i.kind === "journey" ? i.from : i.event.date);

function journeysOf(trips: FoundTrip[]): Journey[] {
  const groups = new Map<string, FoundTrip[]>();
  for (const t of trips) groups.set(t.journey, [...(groups.get(t.journey) ?? []), t]);
  return [...groups.entries()].map(([id, list]) => {
    const inOrder = [...list].sort((a, b) => a.from.localeCompare(b.from));
    const byPhotos = [...list].sort((a, b) => b.photos - a.photos);
    return {
      kind: "journey" as const,
      id,
      trips: inOrder,
      codes: [...new Set(inOrder.map((t) => t.code))],
      from: inOrder[0].from,
      to: inOrder.reduce((m, t) => (t.to > m ? t.to : m), inOrder[0].to),
      photos: list.reduce((s, t) => s + t.photos, 0),
      covers: [...new Set(byPhotos.flatMap((t) => t.covers))].slice(0, 6),
      lived: list.length === 1 && list[0].kind === "lived",
      sure: list.some((t) => t.sure),
    };
  });
}

/**
 * Their story, already kept: years as chapters, each journey a photo card
 * named by its towns, each concert or match a ticket. Nothing to approve
 * one by one; tap anything that's wrong, then save. The few things it isn't
 * sure about wait at the end, off until tapped.
 */
export function StoryView({
  mode,
  world,
  towns,
  events,
  onSave,
}: {
  mode: "new" | "member";
  world: FoundWorld;
  towns: Record<string, TripTown[]>;
  events: FoundEvent[] | null;
  onSave: (kept: KeptWorld) => void;
}) {
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());

  const items: Item[] = useMemo(
    () => [...journeysOf(world.trips), ...(events ?? []).map((e) => ({ kind: "event" as const, id: e.id, event: e, sure: e.sure }))],
    [world.trips, events]
  );
  // Kept: sure ones unless tapped off, unsure ones only if tapped on.
  const isKept = useCallback((i: Item) => (i.sure ? !flipped.has(i.id) : flipped.has(i.id)), [flipped]);
  const sure = items.filter((i) => i.sure);
  const maybe = items.filter((i) => !i.sure).sort((a, b) => dateOf(b).localeCompare(dateOf(a)));

  const chapters = useMemo(() => {
    const byYear = new Map<string, Item[]>();
    for (const i of sure) {
      const y = dateOf(i).slice(0, 4);
      byYear.set(y, [...(byYear.get(y) ?? []), i]);
    }
    return [...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([year, list]) => ({ year, list: list.sort((a, b) => dateOf(b).localeCompare(dateOf(a))) }));
  }, [sure]);

  const keptItems = items.filter(isKept);
  const keptWorld: KeptWorld = {
    homeCode: world.homeCode,
    trips: keptItems.flatMap((i) =>
      i.kind === "journey"
        ? i.trips.map((t) => ({ code: t.code, from: t.from, to: t.to, kind: t.kind, covers: t.covers, towns: (towns[t.id] ?? []).map((x) => ({ name: x.name, lat: x.lat, lng: x.lng, arrived: x.arrived, departed: x.departed })) }))
        : []
    ),
    events: keptItems.flatMap((i) =>
      i.kind === "event"
        ? [{ type: i.event.type, title: i.event.title, artist: i.event.artist, venue: i.event.venue, city: i.event.city, code: i.event.code, date: i.event.date, covers: i.event.covers }]
        : []
    ),
  };
  const countries = keptCountries(keptWorld).length;
  const tripCount = keptWorld.trips.length;
  const eventCount = keptWorld.events?.length ?? 0;

  function toggle(id: string) {
    tapLight();
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Pictures are made on the phone as cards come into view.
  const want = useCallback((ids: string[]) => {
    const need = ids.filter((id) => id && !asked.current.has(id));
    if (!need.length) return;
    need.forEach((id) => asked.current.add(id));
    void photoThumbs(need, 820).then((got) => setThumbs((prev) => ({ ...prev, ...got })));
  }, []);

  return (
    <div className="mx-auto min-h-[100dvh] max-w-md">
      {/* What's in it, live */}
      <div className="sticky top-0 z-20 bg-[#1f0822]/80 px-5 pb-3 pt-[calc(0.9rem+env(safe-area-inset-top))] backdrop-blur-xl">
        <p className="font-serif text-2xl">Your story</p>
        <p className="mt-0.5 text-sm text-white/65">
          <Counter n={countries} one="country" many="countries" /> · <Counter n={tripCount} one="trip" many="trips" />
          {eventCount > 0 && (
            <>
              {" "}
              · <Counter n={eventCount} one="event" many="events" />
            </>
          )}
        </p>
      </div>

      <div className="px-4 pb-44">
        <AnimatePresence>
          {events === null && (
            <motion.div
              key="looking"
              className="mt-3 flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3 text-sm text-white/70 ring-1 ring-white/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
            >
              <motion.span animate={{ rotate: [0, -12, 12, 0] }} transition={{ duration: 1.2, repeat: Infinity }} aria-hidden>
                <Ticket size={18} className="text-[#ffb3d6]" />
              </motion.span>
              Looking for concerts and matches…
            </motion.div>
          )}
        </AnimatePresence>

        {chapters.map(({ year, list }) => {
          const trips = list.filter((i) => i.kind === "journey").length;
          const evs = list.length - trips;
          return (
            <section key={year} className="mt-8" aria-label={year}>
              <div className="mb-3 flex items-baseline justify-between px-1">
                <h2 className="font-serif text-4xl font-semibold tracking-tight">{year}</h2>
                <p className="text-xs text-white/50">
                  {[trips ? `${trips} ${trips === 1 ? "trip" : "trips"}` : null, evs ? `${evs} ${evs === 1 ? "event" : "events"}` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="space-y-3">
                {list.map((i) =>
                  i.kind === "journey" ? (
                    <JourneyCard key={i.id} j={i} year={year} towns={towns} thumbs={thumbs} kept={isKept(i)} onToggle={() => toggle(i.id)} onSeen={() => want(i.covers.slice(0, 1))} />
                  ) : (
                    <EventTicket key={i.id} e={i.event} thumbs={thumbs} kept={isKept(i)} onToggle={() => toggle(i.id)} onSeen={() => want(i.event.covers.slice(0, 1))} />
                  )
                )}
              </div>
            </section>
          );
        })}

        {maybe.length > 0 && (
          <section className="mt-12" aria-label="Maybe">
            <div className="mb-3 flex items-baseline justify-between px-1">
              <h2 className="font-serif text-2xl">Maybe</h2>
              <p className="text-xs text-white/50">Tap to add</p>
            </div>
            <div className="space-y-2">
              {maybe.map((i) => (
                <MaybeRow key={i.id} item={i} towns={towns} thumbs={thumbs} kept={isKept(i)} onToggle={() => toggle(i.id)} onSeen={() => want((i.kind === "journey" ? i.covers : i.event.covers).slice(0, 1))} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Save, always one tap away */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#14051a] via-[#14051a]/95 to-transparent px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-10">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            onClick={() => {
              tapSuccess();
              onSave(keptWorld);
            }}
            className="btn-accent w-full py-4 text-lg shadow-[0_12px_30px_-8px_rgba(250,81,162,0.7)]"
          >
            {mode === "new" ? "Save my world" : "Add to my world"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Counter({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <span>
      <motion.span key={n} className="inline-block font-semibold text-white" initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        {n}
      </motion.span>{" "}
      {n === 1 ? one : many}
    </span>
  );
}

function Toggle({ kept, onToggle, label }: { kept: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={kept}
      aria-label={kept ? `Remove ${label}` : `Add ${label}`}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${kept ? "bg-gradient-to-br from-[#fa51a2] to-[#fb7822] text-white shadow-lg" : "bg-black/35 text-white ring-1 ring-white/40 backdrop-blur"}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={kept ? "on" : "off"} initial={{ scale: 0.4, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.4 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
          {kept ? <Check size={18} strokeWidth={3} aria-hidden /> : <Plus size={18} strokeWidth={2.5} aria-hidden />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function rise(reduce: boolean | null) {
  return reduce
    ? {}
    : { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "0px 0px -40px 0px" }, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } };
}

/** "3–8 May" inside its year's chapter; the year only when it crosses into another. */
function datesIn(year: string, from: string, to: string) {
  const text = tripDates(from, to);
  return from.startsWith(year) && to.startsWith(year) ? text.replace(new RegExp(` ${year}$`), "") : text;
}

function journeyTitle(j: Journey, towns: Record<string, TripTown[]>) {
  if (j.codes.length > 1) {
    const names = j.codes.map((c) => countryByCode(c)?.name ?? c);
    return names.length > 3 ? `${names.slice(0, 3).join(" → ")} +${names.length - 3}` : names.join(" → ");
  }
  const names = j.trips.flatMap((t) => (towns[t.id] ?? []).map((x) => x.name));
  const unique = [...new Set(names)].slice(0, 3);
  return unique.length ? unique.join(" · ") : countryByCode(j.codes[0])?.name ?? "";
}

function JourneyCard({
  j,
  year,
  towns,
  thumbs,
  kept,
  onToggle,
  onSeen,
}: {
  j: Journey;
  year: string;
  towns: Record<string, TripTown[]>;
  thumbs: Record<string, string>;
  kept: boolean;
  onToggle: () => void;
  onSeen: () => void;
}) {
  const reduce = useReducedMotion();
  const flags = j.codes.map((c) => countryByCode(c)?.flag ?? "").join(" ");
  const single = j.codes.length === 1 ? countryByCode(j.codes[0]) : null;
  const title = journeyTitle(j, towns);
  const src = thumbs[j.covers[0]];
  return (
    <motion.article {...rise(reduce)} onViewportEnter={onSeen} className="relative">
      <div className={`relative h-56 overflow-hidden rounded-3xl bg-[#3a1240] ring-1 ring-white/10 transition-[filter,opacity] duration-300 ${kept ? "" : "opacity-40 grayscale"}`}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <motion.img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#5a1758] to-[#2b0b2e] text-6xl opacity-60" aria-hidden>
            {flags}
          </span>
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
            {flags} {single && title !== single.name ? single.name : ""}
            {j.lived && <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 tracking-wider">Lived here</span>}
          </p>
          <p className="mt-1 font-serif text-[1.65rem] leading-tight drop-shadow-md">{title}</p>
          <p className="mt-1 text-sm text-white/75">
            {datesIn(year, j.from, j.to)} · {tripLength(j.from, j.to)} · {j.photos.toLocaleString("en-GB")} photos
          </p>
        </div>
      </div>
      <div className="absolute right-3 top-3">
        <Toggle kept={kept} onToggle={onToggle} label={title} />
      </div>
    </motion.article>
  );
}

const EVENT_META: Record<string, { label: string; icon: typeof Music2 }> = {
  concert: { label: "Concert", icon: Music2 },
  festival: { label: "Festival", icon: Tent },
  sport: { label: "Match", icon: Trophy },
  other: { label: "Show", icon: Ticket },
};

function shortDay(d: string) {
  const date = new Date(`${d}T12:00:00Z`);
  return `${date.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getUTCMonth()]}`;
}

/** A ticket stub: the night's best photo, a perforation, then who and where. */
function EventTicket({ e, thumbs, kept, onToggle, onSeen }: { e: FoundEvent; thumbs: Record<string, string>; kept: boolean; onToggle: () => void; onSeen: () => void }) {
  const reduce = useReducedMotion();
  const meta = EVENT_META[e.type] ?? EVENT_META.other;
  const Icon = meta.icon;
  const src = thumbs[e.covers[0]];
  return (
    <motion.article {...rise(reduce)} onViewportEnter={onSeen} className="relative">
      <div
        className={`relative flex h-32 overflow-hidden rounded-2xl bg-gradient-to-br from-[#fff4f9] to-[#ffe9da] text-[#2b0b2e] shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)] transition-[filter,opacity] duration-300 ${kept ? "" : "opacity-40 grayscale"}`}
      >
        <div className="relative w-32 shrink-0 bg-[#3a1240]">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-white/70" aria-hidden>
              <Icon size={30} />
            </span>
          )}
        </div>
        {/* The perforation, with a bite out of each edge */}
        <span aria-hidden className="relative w-0 border-l-2 border-dashed border-[#2b0b2e]/20">
          <span className="absolute -left-[9px] -top-2 h-4 w-4 rounded-full bg-[#1f0822]" />
          <span className="absolute -bottom-2 -left-[9px] h-4 w-4 rounded-full bg-[#1f0822]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col justify-center px-4 pr-12">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#d63384]">
            <Icon size={13} aria-hidden /> {meta.label} · {shortDay(e.date)}
          </p>
          <p className="mt-1 truncate font-serif text-xl leading-tight">{e.title}</p>
          <p className="mt-0.5 truncate text-sm text-[#2b0b2e]/65">{[e.venue !== e.title ? e.venue : null, e.city].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="absolute right-3 top-3">
        <Toggle kept={kept} onToggle={onToggle} label={e.title} />
      </div>
    </motion.article>
  );
}

function MaybeRow({
  item,
  towns,
  thumbs,
  kept,
  onToggle,
  onSeen,
}: {
  item: Item;
  towns: Record<string, TripTown[]>;
  thumbs: Record<string, string>;
  kept: boolean;
  onToggle: () => void;
  onSeen: () => void;
}) {
  const cover = item.kind === "journey" ? item.covers[0] : item.event.covers[0];
  const title = item.kind === "journey" ? journeyTitle(item, towns) : item.event.title;
  const flag = item.kind === "journey" ? item.codes.map((c) => countryByCode(c)?.flag).join(" ") : countryByCode(item.event.code)?.flag;
  const when = item.kind === "journey" ? tripDates(item.from, item.to) : `${(EVENT_META[item.event.type] ?? EVENT_META.other).label} · ${tripDates(item.event.date, item.event.date)}`;
  return (
    <motion.button
      type="button"
      onViewportEnter={onSeen}
      onClick={onToggle}
      aria-pressed={kept}
      className={`flex w-full items-center gap-3 rounded-2xl p-2 pr-3 text-left ring-1 transition-colors ${kept ? "bg-white/[0.12] ring-[#fa51a2]/60" : "bg-white/[0.05] ring-white/10"}`}
    >
      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#3a1240]">
        {thumbs[cover] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbs[cover]} alt="" className="h-full w-full object-cover" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {flag} {title}
        </span>
        <span className="block truncate text-sm text-white/55">{when}</span>
      </span>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${kept ? "bg-gradient-to-br from-[#fa51a2] to-[#fb7822]" : "ring-1 ring-white/40"}`} aria-hidden>
        {kept ? <Check size={16} strokeWidth={3} /> : <Plus size={16} />}
      </span>
    </motion.button>
  );
}
