import { useSyncExternalStore } from "react";

const never = () => () => {};
const onAndroid = () => /Android/i.test(navigator.userAgent);

/**
 * Whether this is an Android phone or tablet (the app or a browser) - safe
 * to use while drawing: the server says no, then the page updates without
 * a mismatch.
 */
export function useIsAndroid(): boolean {
  return useSyncExternalStore(never, onAndroid, () => false);
}
