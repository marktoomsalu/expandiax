"use client";

import { useEffect } from "react";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isNativePlatform } from "@/lib/capacitor";

// Matches the header's fixed brand-purple background (--brand-purple in
// globals.css) — the header no longer varies with site theme, so neither
// does this: always the dark-background/light-icon style, in both themes.
const BRAND_PURPLE = "#2B0B2E";

export function NativeStatusBar() {
  useEffect(() => {
    if (!isNativePlatform()) return;
    StatusBar.setBackgroundColor({ color: BRAND_PURPLE }).catch(() => {});
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  }, []);

  return null;
}
