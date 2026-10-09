"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Each onboarding step fades out, then the next one drifts up into place —
 * a slow, deliberate beat between screens instead of a hard cut. With
 * reduced motion it's a plain crossfade.
 */
export function StepTransition({ stepKey, children }: { stepKey: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo(0, 0)}>
      <motion.div
        key={stepKey}
        className="relative"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.75, ease: EASE } }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16, transition: { duration: 0.35, ease: "easeIn" } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** A piece of a step that rises in a beat after the step itself, so a screen assembles rather than appears. */
export function Rise({ delay = 0, className, children }: { delay?: number; className?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.15 + delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute left-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-20 flex items-center gap-0.5 rounded-full py-2 pl-1.5 pr-3 text-sm text-muted hover:text-ink"
    >
      <ChevronLeft size={18} aria-hidden /> Back
    </button>
  );
}
