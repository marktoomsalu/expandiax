"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CountrySearch } from "@/components/CountrySearch";
import { countryByCode } from "@/lib/countries";
import { tapLight, tapSuccess } from "@/lib/haptics";
import { Rise } from "./StepTransition";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="h-[280px] w-full sm:h-[380px]" />,
});

// A tap on the globe only proposes a country — it's easy to hit the wrong
// one — and nothing is pinned until it's confirmed. Tapping another
// country just changes the proposal.
export function HomeCountryStep({ onDone }: { onDone: (code: string) => void }) {
  const [picked, setPicked] = useState<string | null>(null);

  function pick(code: string) {
    if (code === picked) return;
    setPicked(code);
    tapLight();
  }

  function confirm() {
    if (!picked) return;
    tapSuccess();
    onDone(picked);
  }

  const country = picked ? countryByCode(picked) : null;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 pb-16 pt-[calc(4rem+env(safe-area-inset-top))]">
      <p className="eyebrow text-center">Step 2</p>
      <h1 className="mt-2 text-center text-3xl md:text-4xl">Where do you call home?</h1>
      <p className="mt-2 text-center text-sm text-muted">The country you live in - it&rsquo;s the first pin on your map.</p>

      <div className="mt-6 w-full">
        <WorldGlobeInner focusCode={picked} visitedCodes={picked ? [picked] : []} homeCode={picked} interactive onSelect={pick} />
      </div>

      <div className="mt-6 min-h-[9.5rem]">
        {picked && country ? (
          <Rise key={picked} delay={-0.15} className="text-center">
            <p className="font-serif text-2xl">
              {country.flag} {country.name}
            </p>
            <button type="button" onClick={confirm} className="btn-accent mt-5 w-full">
              Yes, this is home
            </button>
            <button type="button" onClick={() => setPicked(null)} className="mt-3 text-sm text-muted hover:text-ink">
              Choose a different country
            </button>
          </Rise>
        ) : (
          <CountrySearch onSelect={pick} placeholder="Search for your home country…" />
        )}
      </div>
    </div>
  );
}
