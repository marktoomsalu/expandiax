"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CountryGridStep } from "@/components/start/CountryGridStep";
import { countryByCode } from "@/lib/countries";
import { createClient } from "@/lib/supabase/client";
import { tapSuccess } from "@/lib/haptics";

/**
 * Tap every country you've been to, see the map light up, save them all at
 * once. Only adds: a country already on the map stays, and so does anything
 * in it. Back on My World, any badge this earned gets its celebration.
 */
export function LightUpMap({ userId, homeCode, have }: { userId: string; homeCode: string; have: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(selected: string[]) {
    setBusy(true);
    setError(null);
    const already = new Set(have);
    const rows = [homeCode, ...selected]
      .filter((code) => code && !already.has(code))
      .map((code) => countryByCode(code))
      .filter((c): c is NonNullable<ReturnType<typeof countryByCode>> => !!c)
      .map((c) => ({ user_id: userId, country_code: c.code, country_name: c.name }));
    if (rows.length) {
      const { error: err } = await createClient().from("visited_countries").upsert(rows, { onConflict: "user_id,country_code", ignoreDuplicates: true });
      if (err) {
        setError("Couldn't save them just now. Try again?");
        setBusy(false);
        return;
      }
      tapSuccess();
    }
    router.replace("/my-world");
    router.refresh();
  }

  return (
    <>
      <CountryGridStep
        homeCode={homeCode}
        initialSelected={have}
        onDone={(codes) => void save(codes)}
        eyebrow="Light up your map"
        doneLabel={(n) => (busy ? "Saving…" : `Save ${n} ${n === 1 ? "country" : "countries"}`)}
        busy={busy}
      />
      {error && (
        <p role="alert" className="fixed inset-x-0 bottom-24 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm text-canvas">
          {error}
        </p>
      )}
    </>
  );
}
