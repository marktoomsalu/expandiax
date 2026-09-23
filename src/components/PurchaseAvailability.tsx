"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { isNativePlatform } from "@/lib/capacitor";
import { NATIVE_IAP_LIVE } from "@/lib/nativeApp";

const CanSellPremium = createContext(true);

// The server decides from the app's user-agent marker (see nativeApp.ts),
// so the first render already matches. The Capacitor check after mount is
// a backstop for an app build that somehow lacks the marker.
export function PurchaseAvailabilityProvider({ canSell, children }: { canSell: boolean; children: React.ReactNode }) {
  const [value, setValue] = useState(canSell);
  useEffect(() => {
    if (!NATIVE_IAP_LIVE && isNativePlatform()) setValue(false);
  }, []);
  return <CanSellPremium.Provider value={value}>{children}</CanSellPremium.Provider>;
}

export function useCanSellPremium(): boolean {
  return useContext(CanSellPremium);
}
