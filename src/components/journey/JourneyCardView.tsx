"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { Journey } from "@/lib/journey";
import { tapLight } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { JourneyRing } from "./JourneyRing";

/**
 * "Chapter One · 3 of 8 · Next: Your first trip": stays on the page until
 * all eight are done, and opens the whole journey.
 */
export function JourneyCardView({ journey, className = "mb-6" }: { journey: Journey; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
    >
      <Link
        href="/journey"
        onClick={() => tapLight()}
        className="group block rounded-card bg-gradient-to-br from-accent via-accent-2 to-accent-3 p-px shadow-lg shadow-accent/15"
        aria-label={`Chapter One: ${journey.done} of ${journey.total} done${journey.next ? `. Next: ${journey.next.title}` : ""}`}
      >
        <span className="flex items-center gap-4 rounded-[calc(1.25rem-1px)] bg-surface p-4">
          <JourneyRing done={journey.done} total={journey.total} size={60} />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-accent">Chapter One · your story</span>
            <span className="mt-0.5 block font-serif text-lg leading-tight">{journey.next ? `Next: ${journey.next.title}` : "Almost there"}</span>
            <span className="mt-2 flex gap-1" aria-hidden>
              {journey.steps.map((s, i) => (
                <motion.span
                  key={s.id}
                  className={cn("h-1.5 flex-1 rounded-full", s.done ? "bg-gradient-to-r from-accent to-accent-3" : "bg-line")}
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  style={{ originX: 0 }}
                />
              ))}
            </span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>
    </motion.div>
  );
}
