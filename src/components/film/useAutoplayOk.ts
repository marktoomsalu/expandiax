"use client";

import { useEffect, useState } from "react";

/**
 * Whether it's OK to start video by itself: not for people who asked their
 * device for reduced motion, or to save data. null until known (server
 * render), so nothing autoplays before we've checked.
 */
export function useAutoplayOk(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ?? false;
    setOk(!reduced && !saveData);
  }, []);
  return ok;
}
