"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { TOTAL_COUNTRIES, continentCounts, countryByCode } from "@/lib/countries";
import type { OnboardingMemory } from "@/lib/onboardingDraft";
import { formatDateOrdinal } from "@/lib/utils";
import { eventTypeMeta } from "@/lib/events";
import { startBadges } from "@/lib/startBadges";
import { EarnedBadges } from "./EarnedBadges";

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
      <p className="eyebrow">Day one of your journey</p>
      {props.kind === "country" ? <CountryReveal {...props} /> : <MemoryReveal {...props} />}

      {/* The draft is already sitting in sessionStorage/IndexedDB — signing
          up here just authenticates; FlushOnboardingDraft (mounted on
          /onboarding) picks it up right after and writes it for real. */}
      <Link href="/sign-up" className="btn-accent mt-10 w-full">
        {props.kind === "country" ? "Save my map and badges" : "Save my memory and badges"}
      </Link>

      <p className="mt-5 text-xs text-muted">
        Create your free account to keep them. Free forever - every country, every event, everything.
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
      <h1 className="mt-2 text-3xl md:text-4xl">
        Your world, <span className="italic text-accent">remembered.</span>
      </h1>
      <div className="mt-8 w-full">
        <WorldGlobeInner visitedCodes={allCodes} homeCode={homeCode} interactive={false} />
      </div>
      <p className="mt-6 stat-number">
        {allCodes.length} {allCodes.length === 1 ? "country" : "countries"}
      </p>
      <p className="mt-1 text-sm text-muted">
        {pct}% of the world · {continents} continent{continents === 1 ? "" : "s"}
      </p>
      <EarnedBadges {...startBadges({ countryCodes: allCodes })} />
    </>
  );
}

function MemoryReveal({ memory, photoPreviewUrl }: { memory: OnboardingMemory; photoPreviewUrl: string | null }) {
  const country = countryByCode(memory.countryCode);
  const type = eventTypeMeta(memory.eventType ?? "concert");
  const TypeIcon = type.icon;
  const badges = startBadges({
    countryCodes: [memory.countryCode],
    event: { type: memory.eventType ?? "concert", countryCode: memory.countryCode, date: memory.eventDate, title: memory.title, hasPhoto: !!photoPreviewUrl },
  });
  return (
    <>
      <h1 className="mt-2 text-3xl md:text-4xl">
        Your first <span className="italic text-accent">memory.</span>
      </h1>
      {/* As it'll look as a post. */}
      <div className="relative mt-8 aspect-[4/5] w-full overflow-hidden rounded-3xl bg-brand-purple text-left text-white shadow-xl shadow-black/20">
        {photoPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoPreviewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center font-serif text-7xl opacity-50" aria-hidden>
            {country?.flag}
          </span>
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium ring-1 ring-white/25 backdrop-blur-md">
            <TypeIcon size={13} aria-hidden /> {memory.eventType === "personal" ? "Special occasion" : type.label}
          </span>
          <p className="mt-3 font-serif text-3xl leading-tight drop-shadow-md">{memory.title}</p>
          <p className="mt-1.5 text-sm text-white/85">
            {[memory.venue, memory.city, country ? `${country.flag} ${country.name}` : null].filter(Boolean).join(", ")} · {formatDateOrdinal(memory.eventDate)}
          </p>
        </div>
      </div>
      <EarnedBadges {...badges} />
    </>
  );
}
