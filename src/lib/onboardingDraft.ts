// Scoped to the current build slice — Screen 0, the fork, and Path A only
// (see onboarding-brief.md, §8). "memory" (Path B's draft shape) is added
// when that path gets built, not stubbed in ahead of time.
export type OnboardingStep = "cold-open" | "fork" | "home-country" | "countries";

export type OnboardingDraft = {
  kind: "country" | "event" | null;
  homeCode: string | null;
  countryCodes: string[];
};

const STORAGE_KEY = "expandiax:onboarding-draft";

const EMPTY_DRAFT: OnboardingDraft = { kind: null, homeCode: null, countryCodes: [] };

export function loadDraft(): OnboardingDraft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    return { ...EMPTY_DRAFT, ...JSON.parse(raw) };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveDraft(draft: OnboardingDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage full/unavailable — the flow still works, just isn't resumable.
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

// Resuming mid-flow (killed tab, closed app) should land back on the step
// that matches what's actually in the draft, not always Screen 0 — e.g. a
// draft with `kind` already set but no countryCodes yet resumes on the
// relevant path's first step, not the fork again.
export function stepForDraft(draft: OnboardingDraft): OnboardingStep {
  if (!draft.kind) return "cold-open";
  if (draft.kind === "country") return draft.homeCode ? "countries" : "home-country";
  return "fork"; // "event" (Path B) isn't built yet — fall back rather than dead-end.
}
