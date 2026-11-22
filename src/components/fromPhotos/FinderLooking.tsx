"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Lock, Sparkles } from "lucide-react";
import type { Findings } from "@/lib/memoryFinder";

export type Stage = "photos" | "events" | "matching" | "found";

const EASE = [0.22, 1, 0.36, 1] as const;
const STEPS: { stage: Exclude<Stage, "found">; label: string }[] = [
  { stage: "photos", label: "Looking through your photos" },
  { stage: "events", label: "Checking concerts, matches and races" },
  { stage: "matching", label: "Comparing with what you've saved" },
];
const ORDER: Stage[] = ["photos", "events", "matching", "found"];

const R = 88;
const C = 2 * Math.PI * R;

/** How far along, all of it: the photos are most of the wait. */
function overall(stage: Stage, done: number, total: number) {
  if (stage === "photos") return total ? 0.04 + 0.66 * (done / total) : 0.04;
  if (stage === "events") return 0.82;
  if (stage === "matching") return 0.94;
  return 1;
}

export function counts(f: Findings) {
  const better = f.suggestions.filter((s) => s.kind === "better-trip" || s.kind === "better-event" || s.kind === "which-trip").length;
  const trips = f.suggestions.filter((s) => s.kind === "new-trip").length;
  const events = f.suggestions.filter((s) => s.kind === "new-event").length;
  return { better, trips, events };
}

export function FinderLooking({
  stage,
  progress,
  findings,
  onSkipWait,
}: {
  stage: Stage;
  progress: { done: number; total: number; located: number };
  findings: Findings | null;
  onSkipWait: () => void;
}) {
  const reduce = useReducedMotion();
  const at = ORDER.indexOf(stage);
  const found = stage === "found" && findings;
  const c = findings ? counts(findings) : null;
  const chips = c
    ? [
        c.better ? `${c.better} to make better` : null,
        c.trips ? `${c.trips} new ${c.trips === 1 ? "trip" : "trips"}` : null,
        c.events ? `${c.events} new ${c.events === 1 ? "event" : "events"}` : null,
      ].filter((x): x is string => !!x)
    : [];

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(4rem+env(safe-area-inset-top))]">
      {/* The ring and what's happening, in the middle of the screen */}
      <div className="flex flex-1 flex-col justify-center pb-6">
      <div className="relative mx-auto h-[220px] w-[220px]">
        {/* A slow halo turning behind the ring */}
        <motion.div
          aria-hidden
          className="absolute inset-3 rounded-full opacity-60 blur-2xl [background:conic-gradient(from_0deg,#fa51a2,#fb7822,#7c5cff,#fa51a2)]"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-[18px] rounded-full bg-canvas" />
        <svg viewBox="0 0 220 220" className="absolute inset-0 -rotate-90" role="img" aria-label={`${Math.round(overall(stage, progress.done, progress.total) * 100)} percent done`}>
          <defs>
            <linearGradient id="finder-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fa51a2" />
              <stop offset="1" stopColor="#fb7822" />
            </linearGradient>
          </defs>
          <circle cx="110" cy="110" r={R} fill="none" className="stroke-line" strokeWidth="10" />
          <motion.circle
            cx="110"
            cy="110"
            r={R}
            fill="none"
            stroke="url(#finder-ring)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            animate={{ strokeDashoffset: C * (1 - overall(stage, progress.done, progress.total)) }}
            transition={{ duration: 0.8, ease: EASE }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <AnimatePresence mode="wait" initial={false}>
            {found ? (
              <motion.div key="found" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 240, damping: 15 }} className="flex flex-col items-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#fa51a2] to-[#fb7822] text-white shadow-lg shadow-accent/30">
                  <Sparkles size={26} />
                </span>
                <span className="mt-2 font-serif text-2xl">{findings.suggestions.length ? `${findings.suggestions.length} ${findings.suggestions.length === 1 ? "thing" : "things"}` : "All there"}</span>
              </motion.div>
            ) : stage === "photos" ? (
              <motion.div key="photos" exit={{ opacity: 0 }} className="flex flex-col items-center">
                <span className="font-serif text-[2.6rem] font-semibold leading-none tabular-nums">{progress.done.toLocaleString("en-GB")}</span>
                <span className="mt-1.5 text-sm text-muted">{progress.total ? `of ${progress.total.toLocaleString("en-GB")} photos` : "photos"}</span>
              </motion.div>
            ) : (
              <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-1.5" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-2.5 w-2.5 rounded-full bg-accent"
                    animate={reduce ? undefined : { y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {found ? (
          <motion.div key="chips" className="mt-10 flex flex-col items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h1 className="text-center font-serif text-3xl leading-tight">
              {findings.suggestions.length ? (
                <>
                  Look what <span className="italic text-accent">your photos remembered.</span>
                </>
              ) : (
                <>
                  Your world is <span className="italic text-accent">up to date.</span>
                </>
              )}
            </h1>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {chips.map((t, i) => (
                <motion.span
                  key={t}
                  className="rounded-full bg-surface px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-line"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.25 + i * 0.14 }}
                >
                  {t}
                </motion.span>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.ol key="steps" className="mx-auto mt-10 w-full max-w-xs space-y-4" exit={{ opacity: 0 }}>
            {STEPS.map((s, i) => {
              const state = i < at ? "done" : i === at ? "now" : "later";
              return (
                <li key={s.stage} className={`flex items-center gap-3 text-[15px] transition-colors duration-500 ${state === "later" ? "text-muted/60" : state === "now" ? "font-medium text-ink" : "text-muted"}`}>
                  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                    {state === "done" ? (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }} className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#fa51a2] to-[#fb7822] text-white">
                        <Check size={15} strokeWidth={3} />
                      </motion.span>
                    ) : state === "now" ? (
                      <>
                        <motion.span className="absolute inset-0 rounded-full bg-accent/30" animate={reduce ? undefined : { scale: [1, 1.5], opacity: [0.7, 0] }} transition={{ duration: 1.3, repeat: Infinity }} />
                        <span className="h-3 w-3 rounded-full bg-accent" />
                      </>
                    ) : (
                      <span className="h-2.5 w-2.5 rounded-full bg-line" />
                    )}
                  </span>
                  {s.label}
                </li>
              );
            })}
          </motion.ol>
        )}
      </AnimatePresence>
      </div>

      <div className="pt-4 text-center">
        {found && findings.suggestions.length > 0 ? (
          <button type="button" onClick={onSkipWait} className="btn-accent w-full !rounded-full py-4 text-lg">
            See them
          </button>
        ) : (
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
            <Lock size={13} aria-hidden /> Your photos stay on your phone.
          </p>
        )}
      </div>
    </div>
  );
}
