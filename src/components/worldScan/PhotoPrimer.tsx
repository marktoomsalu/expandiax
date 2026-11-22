"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, ChevronLeft, ListChecks, MapPin, Smartphone, Star } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Before iPhone asks for the photo library: what ExpandiaX will read, where
 * it happens, and that nothing is kept without them, in plain words. Shown
 * once, only to people who haven't answered iPhone yet. One way on
 * ("Continue", to iPhone's own question, as Apple's guidelines ask of a
 * screen like this); back is the other, to "Add it myself".
 */
export function PhotoPrimer({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const reduce = useReducedMotion();
  const rise = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay: reduce ? 0 : delay, ease: EASE },
  });

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col overflow-y-auto px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <button type="button" onClick={onBack} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:text-white" aria-label="Back">
        <ChevronLeft size={24} aria-hidden />
      </button>

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        {/* All we read from a photo: shown, not just said. */}
        <motion.div {...rise(0.05)} className="mx-auto flex items-center gap-3" aria-hidden>
          <div className="relative h-24 w-[4.5rem] rotate-[-4deg] overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#f7c59f,#c8553d)] shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)] ring-2 ring-white/80">
            <span className="absolute inset-0 bg-[linear-gradient(transparent_55%,rgba(0,0,0,0.35))]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-sm ring-1 ring-white/15">
              <CalendarDays size={14} className="text-[#ffb3d6]" /> 12 July 2023
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-sm ring-1 ring-white/15">
              <MapPin size={14} className="text-[#ffb3d6]" /> Lisbon, Portugal
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-sm ring-1 ring-white/15">
              <Star size={14} className="text-[#ffb3d6]" /> A favourite
            </span>
          </div>
        </motion.div>

        <motion.h1 {...rise(0.15)} className="mt-6 text-center font-serif text-[2rem] leading-[1.1]">
          Here&apos;s exactly <span className="italic text-[#ff8cc6]">what happens</span>
        </motion.h1>

        <motion.ul {...rise(0.3)} className="mt-6 space-y-4">
          <Row icon={<CalendarDays size={18} />} title="Only when and where">
            The date, place and favourite mark saved with each photo. Never what&apos;s in the picture.
          </Row>
          <Row icon={<Smartphone size={18} />} title="Worked out on your phone">
            Your photos aren&apos;t uploaded. To spot concerts and matches, only a day, nearby town and venue names and a rough area are checked online.
          </Row>
          <Row icon={<ListChecks size={18} />} title="Nothing kept without you">
            You see every country, trip and memory first and keep only what you want. Change access any time in Settings.
          </Row>
        </motion.ul>

        <motion.div {...rise(0.45)} className="mt-6 rounded-2xl bg-white/[0.07] px-4 py-3 text-sm leading-snug text-white/75 ring-1 ring-white/10">
          <p className="font-semibold text-white">Next, your iPhone asks</p>
          <p className="mt-1">
            <span className="text-white">Allow Full Access</span> finds the most. <span className="text-white">Limit Access</span> lets you pick photos: only those are looked at, and you can add more later.
          </p>
        </motion.div>
      </div>

      <motion.div {...rise(0.55)} className="pt-5">
        <button type="button" onClick={onContinue} className="btn-accent w-full py-4 text-lg shadow-[0_14px_40px_-10px_rgba(250,81,162,0.8)]">
          Continue
        </button>
        <p className="mt-3 text-center text-xs text-white/50">
          More in our{" "}
          <a href="/privacy" className="underline underline-offset-2 hover:text-white">
            Privacy Policy
          </a>
        </p>
      </motion.div>
    </div>
  );
}

function Row({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#ffb3d6]">{icon}</span>
      <span className="text-[15px] leading-snug">
        <span className="font-semibold">{title}</span>
        <span className="mt-0.5 block text-white/70">{children}</span>
      </span>
    </li>
  );
}
