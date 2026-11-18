"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

/** How far along Chapter One is: a ring that fills, "3 of 8" in the middle. */
export function JourneyRing({ done, total, size = 64, light = false }: { done: number; total: number; size?: number; light?: boolean }) {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const stroke = Math.max(5, Math.round(size / 11));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${done} of ${total} done`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fa51a2" />
            <stop offset="100%" stopColor="#fb7822" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={light ? "stroke-white/15" : "stroke-line"} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={`url(#ring-${id})`}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - done / total) }}
          transition={{ duration: reduce ? 0 : 1.1, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
      <span className={`absolute text-center leading-none ${light ? "text-white" : "text-ink"}`}>
        <span className="block font-serif" style={{ fontSize: size * 0.3 }}>
          {done}
        </span>
        <span className={`block ${light ? "text-white/60" : "text-muted"}`} style={{ fontSize: Math.max(10, size * 0.13) }}>
          of {total}
        </span>
      </span>
    </span>
  );
}
