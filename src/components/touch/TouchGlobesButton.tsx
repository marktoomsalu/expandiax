"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { hasGlobeTouch } from "@/lib/globeTouch";

const never = () => () => {};

/** "Touch globes" on My World: only in iPhone app builds that can do it. */
export function TouchGlobesButton() {
  const can = useSyncExternalStore(never, hasGlobeTouch, () => false);
  if (!can) return null;
  return (
    <Link href="/touch" className="btn-ghost !py-2 text-sm">
      <TwoGlobes /> Touch globes
    </Link>
  );
}

function TwoGlobes() {
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="5.5" cy="8" r="4.5" />
      <circle cx="12.5" cy="8" r="4.5" />
      <path d="M1 8h9M8 8h9" strokeOpacity=".55" />
    </svg>
  );
}
