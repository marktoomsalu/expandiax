import { useSyncExternalStore } from "react";
import { isNativePlatform } from "./capacitor";

const never = () => () => {};

/**
 * Whether we're inside the iPhone/Android app - safe to use while drawing.
 * Calling isNativePlatform() directly during a render gives the server
 * "no" and the app "yes", and that mismatch makes React redraw the page.
 */
export function useIsNative(): boolean {
  return useSyncExternalStore(never, isNativePlatform, () => false);
}
