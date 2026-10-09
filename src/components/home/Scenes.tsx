"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll } from "framer-motion";
import { useScrollRange } from "./useScrollRange";
import { WideFilm } from "@/components/film/WatchFilm";

/** The film grows from a card to full width as it scrolls into view. */
export function FilmScene() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.2"] });
  const scale = useScrollRange(scrollYProgress, [0, 1], [0.78, 1]);
  return (
    <motion.div ref={ref} style={reduce ? undefined : { scale }} className="mx-auto max-w-shell">
      <WideFilm />
    </motion.div>
  );
}

const PILLARS = [
  {
    word: "Pin",
    body: "Every country and territory you’ve stood in, on a globe that fills with colour as you go - with the years, the cities and the one memory worth keeping.",
  },
  {
    word: "Remember",
    body: "Concerts, festivals, matches, weddings - with photos, videos, your rating, the song and the moment that stuck.",
  },
  {
    word: "Share",
    body: "A profile that reads like a magazine about your life, and the people who were in the same crowd. Or keep every bit of it private.",
  },
];

/** Three big words, each sliding in beside what it means. */
export function PillarRows() {
  const reduce = useReducedMotion();
  return (
    <ol>
      {PILLARS.map((pl, i) => (
        <li key={pl.word} className="grid gap-5 border-t border-white/10 py-10 md:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.5fr)] md:items-center md:gap-8 md:py-14">
          <span className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/40 text-sm tabular-nums text-white/80 md:flex">
            {i + 1}
          </span>
          <p className="max-w-sm leading-relaxed text-white/75 md:order-none">{pl.body}</p>
          <motion.p
            initial={reduce ? false : { opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-15% 0px" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="order-first font-serif text-[clamp(3.75rem,9vw,8rem)] leading-none md:order-none"
          >
            {i === 1 ? <span className="italic text-accent">{pl.word}</span> : pl.word}
          </motion.p>
        </li>
      ))}
    </ol>
  );
}
