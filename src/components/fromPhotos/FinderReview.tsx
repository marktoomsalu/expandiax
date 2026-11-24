"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, CheckCircle2, ChevronRight, Loader2, Plus } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { eventPhotoKind, eventStockPhoto, stockPhotoFor, stockUrl, type StockPhoto } from "@/lib/stockPhotos";
import { tripDates, tripLength, type FoundTrip } from "@/lib/tripFinder";
import { formatDate, formatMonthYear } from "@/lib/utils";
import { tapLight, tapSuccess } from "@/lib/haptics";
import type { Change, Findings, SavedVisit, Suggestion } from "@/lib/memoryFinder";
import type { TripTown } from "@/lib/worldStory";

const EASE = [0.22, 1, 0.36, 1] as const;
type Which = { pick: number | null; others: boolean };

/** How a saved trip's date reads now: "2023", "August 2022". */
function savedWhen(v: SavedVisit) {
  if (v.precision === "month" && v.from) return formatMonthYear(v.from);
  if (v.precision === "day" && v.from) return tripDates(v.from, v.to ?? v.from);
  return String(v.year);
}

const norm = (s: string) => s.toLowerCase().trim();

/**
 * Everything found, to look over: richer versions of what's saved, then new
 * trips, then new events. All ticked; untick what isn't right. Nothing is
 * written until "Save".
 */
export function FinderReview({ findings, saving, error, onSave }: { findings: Findings; saving: boolean; error: string | null; onSave: (changes: Change[], skipped: string[]) => void }) {
  const reduce = useReducedMotion();
  const [off, setOff] = useState<Set<string>>(new Set());
  const [which, setWhich] = useState<Record<string, Which>>({});
  const [asking, setAsking] = useState<Extract<Suggestion, { kind: "which-trip" }> | null>(null);

  const all = findings.suggestions;
  const better = all.filter((s) => s.kind === "better-trip" || s.kind === "better-event" || s.kind === "which-trip");
  const newTrips = all.filter((s) => s.kind === "new-trip");
  const newEvents = all.filter((s) => s.kind === "new-event");

  const changes = useMemo(() => {
    const out: Change[] = [];
    for (const s of all) {
      if (off.has(s.key)) continue;
      if (s.kind === "better-trip") out.push({ kind: "trip-better", visit: s.visit, trip: s.trip, dates: s.dates, towns: s.towns });
      else if (s.kind === "which-trip") {
        const w = which[s.key];
        if (!w || w.pick === null) continue;
        const chosen = s.options[w.pick];
        const have = new Set(s.visit.cities.map(norm));
        out.push({ kind: "trip-better", visit: s.visit, trip: chosen.trip, dates: true, towns: chosen.towns.filter((t) => !have.has(norm(t.name))) });
        if (w.others) s.options.forEach((o, i) => i !== w.pick && out.push({ kind: "trip-new", trip: o.trip, towns: o.towns }));
      } else if (s.kind === "new-trip") out.push({ kind: "trip-new", trip: s.trip, towns: s.towns });
      else if (s.kind === "better-event") out.push({ kind: "event-better", saved: s.saved, changes: s.changes });
      else out.push({ kind: "event-new", event: s.event });
    }
    return out;
  }, [all, off, which]);

  function toggle(key: string) {
    tapLight();
    setOff((o) => {
      const n = new Set(o);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  const card = (s: Suggestion, i: number) => {
    const on = !off.has(s.key);
    const common = { index: i, on, onToggle: () => toggle(s.key) };
    if (s.kind === "which-trip") return <WhichCard key={s.key} {...common} s={s} which={which[s.key]} onAsk={() => setAsking(s)} />;
    if (s.kind === "better-trip" || s.kind === "new-trip") return <TripCard key={s.key} {...common} s={s} />;
    return <EventCard key={s.key} {...common} s={s} />;
  };

  const n = all.length;
  const matched = findings.matchedTrips + findings.matchedEvents;
  const label = saving ? "Saving…" : changes.length ? `Save ${changes.length} ${changes.length === 1 ? "change" : "changes"}` : "Nothing ticked";

  return (
    <div className="mx-auto max-w-md px-5 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-[calc(4.25rem+env(safe-area-inset-top))]">
      <motion.p className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        Discover my world
      </motion.p>
      <motion.h1 className="mt-2 font-serif text-[2rem] leading-[1.08]" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
        Your photos <span className="italic text-accent">found {n} {n === 1 ? "thing" : "things"}.</span>
      </motion.h1>
      <motion.p className="mt-2 text-[15px] text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
        Untick anything that isn&apos;t right. Nothing changes until you save.
      </motion.p>

      {better.length > 0 && (
        <Section title="Make better" note="already in ExpandiaX" start={0}>
          {better.map((s, i) => card(s, i))}
        </Section>
      )}
      {newTrips.length > 0 && (
        <Section title={newTrips.length === 1 ? "New trip" : "New trips"} start={better.length}>
          {newTrips.map((s, i) => card(s, better.length + i))}
        </Section>
      )}
      {newEvents.length > 0 && (
        <Section title={newEvents.length === 1 ? "New event" : "New events"} start={better.length + newTrips.length}>
          {newEvents.map((s, i) => card(s, better.length + newTrips.length + i))}
        </Section>
      )}

      {matched > 0 && (
        <motion.div
          className="mt-8 flex items-center gap-3 rounded-[22px] bg-emerald-50 px-4 py-3.5 text-emerald-900 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <CheckCircle2 size={22} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="text-sm leading-snug">
            <span className="font-semibold">{countLine(findings.matchedTrips, findings.matchedEvents)}</span> in your photos {matched === 1 ? "is" : "are"} already in ExpandiaX, just as {matched === 1 ? "it is" : "they are"}.
          </p>
        </motion.div>
      )}

      {/* Saving, always in reach */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-canvas via-canvas/95 to-transparent px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-10">
        <div className="mx-auto max-w-md">
          {error && <p className="mb-2 text-center text-sm text-accent">{error}</p>}
          <button
            type="button"
            disabled={saving || !changes.length}
            onClick={() => {
              tapSuccess();
              onSave(
                changes,
                all.filter((s) => off.has(s.key)).map((s) => s.key)
              );
            }}
            className="btn-accent flex w-full items-center justify-center gap-2 !rounded-full py-4 text-lg shadow-[0_14px_30px_-12px_rgba(250,81,162,0.75)] disabled:opacity-50 disabled:shadow-none"
          >
            {saving && <Loader2 size={20} className="animate-spin" aria-hidden />}
            {label}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {asking && (
          <WhichSheet
            s={asking}
            value={which[asking.key] ?? { pick: null, others: true }}
            onDone={(w) => {
              setWhich((all) => ({ ...all, [asking.key]: w }));
              setOff((o) => {
                const n = new Set(o);
                n.delete(asking.key);
                return n;
              });
              setAsking(null);
            }}
            onClose={() => setAsking(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function countLine(trips: number, events: number) {
  const t = trips ? `${trips} ${trips === 1 ? "trip" : "trips"}` : "";
  const e = events ? `${events} ${events === 1 ? "event" : "events"}` : "";
  return [t, e].filter(Boolean).join(" and ");
}

function Section({ title, note, start, children }: { title: string; note?: string; start: number; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <motion.h2
        className="mb-3 flex items-baseline gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 + Math.min(start, 6) * 0.06 }}
      >
        {title}
        {note && <span className="font-medium normal-case tracking-normal text-muted/80">· {note}</span>}
      </motion.h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

// ------------------------------------------------------------------ cards

function Shell({ index, on, photo, badge, onToggle, label, children }: { index: number; on: boolean; photo: StockPhoto | null; badge?: React.ReactNode; onToggle?: () => void; label: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`relative flex overflow-hidden rounded-[24px] bg-surface shadow-[0_10px_30px_-18px_rgba(43,11,46,0.35)] ring-1 ring-line transition-opacity duration-300 ${on ? "" : "opacity-55"}`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 22, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 230, damping: 24, delay: 0.25 + Math.min(index, 7) * 0.07 }}
    >
      <div className="relative w-[5.5rem] shrink-0 overflow-hidden" style={{ background: photo?.color ?? "#3a1240" }}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stockUrl(photo.raw, 200, "2:3", 70)} alt="" className={`absolute inset-0 h-full w-full object-cover transition-[filter] duration-300 ${on ? "" : "grayscale"}`} />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
        {badge && <span className="absolute bottom-2 left-2 text-xl drop-shadow">{badge}</span>}
      </div>
      <div className="min-w-0 flex-1 py-3.5 pl-4 pr-14">{children}</div>
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={on}
          aria-label={label}
          className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center"
        >
          <motion.span
            className={`flex h-8 w-8 items-center justify-center rounded-full ${on ? "bg-gradient-to-br from-[#fa51a2] to-[#fb7822] text-white shadow-md shadow-accent/30" : "bg-surface text-muted ring-[1.5px] ring-line"}`}
            animate={{ scale: on ? [0.8, 1.12, 1] : 1 }}
            transition={{ duration: 0.3 }}
          >
            {on ? <Check size={16} strokeWidth={3} /> : <Plus size={15} strokeWidth={2.5} />}
          </motion.span>
        </button>
      )}
    </motion.div>
  );
}

/** Place names as small chips: the new ones marked. */
function Towns({ towns, fresh }: { towns: TripTown[]; fresh?: boolean }) {
  if (!towns.length) return null;
  const shown = towns.slice(0, 4);
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {shown.map((t) => (
        <span key={t.name} className={`rounded-full px-2.5 py-1 text-xs font-medium ${fresh ? "bg-accent-3-soft text-accent-3" : "bg-raised text-ink/80"}`}>
          {fresh && "+ "}
          {t.name}
        </span>
      ))}
      {towns.length > shown.length && <span className="px-1 py-1 text-xs text-muted">+{towns.length - shown.length} more</span>}
    </div>
  );
}

function Before({ text }: { text: string }) {
  return <span className="text-sm text-muted line-through decoration-muted/60">{text}</span>;
}

function TripCard({ s, index, on, onToggle }: { s: Extract<Suggestion, { kind: "better-trip" | "new-trip" }>; index: number; on: boolean; onToggle: () => void }) {
  const c = countryByCode(s.trip.code);
  const photo = stockPhotoFor(s.trip.code, "finder");
  return (
    <Shell index={index} on={on} photo={photo} badge={c?.flag} onToggle={onToggle} label={`${c?.name}${s.kind === "new-trip" ? ", add this trip" : ", keep this change"}`}>
      <p className="flex flex-wrap items-center gap-2 font-serif text-[1.2rem] leading-tight">
        {c?.name}
        {s.kind === "new-trip" && s.newCountry && (
          <span className="rounded-full bg-gradient-to-r from-[#fa51a2] to-[#fb7822] px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-white">New country</span>
        )}
      </p>
      {s.kind === "better-trip" && s.dates ? (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[15px]">
          <Before text={savedWhen(s.visit)} />
          <ArrowRight size={13} className="text-muted" aria-hidden />
          <span className="font-medium">{tripDates(s.trip.from, s.trip.to)}</span>
        </p>
      ) : (
        <p className="mt-1 text-[15px]">
          <span className="font-medium">{tripDates(s.trip.from, s.trip.to)}</span>
          <span className="text-muted"> · {tripLength(s.trip.from, s.trip.to)}</span>
        </p>
      )}
      {s.kind === "better-trip" && !s.dates && <p className="mt-1 text-sm text-muted">{s.towns.length === 1 ? "A place it's missing" : "Places it's missing"}</p>}
      <Towns towns={s.towns} fresh={s.kind === "better-trip"} />
    </Shell>
  );
}

function EventCard({ s, index, on, onToggle }: { s: Extract<Suggestion, { kind: "better-event" | "new-event" }>; index: number; on: boolean; onToggle: () => void }) {
  const e = s.event;
  const c = countryByCode(e.code);
  const photo = eventStockPhoto(eventPhotoKind(e.type, e.title), e.title);
  const name = s.kind === "better-event" ? s.saved.title : e.artist ?? e.title;
  const where = [e.venue, e.city].filter(Boolean).join(", ");
  return (
    <Shell index={index} on={on} photo={photo} badge={c?.flag} onToggle={onToggle} label={`${name}${s.kind === "new-event" ? ", add this event" : ", keep this change"}`}>
      <p className="truncate font-serif text-[1.2rem] leading-tight">{name}</p>
      {s.kind === "better-event" ? (
        <div className="mt-1.5 space-y-1 text-[15px]">
          {s.changes.date ? (
            <p className="flex flex-wrap items-center gap-x-1.5">
              <Before text={formatDate(s.saved.date)} />
              <ArrowRight size={13} className="text-muted" aria-hidden />
              <span className="font-medium">{formatDate(s.changes.date)}</span>
            </p>
          ) : (
            <p className="font-medium">{formatDate(s.saved.date)}</p>
          )}
          {(s.changes.venue || s.changes.city) && (
            <p className="pt-0.5">
              <span className="inline-block rounded-2xl bg-accent-3-soft px-2.5 py-1 text-xs font-medium leading-snug text-accent-3">
                + {[s.changes.venue ?? s.saved.venue, s.changes.city ?? s.saved.city].filter(Boolean).join(", ")}
              </span>
            </p>
          )}
          {s.changes.artist && !s.changes.venue && !s.changes.date && <p className="text-sm text-muted">Linked to {s.changes.artist}</p>}
        </div>
      ) : (
        <>
          <p className="mt-1 text-[15px] font-medium">{formatDate(e.date)}</p>
          {where && <p className="mt-0.5 truncate text-sm text-muted">{where}</p>}
          {s.newCountry && <p className="mt-1.5 text-xs font-semibold text-accent">+ {c?.name} on your map</p>}
        </>
      )}
    </Shell>
  );
}

function WhichCard({ s, which, index, on, onToggle, onAsk }: { s: Extract<Suggestion, { kind: "which-trip" }>; which?: Which; index: number; on: boolean; onToggle: () => void; onAsk: () => void }) {
  const c = countryByCode(s.visit.code);
  const picked = which?.pick != null ? s.options[which.pick] : null;
  return (
    <Shell index={index} on={!!picked ? on : true} photo={stockPhotoFor(s.visit.code, "finder")} badge={c?.flag} onToggle={picked ? onToggle : undefined} label={`${c?.name}, keep this change`}>
      <p className="font-serif text-[1.2rem] leading-tight">
        {c?.name} · {savedWhen(s.visit)}
      </p>
      {picked ? (
        <>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[15px]">
            <Before text={savedWhen(s.visit)} />
            <ArrowRight size={13} className="text-muted" aria-hidden />
            <span className="font-medium">{tripDates(picked.trip.from, picked.trip.to)}</span>
          </p>
          {which?.others && s.options.length > 1 && (
            <p className="mt-1 text-xs font-semibold text-accent">
              + {s.options.length - 1} new {s.options.length === 2 ? "trip" : "trips"}
            </p>
          )}
          <button type="button" onClick={onAsk} className="mt-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline">
            Change
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">Your photos show {s.options.length} trips that year.</p>
          <button
            type="button"
            onClick={() => {
              tapLight();
              onAsk();
            }}
            className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-accent-soft px-3.5 py-2 text-sm font-semibold text-accent"
          >
            Which one? <ChevronRight size={15} aria-hidden />
          </button>
        </>
      )}
    </Shell>
  );
}

// ------------------------------------------------------------------ sheet

function WhichSheet({ s, value, onDone, onClose }: { s: Extract<Suggestion, { kind: "which-trip" }>; value: Which; onDone: (w: Which) => void; onClose: () => void }) {
  const [pick, setPick] = useState<number | null>(value.pick);
  const [others, setOthers] = useState(value.others);
  const c = countryByCode(s.visit.code);
  const rest = s.options.length - 1;
  const label = (t: FoundTrip) => tripDates(t.from, t.to);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="which-h"
        className="mx-auto w-full max-w-md rounded-t-[30px] bg-surface px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 ring-1 ring-line"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <h2 id="which-h" className="font-serif text-[1.65rem] leading-tight">
          Which one is your{" "}
          <span className="italic text-accent">
            {c?.name} {savedWhen(s.visit)}?
          </span>
        </h2>
        <p className="mt-1.5 text-sm text-muted">Its days and places go onto it.</p>

        <fieldset className="mt-5 space-y-2.5">
          <legend className="sr-only">Trips found</legend>
          {s.options.map((o, i) => (
            <label
              key={o.trip.id}
              className={`flex cursor-pointer items-center gap-3 rounded-[20px] p-4 ring-2 transition-colors ${pick === i ? "bg-accent-soft ring-accent" : "ring-line"}`}
            >
              <input
                type="radio"
                name="which"
                checked={pick === i}
                onChange={() => {
                  tapLight();
                  setPick(i);
                }}
                className="h-5 w-5 accent-[#fa51a2]"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label(o.trip)}</span>
                <span className="block truncate text-sm text-muted">{o.towns.slice(0, 3).map((t) => t.name).join(" · ") || tripLength(o.trip.from, o.trip.to)}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {rest > 0 && (
          <label className="mt-4 flex items-center gap-3 text-[15px]">
            <input type="checkbox" checked={others} onChange={(e) => setOthers(e.target.checked)} className="h-5 w-5 accent-[#fa51a2]" />
            {rest === 1 ? "Add the other one as a new trip too" : `Add the other ${rest} as new trips too`}
          </label>
        )}

        <button
          type="button"
          disabled={pick === null}
          onClick={() => {
            tapSuccess();
            onDone({ pick, others });
          }}
          className="btn-accent mt-6 w-full !rounded-full py-4 text-lg disabled:opacity-50"
        >
          Done
        </button>
      </motion.div>
    </motion.div>
  );
}
