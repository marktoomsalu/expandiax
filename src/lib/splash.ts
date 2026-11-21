// The iPhone app's launch screen (the logo) stays up until the first screen
// is really ready, then fades into it: no blank or half-drawn screen between.
// A page that needs more than its first paint (a globe, say) holds it with
// holdSplash() and lets go when it's ready. The app hides it by itself after
// 10 seconds whatever happens (capacitor.config.ts), so it can't get stuck.

import { SplashScreen } from "@capacitor/splash-screen";
import { isNativePlatform } from "./capacitor";

let holds = 0;
let hidden = false;
let waiting: (() => void) | null = null;

/** Keep the launch screen up until the returned function is called (or 6 s pass). */
export function holdSplash(): () => void {
  if (hidden) return () => {};
  holds += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    holds -= 1;
    if (holds <= 0) waiting?.();
  };
  setTimeout(release, 6000);
  return release;
}

/** Fade the launch screen out once nothing holds it. */
export function hideSplashWhenReady() {
  if (hidden || !isNativePlatform()) return;
  const go = () => {
    if (hidden) return;
    hidden = true;
    waiting = null;
    // One more frame so what's underneath is painted when it fades.
    requestAnimationFrame(() => void SplashScreen.hide({ fadeOutDuration: 350 }).catch(() => {}));
  };
  if (holds <= 0) go();
  else waiting = go;
}
