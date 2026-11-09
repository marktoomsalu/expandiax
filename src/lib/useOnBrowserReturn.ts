import { useEffect, useRef } from "react";
import { Browser } from "@capacitor/browser";
import { isNativePlatform } from "./capacitor";

/**
 * Runs `reset` when someone comes back without finishing a sign-in: in the
 * app, when the in-app browser (Custom Tab / Safari view) is closed; on the
 * web, when the page is shown again from the back button. Without it the
 * sign-in buttons stayed on "Redirecting..." and couldn't be tapped again.
 */
export function useOnBrowserReturn(reset: () => void) {
  const latest = useRef(reset);
  latest.current = reset;
  useEffect(() => {
    const run = () => latest.current();
    let handle: { remove: () => Promise<void> } | undefined;
    if (isNativePlatform()) {
      Browser.addListener("browserFinished", run)
        .then((h) => (handle = h))
        .catch(() => {});
    }
    window.addEventListener("pageshow", run);
    return () => {
      void handle?.remove();
      window.removeEventListener("pageshow", run);
    };
  }, []);
}
