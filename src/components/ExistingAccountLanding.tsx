"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearDraft, clearPendingPhoto } from "@/lib/onboardingDraft";
import { clearKeptWorld, loadKeptWorld } from "@/lib/worldScan";
import { canScanPhotos } from "@/lib/photoScan";

/**
 * Someone with an account already who came in through "Sign up" (Apple or
 * Google find the account they have): nothing from the first steps is
 * saved into it. If they'd just found their world in their photos, it's
 * straight on to Discover my world, which shows only what isn't in their
 * account yet to pick from (nothing saved twice, nothing changed without
 * them); otherwise to their world.
 */
export function ExistingAccountLanding() {
  const router = useRouter();
  useEffect(() => {
    const found = !!loadKeptWorld() && canScanPhotos();
    clearKeptWorld();
    clearDraft();
    void clearPendingPhoto().catch(() => {});
    router.replace(found ? "/my-world/find-trips" : "/my-world");
  }, [router]);
  return null;
}
