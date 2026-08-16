"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isNativePlatform } from "@/lib/capacitor";

// The native app's WebView loads expandiax.com's root ("/") on open — same
// URL as the public marketing homepage. Logged-out + native is the one case
// that actually means "someone just opened the app for the first time,"
// so that's what routes to /start instead of the marketing page. Once
// they're signed in, middleware already sends "/" to /feed, so this never
// fires again for them. Scoped to native only — the public website keeps
// its existing homepage/sign-up flow untouched.
export function NativeFirstRunRedirect({ isLoggedIn }: { isLoggedIn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isNativePlatform() && !isLoggedIn && pathname === "/") {
      router.replace("/start");
    }
  }, [isLoggedIn, pathname, router]);

  return null;
}
