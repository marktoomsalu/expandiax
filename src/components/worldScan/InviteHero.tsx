"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Lock, Sparkles } from "lucide-react";
import { stockPhotoFor, stockUrl, type StockPhoto } from "@/lib/stockPhotos";
import { ExternalLink } from "@/components/ExternalLink";

// The wall: three columns of travel photos (curated Unsplash, credited
// below), each drifting at its own pace.
const COLUMNS = [
  ["JP", "IS", "MA", "PE", "NZ", "TR"],
  ["IT", "NO", "TZ", "VN", "AU", "GR"],
  ["PT", "CH", "MX", "TH", "ZA", "CU"],
];

// What adds up, one after another: countries, and every kind of memory.
const TALLY: { emoji: string; label: string; kind: "country" | "memory" }[] = [
  { emoji: "🇯🇵", label: "Japan", kind: "country" },
  { emoji: "🎤", label: "A concert", kind: "memory" },
  { emoji: "🇮🇸", label: "Iceland", kind: "country" },
  { emoji: "⚽", label: "A match", kind: "memory" },
  { emoji: "🎪", label: "A festival", kind: "memory" },
  { emoji: "🇵🇪", label: "Peru", kind: "country" },
  { emoji: "🏃", label: "A marathon", kind: "memory" },
  { emoji: "🇮🇹", label: "Italy", kind: "country" },
  { emoji: "🎓", label: "A conference", kind: "memory" },
];

/**
 * The first screen of "Find my world": a wall of travel photos drifting by,
 * countries and memories adding up over it, and one button. It should feel
 * like a game you want to play: see in seconds how big your world is.
 */
export function InviteHero({ mode, error, onStart, onManual }: { mode: "new" | "member"; error: string | null; onStart: () => void; onManual: () => void }) {
  const reduce = useReducedMotion();
  const columns = useMemo(() => COLUMNS.map((col) => col.map((cc, i) => stockPhotoFor(cc, `invite${i}`)).filter((p): p is StockPhoto => !!p)), []);
  const credits = useMemo(() => [...new Map(columns.flat().map((p) => [p.author, p])).values()], [columns]);
  const [showCredits, setShowCredits] = useState(false);

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#14051a]">
      {/* The wall */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[72dvh] overflow-hidden">
        <div className="absolute -inset-x-16 -top-24 bottom-0 flex -rotate-[8deg] gap-3 opacity-90">
          {columns.map((col, c) => (
            <motion.div
              key={c}
              className="flex flex-1 flex-col gap-3"
              animate={reduce ? undefined : { y: c % 2 ? ["-50%", "0%"] : ["0%", "-50%"] }}
              transition={{ duration: 46 + c * 9, repeat: Infinity, ease: "linear" }}
            >
              {[...col, ...col].map((p, i) => (
                <div key={i} className="relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.45)]" style={{ background: p.color }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stockUrl(p.raw, 360, "3:4", 70)} alt="" className="h-full w-full object-cover" loading={i < 3 ? "eager" : "lazy"} />
                </div>
              ))}
            </motion.div>
          ))}
        </div>
        {/* Into the night at the bottom, so the words read */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,5,26,0.55)_0%,rgba(20,5,26,0.05)_25%,rgba(20,5,26,0.25)_55%,#14051a_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(250,81,162,0.25),transparent_60%)]" />
      </div>

      {/* What adds up */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 pt-[calc(2rem+env(safe-area-inset-top))]">
        <Tally />
      </div>

      {/* The words and the button */}
      <div className="relative z-10 mx-auto w-full max-w-md px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <motion.h1
          className="text-center font-serif text-[2.6rem] leading-[1.05]"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
        >
          {mode === "new" ? (
            <>
              How big is <span className="italic text-[#ff8cc6]">your world?</span>
            </>
          ) : (
            <>
              What&apos;s <span className="italic text-[#ff8cc6]">missing</span> from your map?
            </>
          )}
        </motion.h1>
        <motion.p className="mt-3 text-center text-base leading-relaxed text-white/75" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.7 }}>
          Countries, trips, concerts, matches, festivals: all added up from your photos, in seconds.
        </motion.p>
        {error && <p className="mt-3 text-center text-sm text-[#ffb3b3]">{error}</p>}

        <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.6 }} className="mt-7">
          <motion.button
            type="button"
            onClick={onStart}
            className="btn-accent relative w-full overflow-hidden py-4 text-lg shadow-[0_14px_40px_-10px_rgba(250,81,162,0.8)]"
            whileTap={{ scale: 0.97 }}
          >
            {!reduce && (
              <motion.span
                aria-hidden
                className="absolute inset-y-0 w-16 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                initial={{ x: -120 }}
                animate={{ x: 480 }}
                transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}
              />
            )}
            <span className="relative inline-flex items-center gap-2">
              <Sparkles size={20} aria-hidden /> {mode === "new" ? "Count my world" : "Find them"}
            </span>
          </motion.button>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-white/55">
            <Lock size={12} aria-hidden /> Your photos stay on your phone
          </p>
          <div className="mt-2 flex items-center justify-center gap-4 text-sm">
            <button type="button" onClick={onManual} className="text-white/55 hover:text-white">
              {mode === "new" ? "Add it myself" : "Not now"}
            </button>
          </div>
          <div className="mt-3 text-center">
            <button type="button" onClick={() => setShowCredits((v) => !v)} className="text-[10px] text-white/35 hover:text-white/60">
              Photos: Unsplash
            </button>
            {showCredits && (
              <p className="mt-1 text-[10px] leading-relaxed text-white/45">
                {credits.map((p, i) => (
                  <span key={p.author}>
                    <ExternalLink href={p.authorUrl} className="underline-offset-2 hover:underline">
                      {p.author}
                    </ExternalLink>
                    {i < credits.length - 1 ? ", " : ""}
                  </span>
                ))}{" "}
                on{" "}
                <ExternalLink href={credits[0]?.unsplashUrl ?? "https://unsplash.com"} className="underline-offset-2 hover:underline">
                  Unsplash
                </ExternalLink>
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/** Countries and memories adding up, like notifications: the last three, newest on top, with the running total. */
function Tally() {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? TALLY.length : 0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setN((x) => (x >= TALLY.length + 3 ? 0 : x + 1)), 1100);
    return () => clearInterval(t);
  }, [reduce]);
  const shown = TALLY.slice(0, Math.min(n, TALLY.length));
  const countries = shown.filter((t) => t.kind === "country").length;
  const memories = shown.length - countries;

  return (
    <div className="flex w-full max-w-xs flex-col items-center">
      <motion.p className="mb-3 rounded-full bg-black/35 px-4 py-1.5 text-sm text-white/90 ring-1 ring-white/15 backdrop-blur-md" layout>
        🌍 <span className="font-semibold tabular-nums">{countries}</span> {countries === 1 ? "country" : "countries"} ·{" "}
        <span className="font-semibold tabular-nums">{memories}</span> {memories === 1 ? "memory" : "memories"}
      </motion.p>
      <div className="relative h-[156px] w-full">
        <AnimatePresence initial={false}>
          {shown
            .slice(-3)
            .reverse()
            .map((t, i) => (
              <motion.div
                key={t.label}
                layout
                className="absolute inset-x-0 flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 text-[#2b0b2e] shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl"
                style={{ top: i * 52, zIndex: 3 - i }}
                initial={{ opacity: 0, y: -24, scale: 0.9 }}
                animate={{ opacity: 1 - i * 0.22, y: 0, scale: 1 - i * 0.04 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
              >
                <span className="text-2xl" aria-hidden>
                  {t.emoji}
                </span>
                <span className="flex-1 font-medium">{t.label}</span>
                <span className="rounded-full bg-gradient-to-r from-[#fa51a2] to-[#fb7822] px-2.5 py-0.5 text-xs font-bold text-white">+1</span>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
