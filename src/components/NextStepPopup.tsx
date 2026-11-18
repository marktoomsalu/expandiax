"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { BookOpen, Camera, Compass, Globe2, Handshake, Map, Music2, Sparkles, Star, Ticket, User, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tapLight } from "@/lib/haptics";
import type { NextStep } from "@/lib/nextStep";
import { isQuietVisit, QUIET_EVENT, startQuietVisit } from "@/lib/quietVisit";
import { claimIntro, releaseIntro } from "@/lib/introQueue";
import { mayPopUp, noteVisit, poppedUp, readRhythm, saveRhythm } from "@/lib/visitRhythm";

const ICONS = { camera: Camera, ticket: Ticket, globe: Globe2, map: Map, music: Music2, book: BookOpen, users: Users, user: User, star: Star, compass: Compass, handshake: Handshake };
const INTRO = "next-step";

function note(id: string, action: "shown" | "taken" | "dismissed") {
  void createClient()
    .rpc("note_next_step", { p_moment: id, p_action: action })
    .then(() => undefined, () => undefined);
}

// "Not now" is remembered on the device too: a page the app kept from a
// moment ago (to open it instantly) still carries the same suggestion.
const NOT_NOW_MS = 7 * 86_400_000;
const notNowKey = (id: string) => `expandiax:next-step-not-now:${id}`;
function saidNotNow(id: string): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(notNowKey(id)) ?? 0) < NOT_NOW_MS;
  } catch {
    return false;
  }
}

/** Something else has the screen: another sheet, or they're typing. */
function busyNow(): boolean {
  if (document.querySelector('[aria-modal="true"]')) return true;
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

/** Keeps the visit count right on every page and on coming back to the app. */
export function VisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    noteVisit();
  }, [pathname]);
  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && noteVisit();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);
  return null;
}

/**
 * The one next step, popping up over the screen: at most once a visit, and
 * less often for people who are here a lot (lib/visitRhythm). Never on top
 * of another sheet, while they're typing, or after a celebration.
 */
export function NextStepPopup({ step }: { step: NextStep }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const tries = useRef(0);

  const tryOpen = useCallback(() => {
    if (open || isQuietVisit() || saidNotNow(step.id)) return;
    const now = Date.now();
    if (!mayPopUp(readRhythm(), now)) return;
    if (busyNow() || !claimIntro(INTRO)) {
      // Wait for the other thing to finish (a little while, not forever).
      if (tries.current++ < 20) setTimeout(tryOpen, 3_000);
      return;
    }
    saveRhythm(poppedUp(readRhythm(), now));
    note(step.id, "shown");
    setOpen(true);
  }, [open, step.id]);

  useEffect(() => {
    noteVisit();
    const t = setTimeout(tryOpen, 1_500);
    const onShow = () => {
      if (document.visibilityState !== "visible") return;
      noteVisit();
      setTimeout(tryOpen, 1_500);
    };
    const hush = () => setOpen(false);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener(QUIET_EVENT, hush);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener(QUIET_EVENT, hush);
    };
  }, [tryOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      releaseIntro(INTRO);
    };
  }, [open]);

  const Icon = ICONS[step.icon] ?? Sparkles;
  const take = () => {
    tapLight();
    note(step.id, "taken");
    setOpen(false);
  };
  const notNow = () => {
    tapLight();
    note(step.id, "dismissed");
    try {
      localStorage.setItem(notNowKey(step.id), String(Date.now()));
    } catch {}
    startQuietVisit(); // nothing else suggested until the next visit
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[85] flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="next-step-h"
            className="w-full max-w-md overflow-hidden rounded-t-[28px] bg-canvas pb-[env(safe-area-inset-bottom)] shadow-2xl sm:rounded-[28px] sm:pb-0"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_: unknown, info: PanInfo) => (info.offset.y > 90 || info.velocity.y > 500) && setOpen(false)}
          >
            {/* The top: brand colours, the icon floating in a soft glow. */}
            <div className="relative overflow-hidden bg-[radial-gradient(120%_120%_at_20%_0%,#6e1e6a_0%,#2b0b2e_60%)] px-6 pb-7 pt-3 text-center text-white">
              <span className="mx-auto mb-5 block h-1 w-10 rounded-full bg-white/30 sm:hidden" aria-hidden />
              <span className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[#fa51a2]/35 blur-3xl" aria-hidden />
              <span className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-[#fb7822]/25 blur-3xl" aria-hidden />
              <div className="relative mx-auto h-16 w-16">
                {!reduce && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-2xl border-2 border-[#fa51a2]"
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: 1.7, opacity: 0 }}
                    transition={{ duration: 1.4, delay: 0.45, repeat: 1, repeatDelay: 0.4 }}
                  />
                )}
                <motion.span
                  className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fa51a2] via-[#f43f5e] to-[#fb7822] shadow-lg shadow-[#fa51a2]/40"
                  initial={reduce ? false : { scale: 0.4, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.25 }}
                >
                  <Icon size={28} aria-hidden />
                </motion.span>
              </div>
              <p className="relative mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffb3d6]">Your next step</p>
            </div>

            <div className="px-6 pb-6 pt-5 text-center">
              <motion.h2
                id="next-step-h"
                className="font-serif text-2xl leading-tight"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {step.title}
              </motion.h2>
              <motion.p className="mt-2 text-sm text-muted" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                {step.body}
              </motion.p>

              {step.chips && step.chips.length > 1 && (
                <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Pick one">
                  {step.chips.map((c, i) => (
                    <motion.li key={c.href} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 + i * 0.05 }}>
                      <Link href={c.href} onClick={take} className="inline-flex items-center rounded-full border border-line bg-surface px-3.5 py-2 text-sm hover:border-accent hover:text-accent">
                        {c.label}
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              )}

              <Link href={step.cta.href} onClick={take} className="btn-accent mt-6 w-full justify-center">
                {step.cta.label}
              </Link>
              <button type="button" onClick={notNow} className="mt-3 w-full py-2 text-sm text-muted hover:text-ink">
                Not now
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
