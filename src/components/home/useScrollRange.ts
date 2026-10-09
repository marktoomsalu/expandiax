"use client";

import { transform, useTransform, type MotionValue } from "framer-motion";

/**
 * useTransform(progress, input, output), computed in JS on every scroll.
 * Framer Motion otherwise hands scroll-linked opacity to the browser's
 * native ScrollTimeline, which mapped these ranges wrongly (a headline
 * faded out, then back in, as the scroll went on).
 */
export function useScrollRange(progress: MotionValue<number>, input: number[], output: number[]): MotionValue<number> {
  return useTransform(progress, (v) => transform(v, input, output));
}
