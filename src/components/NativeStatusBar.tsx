"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isNativePlatform } from "@/lib/capacitor";

// Matches the header's fixed brand-purple background (--brand-purple in
// globals.css).
const BRAND_PURPLE = "#2B0B2E";

/** The colour actually drawn at the very top of the screen: the first element there with a background. */
function topIsLight(): boolean {
  let el = document.elementFromPoint(window.innerWidth / 2, 1) as HTMLElement | null;
  while (el) {
    const style = getComputedStyle(el);
    // Our gradients (onboarding, the cold open) are all deep purple: dark.
    if (style.backgroundImage && style.backgroundImage !== "none") return false;
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(style.backgroundColor);
    if (m && (m[4] === undefined || Number(m[4]) > 0.5)) {
      const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
    }
    el = el.parentElement;
  }
  const body = getComputedStyle(document.body).backgroundColor;
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(body);
  return m ? 0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3]) > 150 : false;
}

/**
 * iPhone: the page draws under the status bar (behind the clock and the
 * Dynamic Island), so the header's purple or the onboarding's gradient runs
 * to the top instead of stopping at a separate strip. Everything at the top
 * already leaves room for it (env(safe-area-inset-top)). The clock and icons
 * are light or dark to suit whatever is drawn behind them, checked as pages
 * and themes change. Android keeps its own status bar (its web view has no
 * safe-area insets to make room with).
 */
export function NativeStatusBar() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isNativePlatform()) return;
    if (Capacitor.getPlatform() !== "ios") {
      StatusBar.setBackgroundColor({ color: BRAND_PURPLE }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      return;
    }
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
    let last: boolean | null = null;
    const check = () => {
      const light = topIsLight();
      if (light === last) return;
      last = light;
      // Style.Light: dark icons (for a light background); Style.Dark: light icons.
      StatusBar.setStyle({ style: light ? Style.Light : Style.Dark }).catch(() => {});
    };
    check();
    // Pages change what's at the top as they go (onboarding steps, the theme, sheets): look again now and then.
    const timer = setInterval(check, 700);
    return () => clearInterval(timer);
  }, [pathname]);

  return null;
}
