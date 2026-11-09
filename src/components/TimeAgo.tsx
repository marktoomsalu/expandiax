"use client";

import { useEffect, useState } from "react";
import { formatRelative } from "@/lib/utils";

/**
 * "8m ago" that can't break the page. The server writes it a moment before
 * the phone takes over, and by then it may already read "9m ago" - a
 * mismatch React treats as an error and answers by redrawing the whole
 * page (where a React bug can then crash it: Sentry's "Unknown root exit
 * status"). So the first text is kept as the server wrote it, and it
 * updates itself every minute after that.
 */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {formatRelative(iso)}
    </time>
  );
}
