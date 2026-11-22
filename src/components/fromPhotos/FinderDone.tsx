"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ImagePlus, ImagesIcon, RotateCcw } from "lucide-react";
import { countryByCode } from "@/lib/countries";
import { chooseMorePhotos } from "@/lib/photoScan";
import { tripDates } from "@/lib/tripFinder";
import { tapSuccess } from "@/lib/haptics";
import type { Applied, Findings } from "@/lib/memoryFinder";
import { Burst, CountUp } from "@/components/worldScan/Burst";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="h-[200px] w-full" />,
});

const EASE = [0.22, 1, 0.36, 1] as const;
const screen = "mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(4.5rem+env(safe-area-inset-top))]";

/** Saved: what changed, a moment to enjoy it, and where to go next. */
export function FinderDone({ applied, countryCodes, homeCode }: { applied: Applied; countryCodes: string[]; homeCode: string | null }) {
  const reduce = useReducedMotion();
  // The globe joins once the celebration has had its moment.
  const [globe, setGlobe] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGlobe(true), 900);
    const h = setTimeout(() => tapSuccess(), reduce ? 0 : 350);
    return () => {
      clearTimeout(t);
      clearTimeout(h);
    };
  }, [reduce]);

  const better = applied.betterTrips + applied.betterEvents;
  const tiles = [
    { value: applied.newTrips, label: applied.newTrips === 1 ? "new trip" : "new trips" },
    { value: applied.newEvents, label: applied.newEvents === 1 ? "new event" : "new events" },
    { value: better, label: "more detailed" },
  ].filter((t) => t.value > 0);
  const newNames = applied.newCountries.map((c) => countryByCode(c)).filter((c): c is NonNullable<typeof c> => !!c);
  const first = applied.firstNewTrip;
  const firstCountry = first ? countryByCode(first.code) : null;
  const rise = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay: reduce ? 0 : delay, ease: EASE },
  });

  return (
    <div className={screen}>
      <div className="relative mx-auto mt-2">
        <Burst delay={0.25} />
        <motion.span
          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#fa51a2] to-[#fb7822] text-white shadow-[0_18px_36px_-12px_rgba(250,81,162,0.7)]"
          initial={reduce ? { opacity: 0 } : { scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 13, delay: 0.1 }}
        >
          <Check size={38} strokeWidth={2.75} />
        </motion.span>
      </div>

      <motion.h1 {...rise(0.35)} className="mt-6 text-center font-serif text-[2.1rem] leading-[1.08]">
        Your story, <span className="italic text-accent">a little more complete.</span>
      </motion.h1>

      {tiles.length > 0 && (
        <motion.div {...rise(0.55)} className={`mt-7 grid gap-2.5 ${tiles.length === 3 ? "grid-cols-3" : tiles.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
          {tiles.map((t, i) => (
            <div key={t.label} className="rounded-[20px] bg-surface px-2 py-4 text-center shadow-sm ring-1 ring-line">
              <p className="font-serif text-3xl font-semibold">
                {t.label === "more detailed" ? "" : "+"}
                <CountUp value={t.value} duration={1} delay={0.7 + i * 0.15} />
              </p>
              <p className="mt-0.5 text-xs text-muted">{t.label}</p>
            </div>
          ))}
        </motion.div>
      )}

      {newNames.length > 0 && (
        <motion.div {...rise(0.8)} className="mt-6">
          <div className="pointer-events-none mx-auto h-[min(200px,22dvh)] w-[min(250px,28dvh)]">
            {globe && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
                <WorldGlobeInner
                  visitedCodes={[...new Set([...countryCodes, ...applied.newCountries])]}
                  homeCode={homeCode ?? undefined}
                  focusCode={applied.newCountries[0]}
                  interactive={false}
                  labels={false}
                />
              </motion.div>
            )}
          </div>
          <p className="mt-2 text-center text-[15px]">
            {newNames.map((c) => c.flag).join(" ")} <span className="font-semibold">{listNames(newNames.map((c) => c.name))}</span> {newNames.length === 1 ? "is" : "are"} on your map now.
          </p>
        </motion.div>
      )}

      {first && firstCountry && (
        <motion.div {...rise(1)}>
          <Link
            href={`/my-world/${first.code.toLowerCase()}`}
            className="mt-6 flex items-center gap-3.5 rounded-[22px] bg-surface p-4 shadow-sm ring-1 ring-line transition-colors hover:ring-accent"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-3-soft text-accent-3">
              <ImagePlus size={20} aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-[15px] leading-snug">
              Add your own photos to <span className="font-semibold">{firstCountry.name}</span>
              <span className="block text-sm text-muted">{tripDates(first.from, first.to)}</span>
            </span>
            <span className="text-sm font-semibold text-accent">Add</span>
          </Link>
        </motion.div>
      )}

      <motion.div {...rise(1.15)} className="mt-auto pt-8 text-center">
        <Link href="/my-world" className="btn-accent flex w-full items-center justify-center !rounded-full py-4 text-lg">
          See my world
        </Link>
        <p className="mt-3 text-xs text-muted">Find more any time: + › From my photos</p>
      </motion.div>
    </div>
  );
}

function listNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Nothing new: that's good news too. */
export function FinderQuiet({ findings, limited, onAgain, onDone }: { findings: Findings; limited: boolean; onAgain: () => void; onDone: () => void }) {
  const reduce = useReducedMotion();
  const trips = findings.matchedTrips;
  const events = findings.matchedEvents;
  const all = [trips ? `${trips} ${trips === 1 ? "trip" : "trips"}` : "", events ? `${events} ${events === 1 ? "event" : "events"}` : ""].filter(Boolean).join(" and ");
  return (
    <div className={screen}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.span
          className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/60"
          initial={reduce ? { opacity: 0 } : { scale: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 14 }}
        >
          <Check size={36} strokeWidth={2.75} />
        </motion.span>
        <h1 className="mt-6 font-serif text-[2.1rem] leading-[1.08]">
          Your world is <span className="italic text-accent">up to date.</span>
        </h1>
        <p className="mt-3 max-w-xs text-[15px] text-muted">
          {all ? `Everything in your photos (${all}) is already in ExpandiaX.` : "No trips or events with a place saved turned up in your photos."}
        </p>
      </div>
      <div className="space-y-3 pt-8">
        {limited && (
          <button
            type="button"
            onClick={async () => {
              await chooseMorePhotos().catch(() => {});
              onAgain();
            }}
            className="btn-ghost flex w-full items-center justify-center gap-2 !rounded-full py-4 text-base"
          >
            <ImagesIcon size={18} aria-hidden /> Share more photos
          </button>
        )}
        <button type="button" onClick={onDone} className="btn-accent w-full !rounded-full py-4 text-lg">
          Done
        </button>
        {!limited && (
          <button type="button" onClick={onAgain} className="mx-auto flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <RotateCcw size={14} aria-hidden /> Look again
          </button>
        )}
      </div>
    </div>
  );
}
