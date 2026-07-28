"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { isNativePlatform } from "@/lib/capacitor";

export function NativeBackButton() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativePlatform()) return;
    const listener = App.addListener("backButton", () => {
      if (window.history.length > 1) {
        router.back();
      } else {
        App.minimizeApp();
      }
    });
    return () => {
      listener.then((l) => l.remove());
    };
  }, [router]);

  return null;
}
