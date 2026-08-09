"use client";

import { useEffect } from "react";
import { isNativePlatform } from "@/lib/capacitor";
import { configureRevenueCat } from "@/lib/revenuecat";

export function NativePurchases({ userId }: { userId: string }) {
  useEffect(() => {
    if (!isNativePlatform()) return;
    configureRevenueCat(userId).catch(() => {
      // Non-fatal — purchasing will just surface a clear error later if
      // this didn't succeed (e.g. missing API key in this environment).
    });
  }, [userId]);

  return null;
}
