"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { Image as ImageIcon, Lock, MapPin, Music2, Sparkles, Video } from "lucide-react";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="aspect-[5/4] w-full" />,
});

// A journey around the world, lit up one country at a time (an illustration,
// not anyone's own: what Discover my world does, shown).
const TOUR = ["PT", "ES", "IT", "GR", "EG", "AE", "IN", "TH", "JP", "AU", "NZ", "US", "MX", "BR", "IS", "NO"];
const STEP_MS = 520;

// What it reads, drifting into the globe: pictures, videos, places, the nights out.
const TILES = [
  { icon: ImageIcon, x: -150, y: -110, d: 0 },
  { icon: Video, x: 150, y: -95, d: 0.8 },
  { icon: MapPin, x: -160, y: 70, d: 1.6 },
  { icon: Music2, x: 145, y: 115, d: 2.4 },
  { icon: ImageIcon, x: 25, y: -170, d: 3.2 },
  { icon: Video, x: -35, y: 170, d: 4.0 },
];

/**
 * 1.2's "What's new", full screen: Discover my world, shown rather than
 * told. A night globe turns, a scan sweeps round it, the camera roll
 * (pictures, videos, places, nights out) drifts in and countries light up
 * one by one with flights between them. A title, one line, the button.
 */
export function DiscoverIntro({ onStart, onLater }: { onStart: () => void; onLater: () => void }) {
  const reduce = useReducedMotion();
  const [lit, setLit] = useState(reduce ? TOUR.length : 1);

  useEffect(() => {
    if (reduce) return;
    // Light the next one, and after a pause start the journey again.
    const t = setInterval(() => setLit((n) => (n >= TOUR.length + 4 ? 1 : n + 1)), STEP_MS);
    return () => clearInterval(t);
  }, [reduce]);

  const shown = TOUR.slice(0, Math.min(lit, TOUR.length));
  const rise = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay: reduce ? 0 : delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <div
      className="fixed inset-0 z-[96] overflow-hidden text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discover-h"
      style={{ background: "radial-gradient(90% 60% at 50% 38%, #3b0f45 0%, #1c0626 45%, #08020c 100%)" }}
    >
      {/* A faint grid and stars: the feel of something looking. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,140,198,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,140,198,0.25) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(circle at 50% 40%, #000 0%, transparent 62%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 40%, #000 0%, transparent 62%)",
        }}
      />

      <div className="relative mx-auto flex h-[100dvh] max-w-md flex-col px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <motion.p {...rise(0.1)} className="flex shrink-0 items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#ff8cc6]">
          <Sparkles size={13} aria-hidden /> New
        </motion.p>

        {/* The globe, the scan and what drifts into it. */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <div className="relative aspect-square w-[min(100%,48dvh)]">
            {/* Glow */}
            <div aria-hidden className="absolute inset-[2%] rounded-full bg-[radial-gradient(circle,rgba(250,81,162,0.38)_0%,rgba(251,120,34,0.12)_42%,transparent_70%)]" />
            {/* The scan: a bright arc sweeping round, and a quiet orbit. */}
            {!reduce && (
              <motion.div
                aria-hidden
                className="absolute inset-[15%] rounded-full"
                style={{
                  background: "conic-gradient(from 0deg, transparent 0deg, transparent 250deg, rgba(255,140,198,0.0) 260deg, rgba(255,140,198,0.9) 350deg, rgba(255,214,150,1) 359deg, transparent 360deg)",
                  maskImage: "radial-gradient(circle, transparent 66%, #000 67%, #000 69%, transparent 70%)",
                  WebkitMaskImage: "radial-gradient(circle, transparent 66%, #000 67%, #000 69%, transparent 70%)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
              />
            )}
            <div aria-hidden className="absolute inset-[15%] rounded-full ring-1 ring-white/10" />
            <div aria-hidden className="absolute inset-[6%] rounded-full ring-1 ring-white/[0.05]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full">
                <WorldGlobeInner visitedCodes={shown} route={shown} interactive={false} labels={false} autoRotate night />
              </div>
            </div>

            {/* The camera roll, drifting in and dissolving into the globe. */}
            {!reduce &&
              TILES.map(({ icon: Icon, x, y, d }, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="absolute left-1/2 top-1/2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.1] text-white ring-1 ring-white/25 backdrop-blur-md"
                  style={{ marginLeft: -20, marginTop: -20 }}
                  initial={{ x, y, opacity: 0, scale: 0.9 }}
                  animate={{ x: [x, x * 0.6, x * 0.25], y: [y, y * 0.6, y * 0.25], opacity: [0, 1, 0], scale: [0.85, 1, 0.3] }}
                  transition={{ duration: 2.2, delay: d, repeat: Infinity, repeatDelay: 2.6, ease: "easeIn" }}
                >
                  <Icon size={18} />
                </motion.span>
              ))}
          </div>
        </div>

        <motion.h1 {...rise(0.3)} id="discover-h" className="shrink-0 text-center font-serif text-[2.6rem] leading-[1.02]">
          Discover
          <br />
          <span className="italic text-[#ff8cc6]">my world</span>
        </motion.h1>
        <motion.p {...rise(0.45)} className="mt-3 shrink-0 text-center text-base text-white/75">
          Your trips and moments, found automatically.
        </motion.p>

        <motion.div {...rise(0.6)} className="mt-6 shrink-0">
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
            <Lock size={11} aria-hidden /> Private, on your phone
          </p>
          <button type="button" onClick={onLater} className="mx-auto mt-1 block py-2 text-sm font-medium text-white/60 hover:text-white">
            Later
          </button>
        </motion.div>
      </div>
    </div>
  );
}
