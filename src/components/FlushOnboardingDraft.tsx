"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { countryByCode } from "@/lib/countries";
import { storagePath } from "@/lib/media";
import { stripImageMetadata } from "@/lib/mediaMetadata";
import { loadDraft, clearDraft, loadPendingPhoto, clearPendingPhoto } from "@/lib/onboardingDraft";

// Picks up a pending /start draft (sessionStorage, plus a photo in
// IndexedDB for Path B — see onboardingDraft.ts) right after signup and
// writes it for real. Nothing from either path touches the database until
// there's an authenticated session to write it under (onboarding-brief.md's
// "soft-gated account creation" principle). Mounted once on /onboarding,
// which every sign-up path already lands on.
export function FlushOnboardingDraft({ userId }: { userId: string }) {
  useEffect(() => {
    const draft = loadDraft();

    if (draft.kind === "country" && draft.homeCode) {
      flushCountries(userId, [draft.homeCode, ...draft.countryCodes]);
    } else if (draft.kind === "event" && draft.memory) {
      flushMemory(userId, draft.memory);
    }
  }, [userId]);

  return null;
}

async function flushCountries(userId: string, codes: string[]) {
  const rows = codes
    .map((code) => countryByCode(code))
    .filter((c): c is NonNullable<ReturnType<typeof countryByCode>> => !!c)
    .map((c) => ({ user_id: userId, country_code: c.code, country_name: c.name }));

  if (rows.length === 0) {
    clearDraft();
    return;
  }

  const supabase = createClient();
  // ignoreDuplicates: harmless to re-run (e.g. a killed tab right after
  // signup) — skips any country already saved instead of erroring.
  await supabase.from("visited_countries").upsert(rows, { onConflict: "user_id,country_code", ignoreDuplicates: true });
  // Best-effort: cleared either way rather than retried indefinitely — on
  // the rare failure, the user can just add countries manually afterward.
  clearDraft();
}

async function flushMemory(userId: string, memory: { title: string; eventDate: string; countryCode: string }) {
  const country = countryByCode(memory.countryCode);
  if (!country) {
    clearDraft();
    return;
  }

  const supabase = createClient();
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      title: memory.title,
      event_date: memory.eventDate,
      country_code: country.code,
      country_name: country.name,
    })
    .select("id")
    .single();

  if (error || !event) {
    // Best-effort, same as the country path — nothing to retry against
    // once the draft's cleared; the user can log the event manually.
    clearDraft();
    await clearPendingPhoto();
    return;
  }

  const rawPhoto = await loadPendingPhoto().catch(() => null);
  if (rawPhoto) {
    // Uploads are served from public URLs — take location/camera data out first.
    const photo = await stripImageMetadata(rawPhoto);
    const path = storagePath(userId, "events", event.id, photo);
    const { error: uploadError } = await supabase.storage.from("media").upload(path, photo);
    if (!uploadError) {
      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
      await supabase.from("event_media").insert({
        event_id: event.id,
        storage_path: path,
        public_url: pub.publicUrl,
        media_type: "image",
        display_order: 0,
      });
    }
  }

  clearDraft();
  await clearPendingPhoto();
}
