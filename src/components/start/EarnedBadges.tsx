"use client";

import { motion } from "framer-motion";
import type { EvaluatedBadge } from "@/lib/badges";

/**
 * The reward at the end of the first steps: each badge earned pops in, one
 * after another, then the nearest next one with how far there is to go.
 * Kept by signing up.
 */
export function EarnedBadges({ earned, next }: { earned: EvaluatedBadge[]; next: EvaluatedBadge | null }) {
  if (!earned.length) return null;
  return (
    <div className="mt-8 w-full">
      <p className="text-sm font-semibold">{earned.length === 1 ? "You earned your first badge" : `You earned ${earned.length} badges`}</p>
      <ul className="mt-4 flex flex-wrap justify-center gap-4">
        {earned.map((b, i) => (
          <motion.li
            key={b.id}
            initial={{ scale: 0.3, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.5 + i * 0.35 }}
            className="flex w-24 flex-col items-center text-center"
          >
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg shadow-accent/30" style={{ background: "linear-gradient(135deg, #fa51a2, #fb7822)" }}>
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full ring-2 ring-[#fa51a2]"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 1.1, delay: 0.6 + i * 0.35 }}
              />
              <b.icon size={26} aria-hidden />
            </span>
            <span className="mt-2 text-sm font-semibold leading-tight">{b.label}</span>
            <span className="mt-0.5 text-[11px] leading-snug text-muted">{b.description}</span>
          </motion.li>
        ))}
      </ul>
      {next && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 + earned.length * 0.35 }}
          className="mx-auto mt-5 max-w-xs rounded-2xl border border-line bg-surface px-4 py-3 text-left"
        >
          <p className="flex items-center gap-2 text-sm">
            <next.icon size={15} className="shrink-0 text-accent" aria-hidden />
            <span>
              Next: <span className="font-semibold">{next.label}</span>{" "}
              <span className="text-muted">
                · {next.group === "types" ? next.description : `${next.target - next.current} more ${noun(next.group, next.target - next.current)}`}
              </span>
            </span>
          </p>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-raised">
            <motion.span
              className="block h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round((next.current / next.target) * 100)}%` }}
              transition={{ delay: 1 + earned.length * 0.35, duration: 0.8 }}
            />
          </span>
        </motion.div>
      )}
    </div>
  );
}

const NOUNS: Record<string, [string, string]> = { countries: ["country", "countries"], continents: ["continent", "continents"], events: ["event", "events"], types: ["event", "events"] };
const noun = (group: string, n: number) => (NOUNS[group] ?? ["", ""])[n === 1 ? 0 : 1];
