"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { TOTAL_COUNTRIES, continentCounts, countryByCode } from "@/lib/countries";
import { COUNTRY_CAP, EVENT_CAP } from "@/lib/plan";
import type { OnboardingMemory } from "@/lib/onboardingDraft";

const WorldGlobeInner = dynamic(() => import("@/components/WorldGlobeInner").then((m) => m.WorldGlobeInner), {
  ssr: false,
  loading: () => <div className="h-[280px] w-full sm:h-[380px]" />,
});

type Props =
  | { kind: "country"; homeCode: string; countryCodes: string[] }
  | { kind: "event"; memory: OnboardingMemory; photoPreviewUrl: string | null };

// Content branches by path — a "0 of 195 countries" stat on Path B's card
// would read as broken, not honest, since that path never collects any.
// Both still converge on the same save mechanism below.
export function RevealStep(props: Props) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 pb-16 pt-[calc(4rem+env(safe-area-inset-top))] text-center">
      <p className="eyebrow">Day one of your archive</p>
      {props.kind === "country" ? <CountryReveal {...props} /> : <MemoryReveal {...props} />}

      {/* The draft is already sitting in sessionStorage/IndexedDB — signing
          up here just authenticates; FlushOnboardingDraft (mounted on
          /onboarding) picks it up right after and writes it for real. */}
      <Link href="/sign-up" className="btn-accent mt-10 w-full">
        Save my world
      </Link>

      <p className="mt-5 text-xs text-muted">
        Free forever up to {COUNTRY_CAP.free} countries and {EVENT_CAP.free} events.
      </p>
    </div>
  );
}

function CountryReveal({ homeCode, countryCodes }: { homeCode: string; countryCodes: string[] }) {
  const allCodes = [homeCode, ...countryCodes];
  const pct = Math.round((allCodes.length / TOTAL_COUNTRIES) * 1000) / 10;
  const continents = continentCounts(allCodes).filter((c) => c.visited > 0).length;

  return (
    <>
      <h1 className="mt-2 text-3xl md:text-4xl">Your world, pinned.</h1>
      <div className="mt-8 w-full">
        <WorldGlobeInner visitedCodes={allCodes} homeCode={homeCode} interactive={false} />
      </div>
      <p className="mt-6 stat-number">
        {allCodes.length} {allCodes.length === 1 ? "country" : "countries"}
      </p>
      <p className="mt-1 text-sm text-muted">
        {pct}% of the world · {continents} continent{continents === 1 ? "" : "s"}
      </p>
    </>
  );
}

function MemoryReveal({ memory, photoPreviewUrl }: { memory: OnboardingMemory; photoPreviewUrl: string | null }) {
  const country = countryByCode(memory.countryCode);
  return (
    <>
      <h1 className="mt-2 text-3xl md:text-4xl">Your first memory, kept.</h1>
      <div className="mt-8 w-full overflow-hidden rounded-card border border-line bg-surface">
        {photoPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoPreviewUrl} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center">
            <span className="font-serif text-5xl opacity-60" aria-hidden>{country?.flag}</span>
          </div>
        )}
        <div className="px-5 py-4 text-left">
          <p className="font-serif text-lg">{memory.title}</p>
          <p className="mt-1 text-sm text-muted">
            {country ? `${country.flag} ${country.name}` : null} · {memory.eventDate}
          </p>
        </div>
      </div>
    </>
  );
}
