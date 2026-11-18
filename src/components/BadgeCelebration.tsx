"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkle } from "lucide-react";
import { BADGES } from "@/lib/badges";
import { createClient } from "@/lib/supabase/client";
import { tapLight, tapSuccess } from "@/lib/haptics";

type Found = { ids: string[]; next: { id: string; current: number; target: number } | null };

// Pages where a celebration would get in the way (or where the first steps
// have their own).
const NOT_HERE = [/^\/start/, /^\/onboarding/, /^\/sign-(in|up)/, /^\/auth/, /\/edit$/, /\/new$/];
const MIN_GAP_MS = 8_000;

/**
 * Watches for badges earned since the last look (after saving something,
 * on the next page, or coming back to the app) and celebrates them: one
 * at a time, each with its own moment. Recorded as seen the moment it shows,
 * so it never shows twice, on any device.
 */
export function BadgeWatcher() {
  const pathname = usePathname();
  const [found, setFound] = useState<Found | null>(null);
  const last = useRef(0);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current || found || Date.now() - last.current < MIN_GAP_MS) return;
    if (NOT_HERE.some((r) => r.test(window.location.pathname))) return;
    try {
      // The first steps' badges are celebrated there; wait until they're saved.
      if (sessionStorage.getItem("expandiax:onboarding-draft")) return;
    } catch {}
    busy.current = true;
    last.current = Date.now();
    try {
      const res = await fetch("/api/badges/new", { cache: "no-store" });
      const data = (await res.json()) as Found;
      const known = data.ids.filter((id) => BADGES.some((b) => b.id === id));
      if (known.length) {
        await createClient().rpc("mark_badges_seen", { p_ids: known });
        setFound({ ids: known, next: data.next });
      }
    } catch {
      // Next page, next try.
    } finally {
      busy.current = false;
    }
  }, [found]);

  useEffect(() => {
    const t = setTimeout(() => void check(), 1200);
    return () => clearTimeout(t);
  }, [pathname, check]);

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [check]);

  return <AnimatePresence>{found && <BadgeCelebration key={found.ids.join()} ids={found.ids} next={found.next} onClose={() => setFound(null)} />}</AnimatePresence>;
}

/* ------------------------------------------------------------------ */

const COLORS = ["#fa51a2", "#f43f5e", "#fb7822", "#ffd166", "#ffffff", "#c084fc"];
// Fixed, not random: the same burst every time, and the same on server and client.
const PIECES = Array.from({ length: 44 }, (_, i) => {
  const angle = (i / 44) * Math.PI * 2 + ((i * 37) % 10) / 20;
  const power = 150 + ((i * 53) % 9) * 22;
  return {
    x: Math.cos(angle) * power,
    y: Math.sin(angle) * power - 60,
    fall: 260 + ((i * 29) % 7) * 40,
    rotate: ((i * 71) % 2 ? 1 : -1) * (180 + ((i * 17) % 5) * 90),
    color: COLORS[i % COLORS.length],
    w: i % 3 === 0 ? 7 : 5,
    h: i % 3 === 0 ? 7 : 12,
    round: i % 3 === 0,
    delay: ((i * 13) % 6) * 0.02,
  };
});
const SPARKS = [
  { x: -118, y: -96, s: 18, d: 0.9 },
  { x: 124, y: -70, s: 14, d: 1.1 },
  { x: -132, y: 54, s: 12, d: 1.3 },
  { x: 112, y: 88, s: 20, d: 1.0 },
  { x: 8, y: -142, s: 12, d: 1.4 },
];

function BadgeCelebration({ ids, next, onClose }: { ids: string[]; next: Found["next"]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();
  const badge = BADGES.find((b) => b.id === ids[index]) ?? BADGES[0];
  const isLast = index === ids.length - 1;
  const nextBadge = isLast && next ? BADGES.find((b) => b.id === next.id) : null;
  const Icon = badge.icon;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The thud when the medal lands.
  useEffect(() => {
    const t = setTimeout(() => tapSuccess(), reduce ? 0 : 650);
    return () => clearTimeout(t);
  }, [index, reduce]);

  const advance = () => {
    tapLight();
    if (isLast) onClose();
    else setIndex((i) => i + 1);
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-title"
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      onClick={advance}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#6e1e6a_0%,#2b0b2e_55%,#14051a_100%)]" aria-hidden />

      <AnimatePresence mode="wait">
        <motion.div
          key={badge.id}
          className="relative flex w-full max-w-sm flex-col items-center text-center text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
        >
          {/* The medal and everything around it. */}
          <div className="relative flex h-72 w-72 items-center justify-center">
            {!reduce && (
              <motion.div
                aria-hidden
                className="absolute inset-[-40%] rounded-full opacity-60"
                style={{ background: "repeating-conic-gradient(from 0deg, rgba(250,81,162,0.28) 0deg 10deg, transparent 10deg 24deg)", maskImage: "radial-gradient(circle, black 18%, transparent 62%)", WebkitMaskImage: "radial-gradient(circle, black 18%, transparent 62%)" }}
                initial={{ rotate: 0, scale: 0.4, opacity: 0 }}
                animate={{ rotate: 360, scale: 1, opacity: 0.6 }}
                transition={{ rotate: { duration: 24, repeat: Infinity, ease: "linear" }, scale: { duration: 0.8, delay: 0.4 }, opacity: { duration: 0.8, delay: 0.4 } }}
              />
            )}

            {/* Glow */}
            <motion.div
              aria-hidden
              className="absolute h-44 w-44 rounded-full bg-[#fa51a2] blur-3xl"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.75, 0.45], scale: [0.5, 1.3, 1.1] }}
              transition={{ duration: 1.4, delay: 0.5 }}
            />

            {/* Rings that ripple out as it lands */}
            {!reduce &&
              [0, 1, 2].map((r) => (
                <motion.span
                  key={r}
                  aria-hidden
                  className="absolute h-40 w-40 rounded-full border-2 border-[#fa51a2]"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: [0.8, 2.1], opacity: [0.9, 0] }}
                  transition={{ duration: 1.6, delay: 0.65 + r * 0.28, ease: "easeOut" }}
                />
              ))}

            {/* Confetti */}
            {!reduce &&
              PIECES.map((p, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="absolute"
                  style={{ width: p.w, height: p.h, background: p.color, borderRadius: p.round ? 999 : 2 }}
                  initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
                  animate={{ x: [0, p.x, p.x * 1.15], y: [0, p.y, p.y + p.fall], opacity: [0, 1, 1, 0], rotate: p.rotate }}
                  transition={{ duration: 2.2, delay: 0.62 + p.delay, times: [0, 0.3, 1], ease: ["easeOut", "easeIn"] }}
                />
              ))}

            {/* Sparkles */}
            {SPARKS.map((s, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="absolute text-[#ffd166]"
                style={{ x: s.x, y: s.y }}
                initial={{ scale: 0, opacity: 0, rotate: 0 }}
                animate={{ scale: [0, 1.2, 0.8, 1], opacity: [0, 1, 0.6, 1], rotate: 90 }}
                transition={{ duration: 1.2, delay: s.d, repeat: reduce ? 0 : Infinity, repeatType: "reverse", repeatDelay: 0.6 }}
              >
                <Sparkle size={s.s} fill="currentColor" />
              </motion.span>
            ))}

            {/* The medal: drops in, flips like a coin, lands with a bounce */}
            <motion.div style={{ perspective: 900 }} className="relative">
              <motion.div
                className="relative flex h-40 w-40 items-center justify-center rounded-full shadow-[0_20px_60px_-10px_rgba(250,81,162,0.7)]"
                style={{ background: "linear-gradient(135deg,#fa51a2 0%,#f43f5e 50%,#fb7822 100%)", transformStyle: "preserve-3d" }}
                initial={reduce ? { opacity: 0 } : { y: -260, rotateY: 540, scale: 0.4, opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { y: 0, rotateY: 0, scale: [0.4, 1.18, 0.94, 1], opacity: 1 }}
                transition={reduce ? { duration: 0.4 } : { y: { type: "spring", stiffness: 140, damping: 13, delay: 0.1 }, rotateY: { duration: 0.85, ease: "easeOut", delay: 0.1 }, scale: { duration: 0.9, times: [0, 0.6, 0.8, 1], delay: 0.1 }, opacity: { duration: 0.2, delay: 0.1 } }}
              >
                {/* Inner rim */}
                <span aria-hidden className="absolute inset-2.5 rounded-full border-2 border-white/35" />
                <span aria-hidden className="absolute inset-5 rounded-full bg-white/10" />
                <Icon size={64} strokeWidth={1.75} className="relative drop-shadow-[0_4px_10px_rgba(0,0,0,0.25)]" aria-hidden />
                {/* A shine that sweeps across once it's landed */}
                {!reduce && (
                  <span aria-hidden className="absolute inset-0 overflow-hidden rounded-full">
                    <motion.span
                      className="absolute -inset-y-4 w-12 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                      initial={{ x: -120 }}
                      animate={{ x: 220 }}
                      transition={{ duration: 0.9, delay: 1.2, repeat: Infinity, repeatDelay: 2.6, ease: "easeInOut" }}
                    />
                  </span>
                )}
              </motion.div>
            </motion.div>
          </div>

          <motion.p
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ffb3d6]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0.1 : 0.9 }}
          >
            {ids.length > 1 ? `New badge · ${index + 1} of ${ids.length}` : "New badge"}
          </motion.p>
          <h2 id="badge-title" className="mt-2 font-serif text-4xl leading-tight">
            {reduce ? (
              badge.label
            ) : (
              <span aria-label={badge.label}>
                {badge.label.split("").map((ch, i) => (
                  <motion.span
                    key={i}
                    aria-hidden
                    className="inline-block"
                    initial={{ opacity: 0, y: 18, rotateX: -80 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    transition={{ delay: 1 + i * 0.035, type: "spring", stiffness: 320, damping: 18 }}
                  >
                    {ch === " " ? " " : ch}
                  </motion.span>
                ))}
              </span>
            )}
          </h2>
          <motion.p className="mt-2 text-base text-white/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0.2 : 1.35 }}>
            {badge.description}
          </motion.p>

          {nextBadge && next && (
            <motion.div
              className="mt-6 w-full max-w-xs rounded-2xl bg-white/10 px-4 py-3 text-left ring-1 ring-white/15 backdrop-blur"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0.3 : 1.6 }}
            >
              <p className="flex items-center gap-2 text-sm">
                <nextBadge.icon size={15} className="shrink-0 text-[#ffb3d6]" aria-hidden />
                <span>
                  Next: <span className="font-semibold">{nextBadge.label}</span>
                  <span className="text-white/65">
                    {" "}
                    · {next.current}/{next.target} {nextBadge.unit}
                  </span>
                </span>
              </p>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/15">
                <motion.span
                  className="block h-full rounded-full bg-gradient-to-r from-[#fa51a2] to-[#fb7822]"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round((next.current / next.target) * 100)}%` }}
                  transition={{ delay: reduce ? 0.3 : 1.8, duration: 0.9, ease: "easeOut" }}
                />
              </span>
            </motion.div>
          )}

          <motion.div
            className="mt-8 flex items-center gap-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0.3 : 1.7 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={advance} className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#2b0b2e] shadow-lg hover:bg-white/90" autoFocus>
              {isLast ? "Lovely" : "Next badge"}
            </button>
            {isLast && (
              <Link href="/stats#badges" onClick={onClose} className="text-sm font-medium text-white/80 hover:text-white">
                All my badges
              </Link>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
