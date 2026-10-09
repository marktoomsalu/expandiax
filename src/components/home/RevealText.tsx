"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, type MotionValue } from "framer-motion";
import { useScrollRange } from "./useScrollRange";
import { cn } from "@/lib/utils";

/**
 * Text that lights up word by word as it's scrolled through — faint until
 * your eyes would reach it. `lead` words start lit, as a bold opener.
 */
export function RevealText({
  text,
  lead = 0,
  as: Tag = "p",
  className,
}: {
  text: string;
  lead?: number;
  as?: "p" | "h2" | "h3";
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = text.split(" ");
  const rest = words.length - lead;

  if (reduce) return <Tag className={className}>{text}</Tag>;

  return (
    <Tag ref={ref} className={cn("flex flex-wrap", className)} aria-label={text}>
      {words.map((w, i) => (
        <Word
          key={i}
          progress={scrollYProgress}
          range={i < lead ? null : [(i - lead) / rest, (i - lead + 1) / rest]}
        >
          {w}
        </Word>
      ))}
    </Tag>
  );
}

function Word({ progress, range, children }: { progress: MotionValue<number>; range: [number, number] | null; children: string }) {
  const opacity = useScrollRange(progress, range ?? [0, 1], range ? [0.18, 1] : [1, 1]);
  return (
    <motion.span aria-hidden style={{ opacity }} className="mr-[0.25em]">
      {children}
    </motion.span>
  );
}
