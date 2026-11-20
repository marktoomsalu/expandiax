"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { countryByCode } from "@/lib/countries";
import type { FoundWorld } from "@/lib/tripFinder";
import type { FoundEvent } from "@/lib/worldStory";
import { tapLight, tapSuccess } from "@/lib/haptics";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full" />,
});

/**
 * The globe wakes up: dark while the photos are searched, then one country
 * after another lights up in the order they were first visited, the years
 * rolling by, a small tap for each, until the whole world is there.
 */
export function ScanAwakening({
  scanning,
  progress,
  world,
  events,
  onDone,
}: {
  scanning: boolean;
  progress: { done: number; total: number; located: number };
  world: FoundWorld | null;
  /** Events found so far (null while still looking). */
  events: FoundEvent[] | null;
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const order = useMemo(() => world?.countries ?? [], [world]);
  const [shown, setShown] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // One country at a time; quicker when there are many, so it never drags.
  useEffect(() => {
    if (!world) return;
    if (reduce || order.length === 0) {
      setShown(order.length);
      const t = setTimeout(() => doneRef.current(), 600);
      return () => clearTimeout(t);
    }
    const step = Math.max(320, Math.min(1100, 9000 / order.length));
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      i += 1;
      setShown(i);
      tapLight();
      if (i < order.length) t = setTimeout(next, step);
      else {
        tapSuccess();
        t = setTimeout(() => doneRef.current(), 1400);
      }
    };
    t = setTimeout(next, 900);
    return () => clearTimeout(t);
  }, [world, order, reduce]);

  const lit = order.slice(0, shown).map((c) => c.code);
  const current = shown > 0 ? order[shown - 1] : null;
  const country = current ? countryByCode(current.code) : null;
  const year = current ? current.firstDay.slice(0, 4) : null;
  const slow = order.length <= 14;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(3.5rem+env(safe-area-inset-top))] text-center">
      <div className="h-24">
        <AnimatePresence mode="popLayout">
          {scanning || !year ? (
            <motion.p key="looking" className="pt-6 font-serif text-2xl text-white/90" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              Looking through your photos…
            </motion.p>
          ) : (
            <motion.p
              key={year}
              className="font-serif text-7xl font-semibold tracking-tight text-white"
              initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -30, filter: "blur(6px)" }}
              transition={{ duration: 0.45 }}
            >
              {year}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="relative w-full">
        {/* A slow pulse behind the globe while it searches */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fa51a2] blur-3xl"
          animate={{ opacity: scanning ? [0.12, 0.32, 0.12] : 0.22, scale: scanning ? [0.85, 1.05, 0.85] : 1 }}
          transition={{ duration: 2.2, repeat: scanning ? Infinity : 0 }}
        />
        <div className="relative">
          <WorldGlobeInner
            visitedCodes={lit}
            homeCode={world?.homeCode ?? undefined}
            interactive={false}
            labels={false}
            autoRotate={scanning || !slow}
            focusCode={!scanning && slow ? current?.code : undefined}
          />
        </div>
      </div>

      <div className="mt-2 h-28 w-full">
        {scanning ? (
          <div className="mx-auto max-w-xs">
            <p className="text-sm text-white/70">
              {progress.total ? `${progress.done.toLocaleString("en-GB")} of ${progress.total.toLocaleString("en-GB")} photos` : "Opening your library…"}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[#fa51a2] to-[#fb7822]" animate={{ width: `${Math.max(4, pct)}%` }} transition={{ ease: "easeOut" }} />
            </div>
          </div>
        ) : (
          <>
            <AnimatePresence mode="popLayout">
              {country && (
                <motion.div
                  key={country.code}
                  className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-lg ring-1 ring-white/20 backdrop-blur"
                  initial={{ opacity: 0, scale: 0.6, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -10 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                >
                  <span aria-hidden>{country.flag}</span>
                  <span className="font-medium">{country.name}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <p className="mt-4 text-sm text-white/70">
              <span className="font-semibold text-white">{lit.length + (world?.homeCode ? 1 : 0)}</span> {lit.length + (world?.homeCode ? 1 : 0) === 1 ? "country" : "countries"}
              <AnimatePresence>
                {!!events?.length && (
                  <motion.span key="ev" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }} className="inline-block">
                    &nbsp;·&nbsp;🎫 <span className="font-semibold text-white">{events.length}</span> {events.length === 1 ? "event" : "events"}
                  </motion.span>
                )}
              </AnimatePresence>
            </p>
          </>
        )}
      </div>

      {!scanning && world && shown < order.length && (
        <button
          type="button"
          onClick={() => {
            setShown(order.length);
            onDone();
          }}
          className="mt-auto text-sm text-white/50 hover:text-white"
        >
          Skip
        </button>
      )}
    </div>
  );
}
