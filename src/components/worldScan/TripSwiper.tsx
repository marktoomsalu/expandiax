"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "framer-motion";
import { Heart, Undo2, X } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { photoThumbs } from "@/lib/photoScan";
import { tripDates, tripLength, type FoundTrip } from "@/lib/tripFinder";
import type { KeptTrip } from "@/lib/worldScan";
import { tapLight, tapSuccess } from "@/lib/haptics";

const THROW = 110;

/**
 * Each trip found, as a card with its best photo: swipe right (or ♥) to keep
 * it, left (or ✕) to skip. Kept trips fly up into the world above, which
 * grows as they go. "Keep the rest" for anyone with a long past.
 */
export function TripSwiper({ trips, homeCode, onDone }: { trips: FoundTrip[]; homeCode: string | null; onDone: (kept: KeptTrip[]) => void }) {
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<boolean[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [leaving, setLeaving] = useState<"keep" | "skip" | null>(null);
  const [pulse, setPulse] = useState(0);

  const keptTrips = trips.filter((_, i) => decisions[i]);
  const keptCountries = new Set([...(homeCode ? [homeCode] : []), ...keptTrips.map((t) => t.code)]);

  // The card on top and the next few, made on the phone ahead of time.
  useEffect(() => {
    const ids = trips.slice(index, index + 4).flatMap((t, i) => (i === 0 ? t.covers.slice(0, 4) : t.covers.slice(0, 1)));
    let alive = true;
    void photoThumbs(ids, 900).then((got) => alive && setThumbs((prev) => ({ ...prev, ...got })));
    return () => {
      alive = false;
    };
  }, [index, trips]);

  function decide(keep: boolean) {
    if (index >= trips.length || leaving) return;
    if (keep) {
      tapSuccess();
      setPulse((p) => p + 1);
    } else tapLight();
    setLeaving(keep ? "keep" : "skip");
    const next = [...decisions];
    next[index] = keep;
    setDecisions(next);
    setTimeout(() => {
      setLeaving(null);
      if (index + 1 >= trips.length) onDone(toKept(trips.filter((_, i) => next[i])));
      else setIndex(index + 1);
    }, 260);
  }

  function undo() {
    if (index === 0 || leaving) return;
    tapLight();
    setIndex(index - 1);
    setDecisions(decisions.slice(0, index - 1));
  }

  function keepRest() {
    tapSuccess();
    const all = trips.map((_, i) => (i < index ? decisions[i] : true));
    onDone(toKept(trips.filter((_, i) => all[i])));
  }

  const trip = trips[index];
  const left = trips.length - index;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
      {/* Your world so far */}
      <div className="flex items-center justify-between py-3">
        <motion.div
          key={pulse}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm ring-1 ring-white/15"
          initial={pulse ? { scale: 1.18, backgroundColor: "rgba(250,81,162,0.55)" } : false}
          animate={{ scale: 1, backgroundColor: "rgba(255,255,255,0.1)" }}
          transition={{ duration: 0.6 }}
        >
          <span aria-hidden>🌍</span>
          <span>
            <span className="font-semibold">{keptCountries.size}</span> {keptCountries.size === 1 ? "country" : "countries"} ·{" "}
            <span className="font-semibold">{keptTrips.length}</span> {keptTrips.length === 1 ? "trip" : "trips"}
          </span>
        </motion.div>
        <span className="text-sm text-white/60">
          {Math.min(index + 1, trips.length)} of {trips.length}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-[#fa51a2] to-[#fb7822]" animate={{ width: `${(index / trips.length) * 100}%` }} />
      </div>

      {/* The stack */}
      <div className="relative mt-5 flex-1">
        {trips.slice(index + 1, index + 3).map((t, i) => (
          <div
            key={t.id}
            aria-hidden
            className="absolute inset-0 overflow-hidden rounded-[28px] bg-[#3a1240] ring-1 ring-white/10"
            style={{ transform: `translateY(${(i + 1) * 10}px) scale(${1 - (i + 1) * 0.04})`, zIndex: 1 - i, opacity: 1 - (i + 1) * 0.25 }}
          >
            {thumbs[t.covers[0]] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbs[t.covers[0]]} alt="" className="h-full w-full object-cover opacity-60" />
            )}
          </div>
        ))}
        <AnimatePresence>
          {trip && <Card key={trip.id} trip={trip} thumbs={thumbs} leaving={leaving} onDecide={decide} />}
        </AnimatePresence>
      </div>

      {/* Buttons */}
      <div className="mt-6 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={undo}
          disabled={index === 0}
          aria-label="Back to the last trip"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/15 disabled:opacity-30"
        >
          <Undo2 size={18} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => decide(false)}
          aria-label="Skip this trip"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/25 active:scale-95"
        >
          <X size={28} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => decide(true)}
          aria-label="Keep this trip"
          className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#fa51a2] to-[#fb7822] text-white shadow-[0_10px_30px_-6px_rgba(250,81,162,0.7)] active:scale-95"
        >
          <Heart size={32} fill="currentColor" aria-hidden />
        </button>
        <span className="w-11" aria-hidden />
      </div>
      <div className="mt-4 h-5 text-center">
        {left > 1 && (index >= 2 || trips.length > 8) && (
          <button type="button" onClick={keepRest} className="text-sm text-white/60 hover:text-white">
            Keep the other {left} trips
          </button>
        )}
      </div>
    </div>
  );
}

function toKept(list: FoundTrip[]): KeptTrip[] {
  return list.map((t) => ({ code: t.code, from: t.from, to: t.to, kind: t.kind, covers: t.covers }));
}

function Card({
  trip,
  thumbs,
  leaving,
  onDecide,
}: {
  trip: FoundTrip;
  thumbs: Record<string, string>;
  leaving: "keep" | "skip" | null;
  onDecide: (keep: boolean) => void;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-14, 0, 14]);
  const keepOpacity = useTransform(x, [20, THROW], [0, 1]);
  const skipOpacity = useTransform(x, [-THROW, -20], [1, 0]);
  const [photo, setPhoto] = useState(0);
  const country = countryByCode(trip.code);
  const extra = trip.covers.slice(1, 4).filter((id) => thumbs[id]);
  const shown = [trip.covers[0], ...extra];
  const src = thumbs[shown[photo % shown.length]];

  // Buttons move the card the same way a swipe does.
  useEffect(() => {
    if (!leaving || reduce) return;
    void animate(x, leaving === "keep" ? 420 : -420, { duration: 0.26, ease: "easeIn" });
  }, [leaving, reduce, x]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > THROW || info.velocity.x > 600) onDecide(true);
    else if (info.offset.x < -THROW || info.velocity.x < -600) onDecide(false);
    else void animate(x, 0, { type: "spring", stiffness: 400, damping: 28 });
  }

  return (
    <motion.div
      className="absolute inset-0 z-10 cursor-grab touch-pan-y overflow-hidden rounded-[28px] bg-[#3a1240] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/15 active:cursor-grabbing"
      style={{ x, rotate }}
      drag={reduce ? false : "x"}
      dragSnapToOrigin={false}
      onDragEnd={onDragEnd}
      initial={reduce ? { opacity: 0 } : { scale: 0.94, y: 10, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={leaving === "keep" && !reduce ? { y: -320, scale: 0.3, opacity: 0, transition: { duration: 0.35 } } : { opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35 }}
    >
      {/* The photo: tap to see the next of the trip's best */}
      <button
        type="button"
        className="absolute inset-0 block h-full w-full"
        aria-label={shown.length > 1 ? "Next photo from this trip" : undefined}
        tabIndex={shown.length > 1 ? 0 : -1}
        onClick={() => shown.length > 1 && setPhoto((p) => p + 1)}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" draggable={false} className="h-full w-full select-none object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#5a1758] to-[#2b0b2e] text-8xl">
            <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.6, repeat: Infinity }} aria-hidden>
              {country?.flag}
            </motion.span>
          </span>
        )}
      </button>

      {shown.length > 1 && (
        <div className="pointer-events-none absolute inset-x-4 top-3 flex gap-1">
          {shown.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i === photo % shown.length ? "bg-white" : "bg-white/35"}`} />
          ))}
        </div>
      )}

      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

      {/* KEEP / SKIP stamps while dragging */}
      <motion.span
        aria-hidden
        style={{ opacity: keepOpacity }}
        className="pointer-events-none absolute left-5 top-10 -rotate-12 rounded-xl border-4 border-[#7dffb2] px-3 py-1 text-3xl font-extrabold tracking-wider text-[#7dffb2]"
      >
        KEEP
      </motion.span>
      <motion.span
        aria-hidden
        style={{ opacity: skipOpacity }}
        className="pointer-events-none absolute right-5 top-10 rotate-12 rounded-xl border-4 border-white/80 px-3 py-1 text-3xl font-extrabold tracking-wider text-white/80"
      >
        SKIP
      </motion.span>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-6 text-left">
        {trip.kind === "lived" && (
          <span className="mb-2 inline-block rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">Lived here</span>
        )}
        <p className="font-serif text-4xl leading-tight drop-shadow-md">
          <span aria-hidden>{country?.flag}</span> {country?.name}
        </p>
        <p className="mt-1.5 text-base text-white/90">{tripDates(trip.from, trip.to)}</p>
        <p className="mt-1 text-sm text-white/70">
          {tripLength(trip.from, trip.to)} · {trip.photos.toLocaleString("en-GB")} {trip.photos === 1 ? "photo" : "photos"}
          {trip.favourites > 0 ? ` · ${trip.favourites} ♥` : ""}
        </p>
      </div>
    </motion.div>
  );
}
