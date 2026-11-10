import { useSyncExternalStore } from "react";
import { hasGlobeTouch } from "./globeTouch";

const never = () => () => {};

/**
 * Chat ships with the new iPhone build (1.1): it shows only in app builds
 * that have its native code (the same check as World Connect), not in the
 * App Store version before it, and not on the website.
 */
export function useChatEnabled(): boolean {
  return useSyncExternalStore(never, hasGlobeTouch, () => false);
}
