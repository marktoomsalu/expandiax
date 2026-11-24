"use client";

import { useEffect, useState } from "react";
import { ColdOpenStep } from "@/components/start/ColdOpenStep";
import { ForkStep } from "@/components/start/ForkStep";
import { HomeCountryStep } from "@/components/start/HomeCountryStep";
import { CountryGridStep } from "@/components/start/CountryGridStep";
import { MemoryStep } from "@/components/start/MemoryStep";
import { RevealStep } from "@/components/start/RevealStep";
import { motion } from "framer-motion";
import { WorldScanFlow } from "@/components/worldScan/WorldScanFlow";
import { preloadInviteWall } from "@/components/worldScan/InviteHero";
import { canScanPhotos } from "@/lib/photoScan";
import { saveKeptWorld } from "@/lib/worldScan";
import { BackButton, StepTransition } from "@/components/start/StepTransition";
import {
  clearPendingPhoto,
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
  const [photo, setPhoto] = useState<File | null>(null);
  // iPhone app build 12 and later: the world is found in their photos first.
  const [scanning, setScanning] = useState(false);
  // "Start my journey" in the app: the globe screen leaves first (flying into the globe), then the photo wall arrives.
  const [leaving, setLeaving] = useState(false);

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

  if (scanning) {
    return (
      <>
        {/* The globe screen's purple, held underneath while the wall fades in: no flash between the two. */}
        <div aria-hidden className="fixed inset-0 z-[79] bg-brand-purple" />
        {/* The moment the globe becomes the photos: a soft pink flash from where it was. */}
        <motion.div
          aria-hidden
          className="pointer-events-none fixed left-1/2 top-[38%] z-[81] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(255,179,214,0.9)_0%,rgba(250,81,162,0.45)_35%,transparent_70%)]"
          style={{ x: "-50%", y: "-50%" }}
          initial={{ scale: 0.2, opacity: 1 }}
          animate={{ scale: 5, opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <WorldScanFlow
            mode="new"
            onManual={() => {
              setScanning(false);
              setLeaving(false);
              setStep("fork");
            }}
            onKeep={(world) => saveKeptWorld(world)}
          />
        </motion.div>
      </>
    );
  }

  // Every step after the first can go back one — choices made so far are
  // kept when going back from the reveal, dropped when going back further.
  let screen: React.ReactNode = null;
  let back: (() => void) | null = null;

  if (finished) {
    back = () => setFinished(false);
    if (draft.kind === "country" && draft.homeCode) {
      screen = <RevealStep kind="country" homeCode={draft.homeCode} countryCodes={draft.countryCodes} />;
    } else if (draft.kind === "event" && draft.memory) {
      screen = <RevealStep kind="event" memory={draft.memory} photoPreviewUrl={photoPreviewUrl} />;
    }
  } else {
    switch (step) {
      case "cold-open":
        screen = (
          <ColdOpenStep
            leaving={leaving}
            // The wall's photos load while the globe turns, so they're there when it arrives.
            onGlobeReady={() => {
              if (canScanPhotos()) preloadInviteWall();
            }}
            onStart={() => {
              if (!canScanPhotos()) return setStep("fork");
              if (leaving) return;
              setLeaving(true);
              preloadInviteWall();
              setTimeout(() => setScanning(true), 420);
            }}
          />
        );
        break;
      case "fork":
        back = () => setStep("cold-open");
        screen = <ForkStep onChoose={(kind) => update({ kind }, kind === "country" ? "home-country" : "memory")} />;
        break;
      case "home-country":
        back = () => update({ kind: null, homeCode: null }, "fork");
        screen = <HomeCountryStep onDone={(code) => update({ homeCode: code }, "countries")} />;
        break;
      case "countries":
        if (!draft.homeCode) break;
        back = () => update({ homeCode: null, countryCodes: [] }, "home-country");
        screen = (
          <CountryGridStep
            homeCode={draft.homeCode}
            initialSelected={draft.countryCodes}
            onDone={(codes) => {
              update({ countryCodes: codes }, "countries");
              setFinished(true);
            }}
          />
        );
        break;
      case "memory":
        back = () => update({ kind: null, memory: null }, "fork");
        screen = (
          <MemoryStep
            initial={draft.memory}
            initialPhoto={photo}
            onDone={(memory, picked) => {
              update({ memory }, "memory");
              setPhoto(picked);
              if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
              setPhotoPreviewUrl(picked ? URL.createObjectURL(picked) : null);
              if (picked) {
                savePendingPhoto(picked).catch(() => {
                  // Falls back to no photo on save — the memory itself (title/
                  // date/country) still saves fine without one.
                });
              } else {
                clearPendingPhoto().catch(() => {});
              }
              setFinished(true);
            }}
          />
        );
        break;
    }
  }

  return (
    <StepTransition stepKey={finished ? "reveal" : step}>
      {back && <BackButton onClick={back} />}
      {screen}
    </StepTransition>
  );
}
