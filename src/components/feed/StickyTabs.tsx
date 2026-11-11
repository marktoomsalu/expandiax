"use client";

import { useEffect, useState } from "react";

/**
 * Keeps the feed's Following | Explore switch at hand: it rides just under
 * the header, slips away while you scroll down through posts, and comes
 * back the moment you scroll up.
 */
export function StickyTabs({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 120) setHidden(false);
      else if (y > last + 8) setHidden(true);
      else if (y < last - 8) setHidden(false);
      if (Math.abs(y - last) > 8) last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      className="sticky z-30 -mx-5 bg-canvas/85 px-5 py-2 backdrop-blur-md transition-transform duration-300 ease-out"
      style={{ top: "calc(env(safe-area-inset-top) + 57px)", transform: hidden ? "translateY(-140%)" : "translateY(0)" }}
    >
      {children}
    </div>
  );
}
