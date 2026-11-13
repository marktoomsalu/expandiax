"use client";

import { useEffect } from "react";

/** Opens the page at its very top (unless the link asked for a section, like #places). */
export function ScrollToTop() {
  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);
  return null;
}
