"use client";

import { useEffect } from "react";
import { hideSplashWhenReady } from "@/lib/splash";

/**
 * Lets the app's launch screen go once the first page has painted with its
 * fonts, and any page that asked to hold it (holdSplash) is ready.
 */
export function NativeSplash() {
  useEffect(() => {
    let alive = true;
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready ?? Promise.resolve();
    // Two frames: pages have mounted (and asked to hold) and painted.
    void fonts.then(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (alive) hideSplashWhenReady();
        })
      )
    );
    return () => {
      alive = false;
    };
  }, []);
  return null;
}
