"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Earth } from "lucide-react";
import { hasGlobeTouch } from "@/lib/globeTouch";

const never = () => () => {};

/** The id the first-time World Connect card points its spotlight at. */
export const WORLD_CONNECT_BUTTON_ID = "world-connect-button";

/** World Connect, in the header next to notifications: only in iPhone app builds that can do it. */
export function WorldConnectButton() {
  const can = useSyncExternalStore(never, hasGlobeTouch, () => false);
  if (!can) return null;
  return (
    <Link
      id={WORLD_CONNECT_BUTTON_ID}
      href="/touch"
      aria-label="World Connect"
      className="flex h-11 w-11 items-center justify-center text-white/70 hover:text-white"
    >
      <Earth size={21} />
    </Link>
  );
}
