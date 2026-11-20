"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearDraft, clearPendingPhoto } from "@/lib/onboardingDraft";
import { clearKeptWorld } from "@/lib/worldScan";

/**
 * Someone with an account already who came in through "Sign up" (Apple or
 * Google find the account they have): nothing from the first steps is
 * saved into it, and they go straight to their world. Members add a found
 * world themselves, from My World.
 */
export function ExistingAccountLanding() {
  const router = useRouter();
  useEffect(() => {
    clearKeptWorld();
    clearDraft();
    void clearPendingPhoto().catch(() => {});
    router.replace("/my-world");
  }, [router]);
  return null;
}
