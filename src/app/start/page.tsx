"use client";

import { useEffect, useState } from "react";
import { ColdOpenStep } from "@/components/start/ColdOpenStep";
import { ForkStep } from "@/components/start/ForkStep";
import { HomeCountryStep } from "@/components/start/HomeCountryStep";
import { CountryGridStep } from "@/components/start/CountryGridStep";
import { loadDraft, saveDraft, stepForDraft, type OnboardingDraft, type OnboardingStep } from "@/lib/onboardingDraft";

const EMPTY_DRAFT: OnboardingDraft = { kind: null, homeCode: null, countryCodes: [] };

// Screen 0, the fork, and Path A only — see onboarding-brief.md §8. Screen 4
// (reveal + real account creation + Supabase writes) is deliberately not
// built yet; finishing Path A here lands on a stub so the flow can still be
// felt end-to-end on a device before that's built.
export default function StartPage() {
  const [step, setStep] = useState<OnboardingStep>("cold-open");
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const loaded = loadDraft();
    setDraft(loaded);
    setStep(stepForDraft(loaded));
    setHydrated(true);
  }, []);

  // Guards against a corrupted/hand-edited sessionStorage draft (step
  // "countries" with no homeCode) rather than crashing on the `!` below.
  useEffect(() => {
    if (hydrated && step === "countries" && !draft.homeCode) setStep("home-country");
  }, [hydrated, step, draft.homeCode]);

  function update(next: Partial<OnboardingDraft>, nextStep: OnboardingStep) {
    const merged = { ...draft, ...next };
    setDraft(merged);
    saveDraft(merged);
    setStep(nextStep);
  }

  if (!hydrated) return null;

  if (finished) {
    const total = draft.countryCodes.length + (draft.homeCode ? 1 : 0);
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="eyebrow">Day one of your archive</p>
        <p className="mt-3 font-serif text-2xl">
          {total} {total === 1 ? "country" : "countries"} pinned.
        </p>
        <p className="mt-3 text-sm text-muted">
          The reveal card and account creation aren&rsquo;t built yet — this stub just proves the flow through here
          feels right first.
        </p>
      </div>
    );
  }

  switch (step) {
    case "cold-open":
      return <ColdOpenStep onStart={() => setStep("fork")} />;
    case "fork":
      return <ForkStep onChoose={(kind) => update({ kind }, kind === "country" ? "home-country" : "fork")} />;
    case "home-country":
      return <HomeCountryStep onDone={(code) => update({ homeCode: code }, "countries")} />;
    case "countries":
      if (!draft.homeCode) return null;
      return (
        <CountryGridStep
          homeCode={draft.homeCode}
          onDone={(codes) => {
            update({ countryCodes: codes }, "countries");
            setFinished(true);
          }}
        />
      );
  }
}
