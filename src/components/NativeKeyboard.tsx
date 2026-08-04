"use client";

import { useEffect } from "react";
import { Keyboard } from "@capacitor/keyboard";
import { isNativePlatform } from "@/lib/capacitor";

export function NativeKeyboard() {
  useEffect(() => {
    if (!isNativePlatform()) return;
    // Removes iOS's intrusive "Done" toolbar strip above the keyboard,
    // matching how most modern native apps look.
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
  }, []);

  return null;
}
