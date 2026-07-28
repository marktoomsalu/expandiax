"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isNativePlatform } from "@/lib/capacitor";

const CANVAS = { light: "#faf9f6", dark: "#0a0e13" };

export function NativeStatusBar() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!isNativePlatform() || !resolvedTheme) return;
    const dark = resolvedTheme === "dark";
    StatusBar.setBackgroundColor({ color: dark ? CANVAS.dark : CANVAS.light }).catch(() => {});
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  }, [resolvedTheme]);

  return null;
}
