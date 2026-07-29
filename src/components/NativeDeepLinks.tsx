"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { isNativePlatform } from "@/lib/capacitor";

export function NativeDeepLinks() {
  useEffect(() => {
    if (!isNativePlatform()) return;
    const listener = App.addListener("appUrlOpen", ({ url }) => {
      window.location.href = url;
    });
    return () => {
      listener.then((l) => l.remove());
    };
  }, []);

  return null;
}
