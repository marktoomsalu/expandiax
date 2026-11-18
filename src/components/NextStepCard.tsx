"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Camera, Compass, Globe2, Handshake, Map, Music2, Sparkles, Star, Ticket, User, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tapLight } from "@/lib/haptics";
import type { NextStep } from "@/lib/nextStep";
import { isQuietVisit, QUIET_EVENT, startQuietVisit } from "@/lib/quietVisit";

const ICONS = { camera: Camera, ticket: Ticket, globe: Globe2, map: Map, music: Music2, book: BookOpen, users: Users, user: User, star: Star, compass: Compass, handshake: Handshake };

function note(id: string, action: "shown" | "taken" | "dismissed") {
  void createClient()
    .rpc("note_next_step", { p_moment: id, p_action: action })
    .then(() => undefined, () => undefined);
}

/** "Shown" once a day per suggestion is enough to learn from, and saves a write per page view. */
function noteShownToday(id: string) {
  const key = `expandiax:next-step-shown:${id}`;
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(key) === today) return;
    localStorage.setItem(key, today);
  } catch {
    // No storage: count it anyway.
  }
  note(id, "shown");
}

// "Not now" is remembered here too: a page kept from a moment ago (the app
// keeps recent pages to open them instantly) still has the card in it.
const NOT_NOW_MS = 7 * 86_400_000;
const notNowKey = (id: string) => `expandiax:next-step-not-now:${id}`;
function saidNotNow(id: string): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(notNowKey(id)) ?? 0) < NOT_NOW_MS;
  } catch {
    return false;
  }
}

/**
 * The one next step: a quiet card with one button and "Not now". Steps
 * aside while something bigger is being celebrated, and for the rest of
 * that visit (the celebration is the whole message). After "Not now",
 * nothing is suggested again until the next visit.
 */
export function NextStepCard({ step, className = "mb-6" }: { step: NextStep; className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isQuietVisit() || saidNotNow(step.id)) return;
    setVisible(true);
    noteShownToday(step.id);
    const hush = () => setVisible(false);
    window.addEventListener(QUIET_EVENT, hush);
    return () => window.removeEventListener(QUIET_EVENT, hush);
  }, [step.id]);

  const Icon = ICONS[step.icon] ?? Sparkles;
  const take = () => {
    tapLight();
    note(step.id, "taken");
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.section
          aria-label="Your next step"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.2 } }}
          transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.25 }}
          className={className}
        >
          <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-accent via-accent-2 to-accent-3 p-px shadow-lg shadow-accent/15">
            <div className="relative rounded-[calc(1.25rem-1px)] bg-surface p-4 sm:p-5">
              <div className="flex items-start gap-3.5">
                <motion.span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-3 text-white shadow-md shadow-accent/25"
                  initial={{ rotate: -12, scale: 0.6 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.45 }}
                >
                  <Icon size={20} aria-hidden />
                </motion.span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Next step</p>
                  <h2 className="mt-0.5 font-serif text-xl leading-tight">{step.title}</h2>
                  <p className="mt-1 text-sm text-muted">{step.body}</p>
                </div>
              </div>

              {step.chips && step.chips.length > 1 && (
                <ul className="mt-4 flex flex-wrap gap-2" aria-label="Pick one">
                  {step.chips.map((c, i) => (
                    <motion.li key={c.href} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.06 }}>
                      <Link
                        href={c.href}
                        onClick={take}
                        className="inline-flex items-center rounded-full border border-line bg-canvas px-3.5 py-2 text-sm hover:border-accent hover:text-accent"
                      >
                        {c.label}
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex items-center gap-4">
                <Link href={step.cta.href} onClick={take} className="btn-accent !py-2 text-sm">
                  {step.cta.label}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    tapLight();
                    note(step.id, "dismissed");
                    try {
                      localStorage.setItem(notNowKey(step.id), String(Date.now()));
                    } catch {}
                    // Nothing else is suggested for the rest of this visit either.
                    startQuietVisit();
                    setVisible(false);
                  }}
                  className="text-sm text-muted hover:text-ink"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
