"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, Globe2, Route, ShieldCheck, Ticket } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Before iPhone asks for the photo library: what they get from it (their
 * countries, their trips rebuilt, the moments in them), then what happens to
 * their photos (only date and place, on the phone, nothing kept without
 * them), in plain words. Shown
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
        <motion.h1 {...rise(0.05)} className="text-center font-serif text-[2rem] leading-[1.1]">
          Your photos <span className="italic text-[#ff8cc6]">remember</span> your world
        </motion.h1>
        <motion.p {...rise(0.12)} className="mx-auto mt-2 max-w-xs text-center text-[15px] leading-snug text-white/70">
          Every photo knows when and where it was taken. Together they tell your story.
        </motion.p>

        {/* What they get. */}
        <motion.ul {...rise(0.25)} className="mt-6 space-y-3.5">
          <Row icon={<Globe2 size={18} />} title="Every country you've been to">
            Found in seconds, even the ones you&apos;d forgotten.
          </Row>
          <Row icon={<Route size={18} />} title="Your trips, rebuilt">
            When you went, how long you stayed and the towns along the way.
          </Row>
          <Row icon={<Ticket size={18} />} title="Moments worth keeping">
            Concerts, matches and festivals, back with their photos.
          </Row>
        </motion.ul>

        {/* What happens to their photos: plain and short. */}
        <motion.div {...rise(0.4)} className="mt-6 rounded-2xl bg-white/[0.07] px-4 py-3.5 ring-1 ring-white/10">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck size={16} className="text-[#ffb3d6]" aria-hidden /> Your photos stay yours
          </p>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-white/75">
            <Fact>Only the date and place are read, never what&apos;s in a picture.</Fact>
            <Fact>It all happens on your phone. Nothing is uploaded.</Fact>
            <Fact>You see everything first and keep only what you want.</Fact>
          </ul>
        </motion.div>

        <motion.p {...rise(0.5)} className="mt-4 text-center text-[13px] leading-snug text-white/60">
          Next, your iPhone asks. <span className="text-white">Allow Full Access</span> finds the most; <span className="text-white">Limit Access</span> lets you pick photos. Change it any time in Settings.
        </motion.p>
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

function Fact({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check size={14} className="mt-0.5 shrink-0 text-[#ffb3d6]" aria-hidden />
      <span>{children}</span>
    </li>
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
