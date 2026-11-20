"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const COLORS = ["#fa51a2", "#fb7822", "#ffd166", "#7c5cff", "#16b3a6", "#ffffff"];

// Fixed, so a burst looks the same each time (and renders the same on the server).
const PIECES = Array.from({ length: 46 }, (_, i) => {
  const angle = (i / 46) * Math.PI * 2 + (i % 3) * 0.21;
  const dist = 120 + ((i * 53) % 150);
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist - 40,
    fall: 160 + ((i * 37) % 120),
    rotate: ((i * 97) % 720) - 360,
    w: i % 4 === 0 ? 7 : 9,
    h: i % 4 === 0 ? 7 : 4,
    round: i % 4 === 0,
    color: COLORS[i % COLORS.length],
    delay: (i % 7) * 0.025,
  };
});

/** Confetti flying out from the middle of its (relative) parent, once. */
export function Burst({ delay = 0 }: { delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible">
      {PIECES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ width: p.w, height: p.h, background: p.color, borderRadius: p.round ? 999 : 2 }}
          initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
          animate={{ x: [0, p.x, p.x * 1.15], y: [0, p.y, p.y + p.fall], opacity: [0, 1, 1, 0], rotate: p.rotate }}
          transition={{ duration: 2.3, delay: delay + p.delay, times: [0, 0.3, 1], ease: ["easeOut", "easeIn"] }}
        />
      ))}
    </div>
  );
}

/** A number that counts up from zero, quickly at first and settling at the end. */
export function CountUp({ value, duration = 1.6, delay = 0, className }: { value: number; duration?: number; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <span className={className}>{value}</span>;
  return (
    <motion.span className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay }}>
      <Counter value={value} duration={duration} delay={delay} />
    </motion.span>
  );
}

function Counter({ value, duration, delay }: { value: number; duration: number; delay: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const t = setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now;
        const p = Math.min(1, (now - start) / (duration * 1000));
        setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay * 1000);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [value, duration, delay]);
  return <>{n}</>;
}
