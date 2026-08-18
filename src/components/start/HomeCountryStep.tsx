"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CountrySearch } from "@/components/CountrySearch";
import { countryByCode } from "@/lib/countries";
import { tapSuccess } from "@/lib/haptics";
import type { WorldGlobeHandle } from "@/components/WorldGlobeInner";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="h-[280px] w-full sm:h-[380px]" />,
});

// The pin-drop deserves its full beat before advancing — this is the
// flow's first real payoff, costing the user exactly one tap.
const FLY_TO_DELAY_MS = 1200;

export function HomeCountryStep({ onDone }: { onDone: (code: string) => void }) {
  const globeRef = useRef<WorldGlobeHandle>(null);
  const [picked, setPicked] = useState<string | null>(null);

  function handleSelect(code: string) {
    if (picked) return;
    setPicked(code);
    tapSuccess();
    globeRef.current?.flyTo(code);
    window.setTimeout(() => onDone(code), FLY_TO_DELAY_MS);
  }

  const country = picked ? countryByCode(picked) : null;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 pb-16 pt-[calc(4rem+env(safe-area-inset-top))]">
      <p className="eyebrow text-center">Step 2</p>
      <h1 className="mt-2 text-center text-3xl md:text-4xl">Where does your map start?</h1>

      <div className="mt-8 w-full">
        <WorldGlobeInner ref={globeRef} visitedCodes={picked ? [picked] : []} interactive={false} />
      </div>

      <div className="mt-8">
        {picked && country ? (
          <p className="text-center font-serif text-lg">
            {country.flag} {country.name}
          </p>
        ) : (
          <CountrySearch onSelect={handleSelect} placeholder="Search for your home country…" />
        )}
      </div>
    </div>
  );
}
