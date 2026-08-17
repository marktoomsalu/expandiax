"use client";

import { useEffect, useState } from "react";
import { ColdOpenStep } from "@/components/start/ColdOpenStep";
import { ForkStep } from "@/components/start/ForkStep";
import { HomeCountryStep } from "@/components/start/HomeCountryStep";
import { CountryGridStep } from "@/components/start/CountryGridStep";
import { MemoryStep } from "@/components/start/MemoryStep";
import { RevealStep } from "@/components/start/RevealStep";
import {
  loadDraft,
  saveDraft,
  savePendingPhoto,
  stepForDraft,
  type OnboardingDraft,
  type OnboardingStep,
} from "@/lib/onboardingDraft";

const EMPTY_DRAFT: OnboardingDraft = { kind: null, homeCode: null, countryCodes: [], memory: null };

// Both paths — see onboarding-brief.md §3 — are real, complete choices: a
// place you've been (Path A) or a night you want to remember (Path B),
// each ending on its own reveal and the same save mechanism.
export default function StartPage() {
  const [step, setStep] = useState<OnboardingStep>("cold-open");
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const [finished, setFinished] = useState(false);
  // Path B's photo never touches sessionStorage (see savePendingPhoto) —
  // this is just a local object URL for the reveal card's own preview.
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

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
    if (draft.kind === "country" && draft.homeCode) {
      return <RevealStep kind="country" homeCode={draft.homeCode} countryCodes={draft.countryCodes} />;
    }
    if (draft.kind === "event" && draft.memory) {
      return <RevealStep kind="event" memory={draft.memory} photoPreviewUrl={photoPreviewUrl} />;
    }
    return null;
  }

  switch (step) {
    case "cold-open":
      return <ColdOpenStep onStart={() => setStep("fork")} />;
    case "fork":
      return <ForkStep onChoose={(kind) => update({ kind }, kind === "country" ? "home-country" : "memory")} />;
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
    case "memory":
      return (
        <MemoryStep
          onDone={(memory, photo) => {
            update({ memory }, "memory");
            if (photo) {
              setPhotoPreviewUrl(URL.createObjectURL(photo));
              savePendingPhoto(photo).catch(() => {
                // Falls back to no photo on save — the memory itself (title/
                // date/country) still saves fine without one.
              });
            }
            setFinished(true);
          }}
        />
      );
  }
}
