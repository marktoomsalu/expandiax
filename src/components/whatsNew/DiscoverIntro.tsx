"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Image as ImageIcon, Lock, MapPin, Music2, Sparkles, Video } from "lucide-react";

// What goes in: the camera roll (pictures, videos, places, sound), drifting
// into the core from all round it.
const TILES = [
  { icon: ImageIcon, x: -128, y: -96, d: 0 },
  { icon: Video, x: 132, y: -84, d: 0.7 },
  { icon: MapPin, x: -138, y: 74, d: 1.4 },
  { icon: Music2, x: 126, y: 96, d: 2.1 },
  { icon: Video, x: 8, y: -150, d: 2.8 },
  { icon: ImageIcon, x: -10, y: 152, d: 3.5 },
];

// What comes out: memories found, one after another (an illustration, not anyone's own).
const FOUND = ["🇵🇹 Portugal · 2023", "🎤 Concert · Oslo", "🇯🇵 Japan · 9 days", "⚽ Match · London", "🇮🇹 Italy · 2025", "🎪 Festival · Tallinn"];
const SPOTS = [{ y: -128 }, { y: 128 }];

/**
 * 1.2's "What's new", full screen and centred: Discover my world, shown
 * rather than told. A glowing core does the work: the camera roll streams
 * in, a scan sweeps the rings round it, ripples go out, and memories it
 * found pop out one by one. A title, two short lines, the button.
 */
export function DiscoverIntro({ onStart, onLater }: { onStart: () => void; onLater: () => void }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  // The scene is drawn at 320px and scaled to the room a small phone has.
  const [fit, setFit] = useState(1);
  useEffect(() => {
    const size = () => setFit(Math.min(1, (window.innerHeight * 0.42) / 320));
    size();
    window.addEventListener("resize", size);
    return () => window.removeEventListener("resize", size);
  }, []);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setN((i) => i + 1), 1500);
    return () => clearInterval(t);
  }, [reduce]);

  const rise = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay: reduce ? 0 : delay, ease: [0.22, 1, 0.36, 1] as const },
  });
  const found = FOUND[n % FOUND.length];
  const spot = SPOTS[n % SPOTS.length];

  return (
    <div
      className="fixed inset-0 z-[96] overflow-hidden text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discover-h"
      style={{ background: "radial-gradient(90% 60% at 50% 36%, #3b0f45 0%, #1c0626 45%, #08020c 100%)" }}
    >
      {/* A faint grid fading out from the core. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,140,198,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,140,198,0.3) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(circle at 50% 36%, #000 0%, transparent 55%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 36%, #000 0%, transparent 55%)",
        }}
      />

      <div className="relative mx-auto flex h-[100dvh] max-w-md flex-col items-center px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] text-center">
        <motion.p {...rise(0.1)} className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#ff8cc6]">
          <Sparkles size={13} aria-hidden /> New in ExpandiaX
        </motion.p>

        {/* The core and everything round it. */}
        <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
          <div className="relative h-[320px] w-[320px] shrink-0" style={{ transform: `scale(${fit})` }}>
            {/* Glow */}
            <div aria-hidden className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(250,81,162,0.42)_0%,rgba(251,120,34,0.14)_40%,transparent_70%)]" />

            {/* Rings, each with a light running round it. */}
            {[
              { inset: "4%", dur: 26, dir: 1, dot: "#ffb3d6" },
              { inset: "17%", dur: 16, dir: -1, dot: "#fb7822" },
              { inset: "29%", dur: 10, dir: 1, dot: "#ffffff" },
            ].map((r, i) => (
              <motion.div
                key={i}
                aria-hidden
                className="absolute rounded-full ring-1 ring-white/[0.12]"
                style={{ inset: r.inset }}
                animate={reduce ? undefined : { rotate: 360 * r.dir }}
                transition={{ duration: r.dur, repeat: Infinity, ease: "linear" }}
              >
                <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: r.dot, boxShadow: `0 0 10px 2px ${r.dot}` }} />
              </motion.div>
            ))}

            {/* The scan, sweeping the middle ring. */}
            {!reduce && (
              <motion.div
                aria-hidden
                className="absolute inset-[17%] rounded-full"
                style={{
                  background: "conic-gradient(from 0deg, transparent 0deg, transparent 260deg, rgba(255,140,198,0.55) 350deg, rgba(255,214,150,0.95) 359deg, transparent 360deg)",
                  maskImage: "radial-gradient(circle, transparent 0%, #000 1%)",
                  opacity: 0.35,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
              />
            )}

            {/* Ripples going out from the core. */}
            {!reduce &&
              [0, 1.1, 2.2].map((d) => (
                <span key={d} aria-hidden className="absolute inset-0 flex items-center justify-center">
                  <motion.span
                    className="h-24 w-24 rounded-full ring-2 ring-[#fa51a2]/60"
                    initial={{ scale: 1, opacity: 0.7 }}
                    animate={{ scale: 2.6, opacity: 0 }}
                    transition={{ duration: 3.3, delay: d, repeat: Infinity, ease: "easeOut" }}
                  />
                </span>
              ))}

            {/* The camera roll, streaming in. */}
            {!reduce &&
              TILES.map(({ icon: Icon, x, y, d }, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="absolute left-1/2 top-1/2 -ml-5 -mt-5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.1] text-white ring-1 ring-white/25 backdrop-blur-md"
                  initial={{ x, y, opacity: 0 }}
                  animate={{ x: [x, x * 0.55, 0], y: [y, y * 0.55, 0], opacity: [0, 1, 0], scale: [0.9, 1, 0.3], rotate: [0, i % 2 ? 8 : -8, 0] }}
                  transition={{ duration: 2.2, delay: d, repeat: Infinity, repeatDelay: 2, ease: "easeIn" }}
                >
                  <Icon size={18} />
                </motion.span>
              ))}

            {/* The core. */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="relative flex h-24 w-24 items-center justify-center rounded-full shadow-[0_0_60px_10px_rgba(250,81,162,0.55)]"
                style={{ background: "radial-gradient(circle at 35% 30%, #ffd1e8 0%, #fa51a2 38%, #fb7822 100%)" }}
                animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <span aria-hidden className="absolute inset-2 rounded-full border border-white/40" />
                <Sparkles size={38} strokeWidth={1.8} aria-hidden />
              </motion.div>
            </div>

            {/* What it found, popping out one at a time. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={reduce ? "still" : n}
                  aria-hidden
                  className="absolute whitespace-nowrap rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-[#2b0b2e] shadow-[0_10px_30px_-8px_rgba(250,81,162,0.8)]"
                  initial={{ y: 0, scale: 0.4, opacity: 0 }}
                  animate={{ y: spot.y, scale: 1, opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.25 } }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                >
                  {found}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <motion.h1 {...rise(0.3)} id="discover-h" className="shrink-0 font-serif text-[2.5rem] leading-[1.04]">
          Discover <span className="italic text-[#ff8cc6]">my world</span>
        </motion.h1>
        <motion.p {...rise(0.45)} className="mt-3 max-w-xs shrink-0 text-[15px] leading-snug text-white/75">
          Your automatic memory finder. It looks through your camera roll and finds your countries, trips and concerts for you, in seconds.
        </motion.p>

        <motion.div {...rise(0.6)} className="mt-6 w-full shrink-0">
          <button
            type="button"
            onClick={onStart}
            className="relative w-full overflow-hidden rounded-full py-4 text-lg font-bold text-[#2b0b2e] shadow-[0_16px_44px_-12px_rgba(250,81,162,0.85)]"
            style={{ background: "linear-gradient(90deg, #fa51a2, #fb7822)" }}
          >
            {!reduce && (
              <motion.span
                aria-hidden
                className="absolute inset-y-0 w-16 -skew-x-12 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                initial={{ x: -120 }}
                animate={{ x: 480 }}
                transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" }}
              />
            )}
            <span className="relative">Discover my world</span>
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/50">
            <Lock size={11} aria-hidden /> Read on your phone. You choose what&apos;s kept.
          </p>
          <button type="button" onClick={onLater} className="mx-auto mt-1 block py-2 text-sm font-medium text-white/60 hover:text-white">
            Later
          </button>
        </motion.div>
      </div>
    </div>
  );
}
