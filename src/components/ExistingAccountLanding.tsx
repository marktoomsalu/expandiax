"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearDraft, clearPendingPhoto, loadDraft } from "@/lib/onboardingDraft";
import { loadKeptWorld, saveKeptWorld } from "@/lib/worldScan";

/**
 * Someone with an account already who came in through "Sign up" (Apple or
 * Google find the account they have): nothing from the first steps is
 * saved into it. What they found or picked waits on the phone, and on My
 * World they choose what to add (WelcomeBackReview), with nothing saved
 * twice and nothing in their account changed.
 */
export function ExistingAccountLanding() {
  const router = useRouter();
  useEffect(() => {
    // Added by hand instead of from photos: the same review, for those too.
    if (!loadKeptWorld()) {
      const draft = loadDraft();
      if (draft.kind === "country" && draft.homeCode) {
        saveKeptWorld({ homeCode: null, trips: [], countries: [draft.homeCode, ...draft.countryCodes] });
      } else if (draft.kind === "event" && draft.memory) {
        const m = draft.memory;
        saveKeptWorld({
          homeCode: null,
          trips: [],
          events: [{ type: m.eventType ?? "concert", title: m.title, artist: m.artist ?? null, venue: m.venue ?? null, city: m.city ?? null, code: m.countryCode, date: m.eventDate, covers: [] }],
        });
      }
    }
    clearDraft();
    void clearPendingPhoto().catch(() => {});
    router.replace("/my-world");
  }, [router]);
  return null;
}
